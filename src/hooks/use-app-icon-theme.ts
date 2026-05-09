import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";
import { setWindowIcon } from "@/lib/window/windows";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";

type AppIconTheme = "light" | "dark";

export const APP_ICON_THEME_PATHS = {
  dark: "/icons/app-icon-dark.png",
  light: "/icons/app-icon-light.png",
} as const satisfies Record<AppIconTheme, string>;

type AppIconRequest = {
  theme: AppIconTheme;
  platformLoaded: boolean;
  supportsRuntimeWindowIconReplacement: boolean;
};

function isSameAppIconRequest(a: AppIconRequest, b: AppIconRequest) {
  return (
    a.theme === b.theme &&
    a.platformLoaded === b.platformLoaded &&
    a.supportsRuntimeWindowIconReplacement === b.supportsRuntimeWindowIconReplacement
  );
}

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
    await setWindowIcon(APP_ICON_THEME_PATHS[theme]),
    Result.inspectError((error) => {
      console.error(`Failed to apply ${theme} app icon theme`, error);
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

        if (pendingRequestRef.current !== null && isSameAppIconRequest(request, pendingRequestRef.current)) {
          pendingRequestRef.current = null;
        }
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
        void drainIconRequests().catch((error: unknown) => {
          console.error("Failed to apply app icon theme:", error);
        });
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

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
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

    return subscribeMatchMediaChange(mediaQuery, handleChange);
  }, [theme, platformLoaded, supportsRuntimeWindowIconReplacement, requestAppIcon]);
}
