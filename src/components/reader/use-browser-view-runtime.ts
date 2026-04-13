import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser-debug-geometry";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { useBrowserNativeDiagnostics } from "./use-browser-native-diagnostics";
import { useBrowserOverlayViewportWidth } from "./use-browser-overlay-viewport-width";

type UseBrowserViewRuntimeParams = {
  onCloseOverlay: () => void;
};

type UseBrowserViewRuntimeResult = {
  showDiagnostics: boolean;
  browserUrl: string | null;
  showToast: ReturnType<typeof useUiStore.getState>["showToast"];
  platformKind: ReturnType<typeof usePlatformStore.getState>["platform"]["kind"];
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  nativeDiagnostics: BrowserDebugGeometryNativeDiagnostics | null;
  handleNativeDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
  viewportWidth: number;
  isLoading: boolean;
  handleCloseOverlay: () => void;
};

export function useBrowserViewRuntime({ onCloseOverlay }: UseBrowserViewRuntimeParams): UseBrowserViewRuntimeResult {
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

  return {
    showDiagnostics,
    browserUrl,
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
  };
}
