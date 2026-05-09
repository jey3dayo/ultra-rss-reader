import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { setWindowIcon } from "@/lib/window/windows";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";

const DARK_ICON_PATH = "/icons/app-icon-dark.png";
const LIGHT_ICON_PATH = "/icons/app-icon-light.png";

type AppIconTheme = "light" | "dark";

type AppIconRequest = {
  theme: AppIconTheme;
  platformLoaded: boolean;
  supportsRuntimeWindowIconReplacement: boolean;
};

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
  theme: AppIconTheme,
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
  const mountedRef = useRef(false);
  const pendingRequestRef = useRef<AppIconRequest | null>(null);
  const applyingRef = useRef(false);
  const drainScheduledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRequestRef.current = null;
      drainScheduledRef.current = false;
    };
  }, []);

  const drainIconRequests = useCallback(async () => {
    if (applyingRef.current) {
      return;
    }

    applyingRef.current = true;

    try {
      while (mountedRef.current && pendingRequestRef.current !== null) {
        const request = pendingRequestRef.current;
        pendingRequestRef.current = null;

        await setAppIcon(request.theme, {
          platformLoaded: request.platformLoaded,
          supportsRuntimeWindowIconReplacement: request.supportsRuntimeWindowIconReplacement,
        });
      }
    } finally {
      applyingRef.current = false;
    }
  }, []);

  const requestAppIcon = useCallback(
    (request: AppIconRequest) => {
      pendingRequestRef.current = request;
      if (drainScheduledRef.current) {
        return;
      }

      drainScheduledRef.current = true;
      queueMicrotask(() => {
        drainScheduledRef.current = false;
        void drainIconRequests();
      });
    },
    [drainIconRequests],
  );

  useEffect(() => {
    if (theme !== "system") {
      requestAppIcon({
        theme: theme === "light" ? "light" : "dark",
        platformLoaded,
        supportsRuntimeWindowIconReplacement,
      });
      return;
    }

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      requestAppIcon({
        theme: matches ? "dark" : "light",
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
  }, [theme, platformLoaded, supportsRuntimeWindowIconReplacement, requestAppIcon]);
}
