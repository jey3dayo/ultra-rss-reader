import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useState } from "react";

function isKeyboardContextMenuEvent(event: ReactKeyboardEvent<HTMLElement>) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

export function useContextMenuTargetSnapshot<T>(target: T) {
  const [snapshot, setSnapshot] = useState<T | null>(null);

  const captureTarget = useCallback(() => {
    setSnapshot(target);
  }, [target]);

  const captureKeyboardTarget = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (isKeyboardContextMenuEvent(event)) {
        setSnapshot(target);
      }
    },
    [target],
  );

  const clearTarget = useCallback(() => {
    setSnapshot(null);
  }, []);

  return {
    contextMenuTarget: snapshot ?? target,
    captureTarget,
    captureKeyboardTarget,
    clearTarget,
  };
}
