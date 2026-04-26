import { useEffect, useEffectEvent, useLayoutEffect } from "react";

export { bindWindowEvents } from "@/lib/window-events";

import { useUiStore } from "@/stores/ui-store";

type BrowserUrlCleanup = ReturnType<typeof useEffect>;
type BrowserUrlScope = {
  browserUrl: string;
  isCurrent: () => boolean;
};
type BrowserUrlEffect = (scope: BrowserUrlScope) => BrowserUrlCleanup;

export function isCurrentBrowserUrl(browserUrl: string) {
  return useUiStore.getState().browserUrl === browserUrl;
}

function createBrowserUrlEffectCallback(
  browserUrl: string | null,
  runEffect: ReturnType<typeof useEffectEvent<BrowserUrlEffect>>,
) {
  if (!browserUrl) {
    return undefined;
  }

  return runEffect({
    browserUrl,
    isCurrent: () => isCurrentBrowserUrl(browserUrl),
  });
}

export function useBrowserUrlEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useEffect(() => createBrowserUrlEffectCallback(browserUrl, runEffect), [browserUrl, ...dependencies]);
}

export function useBrowserUrlLayoutEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useLayoutEffect(() => createBrowserUrlEffectCallback(browserUrl, runEffect), [browserUrl, ...dependencies]);
}
