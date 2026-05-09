import { useEffect, useRef } from "react";

export function useTagDialogAutofocus(open: boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (pendingFocusFrameRef.current !== frame) {
        return;
      }

      pendingFocusFrameRef.current = null;
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    pendingFocusFrameRef.current = frame;

    return () => {
      if (pendingFocusFrameRef.current === frame) {
        pendingFocusFrameRef.current = null;
        cancelAnimationFrame(frame);
      }
    };
  }, [open]);

  return inputRef;
}
