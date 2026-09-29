import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder, Platform } from 'react-native';
import { Chess } from 'chess.js';
import Svg, { Path, Rect } from 'react-native-svg';
import Piece from './Piece';
import WoodSurface from './WoodSurface';
import { playedPlies } from '../memoryVisibility';
import MovingPieces from './MovingPieces';
import { useTranslation } from 'react-i18next';

const NOOP = () => {};
function Square({ square, row, col, piece, size, visible, selected, onTap, onDrop, interactive, flipped, t }) {
  const [dragging, setDragging] = useState(false);
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => interactive,
    onMoveShouldSetPanResponder: () => interactive,
    onPanResponderGrant: (event) => {
      start.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      setDragging(true);
    },
    onPanResponderMove: (event, gesture) => setDelta({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: async (event, gesture) => {
      const reset = () => { setDragging(false); setDelta({ x: 0, y: 0 }); };
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) < 8) { reset(); onTap(square); return; }
      const targetCol = col + Math.floor((start.current.x + gesture.dx) / size);
      const targetRow = row + Math.floor((start.current.y + gesture.dy) / size);
      if (targetCol < 0 || targetCol > 7 || targetRow < 0 || targetRow > 7) { reset(); return; }
      const target = String.fromCharCode(97 + (flipped ? 7 - targetCol : targetCol)) + (flipped ? targetRow + 1 : 8 - targetRow);
      try { if (target !== square) await onDrop(square, target, { x: gesture.dx, y: gesture.dy }); }
      finally { reset(); }
    },
    onPanResponderTerminate: () => { setDragging(false); setDelta({ x: 0, y: 0 }); },
    onPanResponderTerminationRequest: () => false,
  }), [interactive, square, row, col, size, flipped, onTap, onDrop]);
  return <View style={{ width: size, height: size, zIndex: dragging ? 10 : 0 }}>
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><WoodSurface light={(row + col) % 2 === 0} seed={row * 8 + col} /></View>
    {selected && <View pointerEvents="none" style={{ position: 'absolute', inset: 1, borderWidth: 2, borderColor: '#f1d295', backgroundColor: '#f1d29526' }} />}
    <View pointerEvents="none" accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: visible ? 1 : 0, transform: [{ translateX: delta.x }, { translateY: delta.y }] }}>
      {piece && <Piece type={piece.type} color={piece.color} size={size * 0.98} />}
    </View>
    <View {...responder.panHandlers} accessible accessibilityRole="button"
      accessibilityLabel={visible && piece ? t('game.pieceSquare', { square, color: t(piece.color === 'w' ? 'game.white' : 'game.black'), piece: t(`game.promotionPieces.${piece.type}`) }) : t('game.square', { square })}
      accessibilityState={{ selected, disabled: !interactive }}
      onAccessibilityTap={() => interactive && onTap(square)}
      {...(Platform.OS === 'web' ? { tabIndex: interactive ? 0 : -1, onKeyDown: (event) => { if (interactive && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onTap(square); } } } : {})}
      style={{ position: 'absolute', inset: 0, ...(Platform.OS === 'web' ? { cursor: interactive ? 'grab' : 'default', touchAction: 'none', userSelect: 'none' } : {}) }} />
  </View>;
}

function ChessBoard({ fen, ply, width, color = 'w', visible = true, selected, onTap = NOOP, onDrop = NOOP, interactive = false, transition = null, onAnimationComplete = NOOP }) {
  const { t } = useTranslation();
  const chess = useMemo(() => new Chess(fen), [fen]);
  const flipped = color === 'b';
  // Even a stale visible:false snapshot may never hide an untouched new game.
  const piecesVisible = playedPlies({ ply, fen }) === 0 || visible;
  const drag = useRef(null);
  const handleDrop = useCallback(async (from, to, offset) => {
    drag.current = { from, to, ...offset };
    try { if (await onDrop(from, to) === false) drag.current = null; }
    catch (error) { drag.current = null; throw error; }
  }, [onDrop]);
  const handleTap = useCallback((square) => { drag.current = null; onTap(square); }, [onTap]);
  const complete = useCallback((id) => { drag.current = null; onAnimationComplete(id); }, [onAnimationComplete]);
  const frame = Math.max(12, Math.round(width * 0.045));
  const inner = width - frame * 2;
  const size = inner / 8;
  const depth = Math.max(5, Math.round(width * 0.015));
  const labelStyle = { position: 'absolute', color: '#ecd5ad', fontSize: Math.max(8, width * 0.018), fontWeight: '600', textAlign: 'center' };
  return <View accessibilityLabel={t('game.boardLabel')} style={{ width, height: width + depth, marginBottom: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 38px #0008, 0 4px 8px #0008' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 16 }) }}>
    <View pointerEvents="none" style={{ position: 'absolute', top: depth, left: 0, width, height: width, backgroundColor: '#382315', borderRadius: 3, borderBottomWidth: 2, borderBottomColor: '#1c140e' }} />
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height: width, borderRadius: 2, overflow: 'hidden' }}><WoodSurface frame /></View>
    <Svg pointerEvents="none" accessible={false} width={width} height={width} style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${width} ${width}`}>
      <Path d={`M0 0 H${width} L${width - frame} ${frame} H${frame} Z`} fill="#fff2ca" fillOpacity="0.13" />
      <Path d={`M0 0 V${width} L${frame} ${width - frame} V${frame} Z`} fill="#efd6ad" fillOpacity="0.09" />
      <Path d={`M0 ${width} H${width} L${width - frame} ${width - frame} H${frame} Z`} fill="#24150d" fillOpacity="0.23" />
      <Path d={`M${width} 0 V${width} L${width - frame} ${width - frame} V${frame} Z`} fill="#24150d" fillOpacity="0.18" />
      <Rect x="1" y="1" width={width - 2} height={width - 2} stroke="#dbba80" strokeOpacity="0.4" strokeWidth="1" fill="none" />
      <Rect x={frame - 4} y={frame - 4} width={inner + 8} height={inner + 8} stroke="#d0ad72" strokeWidth="1" fill="none" />
      <Rect x={frame - 2} y={frame - 2} width={inner + 4} height={inner + 4} stroke="#31251b" strokeWidth="3" fill="none" />
      <Path d={`M1 1 L${frame - 4} ${frame - 4} M${width - 1} 1 L${width - frame + 4} ${frame - 4} M1 ${width - 1} L${frame - 4} ${width - frame + 4} M${width - 1} ${width - 1} L${width - frame + 4} ${width - frame + 4}`} stroke="#3e281a" strokeOpacity="0.5" fill="none" />
    </Svg>
    {Array.from({ length: 8 }, (_, i) => <React.Fragment key={i}>
      <Text pointerEvents="none" style={[labelStyle, { left: frame + size * i, top: width - frame + 3, width: size }]}>{String.fromCharCode(97 + (flipped ? 7 - i : i))}</Text>
      <Text pointerEvents="none" style={[labelStyle, { left: 0, top: frame + size * i + size / 2 - 6, width: frame - 2 }]}>{flipped ? i + 1 : 8 - i}</Text>
    </React.Fragment>)}
    <View style={{ position: 'absolute', top: frame, left: frame, width: inner, height: inner, flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const square = String.fromCharCode(97 + (flipped ? 7 - col : col)) + (flipped ? row + 1 : 8 - row);
        const moving = transition?.pieces.some((piece) => piece.from === square);
        return <Square key={square} {...{ square, row, col, size, flipped, t }} onTap={handleTap} interactive={interactive && !transition} onDrop={handleDrop} visible={piecesVisible} piece={moving ? undefined : chess.get(square)} selected={selected === square} />;
      })}
      {transition && <MovingPieces key={`${transition.id}-${size}-${color}`} {...{ transition, size, flipped }} drag={drag.current?.to === transition.pieces[0].to ? drag.current : null} onComplete={complete} />}
    </View>
  </View>;
}
export default memo(ChessBoard);
