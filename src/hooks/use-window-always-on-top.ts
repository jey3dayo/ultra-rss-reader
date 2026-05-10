import { Result } from "@praha/byethrow";
import { useEffect, useRef } from "react";
import { hasTauriRuntime } from "@/lib/window/window-chrome";
import { isWindowAlwaysOnTop, isWindowFullscreen, setWindowAlwaysOnTop } from "@/lib/window/windows";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

function isUnsupportedAlwaysOnTopError(error: Error): boolean {
  return /\b(?:not supported|unsupported)\b/i.test(error.message);
}

function logAlwaysOnTopFailure(error: Error): void {
  if (isUnsupportedAlwaysOnTopError(error)) {
    return;
  }

  console.warn("Failed to update window always-on-top state:", error.message);
}

async function verifyWindowAlwaysOnTopRuntimeState(enabled: boolean, isLatestRequest: () => boolean): Promise<void> {
  const alwaysOnTopResult = await isWindowAlwaysOnTop();
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(alwaysOnTopResult)) {
    console.warn("Failed to read window always-on-top state:", Result.unwrapError(alwaysOnTopResult).message);
    return;
  }

  const actualAlwaysOnTop = Result.unwrap(alwaysOnTopResult);
  if (actualAlwaysOnTop !== enabled) {
    console.warn(
      "Window always-on-top preference drift detected:",
      `preferred=${String(enabled)}`,
      `actual=${String(actualAlwaysOnTop)}`,
    );
  }

  if (!enabled) {
    return;
  }

  const fullscreenResult = await isWindowFullscreen();
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(fullscreenResult)) {
    console.warn("Failed to read window fullscreen state:", Result.unwrapError(fullscreenResult).message);
    return;
  }

  if (Result.unwrap(fullscreenResult)) {
    console.warn("Window always-on-top preference is enabled while fullscreen is active.");
  }
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

    setWindowAlwaysOnTop(enabled)
      .then(async (result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        Result.pipe(
          result,
          Result.inspectError((error) => {
            if (requestId !== requestIdRef.current) {
              return;
            }

            logAlwaysOnTopFailure(error);
          }),
        );

        if (Result.isFailure(result)) {
          return;
        }

        await verifyWindowAlwaysOnTopRuntimeState(enabled, () => requestId === requestIdRef.current);
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.warn("Window always-on-top command rejected:", error);
      });

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [enabled]);
}
