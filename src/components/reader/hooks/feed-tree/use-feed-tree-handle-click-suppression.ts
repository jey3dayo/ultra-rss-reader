import { useCallback, useEffect, useRef } from "react";

type FeedTreeHandleClickSuppressionResult = {
  consumeSuppressedHandleClick: () => boolean;
  queueSuppressHandleClickReset: () => void;
};

export function useFeedTreeHandleClickSuppression(): FeedTreeHandleClickSuppressionResult {
  const suppressHandleClickRef = useRef(false);
  const suppressHandleClickTimeoutRef = useRef<number | null>(null);

  const clearSuppressHandleClickTimer = useCallback(() => {
    if (suppressHandleClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressHandleClickTimeoutRef.current);
      suppressHandleClickTimeoutRef.current = null;
    }
  }, []);

  const consumeSuppressedHandleClick = useCallback(() => {
    if (!suppressHandleClickRef.current) {
      return false;
    }

    clearSuppressHandleClickTimer();
    suppressHandleClickRef.current = false;
    return true;
  }, [clearSuppressHandleClickTimer]);

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
  };
}
