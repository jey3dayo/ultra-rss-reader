import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { setWindowIcon } from "@/lib/windows";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

const DARK_ICON_PATH = "/icons/app-icon-dark.png";
const LIGHT_ICON_PATH = "/icons/app-icon-light.png";

function shouldSkipRuntimeIconReplacement({
  platformLoaded,
  supportsRuntimeWindowIconReplacement,
}: {
  platformLoaded: boolean;
  supportsRuntimeWindowIconReplacement: boolean;
}) {
  return !platformLoaded || !supportsRuntimeWindowIconReplacement;
}

async function setAppIcon(
  theme: "light" | "dark",
  options: {
    platformLoaded: boolean;
    supportsRuntimeWindowIconReplacement: boolean;
  },
): Promise<void> {
  if (shouldSkipRuntimeIconReplacement(options)) {
    return;
  }

  Result.pipe(
    await setWindowIcon(theme === "light" ? LIGHT_ICON_PATH : DARK_ICON_PATH),
    Result.inspectError(() => {
      // Browser dev mode or unsupported platform: no-op
    }),
  );
}

export function useAppIconTheme() {
  const theme = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "theme"));
  const platformLoaded = usePlatformStore((state) => state.loaded);
  const supportsRuntimeWindowIconReplacement = usePlatformStore(
    (state) => state.platform.capabilities.supports_runtime_window_icon_replacement,
  );

  useEffect(() => {
    if (theme !== "system") {
      void setAppIcon(theme === "light" ? "light" : "dark", {
        platformLoaded,
        supportsRuntimeWindowIconReplacement,
      });
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      void setAppIcon(matches ? "dark" : "light", {
        platformLoaded,
        supportsRuntimeWindowIconReplacement,
      });
    };

    apply(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      apply(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, platformLoaded, supportsRuntimeWindowIconReplacement]);
}
