import { useEffect, useRef } from "react";
import { cancelAnimationFrameHandle, scheduleAnimationFrame } from "@/lib/dom/animation-frame";
import { focusAndSelectInput } from "@/lib/dom/input-focus";

export function useTagDialogAutofocus(open: boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = scheduleAnimationFrame(() => {
      // Timer guard pattern: only the latest scheduled frame may mutate focus state.
      if (pendingFocusFrameRef.current !== frame) {
        return;
      }

      pendingFocusFrameRef.current = null;
      focusAndSelectInput(inputRef.current);
    });
    pendingFocusFrameRef.current = frame;

    return () => {
      if (frame !== null && pendingFocusFrameRef.current === frame) {
        pendingFocusFrameRef.current = null;
        cancelAnimationFrameHandle(frame);
      }
    };
  }, [open]);

  return inputRef;
}
