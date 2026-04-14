import { listen } from "@tauri-apps/api/event";
import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { APP_EVENTS } from "../constants/events";
import { useAppIconTheme } from "../hooks/use-app-icon-theme";
import { useBadge } from "../hooks/use-badge";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useMenuEvents } from "../hooks/use-menu-events";
import { useUpdater } from "../hooks/use-updater";
import { type BrowserDebugGeometrySnapshot, getBrowserGeometryRows } from "../lib/browser-debug-geometry";
import { copyValueToClipboard } from "../lib/clipboard";
import { emitDebugInputTrace } from "../lib/debug-input-trace";
import { cn } from "../lib/utils";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "../lib/window-chrome";
import { usePlatformStore } from "../stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppLayout } from "./app-layout";
import { IndeterminateProgress } from "./shared/indeterminate-progress";

const LazyFocusDebugHudView = lazy(async () => {
  const mod = await import("./debug/focus-debug-hud-view");
  return { default: mod.FocusDebugHudView };
});

const LazyCommandPalette = lazy(async () => {
  const mod = await import("./reader/command-palette");
  return { default: mod.CommandPalette };
});

const LazyShortcutsHelpModal = lazy(async () => {
  const mod = await import("./reader/shortcuts-help-modal");
  return { default: mod.ShortcutsHelpModal };
});

const LazySettingsModal = lazy(async () => {
  const mod = await import("./settings/settings-modal");
  return { default: mod.SettingsModal };
});

function Toast() {
  const { t } = useTranslation("common");
  const { toastMessage, clearToast } = useUiStore();
  if (!toastMessage) return null;

  const { message, progress, actions } = toastMessage;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={clearToast}
          aria-label={t("close")}
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {progress != null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          )}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function describeActiveElement(element: Element | null): string {
  if (!(element instanceof HTMLElement)) {
    return "none";
  }

  const parts: string[] = [element.tagName.toLowerCase()];
  if (element.dataset.debugHud !== undefined) {
    parts.push("debug-hud");
  }
  if (element.dataset.articleId) {
    parts.push(`article=${element.dataset.articleId}`);
  }
  if (element.dataset.browserOverlayReturnFocus) {
    parts.push(`return=${element.dataset.browserOverlayReturnFocus}`);
  }
  const role = element.getAttribute("role");
  if (role) {
    parts.push(`role=${role}`);
  }
  const testId = element.dataset.testid;
  if (testId) {
    parts.push(`testid=${testId}`);
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    parts.push(`label=${ariaLabel}`);
  }

  return parts.join(" | ");
}

function FocusDebugHud() {
  const MAX_TRACE_LINES = 20;
  const { t } = useTranslation("reader");
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const selectedArticleId = useUiStore((state) => state.selectedArticleId);
  const browserCloseInFlight = useUiStore((state) => state.browserCloseInFlight);
  const pendingBrowserCloseAction = useUiStore((state) => state.pendingBrowserCloseAction);
  const showToast = useUiStore((state) => state.showToast);
  const [activeElementDescription, setActiveElementDescription] = useState("none");
  const [traces, setTraces] = useState<string[]>([]);
  const [browserGeometry, setBrowserGeometry] = useState<BrowserDebugGeometrySnapshot | null>(null);

  useEffect(() => {
    const update = () => {
      setActiveElementDescription(describeActiveElement(document.activeElement));
    };

    update();
    const keyTraceListener = (event: KeyboardEvent) => {
      setTraces((current) => [
        ...current.slice(-(MAX_TRACE_LINES - 1)),
        `${new Date().toISOString().slice(11, 23)} raw-key ${event.key} target=${describeActiveElement(
          event.target instanceof Element ? event.target : null,
        )}`,
      ]);
    };
    window.addEventListener("focusin", update, true);
    window.addEventListener("focusout", update, true);
    window.addEventListener("keydown", update, true);
    window.addEventListener("keydown", keyTraceListener, true);
    const traceListener = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setTraces((current) => [...current.slice(-(MAX_TRACE_LINES - 1)), detail]);
    };
    const geometryListener = (event: Event) => {
      setBrowserGeometry((event as CustomEvent<BrowserDebugGeometrySnapshot | null>).detail);
    };
    const pointerTraceListener = (event: PointerEvent) => {
      setTraces((current) => [
        ...current.slice(-(MAX_TRACE_LINES - 1)),
        `${new Date().toISOString().slice(11, 23)} raw-pointer ${event.type} x=${Math.round(event.clientX)} y=${Math.round(event.clientY)} target=${describeActiveElement(
          event.target instanceof Element ? event.target : null,
        )}`,
      ]);
    };
    const clickTraceListener = (event: MouseEvent) => {
      setTraces((current) => [
        ...current.slice(-(MAX_TRACE_LINES - 1)),
        `${new Date().toISOString().slice(11, 23)} raw-click x=${Math.round(event.clientX)} y=${Math.round(event.clientY)} target=${describeActiveElement(
          event.target instanceof Element ? event.target : null,
        )}`,
      ]);
    };
    window.addEventListener(APP_EVENTS.debugInputTrace, traceListener);
    window.addEventListener(APP_EVENTS.browserDebugGeometry, geometryListener);
    window.addEventListener("pointerdown", pointerTraceListener, true);
    window.addEventListener("click", clickTraceListener, true);

    return () => {
      window.removeEventListener("focusin", update, true);
      window.removeEventListener("focusout", update, true);
      window.removeEventListener("keydown", update, true);
      window.removeEventListener("keydown", keyTraceListener, true);
      window.removeEventListener(APP_EVENTS.debugInputTrace, traceListener);
      window.removeEventListener(APP_EVENTS.browserDebugGeometry, geometryListener);
      window.removeEventListener("pointerdown", pointerTraceListener, true);
      window.removeEventListener("click", clickTraceListener, true);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<string>("browser-webview-debug-input", (event) => {
      if (cancelled) {
        return;
      }
      setTraces((current) => [...current.slice(-5), event.payload]);
    })
      .then((cleanup) => {
        if (cancelled) {
          cleanup();
          return;
        }
        unlisten = cleanup;
      })
      .catch(() => {
        // browser mode / non-tauri
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const debugHudText = [
    `pane=${focusedPane} mode=${contentMode} article=${selectedArticleId ?? "none"}`,
    `closing=${browserCloseInFlight} pending=${pendingBrowserCloseAction ?? "none"}`,
    activeElementDescription,
    ...traces,
  ].join("\n");

  const handleCopy = async () => {
    emitDebugInputTrace("hud-copy start");
    await copyValueToClipboard(debugHudText, {
      onSuccess: () => {
        emitDebugInputTrace("hud-copy success");
        showToast(t("copied_to_clipboard"));
      },
      onError: (message, error) => {
        emitDebugInputTrace(`hud-copy error=${message}`);
        console.error("Failed to copy focus debug HUD:", error);
        showToast(message);
      },
    });
  };

  const hud = (
    <Suspense fallback={null}>
      <LazyFocusDebugHudView
        focusedPane={focusedPane}
        contentMode={contentMode}
        selectedArticleId={selectedArticleId}
        browserCloseInFlight={browserCloseInFlight}
        pendingBrowserCloseAction={pendingBrowserCloseAction}
        activeElementDescription={activeElementDescription}
        browserGeometryRows={browserGeometry ? getBrowserGeometryRows(browserGeometry) : []}
        traces={traces}
        onCopyClick={() => {
          emitDebugInputTrace("hud-click");
          void handleCopy();
        }}
        onCopyPointerDown={(event) => {
          event.preventDefault();
          emitDebugInputTrace("hud-pointer-down");
        }}
      />
    </Suspense>
  );

  if (typeof document !== "undefined") {
    return createPortal(hud, document.body);
  }

  return hud;
}

export function AppShell() {
  useAppIconTheme();
  useBadge();
  useBreakpoint();
  useKeyboard();
  useMenuEvents();
  useUpdater();
  const loadPlatformInfo = usePlatformStore((state) => state.loadPlatformInfo);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const shortcutsHelpOpen = useUiStore((state) => state.shortcutsHelpOpen);
  const closeShortcutsHelp = useUiStore((state) => state.closeShortcutsHelp);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const appLoading = useUiStore((state) => state.appLoading);
  const prefs = usePreferencesStore((state) => state.prefs);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });
  const showFocusDebugHud = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";

  useEffect(() => {
    loadPlatformInfo();
  }, [loadPlatformInfo]);

  return (
    <div className="relative flex h-full flex-col">
      <div
        data-browser-overlay-root=""
        className={cn(
          "pointer-events-none absolute inset-0 z-40",
          overlayTitlebar && "desktop-titlebar-offset desktop-overlay-titlebar",
        )}
      />
      {appLoading && <IndeterminateProgress className="shrink-0" />}
      <div className="min-h-0 flex-1">
        <AppLayout />
      </div>
      {settingsOpen ? (
        <Suspense fallback={null}>
          <LazySettingsModal />
        </Suspense>
      ) : null}
      <AppConfirmDialog />
      {shortcutsHelpOpen ? (
        <Suspense fallback={null}>
          <LazyShortcutsHelpModal
            open={shortcutsHelpOpen}
            onOpenChange={(nextOpen) => !nextOpen && closeShortcutsHelp()}
          />
        </Suspense>
      ) : null}
      <Toast />
      {commandPaletteOpen ? (
        <Suspense fallback={null}>
          <LazyCommandPalette />
        </Suspense>
      ) : null}
      {showFocusDebugHud ? <FocusDebugHud /> : null}
    </div>
  );
}
