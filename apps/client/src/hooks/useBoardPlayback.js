import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { BoardPlayback, boardFrame } from '../animation/boardPlayback';

export default function useBoardPlayback(room, events) {
  const machine = useRef(null);
  if (!machine.current) machine.current = new BoardPlayback(boardFrame(room));
  const [presentation, setPresentation] = useState(machine.current.snapshot);
  const lastSequence = useRef(events.at(-1)?.sequence ?? 0);
  useLayoutEffect(() => {
    const player = machine.current;
    player.notify = setPresentation;
    for (const event of events) {
      if (event.sequence > lastSequence.current && event.id === room.id) {
        lastSequence.current = event.sequence;
        player.enqueue(boardFrame(event));
      }
    }
    return () => { player.notify = () => {}; };
  }, [events, room.id]);
  const complete = useCallback((id) => machine.current.complete(id), []);
  return { ...presentation, complete, animating: Boolean(presentation.transition) };
}
