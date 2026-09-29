import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSession } from '../session';
import { colors, ui, Button, Input, Pill, mono } from '../theme';
import ChessBoard from '../components/ChessBoard';
import Piece from '../components/Piece';
import SpringPressable from '../components/SpringPressable';
import FadeIn from '../components/FadeIn';
import { useTranslation } from 'react-i18next';
import { translateError } from '../i18n';

export default function MainMenuScreen({ inviteCode }) {
  const { t } = useTranslation();
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
    catch (e) { setError(translateError(e, t)); }
    finally { setBusy(''); }
  }

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 36 : 20, paddingTop: wide ? 42 : 26 }}>
    <FadeIn duration={420} style={{ maxWidth: 1160, width: '100%', alignSelf: 'center', gap: 32 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 36, alignItems: wide ? 'center' : 'flex-start' }}>
        <View style={{ flex: 1, gap: 18 }}>
          <Text style={[ui.label, { color: colors.accent }]}>{t('menu.eyebrow')}</Text>
          <Text style={{ fontSize: wide ? 54 : 37, lineHeight: wide ? 61 : 44, fontWeight: '700', letterSpacing: -2, color: colors.text }}>{t('menu.headline')}{'\n'}<Text style={{ color: colors.accent }}>{t('menu.headlineAccent')}</Text></Text>
          <Text style={[ui.muted, { maxWidth: 450, fontSize: 16, lineHeight: 25 }]}>{t('menu.body')}</Text>
          <View style={[ui.row, { paddingTop: 4 }]}><Pill>{t('menu.perMove')}</Pill><Pill>{t('menu.multiplayer')}</Pill></View>
        </View>
        {wide && <View style={{ padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.panel, transform: [{ rotate: '-3deg' }] }}>
          <ChessBoard fen="r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4" width={230} />
          <Text style={[ui.label, { textAlign: 'center', paddingTop: 13, fontSize: 9 }]}>{t('menu.previewCaption')}</Text>
        </View>}
      </View>

      <View style={{ gap: 14 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.label}>{t('menu.challengeSection')}</Text><Text style={[ui.muted, { fontSize: 12 }]}>{t('menu.challengeSubhead')}</Text></View>
        <View style={{ flexDirection: width >= 640 ? 'row' : 'column', gap: 14 }}>{[
          { id: 'hardcore', number: '01', name: t('menu.hardcoreModeName'), title: t('menu.hardcoreTitle'), desc: t('menu.hardcoreDescription'), tag: t('menu.noPeek'), piece: 'n' },
          { id: 'peeks', number: '02', name: t('menu.peeksModeName'), title: t('menu.peeksTitle'), desc: t('menu.peeksDescription'), tag: t('menu.peeksTag'), piece: 'b' },
        ].map((item) => <SpringPressable key={item.id} testID={`mode-${item.id}`} pressedScale={0.95} accessibilityRole="radio" accessibilityState={{ checked: mode === item.id }} disabled={locked} onPress={() => setMode(item.id)} style={[ui.card, { flex: 1, borderColor: mode === item.id ? colors.accent : colors.border, backgroundColor: mode === item.id ? '#302A21' : colors.panel, gap: 14, padding: 22 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}><View style={ui.row}><Piece type={item.piece} color="w" size={36} /><Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.name}</Text></View><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: mode === item.id ? 5 : 1, borderColor: mode === item.id ? colors.accent : colors.muted }} /></View>
          <Text style={[ui.muted, { minHeight: width >= 640 ? 48 : undefined }]}><Text style={{ color: colors.text }}>{item.title} </Text>{item.desc}</Text>
          <Pill active={mode === item.id}>{item.tag}</Pill>
        </SpringPressable>)}</View>
      </View>

      <View style={{ gap: 14 }}>
        <Text style={ui.label}>{t('menu.enterBoardSection')}</Text>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
          <View style={[ui.card, { flex: 1, borderTopColor: colors.accent, borderTopWidth: 3 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{t('menu.rankedTitle')}</Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>{t('menu.rankedDescription')}</Text>
            <View style={[ui.row, { alignItems: 'baseline' }]}><Text style={{ fontSize: 38, fontWeight: '600', color: colors.text, fontFamily: mono }}>{user.elo}</Text><Text style={ui.muted}>{t('menu.yourElo')}</Text></View>
            <Button disabled={locked} loading={busy === 'match:find'} onPress={() => action('match:find', { mode })}>{t('menu.findMatch')}</Button>
          </View>
          <View style={[ui.card, { flex: 1 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{t('menu.friendsTitle')}</Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>{t('menu.friendsDescription')}</Text>
            <Button variant="secondary" disabled={locked} loading={busy === 'party:create'} onPress={() => action('party:create', { mode })}>{t('menu.createRoom')}</Button>
            <View style={[ui.row, { gap: 8 }]}><View style={{ flex: 1 }}><Input accessibilityLabel={t('menu.roomCodeLabel')} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder={t('menu.roomCodePlaceholder')} keyboardType="number-pad" maxLength={6} style={{ fontFamily: mono, fontSize: 15 }} /></View><Button disabled={locked || code.length !== 6} loading={busy === 'party:join'} variant="secondary" onPress={() => action('party:join', { code })} style={{ paddingHorizontal: 16 }}>{t('menu.join')}</Button></View>
          </View>
          <View style={[ui.card, { flex: 1 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{t('menu.stockfishTitle')}</Text>
            <Text style={[ui.muted, { minHeight: wide ? 66 : undefined }]}>{t('menu.botDescription')}</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>{[800, 1200, 1600].map((elo) => <SpringPressable key={elo} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: botElo === elo }} onPress={() => setBotElo(elo)} style={{ flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: elo === botElo ? '#443725' : colors.bg, borderWidth: 1, borderColor: elo === botElo ? colors.accent : colors.border }}><Text style={{ color: elo === botElo ? colors.accent : colors.muted, fontFamily: mono, fontWeight: '600' }}>{elo}</Text></SpringPressable>)}</View>
            <Button variant="secondary" disabled={locked} loading={busy === 'bot:start'} onPress={() => action('bot:start', { mode, elo: botElo })}>{t('menu.startTraining')}</Button>
            <Text style={[ui.muted, { fontSize: 11 }]}>{t('menu.approximateElo')}</Text>
          </View>
        </View>
      </View>
      {queue && <View style={[ui.card, { borderColor: colors.accent }]}><View style={ui.row}><ActivityIndicator color={colors.accent} /><Text style={ui.text}>{t('menu.searching')}</Text></View><Text style={ui.muted}>{t('menu.searchRange')}</Text><Button variant="secondary" loading={busy === 'match:cancel'} onPress={() => action('match:cancel')}>{t('menu.cancelSearch')}</Button></View>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 22 }}>{error}</Text> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 22, paddingBottom: 10 }}><Text style={[ui.muted, { fontSize: 12 }]}>{t('menu.footer')}</Text></View>
    </FadeIn>
  </ScrollView>;
}
