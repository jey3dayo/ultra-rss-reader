import { Result } from "@praha/byethrow";
import { useEffect, useRef } from "react";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { isWindowAlwaysOnTop, isWindowFullscreen, setWindowAlwaysOnTop } from "@/lib/window/tauri-window";
import { hasTauriRuntime } from "@/lib/window/window-chrome";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

function isUnsupportedAlwaysOnTopError(error: Error): boolean {
  return /\b(?:not supported|unsupported)\b/i.test(error.message);
}

function logAlwaysOnTopFailure(error: Error): void {
  if (isUnsupportedAlwaysOnTopError(error)) {
    return;
  }

  logRuntimeDiagnostic("window-always-on-top", "Failed to update window always-on-top state", error);
}

async function reconcileWindowAlwaysOnTopDrift(enabled: boolean, isLatestRequest: () => boolean): Promise<void> {
  const reconcileResult = await setWindowAlwaysOnTop(enabled);
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(reconcileResult)) {
    logAlwaysOnTopFailure(Result.unwrapError(reconcileResult));
    return;
  }

  const verifiedResult = await isWindowAlwaysOnTop();
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(verifiedResult)) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Failed to read window always-on-top state",
      Result.unwrapError(verifiedResult),
    );
    return;
  }

  const verifiedAlwaysOnTop = Result.unwrap(verifiedResult);
  if (verifiedAlwaysOnTop !== enabled) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Window always-on-top preference drift persisted",
      `preferred=${String(enabled)}`,
      `actual=${String(verifiedAlwaysOnTop)}`,
    );
  }
}

async function verifyWindowAlwaysOnTopRuntimeState(enabled: boolean, isLatestRequest: () => boolean): Promise<void> {
  const alwaysOnTopResult = await isWindowAlwaysOnTop();
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(alwaysOnTopResult)) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Failed to read window always-on-top state",
      Result.unwrapError(alwaysOnTopResult),
    );
    return;
  }

  const actualAlwaysOnTop = Result.unwrap(alwaysOnTopResult);
  if (actualAlwaysOnTop !== enabled) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Window always-on-top preference drift detected",
      `preferred=${String(enabled)}`,
      `actual=${String(actualAlwaysOnTop)}`,
    );
    await reconcileWindowAlwaysOnTopDrift(enabled, isLatestRequest);
  }

  if (!enabled) {
    return;
  }

  const fullscreenResult = await isWindowFullscreen();
  if (!isLatestRequest()) {
    return;
  }

  if (Result.isFailure(fullscreenResult)) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Failed to read window fullscreen state",
      Result.unwrapError(fullscreenResult),
    );
    return;
  }

  if (Result.unwrap(fullscreenResult)) {
    logRuntimeDiagnostic(
      "window-always-on-top",
      "Window always-on-top preference is enabled while fullscreen is active",
    );
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

        logRuntimeDiagnostic("window-always-on-top", "Window always-on-top command rejected", error);
      });

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [enabled]);
}
