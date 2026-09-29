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
import { useTranslation } from 'react-i18next';
import { translateError } from '../i18n';

function PlayerStrip({ player, you, color, turn, online, seconds, finished }) {
  const { t } = useTranslation();
  return <View style={[ui.row, { justifyContent: 'space-between', paddingVertical: 14 }]}>
    <View style={ui.row}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Piece type="k" color={color} size={30} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{player.username}{you ? ` · ${t('game.playerYou')}` : ''}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{player.elo} Elo · {player.bot ? 'Stockfish' : online ? t('game.connected') : t('game.reconnecting')}</Text>
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
  const { t } = useTranslation();
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
    catch (e) { setError(translateError(e, t)); return false; }
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
    catch (e) { setError(translateError(e, t)); }
    finally { setBusy(false); setConfirmResign(false); }
  }

  async function shareCode() {
    try {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        await navigator.clipboard.writeText(room.code);
        setNotice(t('game.copiedCode'));
      } else await Share.share({ message: t('game.shareMessage', { code: room.code }) });
    } catch { setNotice(t('game.roomCodeNotice', { code: room.code })); }
  }

  if (room.status === 'waiting' || room.status === 'starting') return <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, marginTop: 48 }}>
    <View style={[ui.card, { alignItems: 'center', paddingVertical: 44 }]}>
      <Piece type="n" color="w" size={70} />
      <Pill active>{room.mode === 'hardcore' ? t('game.hardcore') : t('game.peeks')}</Pill>
      <Text style={ui.title}>{room.status === 'waiting' ? t('game.inviteFriend') : t('game.preparing')}</Text>
      <Text style={[ui.muted, { textAlign: 'center' }]}>{room.status === 'waiting' ? t('game.inviteDescription') : t('game.preparingDescription')}</Text>
      {room.code && <Text selectable style={{ color: colors.accent, fontFamily: mono, fontSize: 44, letterSpacing: 8 }}>{room.code}</Text>}
      {room.status === 'waiting' && <>
        <Button onPress={shareCode}>{t('game.shareRoom')}</Button>
        <Text style={ui.muted}>{t('game.roomExpiry')}</Text>
        <Button variant="secondary" disabled={busy} onPress={() => action('room:leave')}>{t('game.closeRoom')}</Button>
      </>}
    </View>
  </View>;

  const delta = room.result?.ratingChanges?.[room.color]?.delta;
  const resultTitle = room.result?.reason === 'engine_error' ? t('game.gameAborted') : room.result?.winner === null ? t('game.drawTitle') : room.result?.winner === room.color ? t('game.victory') : t('game.gameOver');

  const controls = (
      <View style={{ width: '100%', gap: 18 }}>
        <View style={ui.card}>
          <Text style={ui.label}>{room.mode === 'hardcore' ? t('game.hardcoreSectionLabel') : t('game.peeksSectionLabel')}</Text>
          <Text style={[ui.title, { fontSize: 26 }]}>{finished ? resultTitle : yourTurn ? t('game.yourTurn') : t('game.opponentThinking')}</Text>
          {finished ? <>
            <Text style={ui.muted}>{room.result?.reason ? t(`game.reasons.${room.result.reason}`) : t('common.unknownError')}</Text>
            {delta !== undefined && <Text style={{ color: delta >= 0 ? colors.accent : colors.danger, fontSize: 36, fontWeight: '700' }}>{delta >= 0 ? '+' : ''}{delta} <Text style={{ fontSize: 16 }}>Elo</Text></Text>}
            <Text style={ui.muted}>{room.result?.ratingStatus === 'pending' ? t('game.savingResult') : room.rated ? t('game.resultSaved') : t('game.botUnrated')}</Text>
            <Button disabled={room.result?.ratingStatus === 'pending'} onPress={onHome}>{t('game.returnToLobby')}</Button>
          </> : <>
            <Text style={ui.muted}>{playback.animating && piecesVisible ? t('game.animationHint') : !hasMoved ? t('game.firstMoveHint') : piecesVisible ? t('game.peekHint') : t('game.hiddenHint')}</Text>
            <View style={[ui.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18 }]}>
              <Text style={ui.muted}>{t('game.boardStatus')}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{piecesVisible ? t('game.visible') : t('game.hidden')}</Text>
            </View>
            {room.mode === 'peeks' && <>
              <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.text}>{t('game.peeksRemaining')}</Text><Text style={{ color: colors.text, fontSize: 28, fontFamily: mono }}>{room.peek.remaining}<Text style={{ fontSize: 14, color: colors.muted }}> / 10</Text></Text></View>
              <View style={[ui.row, { gap: 5 }]}>{Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < room.peek.remaining ? colors.accent : colors.border }} />)}</View>
              {wide && <Button disabled={!connected || busy || playback.animating || !hasMoved || room.peek.active || room.peek.remaining === 0} onPress={() => action('game:peek')}>{room.peek.active ? t('game.peekActive') : t('game.peekBoard')}</Button>}
              <Text style={[ui.muted, { fontSize: 12 }]}>{t('game.peekRule')}</Text>
            </>}
          </>}
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text> : null}
        </View>
        {!finished && <>
          <View style={{ paddingHorizontal: 10, gap: 8 }}><Text style={ui.label}>{t('game.minute')}</Text><Text style={ui.muted}>{t('game.clockRule')}</Text></View>
          <Button variant="secondary" disabled={busy || !connected} onPress={() => setConfirmResign(true)}>{t('game.resign')}</Button>
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
          <Pill active>{room.kind === 'bot' ? t('game.practice') : t('game.rated')}</Pill>
          <Text style={ui.muted}>{t('game.secondsPerMove')}</Text>
        </View>
        <PlayerStrip player={room.players[opponent]} color={opponent} turn={room.turn === opponent} online={room.connected[opponent]} seconds={seconds} finished={finished} />
        <View style={{ padding: 0, borderWidth: 0, borderRadius: 4 }}>
          <ChessBoard fen={playback.frame.fen} ply={playback.frame.ply} transition={playback.transition} onAnimationComplete={playback.complete} width={boardWidth} color={room.color} visible={piecesVisible} selected={selected} onTap={tap} onDrop={move} interactive={yourTurn && connected && !busy && !promotion && !playback.animating} />
        </View>
        <PlayerStrip player={room.players[room.color]} you color={room.color} turn={yourTurn} online={connected} seconds={seconds} finished={finished} />
        <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
          <View style={{ height: 3, width: `${seconds / 60 * 100}%`, backgroundColor: seconds <= 10 ? colors.danger : colors.accent, borderRadius: 2 }} />
        </View>

        {!wide && active && room.mode === 'peeks' && <Button style={{ marginTop: 16 }} disabled={!connected || busy || playback.animating || !hasMoved || room.peek.active || room.peek.remaining === 0} onPress={() => action('game:peek')}>{playback.animating && piecesVisible ? t('game.finishMove') : room.peek.active ? t('game.peekActive') : t('game.peekRemaining', { count: room.peek.remaining })}</Button>}
        <Text style={[ui.muted, { textAlign: 'center', marginTop: 14, fontSize: 12 }]}>{selected ? t('game.selectedMove', { square: selected }) : t('game.moveInstruction')}</Text>
        {!wide && <View style={{ marginTop: 24 }}>{controls}</View>}
      </View>


    </View>
    <Modal visible={Boolean(promotion)} transparent animationType="fade" onRequestClose={() => setPromotion(null)}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={[ui.card, { maxWidth: 400, width: '100%' }]}>
          <Text style={ui.title}>{t('game.promotion')}</Text><Text style={ui.muted}>{t('game.promotionHint')}</Text>
          <View style={ui.row}>{['q', 'r', 'b', 'n'].map((type) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={t('game.promoteTo', { piece: t(`game.promotionPieces.${type}`) })} onPress={() => move(promotion.from, promotion.to, type)} style={{ flex: 1, paddingVertical: 10, backgroundColor: colors.panelAlt, alignItems: 'center', borderRadius: 8 }}><Piece type={type} color={room.color} size={44} /></Pressable>)}</View>
          <Button variant="secondary" onPress={() => setPromotion(null)}>{t('common.cancel')}</Button>
        </View>
      </View>
    </Modal>
    <Modal visible={confirmResign} transparent animationType="fade" onRequestClose={() => setConfirmResign(false)}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={[ui.card, { maxWidth: 400, width: '100%' }]}>
          <Text style={ui.title}>{t('game.confirmResign')}</Text><Text style={ui.muted}>{room.rated ? t('game.resignDescriptionRated') : t('game.resignDescriptionUnrated')}</Text>
          <Button variant="danger" loading={busy} onPress={() => action('game:resign')}>{t('game.confirmResignButton')}</Button>
          <Button variant="secondary" onPress={() => setConfirmResign(false)}>{t('game.continuePlaying')}</Button>
        </View>
      </View>
    </Modal>
  </ScrollView>;
}
