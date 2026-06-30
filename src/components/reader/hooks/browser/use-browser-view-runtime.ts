import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import type { PlatformInfo } from "@/api/schemas";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserNativeDiagnostics } from "@/components/reader/hooks/browser/use-browser-native-diagnostics";
import { useBrowserOverlayViewportWidth } from "@/components/reader/hooks/browser/use-browser-overlay-viewport-width";
import type { ToastData } from "@/lib/ui/toast.types";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { BrowserOverlayCloseHandler, BrowserWebviewDiagnosticsPayload } from "../../browser-view.types";

type UseBrowserViewRuntimeParams = BrowserOverlayCloseHandler;

type UseBrowserViewRuntimeResult = {
  showDiagnostics: boolean;
  browserUrl: string | null;
  browserState: BrowserWebviewState | null;
  showToast: (message: string | ToastData) => void;
  platformKind: PlatformInfo["kind"];
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  handleNativeDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
  viewportWidth: number;
  isLoading: boolean;
  handleCloseOverlay: () => void;
  handleBrowserWebviewClosed: () => void;
};

export function useBrowserViewRuntime({
  onCloseOverlay,
  onBrowserWebviewClosed,
}: UseBrowserViewRuntimeParams): UseBrowserViewRuntimeResult {
  const prefs = usePreferencesStore((s) => s.prefs);
  const showDiagnostics = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const browserUrl = useUiStore((s) => s.browserUrl);
  const showToast = useUiStore((s) => s.showToast);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const browserStateRef = useRef<BrowserWebviewState | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fallbackInFlightRef = useRef(false);
  const { nativeDiagnostics, handleNativeDiagnostics } = useBrowserNativeDiagnostics(showDiagnostics);
  const viewportWidth = useBrowserOverlayViewportWidth();
  const isLoading = browserUrl ? (browserState?.is_loading ?? true) : false;

  const handleCloseOverlay = useCallback(() => {
    onCloseOverlay();
  }, [onCloseOverlay]);
  const handleBrowserWebviewClosed = useCallback(() => {
    (onBrowserWebviewClosed ?? onCloseOverlay)();
  }, [onBrowserWebviewClosed, onCloseOverlay]);

  return {
    showDiagnostics,
    browserUrl,
    browserState,
    showToast,
    platformKind,
    setBrowserState,
    browserStateRef,
    hostRef,
    overlayRef,
    stageRef,
    fallbackInFlightRef,
    nativeDiagnostics,
    handleNativeDiagnostics,
    viewportWidth,
    isLoading,
    handleCloseOverlay,
    handleBrowserWebviewClosed,
  };
}
