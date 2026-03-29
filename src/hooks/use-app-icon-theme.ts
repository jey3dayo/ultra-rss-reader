import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { setWindowIcon } from "@/lib/windows";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

const DARK_ICON_PATH = "/icons/app-icon-dark.png";
const LIGHT_ICON_PATH = "/icons/app-icon-light.png";

async function setAppIcon(theme: "light" | "dark"): Promise<void> {
  Result.pipe(
    await setWindowIcon(theme === "light" ? LIGHT_ICON_PATH : DARK_ICON_PATH),
    Result.inspectError(() => {
      // Browser dev mode or unsupported platform: no-op
    }),
  );
}

export function useAppIconTheme() {
  const theme = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "theme"));

  useEffect(() => {
    if (theme !== "system") {
      void setAppIcon(theme === "light" ? "light" : "dark");
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      void setAppIcon(matches ? "dark" : "light");
    };

    apply(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      apply(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);
}
