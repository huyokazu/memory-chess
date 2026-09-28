import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';

// Production Web is served by Express on the same origin as Socket.IO/API.
// Native builds still set EXPO_PUBLIC_API_URL to the public HTTPS backend.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' && !__DEV__ ? globalThis.location?.origin : null) || 'http://localhost:3001';
const SessionContext = createContext(null);
const TOKEN_KEY = 'memory-chess-token';

const storage = {
  get: () => Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(TOKEN_KEY)) : SecureStore.getItemAsync(TOKEN_KEY),
  set: (value) => Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(TOKEN_KEY, value)) : SecureStore.setItemAsync(TOKEN_KEY, value),
  remove: () => Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(TOKEN_KEY)) : SecureStore.deleteItemAsync(TOKEN_KEY),
};

export async function request(path, { token, body, method = 'GET' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || 'Không thể xử lý yêu cầu.');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Không kết nối được server. Kiểm tra địa chỉ API và mạng.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function SessionProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [boardEvents, setBoardEvents] = useState([]);
  const boardSequence = useRef(0);
  const [queue, setQueue] = useState(null);
  const [notice, setNotice] = useState('');
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  roomRef.current = room;
  const clockRef = useRef({ offset: 0 });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const saved = await storage.get();
        if (saved) {
          const data = await request('/api/me', { token: saved });
          if (live) { setUser(data.user); setToken(saved); }
        }
      } catch (error) {
        if (error.status === 401) await storage.remove();
        if (live) setNotice(error.message);
      } finally { if (live) setReady(true); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { auth: { token }, autoConnect: false, reconnection: true });
    let invalidSession = false;
    socketRef.current = socket;
    const clearSession = (message) => {
      invalidSession = true;
      void storage.remove();
      setUser(null); setToken(null); setRoom(null); setQueue(null); setNotice(message);
    };
    const state = (next) => {
      clockRef.current.offset = next.serverNow - Date.now();
      const event = { ...next, sequence: ++boardSequence.current };
      // Retain every state packet even if React batches a move and a fast reply.
      setBoardEvents((current) => current.at(-1)?.id === next.id ? [...current, event].slice(-256) : [event]);
      setRoom(next); setQueue(null);
    };
    socket.on('connect', () => { setConnected(true); setNotice(''); });
    socket.on('disconnect', (reason) => {
      setConnected(false); setQueue(null);
      if (!invalidSession && reason !== 'io client disconnect') setNotice('Mất kết nối. Đồng hồ vẫn chạy; ứng dụng đang kết nối lại.');
    });
    socket.on('connect_error', (error) => {
      setConnected(false);
      if (error.data?.code === 'UNAUTHORIZED') clearSession('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      else setNotice('Chưa kết nối được server. Đang thử lại…');
    });
    socket.on('session:replaced', () => clearSession('Tài khoản đã được mở trên thiết bị khác. Hãy đăng nhập lại để tiếp tục tại đây.'));
    socket.on('profile', setUser);
    socket.on('queue:state', (value) => setQueue(value.searching ? value : null));
    socket.on('game:state', state);
    socket.on('game:over', state);
    socket.on('game:clock', (clock) => {
      if (roomRef.current?.id !== clock.roomId) return;
      clockRef.current.offset = clock.serverNow - Date.now();
      setRoom((current) => current && current.id === clock.roomId ? { ...current, deadline: clock.deadline, turn: clock.turn } : current);
    });
    socket.on('room:closed', () => { setRoom(null); setNotice('Phòng đã đóng hoặc hết hạn.'); });
    socket.on('room:failed', () => { setRoom(null); setQueue(null); setNotice('Không thể bắt đầu trận. Vui lòng thử lại.'); });
    socket.connect();
    const subscription = AppState.addEventListener('change', (value) => {
      if (value !== 'active') return;
      socket.connect();
      if (socket.connected && roomRef.current) {
        socket.timeout(6000).emit('game:sync', { roomId: roomRef.current.id }, (error, response) => {
          if (!error && response?.ok) state(response.data);
        });
      }
    });
    return () => { subscription.remove(); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [token]);

  async function login(username, password, register) {
    const data = await request(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: { username, password } });
    await storage.set(data.token);
    setUser(data.user); setToken(data.token); setNotice('');
  }

  async function logout() {
    socketRef.current?.disconnect();
    await storage.remove();
    setToken(null); setUser(null); setRoom(null); setQueue(null); setConnected(false); setNotice('');
  }

  const send = useCallback((event, payload = {}) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error('Chưa kết nối với server.'));
      socket.timeout(15_000).emit(event, payload, (error, response) => {
        if (error) return reject(new Error('Server chưa phản hồi. Trạng thái sẽ được đồng bộ lại khi có kết nối.'));
        if (!response?.ok) return reject(new Error(response?.error?.message || 'Thao tác không thành công.'));
        resolve(response.data);
      });
    });
  }, []);

  return <SessionContext.Provider value={{ user, token, ready, connected, room, boardEvents, queue, notice, setNotice, setRoom, login, logout, send, clockRef }}>
    {children}
  </SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
