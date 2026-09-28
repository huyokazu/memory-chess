import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SessionProvider, useSession, request } from './src/session';
import { colors, ui, Button, Input, Pill, mono } from './src/theme';
import MainMenuScreen from './src/screens/MainMenuScreen';
import Piece from './src/components/Piece';
import ChessBoardScreen from './src/screens/ChessBoardScreen';

function Wordmark({ compact = false }) {
  return <View style={ui.row}>
    <View style={{ width: 37, height: 37, backgroundColor: colors.accent, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}><Piece type="n" color="b" size={31} /></View>
    {!compact && <Text style={{ color: colors.text, fontWeight: '700', fontSize: 19, letterSpacing: -0.5 }}>memory<Text style={{ color: colors.accent }}>chess</Text><Text style={{ color: colors.muted, fontSize: 12 }}> /</Text></Text>}
  </View>;
}

function AuthScreen() {
  const { login } = useSession();
  const { width } = useWindowDimensions();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wide = width >= 850;
  async function submit() {
    setBusy(true); setError('');
    try { await login(username.trim(), password, register); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: wide ? 48 : 24 }}>
      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', flex: 1 }}>
        <Wordmark />
        <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: wide ? 90 : 36, paddingVertical: 48 }}>
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 24 }}>
            <Pill active>CHESS, BEYOND SIGHT.</Pill>
            <Text style={{ fontSize: wide ? 62 : 43, lineHeight: wide ? 68 : 49, letterSpacing: -2.5, color: colors.text, fontWeight: '700' }}>Nhớ bàn cờ.{ '\n' }<Text style={{ color: colors.accent }}>Làm chủ{ '\n' }ván đấu.</Text></Text>
            <Text style={[ui.muted, { maxWidth: 400, fontSize: 17, lineHeight: 28 }]}>Không còn nhìn. Chỉ còn ghi nhớ.{ '\n' }Thử thách trí nhớ qua từng nước cờ, cùng đối thủ thực và một phút để quyết định.</Text>
            <View style={[ui.row, { gap: 24, paddingTop: 10 }]}>{[['02', 'CHẾ ĐỘ MEMORY'], ['60s', 'MỖI NƯỚC ĐI'], ['∞', 'KHẢ NĂNG']].map(([value, label]) => <View key={label} style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 28, fontFamily: mono }}>{value}</Text><Text style={[ui.label, { fontSize: 9, letterSpacing: 1 }]}>{label}</Text></View>)}</View>
          </View>
          <View style={[ui.card, { width: wide ? 390 : '100%', maxWidth: 480, padding: 30, gap: 22 }]}>
            <View style={{ gap: 8 }}><Text style={ui.title}>{register ? 'Bắt đầu hành trình.' : 'Chào mừng trở lại.'}</Text><Text style={ui.muted}>{register ? 'Tạo tài khoản và bắt đầu với 1.200 Elo.' : 'Bàn cờ tiếp theo đang chờ bạn.'}</Text></View>
            <View style={{ flexDirection: 'row', backgroundColor: colors.bg, padding: 4, borderRadius: 10 }}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: register === value }} onPress={() => { setRegister(value); setError(''); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 7, backgroundColor: register === value ? colors.panelAlt : 'transparent' }}><Text style={{ fontWeight: '600', color: register === value ? colors.text : colors.muted }}>{value ? 'Tạo tài khoản' : 'Đăng nhập'}</Text></Pressable>)}</View>
            <Input label="Tên đăng nhập" placeholder="chess_player" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={24} />
            <Input label="Mật khẩu" placeholder="Ít nhất 8 ký tự" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} onSubmitEditing={submit} />
            {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text> : null}
            <Button loading={busy} disabled={!username || !password} onPress={submit}>{register ? 'Tạo tài khoản →' : 'Vào sảnh đấu →'}</Button>
            <Text style={[ui.muted, { textAlign: 'center', fontSize: 12 }]}>Một tài khoản. Web, iOS và Android.{ '\n' }Chỉ Memory Chess. Không có chế độ thường.</Text>
          </View>
        </View>
        <Text style={[ui.label, { fontSize: 10, letterSpacing: 1.2 }]}>MEMORY CHESS · RÈN TRÍ NHỚ QUA TỪNG NƯỚC ĐI</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}


function Records({ type }) {
  const { token, user } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true; setData(null); setError('');
    request(`/api/${type === 'leaderboard' ? 'leaderboard' : 'matches'}`, { token }).then((result) => { if (live) setData(result); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [type, token, version]);
  return <ScrollView contentContainerStyle={{ padding: 24 }}><View style={{ maxWidth: 850, width: '100%', alignSelf: 'center', gap: 20, paddingTop: 20 }}>
    <Text style={ui.label}>{type === 'leaderboard' ? 'NHỮNG TRÍ NHỚ XUẤT SẮC' : 'MỖI VÁN ĐẤU LÀ MỘT BÀI HỌC'}</Text>
    <Text style={ui.title}>{type === 'leaderboard' ? 'Bảng xếp hạng' : 'Lịch sử của bạn'}</Text>
    <Text style={ui.muted}>{type === 'leaderboard' ? '30 người chơi có Elo cao nhất.' : '20 ván gần nhất. Các ván bot không làm thay đổi Elo.'}</Text>
    {!data && !error && <ActivityIndicator color={colors.accent} />}
    {error ? <><Text style={{ color: colors.danger }}>{error}</Text><Button onPress={() => setVersion(version + 1)}>Thử lại</Button></> : null}
    {data?.users?.map((player, index) => <View key={player.id} style={[ui.card, ui.row, { padding: 18, borderColor: player.id === user.id ? colors.accent : colors.border }]}><Text style={{ width: 35, color: index < 3 ? colors.accent : colors.muted, fontFamily: mono, fontSize: 20 }}>{String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1, gap: 3 }}><Text style={ui.text}>{player.username}{player.id === user.id ? ' · Bạn' : ''}</Text><Text style={[ui.muted, { fontSize: 12 }]}>{player.wins} thắng · {player.losses} thua · {player.draws} hòa</Text></View><Text style={{ color: colors.accent, fontFamily: mono, fontSize: 22 }}>{player.elo}</Text></View>)}
    {data?.matches?.length === 0 && <View style={ui.card}><Text style={ui.text}>Chưa có ván đấu nào.</Text><Text style={ui.muted}>Bắt đầu ở sảnh đấu để viết nước đi đầu tiên của bạn.</Text></View>}
    {data?.matches?.map((match) => {
      const color = match.white.id === user.id ? 'w' : 'b';
      const opponent = color === 'w' ? match.black : match.white;
      const delta = match.ratingChanges?.[color]?.delta;
      return <View key={match._id} style={[ui.card, { padding: 18, gap: 10 }]}><View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.text}>vs. {opponent.username}</Text><Text style={{ color: match.winner === color ? colors.accent : colors.muted, fontWeight: '700' }}>{match.status === 'aborted' ? 'ĐÃ HỦY' : match.winner === null ? 'HÒA' : match.winner === color ? 'THẮNG' : 'THUA'}</Text></View><Text style={[ui.muted, { fontSize: 12 }]}>{match.mode === 'peeks' ? 'Strategic Peeks' : 'Hardcore Memory'} · {new Date(match.createdAt).toLocaleDateString('vi-VN')} · {delta !== undefined ? `${delta >= 0 ? '+' : ''}${delta} Elo` : match.rated && match.ratingStatus === 'pending' ? 'Đang tính điểm' : 'Không tính điểm'}</Text></View>;
    })}
  </View></ScrollView>;
}

function Shell() {
  const { user, ready, connected, room, queue, notice, setNotice, setRoom, logout, send } = useSession();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState('play');
  const [inviteCode, setInviteCode] = useState('');
  const [dismissedRoom, setDismissedRoom] = useState(null);
  const showingGame = room && room.id !== dismissedRoom;
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    const value = Linking.parse(url).queryParams?.room;
    if (typeof value === 'string' && /^\d{6}$/.test(value)) { setInviteCode(value); setPage('play'); }
  }, [url]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showingGame && room.status !== 'finished') {
        setNotice('Ván đang chơi. Dùng nút đầu hàng hoặc đóng phòng để rời.'); return true;
      }
      if (showingGame) { setDismissedRoom(room.id); setPage('play'); return true; }
      if (page !== 'play') { setPage('play'); return true; }
      return false;
    });
    return () => listener.remove();
  }, [showingGame, room, page]);
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} size="large" /></View>;
  async function home() {
    try { await send('room:leave', { roomId: room.id }); setDismissedRoom(room.id); setRoom(null); setPage('play'); }
    catch (error) { setNotice(error.message); }
  }
  const activeGame = showingGame && room.status !== 'finished';
  return <>
    {notice ? <Pressable onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Đóng thông báo" style={{ backgroundColor: '#393126', paddingHorizontal: 24, paddingVertical: 10 }}><Text style={{ color: colors.accent, fontSize: 13, lineHeight: 20 }}>{notice}  ×</Text></Pressable> : null}
    {!user ? <AuthScreen /> : <>
      <View style={{ paddingHorizontal: width > 700 ? 36 : 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={[ui.row, { maxWidth: 1160, width: '100%', alignSelf: 'center', justifyContent: 'space-between' }]}>
          <Wordmark compact={width < 400} />
          {width >= 800 && <View style={[ui.row, { gap: 26 }]}>{[['play', 'Sảnh đấu'], ['leaderboard', 'Xếp hạng'], ['history', 'Lịch sử']].map(([id, text]) => <Pressable key={id} disabled={activeGame} onPress={() => { setPage(id); if (room?.status === 'finished') setDismissedRoom(room.id); }} accessibilityRole="tab" accessibilityState={{ selected: page === id, disabled: activeGame }}><Text style={{ color: page === id ? colors.accent : colors.muted, fontSize: 14, fontWeight: '600' }}>{text}</Text></Pressable>)}</View>}
          <View style={[ui.row, { gap: 10 }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? colors.accent : colors.danger }} />
            <View><Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{user.username}</Text><Text style={{ color: colors.accent, fontSize: 11 }}>{user.elo} Elo</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" disabled={activeGame || Boolean(queue)} onPress={logout} style={{ padding: 8, opacity: activeGame || queue ? 0.3 : 1 }}><Text style={{ color: colors.muted, fontSize: 18 }}>↪</Text></Pressable>
          </View>
        </View>
      </View>
      {showingGame ? <ChessBoardScreen key={room.id} onHome={home} /> : page === 'play' ? <MainMenuScreen inviteCode={inviteCode} /> : <Records type={page} />}
      {width < 800 && !showingGame && <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel }}>{[['play', 'Sảnh đấu'], ['leaderboard', 'Xếp hạng'], ['history', 'Lịch sử']].map(([id, text]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: page === id }} onPress={() => setPage(id)} style={{ flex: 1, paddingVertical: 18, alignItems: 'center', borderTopWidth: 2, borderTopColor: page === id ? colors.accent : 'transparent' }}><Text style={{ color: page === id ? colors.accent : colors.muted, fontSize: 12, fontWeight: '600' }}>{text}</Text></Pressable>)}</View>}
    </>}
  </>;
}

export default function App() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><StatusBar style="light" /><SessionProvider><Shell /></SessionProvider></SafeAreaView></SafeAreaProvider>;
}
