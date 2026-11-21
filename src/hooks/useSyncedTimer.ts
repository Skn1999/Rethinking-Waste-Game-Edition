import { useEffect, useState } from 'react';
import { getLiveRemainingMs, useGameStore } from '../store/gameStore';

export function useSyncedTimer(): {
  remainingMs: number;
  totalSeconds: number;
  status: 'idle' | 'running' | 'paused';
} {
  const timerStatus = useGameStore((s) => s.timerStatus);
  const timerRemainingMs = useGameStore((s) => s.timerRemainingMs);
  const timerStartedAt = useGameStore((s) => s.timerStartedAt);
  const totalSeconds = useGameStore((s) => s.settings.timerSeconds);

  const [displayMs, setDisplayMs] = useState(() =>
    getLiveRemainingMs({ timerStatus, timerRemainingMs, timerStartedAt })
  );

  useEffect(() => {
    setDisplayMs(
      getLiveRemainingMs({ timerStatus, timerRemainingMs, timerStartedAt })
    );

    if (timerStatus !== 'running' || timerStartedAt === null) {
      return;
    }

    let rafId = 0;
    const tick = () => {
      const next = getLiveRemainingMs({
        timerStatus,
        timerRemainingMs,
        timerStartedAt,
      });
      setDisplayMs(next);
      if (next > 0) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [timerStatus, timerRemainingMs, timerStartedAt]);

  return {
    remainingMs: displayMs,
    totalSeconds,
    status: timerStatus,
  };
}
