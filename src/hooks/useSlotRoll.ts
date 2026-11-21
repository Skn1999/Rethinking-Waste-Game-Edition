import { useEffect, useRef, useState } from 'react';
import type { DrawAnimationPayload } from '../types/game';

const ROLL_DURATION_MS = 2500;

interface UseSlotRollOptions {
  isDrawing: boolean;
  drawAnimation: DrawAnimationPayload | null;
  currentNumber: number | null;
  reducedMotion: boolean;
  onStep?: (progress: number) => void;
  onFinish?: () => void;
}

/**
 * Runs a 2.5s cubic ease-out slot-machine roll synchronized to `drawAnimation.startedAt`,
 * always landing deterministically on `drawAnimation.target`.
 */
export function useSlotRoll({
  isDrawing,
  drawAnimation,
  currentNumber,
  reducedMotion,
  onStep,
  onFinish,
}: UseSlotRollOptions): {
  displayedNumber: number | null;
  isRolling: boolean;
} {
  const [displayedNumber, setDisplayedNumber] = useState<number | null>(currentNumber);
  const finishedRef = useRef<number | null>(null);
  const lastStepIdxRef = useRef<number>(-1);
  const onStepRef = useRef(onStep);
  const onFinishRef = useRef(onFinish);

  onStepRef.current = onStep;
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (!isDrawing || !drawAnimation) {
      setDisplayedNumber(currentNumber);
      lastStepIdxRef.current = -1;
      return;
    }

    const prefersReduced =
      reducedMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    if (prefersReduced || drawAnimation.candidates.length <= 1) {
      setDisplayedNumber(drawAnimation.target);
      if (onFinishRef.current && finishedRef.current !== drawAnimation.startedAt) {
        finishedRef.current = drawAnimation.startedAt;
        onFinishRef.current();
      }
      return;
    }

    let rafId = 0;
    const { candidates, target, startedAt } = drawAnimation;
    lastStepIdxRef.current = -1;

    const frame = () => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      const t = Math.min(1, elapsed / ROLL_DURATION_MS);
      // Cubic ease-out: fast start, dramatic slow-down at the end
      const eased = 1 - Math.pow(1 - t, 3);
      const idx = Math.min(
        candidates.length - 1,
        Math.floor(eased * candidates.length)
      );

      if (t >= 1) {
        setDisplayedNumber(target);
        if (onFinishRef.current && finishedRef.current !== startedAt) {
          finishedRef.current = startedAt;
          onFinishRef.current();
        }
        return;
      }

      if (idx !== lastStepIdxRef.current) {
        lastStepIdxRef.current = idx;
        setDisplayedNumber(candidates[idx]);
        onStepRef.current?.(t);
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isDrawing, drawAnimation, currentNumber, reducedMotion]);

  return {
    displayedNumber,
    isRolling: isDrawing && Boolean(drawAnimation),
  };
}
