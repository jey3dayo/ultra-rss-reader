import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BrowserWebviewState } from "@/api/schemas";
import { useUiStore } from "@/stores/ui-store";

function toBrowserNavigationState(nextState: BrowserWebviewState | null) {
  if (!nextState) {
    return null;
  }

  return {
    canGoBack: nextState.can_go_back,
    canGoForward: nextState.can_go_forward,
  };
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
