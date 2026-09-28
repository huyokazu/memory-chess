import React, { useLayoutEffect, useState } from 'react';
import Piece from './Piece';
import { MOVE_DURATION, squarePoint } from '../animation/boardPlayback';

export default function MovingPieces({ transition, size, flipped, onComplete, drag }) {
  const [moving, setMoving] = useState(false);
  useLayoutEffect(() => {
    let first, second, fallback;
    setMoving(false);
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setMoving(true);
        // transitionend handles normal completion; fallback handles hidden tabs.
        fallback = setTimeout(() => onComplete(transition.id), MOVE_DURATION + 150);
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); clearTimeout(fallback); };
  }, [transition.id, onComplete]);
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: transition.visible ? 1 : 0 }}>
    {transition.pieces.map((piece, index) => {
      const source = squarePoint(piece.from, flipped);
      const target = squarePoint(piece.to, flipped);
      const x = moving ? target.x * size : source.x * size + (drag?.from === piece.from ? drag.x : 0);
      const y = moving ? target.y * size : source.y * size + (drag?.from === piece.from ? drag.y : 0);
      return <div key={piece.from} data-testid={`moving-${piece.from}-${piece.to}`}
        onTransitionEnd={(event) => { if (index === 0 && event.propertyName === 'transform') onComplete(transition.id); }}
        style={{ position: 'absolute', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translate(${x}px, ${y}px)`, transition: moving ? `transform ${MOVE_DURATION}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none', willChange: 'transform' }}>
        <Piece type={piece.type} color={piece.color} size={size * 0.98} />
      </div>;
    })}
  </div>;
}
