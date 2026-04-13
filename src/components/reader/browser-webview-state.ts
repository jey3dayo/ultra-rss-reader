import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";

export type BrowserWebviewFallbackPayload = {
  url: string;
  opened_external: boolean;
  error_message: string | null;
};

const MISSING_EMBEDDED_BROWSER_WEBVIEW_ERROR = "Embedded browser webview is not open";

export function initialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
  };
}

export function resolveBrowserStateForRequestedUrl(
  previousState: BrowserWebviewState | null,
  requestedUrl: string,
): BrowserWebviewState {
  return previousState?.url === requestedUrl ? previousState : initialBrowserState(requestedUrl);
}

export function isMissingEmbeddedBrowserWebviewError(error: AppError) {
  return error.message.includes(MISSING_EMBEDDED_BROWSER_WEBVIEW_ERROR);
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

  return nextState;
}
