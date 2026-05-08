import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBrowserViewController } from "@/components/reader/hooks/browser/use-browser-view-controller";
import { MOTION_BROWSER_OVERLAY_CLASS_NAME, MOTION_BROWSER_THEME_WIPE_OVERLAY_CLASS_NAME } from "@/constants/motion";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import type { BrowserViewProps } from "./browser-view.types";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const BROWSER_THEME_WIPE_DURATION_MS = 750;

function getSystemTheme() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function BrowserThemeWipeOverlay() {
  const themePreference = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "theme"));
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const resolvedTheme = useMemo(
    () => (themePreference === "system" ? systemTheme : themePreference),
    [systemTheme, themePreference],
  );
  const cleanupTimeoutRef = useRef<number | null>(null);
  const previousResolvedThemeRef = useRef<typeof resolvedTheme | null>(null);
  const [wipeKey, setWipeKey] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (previousResolvedThemeRef.current === null) {
      previousResolvedThemeRef.current = resolvedTheme;
      return undefined;
    }

    if (previousResolvedThemeRef.current === resolvedTheme) {
      return undefined;
    }
    previousResolvedThemeRef.current = resolvedTheme;

    if (prefersReducedMotion()) {
      return undefined;
    }

    setWipeKey((value) => value + 1);
    if (cleanupTimeoutRef.current !== null) {
      window.clearTimeout(cleanupTimeoutRef.current);
    }
    cleanupTimeoutRef.current = window.setTimeout(() => {
      cleanupTimeoutRef.current = null;
      setWipeKey(0);
    }, BROWSER_THEME_WIPE_DURATION_MS);

    return undefined;
  }, [resolvedTheme]);

  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
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
  const [overlayOpen, setOverlayOpen] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (browserCloseInFlight) {
      setOverlayOpen(false);
      return undefined;
    }

    if (prefersReducedMotion()) {
      setOverlayOpen(true);
      return undefined;
    }

    setOverlayOpen(false);
    const frame = window.requestAnimationFrame(() => {
      setOverlayOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [browserCloseInFlight]);

  return (
    <div
      ref={controller.overlayRef}
      data-browser-overlay-client-root=""
      data-testid="browser-overlay-shell"
      data-open={overlayOpen ? "true" : "false"}
      className={cn(
        MOTION_BROWSER_OVERLAY_CLASS_NAME,
        "pointer-events-auto absolute inset-0 z-20 isolate overflow-hidden bg-browser-overlay-shell backdrop-blur-sm",
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
        className="absolute inset-0 z-0 cursor-default bg-background/0"
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

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, toolbarActions }: BrowserViewProps) {
  const controller = useBrowserViewController({ scope, onCloseOverlay });

  if (!controller.browserUrl) return null;

  if (scope === "main-stage" && typeof document !== "undefined") {
    const portalTarget = document.querySelector<HTMLElement>("[data-browser-overlay-root]");
    if (portalTarget) {
      return createPortal(
        <BrowserOverlayShell controller={controller} scope={scope} labels={labels} toolbarActions={toolbarActions} />,
        portalTarget,
      );
    }
  }

  return <BrowserOverlayShell controller={controller} scope={scope} labels={labels} toolbarActions={toolbarActions} />;
}
