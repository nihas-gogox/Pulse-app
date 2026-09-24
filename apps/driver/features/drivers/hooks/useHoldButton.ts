import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_DURATION_MS = 1500;

export function useHoldButton(onComplete: () => void) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete; // always fresh ref, no stale closure

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const reset = useCallback(() => {
    clearTimer();
    setHoldProgress(0);
    setIsHolding(false);
  }, []);

  const startHold = useCallback(() => {
    setIsHolding(true);
    setHoldProgress(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - startRef.current) / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(pct);
      if (pct >= 100) { 
        clearTimer(); 
        onCompleteRef.current(); 
      }
    }, 20);
  }, []); // safe empty deps — all mutable state via refs

  useEffect(() => clearTimer, []); // unmount cleanup, one-liner

  return { 
    holdProgress, 
    isHolding, 
    startHold, 
    cancelHold: reset, 
    resetHold: reset 
  };
}
