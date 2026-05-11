import { listen } from "@tauri-apps/api/event";
import { Component, lazy, type ReactNode, Suspense, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { type BrowserDebugGeometrySnapshot, getBrowserGeometryRows } from "@/lib/browser/browser-debug-geometry";
import { describeDebugHudActiveElement, describeDebugHudEventTarget } from "@/lib/debug/debug-hud-active-element";
import {
  buildDebugHudClipboardText,
  emitDebugInputTrace,
  formatRawClickTrace,
  formatRawKeyboardTrace,
  formatRawPointerTrace,
} from "@/lib/debug/debug-input-trace";
import {
  APP_STACKING_CLASS_NAMES,
  hasTauriRuntime,
  LAYER_POINTER_EVENT_CLASS_NAMES,
  shouldUseDesktopOverlayTitlebar,
} from "@/lib/window/window-chrome";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  createKeyboardEventListener,
  createMouseEventListener,
  createPointerEventListener,
} from "@/lib/window/window-events";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { APP_EVENTS } from "../constants/events";
import { useAppIconTheme } from "../hooks/use-app-icon-theme";
import { useBadge } from "../hooks/use-badge";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useMenuEvents } from "../hooks/use-menu-events";
import { useMouseNavigation } from "../hooks/use-mouse-navigation";
import { useUpdater } from "../hooks/use-updater";
import { useWindowAlwaysOnTop } from "../hooks/use-window-always-on-top";
import { copyValueToClipboard } from "../lib/runtime/clipboard";
import { attachTauriListeners, TAURI_EVENT_LISTENER_FAILURE_EVENT } from "../lib/runtime/tauri-event-listeners";
import { cn } from "../lib/utils";
import { usePlatformStore } from "../stores/platform-store";
import { usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppLayout } from "./app-layout";
import { AppToastView } from "./shared/app-toast-view";

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

async function loadSettingsModalModule() {
  return import("./settings/settings-modal");
}

type SettingsModalPreloadState = "idle" | "pending" | "succeeded" | "retrying" | "failed";

const SETTINGS_MODAL_PRELOAD_RETRY_DELAY_MS = 250;
const SETTINGS_MODAL_PRELOAD_FAILURE_TOAST = "設定画面の読み込みに失敗しました。アプリの再読み込みを試してください。";
const LAZY_CHUNK_FAILURE_TOAST = "画面の読み込みに失敗しました。アプリの再読み込みを試してください。";
const MAIN_WINDOW_CLOSE_BLOCKED_EVENT = "main-window-close-blocked";
const MAIN_WINDOW_CLOSE_BLOCKED_TOAST = "未保存または実行中の処理があるため、終了前に確認してください。";
let settingsModalPreloadState: SettingsModalPreloadState = "idle";
let settingsModalPreloadRetryTimer: ReturnType<typeof setTimeout> | null = null;
let settingsModalPreloadGeneration = 0;

function clearSettingsModalPreloadRetryTimer() {
  if (settingsModalPreloadRetryTimer === null) {
    return;
  }

  clearTimeout(settingsModalPreloadRetryTimer);
  settingsModalPreloadRetryTimer = null;
}

function reportLazyChunkFailure(message: string) {
  useUiStore.getState().showToast(message);
}

export function preloadSettingsModalModuleForDev(loadModule = loadSettingsModalModule) {
  if (!import.meta.env.DEV) {
    return;
  }

  if (settingsModalPreloadState !== "idle") {
    return;
  }

  settingsModalPreloadState = "pending";
  settingsModalPreloadGeneration += 1;
  const preloadGeneration = settingsModalPreloadGeneration;

  void loadModule()
    .then(() => {
      if (settingsModalPreloadGeneration !== preloadGeneration) {
        return;
      }

      settingsModalPreloadState = "succeeded";
    })
    .catch((error: unknown) => {
      if (settingsModalPreloadGeneration !== preloadGeneration) {
        return;
      }

      console.error("Failed to preload settings modal.", error);
      reportLazyChunkFailure(SETTINGS_MODAL_PRELOAD_FAILURE_TOAST);
      settingsModalPreloadState = "retrying";
      settingsModalPreloadRetryTimer = setTimeout(() => {
        settingsModalPreloadRetryTimer = null;
        if (settingsModalPreloadGeneration !== preloadGeneration) {
          return;
        }

        void loadModule()
          .then(() => {
            if (settingsModalPreloadGeneration !== preloadGeneration) {
              return;
            }

            settingsModalPreloadState = "succeeded";
          })
          .catch((retryError: unknown) => {
            if (settingsModalPreloadGeneration !== preloadGeneration) {
              return;
            }

            settingsModalPreloadState = "failed";
            console.error("Failed to retry settings modal preload.", retryError);
          });
      }, SETTINGS_MODAL_PRELOAD_RETRY_DELAY_MS);
    });
}

preloadSettingsModalModuleForDev();

function resetSettingsModalPreloadSession() {
  settingsModalPreloadGeneration += 1;
  clearSettingsModalPreloadRetryTimer();
  settingsModalPreloadState = "idle";
}

export function resetSettingsModalPreloadForTest() {
  resetSettingsModalPreloadSession();
}

const LazySettingsModal = lazy(async () => {
  const mod = await loadSettingsModalModule();
  return { default: mod.SettingsModal };
});

const TAURI_EVENT_LISTENER_FAILURE_TOAST = "デスクトップ連携の一部を開始できませんでした。";

type SettingsModalBoundaryProps = {
  children: ReactNode;
  onTelemetryError: (error: Error) => void;
  onUserRecoveryRequired: () => void;
};

type SettingsModalBoundaryState = {
  hasError: boolean;
};

class SettingsModalBoundary extends Component<SettingsModalBoundaryProps, SettingsModalBoundaryState> {
  state: SettingsModalBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): SettingsModalBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onTelemetryError(error);
    this.props.onUserRecoveryRequired();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

type LazyChunkBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onTelemetryError?: (error: Error) => void;
  onUserRecoveryRequired?: () => void;
};

type LazyChunkBoundaryState = {
  hasError: boolean;
};

class LazyChunkBoundary extends Component<LazyChunkBoundaryProps, LazyChunkBoundaryState> {
  state: LazyChunkBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): LazyChunkBoundaryState {
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
  if (!toastMessage) return null;

  return (
    <AppToastView
      toastMessage={toastMessage}
      onClose={clearToast}
      placement={browserUrl ? "browser-rail" : "bottom-right"}
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
    <div aria-live="polite" aria-atomic="false" className="sr-only" data-testid="toast-live-region" role="status">
      {toastAnnouncements.map((announcement) => (
        <div key={announcement.id}>{announcement.message}</div>
      ))}
    </div>
  );
}

function isBrowserDebugGeometrySnapshot(value: unknown): value is BrowserDebugGeometrySnapshot {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return "layoutDiagnostics" in value && "nativeDiagnostics" in value;
}

function isBrowserDebugGeometryDetail(value: unknown): value is BrowserDebugGeometrySnapshot | null {
  return value === null || isBrowserDebugGeometrySnapshot(value);
}

function reportSettingsModalBoundaryError(error: Error) {
  console.error("Failed to render settings modal.", error);
}

function reportLazyChunkBoundaryError(error: Error) {
  console.error("Failed to render lazy app shell surface.", error);
  reportLazyChunkFailure(LAZY_CHUNK_FAILURE_TOAST);
}

type FocusDebugHudState = {
  activeElementDescription: string;
  traces: string[];
  browserGeometry: BrowserDebugGeometrySnapshot | null;
};

type FocusDebugHudAction =
  | { type: "set-active-element"; value: string }
  | { type: "append-trace"; value: string }
  | { type: "append-browser-trace"; value: string }
  | {
      type: "set-browser-geometry";
      value: BrowserDebugGeometrySnapshot | null;
    };

const initialFocusDebugHudState: FocusDebugHudState = {
  activeElementDescription: "none",
  traces: [],
  browserGeometry: null,
};

function pushTraceLine(traces: string[], value: string, maxLines: number): string[] {
  return [...traces.slice(-(maxLines - 1)), value];
}

function focusDebugHudReducer(state: FocusDebugHudState, action: FocusDebugHudAction): FocusDebugHudState {
  const MAX_TRACE_LINES = 20;

  switch (action.type) {
    case "set-active-element":
      return { ...state, activeElementDescription: action.value };
    case "append-trace":
      return {
        ...state,
        traces: pushTraceLine(state.traces, action.value, MAX_TRACE_LINES),
      };
    case "append-browser-trace":
      return {
        ...state,
        traces: pushTraceLine(state.traces, action.value, 6),
      };
    case "set-browser-geometry":
      return { ...state, browserGeometry: action.value };
    default:
      return state;
  }
}

type FocusDebugHudProps = {
  temporarilyHidden?: boolean;
  avoidBottomRight?: boolean;
};

function normalizeDebugHudClipboardText(text: string): string {
  return Array.from(text, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127) ? " | " : char;
  }).join("");
}

type DebugHudDocumentBoundary = {
  readonly activeElement?: unknown;
  readonly body?: unknown;
  readonly defaultView?: (Window & { readonly HTMLElement?: typeof HTMLElement }) | null;
};

function isDebugHudHtmlElement(value: unknown, ownerDocument: DebugHudDocumentBoundary): value is HTMLElement {
  const HtmlElement: typeof HTMLElement | null =
    ownerDocument.defaultView?.HTMLElement ?? (typeof HTMLElement !== "undefined" ? HTMLElement : null);
  return HtmlElement !== null && value instanceof HtmlElement;
}

export function resolveFocusDebugHudPortalTarget(
  ownerDocument: DebugHudDocumentBoundary | null | undefined = typeof document === "undefined" ? undefined : document,
): HTMLElement | null {
  if (ownerDocument == null) {
    return null;
  }

  const { body } = ownerDocument;
  return isDebugHudHtmlElement(body, ownerDocument) ? body : null;
}

export function getFocusDebugHudActiveElementDescription(
  ownerDocument: DebugHudDocumentBoundary | null | undefined = typeof document === "undefined" ? undefined : document,
): string {
  if (ownerDocument == null) {
    return "none";
  }

  let activeElement: unknown;
  try {
    activeElement = ownerDocument.activeElement;
  } catch {
    return "none";
  }

  return isDebugHudHtmlElement(activeElement, ownerDocument)
    ? describeDebugHudActiveElement(activeElement)
    : describeDebugHudActiveElement(null);
}

function FocusDebugHud({ temporarilyHidden = false, avoidBottomRight = false }: FocusDebugHudProps) {
  const { t } = useTranslation("reader");
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const selectedArticleId = useUiStore((state) => state.selectedArticleId);
  const browserCloseInFlight = useUiStore((state) => state.browserCloseInFlight);
  const pendingBrowserCloseAction = useUiStore((state) => state.pendingBrowserCloseAction);
  const showToast = useUiStore((state) => state.showToast);
  const setPref = usePreferencesStore((state) => state.setPref);
  const [state, dispatch] = useReducer(focusDebugHudReducer, initialFocusDebugHudState);
  const { activeElementDescription, traces, browserGeometry } = state;

  useEffect(() => {
    const update = () => {
      dispatch({
        type: "set-active-element",
        value: getFocusDebugHudActiveElementDescription(),
      });
    };

    update();
    const keyTraceListener = createKeyboardEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawKeyboardTrace(event.key, describeDebugHudEventTarget(event.target), event.target),
      });
    });
    const traceListener = createCustomEventDetailListener(
      (value): value is string => typeof value === "string",
      (detail) => {
        dispatch({ type: "append-trace", value: detail });
      },
    );
    const geometryListener = createCustomEventDetailListener(isBrowserDebugGeometryDetail, (detail) => {
      dispatch({
        type: "set-browser-geometry",
        value: detail,
      });
    });
    const pointerTraceListener = createPointerEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawPointerTrace({
          type: event.type,
          clientX: event.clientX,
          clientY: event.clientY,
          targetDescription: describeDebugHudEventTarget(event.target),
          target: event.target,
        }),
      });
    });
    const clickTraceListener = createMouseEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawClickTrace(
          event.clientX,
          event.clientY,
          describeDebugHudEventTarget(event.target),
          event.target,
        ),
      });
    });

    return bindWindowEvents([
      { type: "focusin", listener: update, options: true },
      { type: "focusout", listener: update, options: true },
      { type: "keydown", listener: update, options: true },
      { type: "keydown", listener: keyTraceListener, options: true },
      { type: APP_EVENTS.debugInputTrace, listener: traceListener },
      { type: APP_EVENTS.browserDebugGeometry, listener: geometryListener },
      { type: "pointerdown", listener: pointerTraceListener, options: true },
      { type: "click", listener: clickTraceListener, options: true },
    ]);
  }, []);

  useEffect(() => {
    return attachTauriListeners(
      [
        listen<string>("browser-webview-debug-input", (event) => {
          dispatch({ type: "append-browser-trace", value: event.payload });
        }),
      ],
      {
        onUnavailable: () => {
          // browser mode / non-tauri
        },
      },
    );
  }, []);

  const debugHudText = buildDebugHudClipboardText({
    focusedPane,
    contentMode,
    selectedArticleId,
    browserCloseInFlight,
    pendingBrowserCloseAction,
    activeElementDescription,
    traces,
  });

  const handleCopy = async () => {
    emitDebugInputTrace("hud-copy start");
    const clipboardText = normalizeDebugHudClipboardText(debugHudText);

    await copyValueToClipboard(clipboardText, {
      onSuccess: () => {
        emitDebugInputTrace("hud-copy success");
        showToast(t("copied_to_clipboard"));
      },
      onError: (message, error) => {
        emitDebugInputTrace(`hud-copy error category=${error.category} message=${message}`);
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
        onCloseClick={() => setPref("debug_browser_hud", "false")}
        temporarilyHidden={temporarilyHidden}
        avoidBottomRight={avoidBottomRight}
      />
    </Suspense>
  );

  const portalTarget = resolveFocusDebugHudPortalTarget();
  if (portalTarget !== null) {
    return createPortal(hud, portalTarget);
  }

  return null;
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
  const contentMode = useUiStore((state) => state.contentMode);
  const browserUrl = useUiStore((state) => state.browserUrl);
  const toastMessage = useUiStore((state) => state.toastMessage);
  const prefs = usePreferencesStore((state) => state.prefs);
  const settingsPreloadSessionOpenedRef = useRef(false);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });
  const showFocusDebugHud = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const focusDebugHudTemporarilyHidden = settingsOpen || confirmDialogOpen || shortcutsHelpOpen || commandPaletteOpen;
  const browserOverlayRootInteractive = contentMode === "browser" && browserUrl !== null;

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
        listen<void>(MAIN_WINDOW_CLOSE_BLOCKED_EVENT, () => {
          const { getNativeLifecycleBlockerSnapshot, showToast } = useUiStore.getState();
          const blockerSnapshot = getNativeLifecycleBlockerSnapshot();
          showToast({
            message: MAIN_WINDOW_CLOSE_BLOCKED_TOAST,
            persistent: blockerSnapshot.dirty || blockerSnapshot.pending,
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

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <div
        data-browser-overlay-root=""
        className={cn(
          "absolute inset-0",
          APP_STACKING_CLASS_NAMES.browserOverlayRoot,
          browserOverlayRootInteractive
            ? LAYER_POINTER_EVENT_CLASS_NAMES.interactive
            : LAYER_POINTER_EVENT_CLASS_NAMES.inert,
          // Keep the overlay root aligned to the shell; traffic-light safe area is handled by browser geometry.
          overlayTitlebar && "desktop-overlay-titlebar",
        )}
      />
      <div className="min-h-0 flex-1">
        <AppLayout />
      </div>
      {settingsOpen ? (
        <LazyChunkBoundary onTelemetryError={reportLazyChunkBoundaryError} onUserRecoveryRequired={closeSettings}>
          <SettingsModalBoundary
            onTelemetryError={reportSettingsModalBoundaryError}
            onUserRecoveryRequired={closeSettings}
          >
            <Suspense fallback={null}>
              <LazySettingsModal />
            </Suspense>
          </SettingsModalBoundary>
        </LazyChunkBoundary>
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
        <LazyChunkBoundary onTelemetryError={reportLazyChunkBoundaryError}>
          <Suspense fallback={null}>
            <LazyCommandPalette />
          </Suspense>
        </LazyChunkBoundary>
      ) : null}
      {showFocusDebugHud ? (
        <FocusDebugHud temporarilyHidden={focusDebugHudTemporarilyHidden} avoidBottomRight={toastMessage !== null} />
      ) : null}
    </div>
  );
}
