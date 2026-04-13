import { useCallback, useEffect, useRef } from "react";

export function useFeedTreeHandleClickSuppression() {
  const suppressHandleClickRef = useRef(false);
  const suppressHandleClickTimeoutRef = useRef<number | null>(null);

  const clearSuppressHandleClickTimer = useCallback(() => {
    if (suppressHandleClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressHandleClickTimeoutRef.current);
      suppressHandleClickTimeoutRef.current = null;
    }
  }, []);

  const consumeSuppressedHandleClick = useCallback(() => suppressHandleClickRef.current, []);

  const queueSuppressHandleClickReset = useCallback(() => {
    clearSuppressHandleClickTimer();
    suppressHandleClickRef.current = true;
    suppressHandleClickTimeoutRef.current = window.setTimeout(() => {
      suppressHandleClickRef.current = false;
      suppressHandleClickTimeoutRef.current = null;
    }, 0);
  }, [clearSuppressHandleClickTimer]);

  useEffect(() => {
    return () => {
      clearSuppressHandleClickTimer();
    };
  }, [clearSuppressHandleClickTimer]);

  return {
    consumeSuppressedHandleClick,
    queueSuppressHandleClickReset,
  } as const;
}
