import { useCallback, useEffect, useRef, useState } from 'react';

export function useNeuroCoinFeedback(durationMs = 1600) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage(null);
  }, []);

  const showMessage = useCallback(
    (nextMessage: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setMessage(nextMessage);
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  const showNeuroCoinSpendFeedback = useCallback(
    (amount: number) => {
      showMessage(`-${Math.max(0, Math.floor(amount))} 🪙`);
    },
    [showMessage],
  );

  const showNeuroCoinError = useCallback(
    (errorMessage: string) => {
      showMessage(errorMessage);
    },
    [showMessage],
  );

  useEffect(() => clearFeedback, [clearFeedback]);

  return {
    message,
    clearFeedback,
    showMessage,
    showNeuroCoinSpendFeedback,
    showNeuroCoinError,
  };
}