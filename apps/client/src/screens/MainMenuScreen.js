import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSession } from '../session';
import { colors, ui, Button, Input, Pill, mono } from '../theme';
import ChessBoard from '../components/ChessBoard';
import Piece from '../components/Piece';
import SpringPressable from '../components/SpringPressable';
import FadeIn from '../components/FadeIn';

export default function MainMenuScreen({ inviteCode }) {
  const { user, connected, send, queue, setNotice } = useSession();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState('peeks');
  const [botElo, setBotElo] = useState(1200);
  const [code, setCode] = useState(inviteCode || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const wide = width >= 960;
  const locked = !connected || Boolean(busy) || Boolean(queue);
  useEffect(() => { if (inviteCode) setCode(inviteCode); }, [inviteCode]);

  async function action(event, payload = {}) {
    setBusy(event); setError(''); setNotice('');
    try { await send(event, payload); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 36 : 20, paddingTop: wide ? 42 : 26 }}>
    <FadeIn duration={420} style={{ maxWidth: 1160, width: '100%', alignSelf: 'center', gap: 32 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 36, alignItems: wide ? 'center' : 'flex-start' }}>
        <View style={{ flex: 1, gap: 18 }}>
          <Text style={[ui.label, { color: colors.accent }]}>SÂN TẬP CHO TRÍ NHỚ CỦA BẠN</Text>
          <Text style={{ fontSize: wide ? 54 : 37, lineHeight: wide ? 61 : 44, fontWeight: '700', letterSpacing: -2, color: colors.text }}>Bàn cờ biến mất.{ '\n' }<Text style={{ color: colors.accent }}>Tư duy ở lại.</Text></Text>
          <Text style={[ui.muted, { maxWidth: 450, fontSize: 16, lineHeight: 25 }]}>Ghi nhớ vị trí. Hình dung nước đi. Thách đấu chính mình — và những người chơi khác.</Text>
          <View style={[ui.row, { paddingTop: 4 }]}><Pill>60 GIÂY / NƯỚC</Pill><Pill>REAL-TIME MULTIPLAYER</Pill></View>
        </View>
        {wide && <View style={{ padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.panel, transform: [{ rotate: '-3deg' }] }}>
          <ChessBoard fen="r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4" width={230} />
          <Text style={[ui.label, { textAlign: 'center', paddingTop: 13, fontSize: 9 }]}>MỌI NƯỚC ĐI BẮT ĐẦU TRONG TÂM TRÍ</Text>
        </View>}
      </View>

      <View style={{ gap: 14 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.label}>01 — CHỌN THỬ THÁCH</Text><Text style={[ui.muted, { fontSize: 12 }]}>Hai cách rèn trí nhớ</Text></View>
        <View style={{ flexDirection: width >= 640 ? 'row' : 'column', gap: 14 }}>{[
          { id: 'hardcore', number: '01', name: 'Hardcore Memory', title: 'Tin vào trí nhớ.', desc: 'Ẩn toàn bộ quân sau nước đầu tiên. Không nhìn lại, đến khi ván đấu kết thúc.', tag: 'KHÔNG PEEK', piece: 'n' },
          { id: 'peeks', number: '02', name: 'Strategic Peeks', title: 'Nhìn đúng thời điểm.', desc: '10 lượt xem lại bàn cờ. Mỗi Peek giữ đến khi bạn hoàn thành nước đi tiếp theo.', tag: '10 LƯỢT PEEK', piece: 'b' },
        ].map((item) => <SpringPressable key={item.id} testID={`mode-${item.id}`} pressedScale={0.95} accessibilityRole="radio" accessibilityState={{ checked: mode === item.id }} disabled={locked} onPress={() => setMode(item.id)} style={[ui.card, { flex: 1, borderColor: mode === item.id ? colors.accent : colors.border, backgroundColor: mode === item.id ? '#302A21' : colors.panel, gap: 14, padding: 22 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}><View style={ui.row}><Piece type={item.piece} color="w" size={36} /><Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.name}</Text></View><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: mode === item.id ? 5 : 1, borderColor: mode === item.id ? colors.accent : colors.muted }} /></View>
          <Text style={[ui.muted, { minHeight: width >= 640 ? 48 : undefined }]}><Text style={{ color: colors.text }}>{item.title} </Text>{item.desc}</Text>
          <Pill active={mode === item.id}>{item.tag}</Pill>
        </SpringPressable>)}</View>
      </View>

      <View style={{ gap: 14 }}>
        <Text style={ui.label}>02 — BƯỚC VÀO BÀN CỜ</Text>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
          <View style={[ui.card, { flex: 1, borderTopColor: colors.accent, borderTopWidth: 3 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Đấu xếp hạng <Text style={{ color: colors.accent }}>↗</Text></Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>Tìm đối thủ cùng trình độ. Mỗi ván đấu là một bước tiến trên bảng Elo.</Text>
            <View style={[ui.row, { alignItems: 'baseline' }]}><Text style={{ fontSize: 38, fontWeight: '600', color: colors.text, fontFamily: mono }}>{user.elo}</Text><Text style={ui.muted}>Elo của bạn</Text></View>
            <Button disabled={locked} loading={busy === 'match:find'} onPress={() => action('match:find', { mode })}>Tìm trận →</Button>
          </View>
          <View style={[ui.card, { flex: 1 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Chơi cùng bạn bè</Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>Một mã phòng. Một đối thủ quen.{ '\n' }Cùng thử xem ai nhớ tốt hơn.</Text>
            <Button variant="secondary" disabled={locked} loading={busy === 'party:create'} onPress={() => action('party:create', { mode })}>Tạo phòng · Mã 6 số</Button>
            <View style={[ui.row, { gap: 8 }]}><View style={{ flex: 1 }}><Input accessibilityLabel="Mã phòng 6 số" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="Mã 6 số" keyboardType="number-pad" maxLength={6} style={{ fontFamily: mono, fontSize: 15 }} /></View><Button disabled={locked || code.length !== 6} loading={busy === 'party:join'} variant="secondary" onPress={() => action('party:join', { code })} style={{ paddingHorizontal: 16 }}>Vào</Button></View>
          </View>
          <View style={[ui.card, { flex: 1 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Luyện với Stockfish</Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>Không áp lực xếp hạng. Chọn mức thử thách và luyện theo nhịp của bạn.</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>{[800, 1200, 1600].map((elo) => <SpringPressable key={elo} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: botElo === elo }} onPress={() => setBotElo(elo)} style={{ flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: elo === botElo ? '#443725' : colors.bg, borderWidth: 1, borderColor: elo === botElo ? colors.accent : colors.border }}><Text style={{ color: elo === botElo ? colors.accent : colors.muted, fontFamily: mono, fontWeight: '600' }}>{elo}</Text></SpringPressable>)}</View>
            <Button variant="secondary" disabled={locked} loading={busy === 'bot:start'} onPress={() => action('bot:start', { mode, elo: botElo })}>Bắt đầu luyện tập</Button>
            <Text style={[ui.muted, { fontSize: 11 }]}>Mức Elo gần đúng · Không tính điểm</Text>
          </View>
        </View>
      </View>
      {queue && <View style={[ui.card, { borderColor: colors.accent }]}><View style={ui.row}><ActivityIndicator color={colors.accent} /><Text style={ui.text}>Đang tìm đối thủ cùng chế độ và gần Elo…</Text></View><Text style={ui.muted}>Khoảng Elo sẽ mở rộng dần theo thời gian chờ.</Text><Button variant="secondary" loading={busy === 'match:cancel'} onPress={() => action('match:cancel')}>Hủy tìm trận</Button></View>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 22 }}>{error}</Text> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 22, paddingBottom: 10 }}><Text style={[ui.muted, { fontSize: 12 }]}>Không phải thấy nhiều hơn. Là nhớ rõ hơn. <Text style={{ color: colors.accent }}>Your mind. Your board.</Text></Text></View>
    </FadeIn>
  </ScrollView>;
}
