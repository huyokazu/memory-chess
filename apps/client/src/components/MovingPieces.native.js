import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing, runOnJS } from 'react-native-reanimated';
import Piece from './Piece';
import { MOVE_DURATION, squarePoint } from '../animation/boardPlayback';

function MovingPiece({ piece, size, flipped, progress, drag }) {
  const start = squarePoint(piece.from, flipped);
  const end = squarePoint(piece.to, flipped);
  const x = start.x * size + (drag?.from === piece.from ? drag.x : 0);
  const y = start.y * size + (drag?.from === piece.from ? drag.y : 0);
  const style = useAnimatedStyle(() => ({ transform: [
    { translateX: x + (end.x * size - x) * progress.value },
    { translateY: y + (end.y * size - y) * progress.value },
  ] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Piece type={piece.type} color={piece.color} size={size * 0.98} />
  </Animated.View>;
}

export default function MovingPieces({ transition, size, flipped, onComplete, drag }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: MOVE_DURATION, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onComplete)(transition.id);
    });
    return () => cancelAnimation(progress);
  }, [transition.id, onComplete, progress]);
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0, opacity: transition.visible ? 1 : 0 }}>
    {transition.pieces.map((piece) => <MovingPiece key={piece.from} {...{ piece, size, flipped, progress, drag }} />)}
  </Animated.View>;
}
