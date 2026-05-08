import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { setWindowAlwaysOnTop } from "@/lib/windows";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

export function useWindowAlwaysOnTop() {
  const enabled = usePreferencesStore(
    (state) => resolvePreferenceValue(state.prefs, "window_always_on_top") === "true",
  );

  useEffect(() => {
    setWindowAlwaysOnTop(enabled).then((result) =>
      Result.pipe(
        result,
        Result.inspectError(() => {
          // Browser dev mode or unsupported platform: no-op
        }),
      ),
    );
  }, [enabled]);
}
