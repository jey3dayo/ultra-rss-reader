import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useBrowserViewController } from "@/components/reader/hooks/browser/use-browser-view-controller";
import { MOTION_BROWSER_OVERLAY_CLASS_NAME, MOTION_BROWSER_THEME_WIPE_OVERLAY_CLASS_NAME } from "@/constants/motion";
import { subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import type { BrowserOverlayToolbarAction, BrowserViewScope } from "./browser-view.types";

type BrowserViewProps = {
  scope?: BrowserViewScope;
  onCloseOverlay: () => void;
  onBrowserWebviewClosed?: () => void;
  labels: {
    closeWebPreview: string;
  };
  toolbarActions?: BrowserOverlayToolbarAction[];
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const BROWSER_THEME_WIPE_DURATION_MS = 500;
const SYSTEM_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getSystemTheme() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY).matches
    ? "dark"
    : "light";
}

function subscribeSystemThemeChange(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY);
  return subscribeMatchMediaChange(mediaQuery, onStoreChange);
}

function subscribeReducedMotionChange(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  return subscribeMatchMediaChange(mediaQuery, onStoreChange);
}

function useSystemTheme() {
  return useSyncExternalStore(subscribeSystemThemeChange, getSystemTheme, () => "light");
}

function useReducedMotionPreference() {
  return useSyncExternalStore(subscribeReducedMotionChange, prefersReducedMotion, () => false);
}

function BrowserThemeWipeOverlay() {
  const themePreference = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "theme"));
  const systemTheme = useSystemTheme();
  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;
  const reducedMotion = useReducedMotionPreference();
  const cleanupTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const previousResolvedThemeRef = useRef<typeof resolvedTheme | null>(null);
  const [wipeKey, setWipeKey] = useState(0);

  useEffect(() => {
    if (!reducedMotion) {
      return undefined;
    }

    if (cleanupTimeoutRef.current !== null) {
      window.clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    setWipeKey(0);
    return undefined;
  }, [reducedMotion]);

  useEffect(() => {
    if (previousResolvedThemeRef.current === null) {
      previousResolvedThemeRef.current = resolvedTheme;
      return undefined;
    }

    if (previousResolvedThemeRef.current === resolvedTheme) {
      return undefined;
    }
    previousResolvedThemeRef.current = resolvedTheme;

    if (reducedMotion) {
      return undefined;
    }

    setWipeKey((value) => value + 1);
    if (cleanupTimeoutRef.current !== null) {
      window.clearTimeout(cleanupTimeoutRef.current);
    }
    cleanupTimeoutRef.current = window.setTimeout(() => {
      cleanupTimeoutRef.current = null;
      if (!mountedRef.current) {
        return;
      }
      setWipeKey(0);
    }, BROWSER_THEME_WIPE_DURATION_MS);

    return undefined;
  }, [reducedMotion, resolvedTheme]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, []);

  if (wipeKey === 0) {
    return null;
  }

  return (
    <div
      key={wipeKey}
      aria-hidden="true"
      data-testid="browser-theme-wipe-overlay"
      className={cn(
        MOTION_BROWSER_THEME_WIPE_OVERLAY_CLASS_NAME,
        "pointer-events-none absolute inset-0 z-[45] bg-background",
      )}
    />
  );
}

type BrowserOverlayOpenAction = { type: "close" } | { type: "open" };

function createInitialBrowserOverlayOpenState() {
  return prefersReducedMotion();
}

function browserOverlayOpenReducer(state: boolean, action: BrowserOverlayOpenAction) {
  switch (action.type) {
    case "close":
      return false;
    case "open":
      return true;
  }

  return state;
}

function useBrowserOverlayOpenState(browserCloseInFlight: boolean) {
  const [overlayOpen, dispatchOverlayOpen] = useReducer(
    browserOverlayOpenReducer,
    undefined,
    createInitialBrowserOverlayOpenState,
  );

  useEffect(() => {
    if (browserCloseInFlight) {
      dispatchOverlayOpen({ type: "close" });
      return undefined;
    }

    if (prefersReducedMotion()) {
      dispatchOverlayOpen({ type: "open" });
      return undefined;
    }

    dispatchOverlayOpen({ type: "close" });
    const frame = window.requestAnimationFrame(() => {
      dispatchOverlayOpen({ type: "open" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [browserCloseInFlight]);

  return overlayOpen;
}

function BrowserOverlayShell({
  controller,
  scope,
  labels,
  toolbarActions,
}: {
  controller: ReturnType<typeof useBrowserViewController>;
  scope: BrowserViewProps["scope"];
  labels: BrowserViewProps["labels"];
  toolbarActions?: BrowserViewProps["toolbarActions"];
}) {
  const browserCloseInFlight = useUiStore((s) => s.browserCloseInFlight);
  const overlayOpen = useBrowserOverlayOpenState(browserCloseInFlight);

  return (
    <div
      ref={controller.overlayRef}
      data-browser-overlay-client-root=""
      data-testid="browser-overlay-shell"
      data-open={overlayOpen ? "true" : "false"}
      className={cn(
        MOTION_BROWSER_OVERLAY_CLASS_NAME,
        "absolute inset-0 z-20 isolate overflow-hidden bg-browser-overlay-shell backdrop-blur-sm",
        scope === "main-stage" ? "pointer-events-none" : "pointer-events-auto",
      )}
    >
      <div
        aria-hidden="true"
        data-testid="browser-overlay-veil"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--browser-overlay-shell-veil)" }}
      />
      {controller.geometry.chromeRail.visible ? (
        <div
          data-tauri-drag-region
          aria-hidden="true"
          data-testid="browser-overlay-top-rail"
          style={{
            left: `${controller.geometry.chromeRail.left}px`,
            right: `${controller.geometry.chromeRail.right}px`,
            top: `${controller.geometry.chromeRail.top}px`,
            height: `${controller.geometry.chromeRail.height}px`,
            backgroundImage: "var(--browser-overlay-rail)",
            borderColor: "var(--color-browser-overlay-rail-border)",
          }}
          className={cn(
            "absolute z-[50] border-b backdrop-blur-md",
            scope === "main-stage" ? "rounded-none" : "rounded-t-lg",
          )}
        />
      ) : null}
      <div
        aria-hidden="true"
        data-testid="browser-overlay-scrim"
        className={cn(
          "absolute inset-0 z-0 cursor-default bg-background/0",
          scope === "main-stage" && "pointer-events-none",
        )}
        onClick={scope === "main-stage" ? undefined : controller.handleCloseOverlay}
      />
      <BrowserOverlayChrome
        controller={controller}
        presentation={controller.presentation}
        closeWebPreviewLabel={labels.closeWebPreview}
        toolbarActions={toolbarActions}
      />
      <BrowserOverlayStage controller={controller} />
      <BrowserThemeWipeOverlay />
    </div>
  );
}

export function BrowserView({
  scope = "content-pane",
  onCloseOverlay,
  onBrowserWebviewClosed,
  labels,
  toolbarActions,
}: BrowserViewProps) {
  const portalTarget =
    scope === "main-stage" && typeof document !== "undefined"
      ? document.querySelector<HTMLElement>("[data-browser-overlay-root]")
      : null;
  const resolvedScope = scope === "main-stage" && !portalTarget ? "content-pane" : scope;
  const controller = useBrowserViewController({ scope: resolvedScope, onCloseOverlay, onBrowserWebviewClosed });

  if (!controller.browserUrl) return null;

  if (scope === "main-stage" && portalTarget) {
    return createPortal(
      <BrowserOverlayShell
        controller={controller}
        scope={resolvedScope}
        labels={labels}
        toolbarActions={toolbarActions}
      />,
      portalTarget,
    );
  }

  return (
    <BrowserOverlayShell
      controller={controller}
      scope={resolvedScope}
      labels={labels}
      toolbarActions={toolbarActions}
    />
  );
}
