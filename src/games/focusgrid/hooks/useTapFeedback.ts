import { useCallback, useEffect, useRef, useState } from 'react';

export type TapFeedback = {
  value: number;
  type: 'correct' | 'incorrect';
};

export function useTapFeedback(durationMs = 420) {
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapFeedback, setTapFeedback] = useState<TapFeedback | null>(null);

  const clearFeedback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const applyTapFeedback = useCallback(
    (feedback: TapFeedback) => {
      clearFeedback();
      setTapFeedback(feedback);
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setTapFeedback(null);
      }, durationMs);
    },
    [clearFeedback, durationMs],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearFeedback();
    };
  }, [clearFeedback]);

  return {
    tapFeedback,
    setTapFeedback,
    clearFeedback,
    applyTapFeedback,
  };
}