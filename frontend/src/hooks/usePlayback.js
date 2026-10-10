import { useCallback, useEffect, useState } from 'react';

export const SPEEDS = Object.freeze([
  { label: '0.5×', ms: 800 },
  { label: '1×', ms: 400 },
  { label: '2×', ms: 200 },
  { label: '4×', ms: 100 },
  { label: '10×', ms: 40 },
]);

/** Cycle cursor with auto-play. `total` is the number of cycles. */
export function usePlayback(total) {
  const [rawIndex, setRawIndex] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [speed, setSpeed] = useState(1);

  const last = Math.max(0, total - 1);
  const index = Math.min(rawIndex, last);
  const atEnd = index >= last;
  // Playback stops by itself at the end; derived, so no effect is needed.
  const playing = wantsPlay && !atEnd && total > 0;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setRawIndex((i) => Math.min(i + 1, last)), SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [playing, speed, last]);

  const seek = useCallback((i) => {
    setWantsPlay(false);
    setRawIndex(Math.max(0, Math.min(i, last)));
  }, [last]);

  const step = useCallback((delta) => {
    setWantsPlay(false);
    setRawIndex((i) => Math.max(0, Math.min(Math.min(i, last) + delta, last)));
  }, [last]);

  const toggle = useCallback(() => {
    if (total === 0) return;
    if (!playing && atEnd) setRawIndex(0);
    setWantsPlay(!playing);
  }, [playing, atEnd, total]);

  const reset = useCallback(() => {
    setWantsPlay(false);
    setRawIndex(0);
  }, []);

  return { index, total, playing, atEnd, speed, setSpeed, seek, step, toggle, reset };
}
