import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, Modal, Pressable, Share, Platform } from 'react-native';
import { Chess } from 'chess.js';
import { useSession } from '../session';
import { Button, Pill, colors, ui, mono } from '../theme';
import ChessBoard from '../components/ChessBoard';
import Piece from '../components/Piece';
import { memoryVisibility } from '../memoryVisibility';
import useBoardPlayback from '../hooks/useBoardPlayback';
import LastMoveCard from '../components/LastMoveCard';

const reasons = {
  checkmate: 'Chiếu hết', timeout: 'Hết 60 giây', resignation: 'Đầu hàng',
  stalemate: 'Hết nước đi hợp lệ', threefold_repetition: 'Lặp lại thế cờ 3 lần',
  insufficient_material: 'Không đủ quân chiếu hết', fifty_move_rule: 'Luật 50 nước',
  engine_error: 'Bot gặp lỗi — ván đấu bị hủy',
};

function PlayerStrip({ player, you, color, turn, online, seconds, finished }) {
  return <View style={[ui.row, { justifyContent: 'space-between', paddingVertical: 14 }]}>
    <View style={ui.row}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Piece type="k" color={color} size={30} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{player.username}{you ? ' · Bạn' : ''}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{player.elo} Elo · {player.bot ? 'Stockfish' : online ? 'Đã kết nối' : 'Đang kết nối lại'}</Text>
      </View>
    </View>
    <View style={{ backgroundColor: turn && !finished ? colors.accent : colors.panelAlt, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, minWidth: 87 }}>
      <Text style={{ color: turn && !finished ? colors.ink : colors.muted, fontSize: 24, fontWeight: '600', fontFamily: mono, textAlign: 'center' }}>
        {finished ? '—' : turn ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '1:00'}
      </Text>
    </View>
  </View>;
}

export default function ChessBoardScreen({ onHome }) {
  const { room, boardEvents, connected, send, clockRef, setNotice } = useSession();
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(Date.now());
  const chess = useMemo(() => new Chess(room.fen), [room.fen]);
  const { hasMoved } = memoryVisibility(room);
  const playback = useBoardPlayback(room, boardEvents);
  const piecesVisible = playback.frame.visible;
  const wide = width >= 760 && width > height;
  const boardWidth = Math.floor(Math.min(width - 48, wide ? width - 380 : 580, 580));
  const finished = room.status === 'finished';
  const active = room.status === 'active';
  const yourTurn = active && room.turn === room.color;
  const opponent = room.color === 'w' ? 'b' : 'w';
  const seconds = active ? Math.max(0, Math.ceil((room.deadline - time - clockRef.current.offset) / 1000)) : 0;

  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => { setSelected(null); setPromotion(null); }, [room.ply, room.id, room.status]);

  const move = useCallback(async (from, to, promote) => {
    if (!connected || busy || playback.animating || room.status !== 'active' || room.turn !== room.color) return false;
    if (!promote && chess.get(from)?.type === 'p' && ['1', '8'].includes(to[1])) {
      setPromotion({ from, to }); return false;
    }
    setBusy(true); setError('');
    try { await send('game:move', { roomId: room.id, from, to, ...(promote ? { promotion: promote } : {}) }); setSelected(null); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); setPromotion(null); }
  }, [connected, busy, playback.animating, room.id, room.status, room.turn, room.color, chess, send]);

  const tap = useCallback((square) => {
    if (!selected) setSelected(square);
    else if (selected === square) setSelected(null);
    else { void move(selected, square); }
  }, [selected, move]);

  async function action(event) {
    setBusy(true); setError('');
    try { await send(event, { roomId: room.id }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); setConfirmResign(false); }
  }

  async function shareCode() {
    try {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        await navigator.clipboard.writeText(room.code);
        setNotice('Đã sao chép mã phòng.');
      } else await Share.share({ message: `Cùng chơi Memory Chess! Mã phòng: ${room.code}` });
    } catch { setNotice(`Mã phòng của bạn: ${room.code}`); }
  }

  if (room.status === 'waiting' || room.status === 'starting') return <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, marginTop: 48 }}>
    <View style={[ui.card, { alignItems: 'center', paddingVertical: 44 }]}>
      <Piece type="n" color="w" size={70} />
      <Pill active>{room.mode === 'hardcore' ? 'HARDCORE MEMORY' : 'STRATEGIC PEEKS'}</Pill>
      <Text style={ui.title}>{room.status === 'waiting' ? 'Mời một người bạn' : 'Đang chuẩn bị bàn cờ…'}</Text>
      <Text style={[ui.muted, { textAlign: 'center' }]}>{room.status === 'waiting' ? 'Chia sẻ mã 6 số bên dưới. Ván đấu bắt đầu ngay khi người thứ hai tham gia.' : 'Server đang tạo trận và phân màu ngẫu nhiên.'}</Text>
      {room.code && <Text selectable style={{ color: colors.accent, fontFamily: mono, fontSize: 44, letterSpacing: 8 }}>{room.code}</Text>}
      {room.status === 'waiting' && <>
        <Button onPress={shareCode}>Chia sẻ mã phòng</Button>
        <Text style={ui.muted}>Phòng có hiệu lực 10 phút · Có tính Elo</Text>
        <Button variant="secondary" disabled={busy} onPress={() => action('room:leave')}>Đóng phòng</Button>
      </>}
    </View>
  </View>;

  const delta = room.result?.ratingChanges?.[room.color]?.delta;
  const resultTitle = room.result?.reason === 'engine_error' ? 'Ván đấu bị hủy' : room.result?.winner === null ? 'Ván đấu hòa' : room.result?.winner === room.color ? 'Bạn đã chiến thắng' : 'Ván đấu kết thúc';

  const controls = (
      <View style={{ width: '100%', gap: 18 }}>
        <View style={ui.card}>
          <Text style={ui.label}>{room.mode === 'hardcore' ? '01 / HARDCORE MEMORY' : '02 / STRATEGIC PEEKS'}</Text>
          <Text style={[ui.title, { fontSize: 26 }]}>{finished ? resultTitle : yourTurn ? 'Đến lượt của bạn.' : 'Đối thủ đang suy nghĩ.'}</Text>
          {finished ? <>
            <Text style={ui.muted}>{reasons[room.result?.reason] || room.result?.reason}</Text>
            {delta !== undefined && <Text style={{ color: delta >= 0 ? colors.accent : colors.danger, fontSize: 36, fontWeight: '700' }}>{delta >= 0 ? '+' : ''}{delta} <Text style={{ fontSize: 16 }}>Elo</Text></Text>}
            <Text style={ui.muted}>{room.result?.ratingStatus === 'pending' ? 'Đang lưu kết quả và cập nhật Elo…' : room.rated ? 'Kết quả đã được lưu.' : 'Ván luyện tập không ảnh hưởng Elo.'}</Text>
            <Button disabled={room.result?.ratingStatus === 'pending'} onPress={onHome}>Trở về sảnh đấu</Button>
          </> : <>
            <Text style={ui.muted}>{playback.animating && piecesVisible ? 'Đang hoàn tất chuyển động. Các quân sẽ ẩn khi nước đi kết thúc nếu Peek đã hết hiệu lực.' : !hasMoved ? 'Ghi nhớ vị trí các quân. Bàn cờ sẽ ẩn sau chuyển động của nước đi đầu tiên.' : piecesVisible ? 'Peek đang bật. Các quân sẽ ẩn sau nước đi hợp lệ tiếp theo của bạn.' : 'Các quân đã ẩn. Hình dung bàn cờ và tin vào trí nhớ của bạn.'}</Text>
            <View style={[ui.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18 }]}>
              <Text style={ui.muted}>Trạng thái bàn cờ</Text>
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{piecesVisible ? 'ĐANG HIỂN THỊ' : 'ĐÃ ẨN QUÂN'}</Text>
            </View>
            {room.mode === 'peeks' && <>
              <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.text}>Lượt Peek còn lại</Text><Text style={{ color: colors.text, fontSize: 28, fontFamily: mono }}>{room.peek.remaining}<Text style={{ fontSize: 14, color: colors.muted }}> / 10</Text></Text></View>
              <View style={[ui.row, { gap: 5 }]}>{Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < room.peek.remaining ? colors.accent : colors.border }} />)}</View>
              {wide && <Button disabled={!connected || busy || playback.animating || !hasMoved || room.peek.active || room.peek.remaining === 0} onPress={() => action('game:peek')}>{room.peek.active ? 'Peek đang bật' : 'Peek · Xem bàn cờ'}</Button>}
              <Text style={[ui.muted, { fontSize: 12 }]}>Chỉ trừ 1 Peek khi bạn đi thành công. Có thể bật trong lượt của đối thủ.</Text>
            </>}
          </>}
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text> : null}
        </View>
        {!finished && <>
          <View style={{ paddingHorizontal: 10, gap: 8 }}><Text style={ui.label}>MỘT NƯỚC ĐI. MỘT PHÚT.</Text><Text style={ui.muted}>Mỗi lượt có đúng 60 giây. Mất kết nối hoặc bật Peek không dừng đồng hồ.</Text></View>
          <Button variant="secondary" disabled={busy || !connected} onPress={() => setConfirmResign(true)}>Đầu hàng</Button>
        </>}
      </View>
  );

  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: wide ? 30 : 12, alignItems: 'center' }}>
    <View style={{ width: '100%', maxWidth: 1000, flexDirection: wide ? 'row' : 'column', gap: wide ? 28 : 20, alignItems: wide ? 'flex-start' : 'center' }}>
      <View style={{ width: wide ? 280 : boardWidth, gap: 20, paddingTop: wide ? 42 : 0 }}>
        <LastMoveCard move={playback.transition?.target.lastMove || playback.frame.lastMove} color={room.color} compact={!wide} />
        {wide && controls}
      </View>
      <View style={{ width: boardWidth }}>
        <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
          <Pill active>{room.kind === 'bot' ? 'LUYỆN TẬP' : 'ĐẤU XẾP HẠNG'}</Pill>
          <Text style={ui.muted}>60 giây / nước</Text>
        </View>
        <PlayerStrip player={room.players[opponent]} color={opponent} turn={room.turn === opponent} online={room.connected[opponent]} seconds={seconds} finished={finished} />
        <View style={{ padding: 0, borderWidth: 0, borderRadius: 4 }}>
          <ChessBoard fen={playback.frame.fen} ply={playback.frame.ply} transition={playback.transition} onAnimationComplete={playback.complete} width={boardWidth} color={room.color} visible={piecesVisible} selected={selected} onTap={tap} onDrop={move} interactive={yourTurn && connected && !busy && !promotion && !playback.animating} />
        </View>
        <PlayerStrip player={room.players[room.color]} you color={room.color} turn={yourTurn} online={connected} seconds={seconds} finished={finished} />
        <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
          <View style={{ height: 3, width: `${seconds / 60 * 100}%`, backgroundColor: seconds <= 10 ? colors.danger : colors.accent, borderRadius: 2 }} />
        </View>

        {!wide && active && room.mode === 'peeks' && <Button style={{ marginTop: 16 }} disabled={!connected || busy || playback.animating || !hasMoved || room.peek.active || room.peek.remaining === 0} onPress={() => action('game:peek')}>{playback.animating && piecesVisible ? 'Đang hoàn tất nước đi…' : room.peek.active ? 'Peek đang bật' : `Peek · ${room.peek.remaining}/10 lượt`}</Button>}
        <Text style={[ui.muted, { textAlign: 'center', marginTop: 14, fontSize: 12 }]}>{selected ? `Đã chọn ${selected} · Chạm ô đích, hoặc chạm lại để bỏ chọn` : 'Kéo thả hoặc chạm ô xuất phát → ô đích'}</Text>
        {!wide && <View style={{ marginTop: 24 }}>{controls}</View>}
      </View>


    </View>
    <Modal visible={Boolean(promotion)} transparent animationType="fade" onRequestClose={() => setPromotion(null)}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={[ui.card, { maxWidth: 400, width: '100%' }]}>
          <Text style={ui.title}>Phong cấp</Text><Text style={ui.muted}>Chọn quân mới. Đồng hồ vẫn đang chạy.</Text>
          <View style={ui.row}>{['q', 'r', 'b', 'n'].map((type) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={`Phong cấp ${type}`} onPress={() => move(promotion.from, promotion.to, type)} style={{ flex: 1, paddingVertical: 10, backgroundColor: colors.panelAlt, alignItems: 'center', borderRadius: 8 }}><Piece type={type} color={room.color} size={44} /></Pressable>)}</View>
          <Button variant="secondary" onPress={() => setPromotion(null)}>Hủy</Button>
        </View>
      </View>
    </Modal>
    <Modal visible={confirmResign} transparent animationType="fade" onRequestClose={() => setConfirmResign(false)}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={[ui.card, { maxWidth: 400, width: '100%' }]}>
          <Text style={ui.title}>Đầu hàng ván này?</Text><Text style={ui.muted}>Đối thủ sẽ thắng. {room.rated ? 'Elo của bạn sẽ được cập nhật.' : 'Ván bot không ảnh hưởng Elo.'}</Text>
          <Button variant="danger" loading={busy} onPress={() => action('game:resign')}>Xác nhận đầu hàng</Button>
          <Button variant="secondary" onPress={() => setConfirmResign(false)}>Tiếp tục chơi</Button>
        </View>
      </View>
    </Modal>
  </ScrollView>;
}
