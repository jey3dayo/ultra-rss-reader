import { Component, lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import {
  preloadSettingsModalModuleForDev,
  resetSettingsModalPreloadSession,
} from "@/components/app-shell/settings-modal-preload";
import { shouldStartDesktopTitlebarDrag } from "@/components/app-shell/titlebar-drag";
import { TOAST_EXIT_DURATION_MS } from "@/constants/ui-runtime";
import { APP_TOAST_PLACEMENTS, AppToastView } from "@/design-system";
import { registerBrowserWebviewDevCleanup } from "@/lib/browser/browser-webview-dev-cleanup";
import i18n from "@/lib/i18n";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";
import {
  APP_STACKING_CLASS_NAMES,
  hasTauriRuntime,
  LAYER_POINTER_EVENT_CLASS_NAMES,
  shouldUseDesktopOverlayTitlebar,
} from "@/lib/window/window-chrome";
import { bindWindowEvents, createPointerEventListener } from "@/lib/window/window-events";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { useAppIconTheme } from "../hooks/use-app-icon-theme";
import { useBadge } from "../hooks/use-badge";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useMenuEvents } from "../hooks/use-menu-events";
import { useMouseNavigation } from "../hooks/use-mouse-navigation";
import { useUpdater } from "../hooks/use-updater";
import { useWindowAlwaysOnTop } from "../hooks/use-window-always-on-top";
import {
  attachTauriListeners,
  listenTauriEvent,
  TAURI_EVENT_LISTENER_FAILURE_EVENT,
} from "../lib/runtime/tauri-event-listeners";
import { cn } from "../lib/utils";
import { startWindowDragging } from "../lib/window/tauri-window";
import { usePlatformStore } from "../stores/platform-store";
import { usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppLayout } from "./app-layout";

const LazyFocusDebugHud = lazy(async () => {
  const mod = await import("./app-shell/focus-debug-hud");
  return { default: mod.FocusDebugHud };
});

const LazyCommandPalette = lazy(async () => {
  const mod = await import("./reader/command-palette");
  return { default: mod.CommandPalette };
});

const LazyShortcutsHelpModal = lazy(async () => {
  const mod = await import("./reader/shortcuts-help-modal");
  return { default: mod.ShortcutsHelpModal };
});

async function loadSettingsModalModule() {
  await loadI18nResourceNamespace(i18n, "settings");
  return import("./settings/settings-modal");
}

const SETTINGS_MODAL_PRELOAD_FAILURE_TOAST = "設定画面の読み込みに失敗しました。アプリの再読み込みを試してください。";
const LAZY_CHUNK_FAILURE_TOAST = "画面の読み込みに失敗しました。アプリの再読み込みを試してください。";
const MAIN_WINDOW_CLOSE_BLOCKED_EVENT = "main-window-close-blocked";
const MAIN_WINDOW_CLOSE_BLOCKED_TOAST = "未保存または実行中の処理があるため、終了前に確認してください。";

function reportLazyChunkFailure(message: string) {
  useUiStore.getState().showToast(message);
}

async function startDesktopTitlebarDrag() {
  await startWindowDragging();
}

function reportSettingsModalPreloadFailure(error: unknown) {
  console.error("Failed to preload settings modal.", error);
  reportLazyChunkFailure(SETTINGS_MODAL_PRELOAD_FAILURE_TOAST);
}

function reportSettingsModalPreloadRetryFailure(error: unknown) {
  console.error("Failed to retry settings modal preload.", error);
}

preloadSettingsModalModuleForDev(loadSettingsModalModule, {
  onInitialFailure: reportSettingsModalPreloadFailure,
  onRetryFailure: reportSettingsModalPreloadRetryFailure,
});
registerBrowserWebviewDevCleanup();

const LazySettingsModal = lazy(async () => {
  const mod = await loadSettingsModalModule();
  return { default: mod.SettingsModal };
});

const TAURI_EVENT_LISTENER_FAILURE_TOAST = "デスクトップ連携の一部を開始できませんでした。";

type AppShellErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onTelemetryError?: (error: Error) => void;
  onUserRecoveryRequired?: () => void;
};

type AppShellErrorBoundaryState = {
  hasError: boolean;
};

class AppShellErrorBoundary extends Component<AppShellErrorBoundaryProps, AppShellErrorBoundaryState> {
  state: AppShellErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppShellErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onTelemetryError?.(error);
    this.props.onUserRecoveryRequired?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

function Toast() {
  const toastMessage = useUiStore((state) => state.toastMessage);
  const clearToast = useUiStore((state) => state.clearToast);
  const browserUrl = useUiStore((state) => state.browserUrl);
  const syncActive = useUiStore((state) => state.syncProgress.active);
  const [renderedToast, setRenderedToast] = useState(toastMessage);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setRenderedToast(toastMessage);
      setIsExiting(false);
      return;
    }

    if (!renderedToast) {
      return;
    }

    setIsExiting(true);
    const exitTimer = window.setTimeout(() => {
      setRenderedToast(null);
      setIsExiting(false);
    }, TOAST_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [renderedToast, toastMessage]);

  if (!renderedToast) return null;

  return (
    <AppToastView
      toastMessage={renderedToast}
      onClose={clearToast}
      placement={browserUrl ? APP_TOAST_PLACEMENTS.browserRail : APP_TOAST_PLACEMENTS.bottomRight}
      syncActionState={syncActive}
      ending={isExiting}
    />
  );
}

function ToastLiveRegion() {
  const toastAnnouncements = useUiStore((state) => state.toastAnnouncements);
  const clearToastAnnouncement = useUiStore((state) => state.clearToastAnnouncement);

  useEffect(() => {
    if (toastAnnouncements.length === 0) {
      return;
    }

    const announcementIds = toastAnnouncements.map((announcement) => announcement.id);
    const timer = window.setTimeout(() => {
      for (const id of announcementIds) {
        clearToastAnnouncement(id);
      }
    }, 1_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearToastAnnouncement, toastAnnouncements]);

  return (
    <output aria-live="polite" aria-atomic="false" className="sr-only" data-testid="toast-live-region">
      {toastAnnouncements.map((announcement) => (
        <div key={announcement.id}>{announcement.message}</div>
      ))}
    </output>
  );
}

function reportSettingsModalBoundaryError(error: Error) {
  console.error("Failed to render settings modal.", error);
}

function reportLazyChunkBoundaryError(error: Error) {
  console.error("Failed to render lazy app shell surface.", error);
  reportLazyChunkFailure(LAZY_CHUNK_FAILURE_TOAST);
}

export function AppShell() {
  useAppIconTheme();
  useBadge();
  useBreakpoint();
  useKeyboard();
  useMouseNavigation();
  useMenuEvents();
  useUpdater();
  useWindowAlwaysOnTop();
  const loadPlatformInfo = usePlatformStore((state) => state.loadPlatformInfo);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const shortcutsHelpOpen = useUiStore((state) => state.shortcutsHelpOpen);
  const closeShortcutsHelp = useUiStore((state) => state.closeShortcutsHelp);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const confirmDialogOpen = useUiStore((state) => state.confirmDialog.open);
  const closeSettings = useUiStore((state) => state.closeSettings);
  const toastMessage = useUiStore((state) => state.toastMessage);
  const prefs = usePreferencesStore((state) => state.prefs);
  const settingsPreloadSessionOpenedRef = useRef(false);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });
  const showFocusDebugHud = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const focusDebugHudTemporarilyHidden = settingsOpen || confirmDialogOpen || shortcutsHelpOpen || commandPaletteOpen;

  useEffect(() => {
    loadPlatformInfo();
  }, [loadPlatformInfo]);

  useEffect(() => resetSettingsModalPreloadSession, []);

  useEffect(() => {
    if (settingsOpen) {
      settingsPreloadSessionOpenedRef.current = true;
      return;
    }

    if (!settingsPreloadSessionOpenedRef.current) {
      return;
    }

    settingsPreloadSessionOpenedRef.current = false;
    resetSettingsModalPreloadSession();
  }, [settingsOpen]);

  useEffect(() => {
    const handleTauriEventListenerFailure = () => {
      useUiStore.getState().showToast(TAURI_EVENT_LISTENER_FAILURE_TOAST);
    };

    window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, handleTauriEventListenerFailure);
    return () => {
      window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, handleTauriEventListenerFailure);
    };
  }, []);

  useEffect(() => {
    return attachTauriListeners(
      [
        listenTauriEvent<void>(MAIN_WINDOW_CLOSE_BLOCKED_EVENT, () => {
          const { showToast } = useUiStore.getState();
          showToast({
            message: MAIN_WINDOW_CLOSE_BLOCKED_TOAST,
            persistent: true,
          });
        }),
      ],
      {
        onUnavailable: () => {
          // browser mode / non-tauri
        },
      },
    );
  }, []);

  useEffect(() => {
    if (!overlayTitlebar) {
      return;
    }

    return bindWindowEvents([
      {
        type: "pointerdown",
        listener: createPointerEventListener((event) => {
          if (!shouldStartDesktopTitlebarDrag(event)) {
            return;
          }

          void startDesktopTitlebarDrag().catch((error: unknown) => {
            console.error("Failed to start desktop titlebar drag.", error);
          });
        }),
        options: { capture: true },
      },
    ]);
  }, [overlayTitlebar]);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col bg-background text-foreground",
        overlayTitlebar && "desktop-overlay-titlebar-shell",
      )}
    >
      {overlayTitlebar ? (
        <div
          data-testid="desktop-titlebar-drag-strip"
          data-tauri-drag-region
          aria-hidden="true"
          className="desktop-titlebar-drag-strip pointer-events-none absolute inset-x-0 top-0 z-[1]"
        />
      ) : null}
      <div
        data-browser-overlay-root=""
        className={cn(
          "absolute inset-0",
          APP_STACKING_CLASS_NAMES.browserOverlayRoot,
          LAYER_POINTER_EVENT_CLASS_NAMES.inert,
          // Keep the overlay root aligned to the shell; traffic-light safe area is handled by browser geometry.
          overlayTitlebar && "desktop-overlay-titlebar",
        )}
      />
      <div className="min-h-0 flex-1">
        <AppLayout />
      </div>
      {settingsOpen ? (
        <AppShellErrorBoundary onTelemetryError={reportLazyChunkBoundaryError} onUserRecoveryRequired={closeSettings}>
          <AppShellErrorBoundary
            onTelemetryError={reportSettingsModalBoundaryError}
            onUserRecoveryRequired={closeSettings}
          >
            <Suspense fallback={null}>
              <LazySettingsModal />
            </Suspense>
          </AppShellErrorBoundary>
        </AppShellErrorBoundary>
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
      <ToastLiveRegion />
      <Toast />
      {commandPaletteOpen ? (
        <AppShellErrorBoundary onTelemetryError={reportLazyChunkBoundaryError}>
          <Suspense fallback={null}>
            <LazyCommandPalette />
          </Suspense>
        </AppShellErrorBoundary>
      ) : null}
      {showFocusDebugHud ? (
        <Suspense fallback={null}>
          <LazyFocusDebugHud
            temporarilyHidden={focusDebugHudTemporarilyHidden}
            avoidBottomRight={toastMessage !== null}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
