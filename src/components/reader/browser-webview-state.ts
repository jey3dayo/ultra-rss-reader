import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BrowserWebviewFallbackPayload } from "@/api/schemas";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

export type { BrowserWebviewFallbackPayload };

const MISSING_EMBEDDED_BROWSER_WEBVIEW_ERROR = "Embedded browser webview is not open";

function toBrowserNavigationState(nextState: BrowserWebviewState | null) {
  if (!nextState) {
    return null;
  }

  return {
    canGoBack: nextState.can_go_back,
    canGoForward: nextState.can_go_forward,
  };
}

export function initialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
    load_generation: 0,
  };
}

export function resolveBrowserStateForRequestedUrl(
  previousState: BrowserWebviewState | null,
  requestedUrl: string,
): BrowserWebviewState {
  return previousState?.url === requestedUrl ? previousState : initialBrowserState(requestedUrl);
}

export function isBrowserWebviewFallbackForRequestedUrl(
  payload: BrowserWebviewFallbackPayload,
  requestedUrl: string,
): boolean {
  return requestedUrl.length > 0 && payload.url === requestedUrl;
}

export function isMissingEmbeddedBrowserWebviewError(error: AppError) {
  return error.message === MISSING_EMBEDDED_BROWSER_WEBVIEW_ERROR;
}

export function mergeBrowserState(
  previousState: BrowserWebviewState | null,
  nextState: BrowserWebviewState,
  intendedUrl: string,
): BrowserWebviewState {
  if (!previousState) {
    return nextState;
  }

  if (!previousState.is_loading && nextState.is_loading && previousState.url !== nextState.url) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  if (
    previousState.is_loading &&
    nextState.is_loading &&
    previousState.url === intendedUrl &&
    nextState.url !== intendedUrl
  ) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  if (
    previousState.is_loading &&
    previousState.url === intendedUrl &&
    nextState.url !== intendedUrl &&
    nextState.load_generation <= previousState.load_generation
  ) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  return nextState;
}

export function setBrowserStateWithRef(
  browserStateRef: MutableRefObject<BrowserWebviewState | null>,
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>,
  nextState: BrowserWebviewState | null,
) {
  browserStateRef.current = nextState;
  useUiStore.getState().setBrowserNavigationState(toBrowserNavigationState(nextState));
  setBrowserState(nextState);
}

export function updateBrowserStateWithRef(
  browserStateRef: MutableRefObject<BrowserWebviewState | null>,
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>,
  update: (currentState: BrowserWebviewState | null) => BrowserWebviewState | null,
) {
  const nextState = update(browserStateRef.current);
  browserStateRef.current = nextState;
  useUiStore.getState().setBrowserNavigationState(toBrowserNavigationState(nextState));
  setBrowserState(nextState);
}
