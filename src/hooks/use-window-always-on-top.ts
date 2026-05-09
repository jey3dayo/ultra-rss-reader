import { Result } from "@praha/byethrow";
import { useEffect, useRef } from "react";
import { hasTauriRuntime } from "@/lib/window/window-chrome";
import { setWindowAlwaysOnTop } from "@/lib/window/windows";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

function isUnsupportedAlwaysOnTopError(error: Error): boolean {
  return /\b(?:not supported|unsupported)\b/i.test(error.message);
}

export function useWindowAlwaysOnTop() {
  const requestIdRef = useRef(0);
  const enabled = usePreferencesStore(
    (state) => resolvePreferenceValue(state.prefs, "window_always_on_top") === "true",
  );

  useEffect(() => {
    if (!hasTauriRuntime()) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setWindowAlwaysOnTop(enabled).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          if (isUnsupportedAlwaysOnTopError(error)) {
            return;
          }

          console.warn("Failed to update window always-on-top state:", error.message);
        }),
      ),
    );

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [enabled]);
}
