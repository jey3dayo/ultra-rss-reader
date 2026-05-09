import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { useUiStore } from "@/stores/ui-store";

type BrowserUrlCleanup = void | (() => void);
type BrowserUrlScope = {
  browserUrl: string;
  isCurrent: () => boolean;
};
type BrowserUrlEffect = (scope: BrowserUrlScope) => BrowserUrlCleanup;
type AsyncCommandLifecycleRun = {
  requestId: number;
  isLatest: () => boolean;
  finish: () => void;
};
type AsyncCommandLifecycle = {
  isInFlight: () => boolean;
  reset: () => void;
  start: () => AsyncCommandLifecycleRun;
};

function isCurrentBrowserUrl(browserUrl: string) {
  return useUiStore.getState().browserUrl === browserUrl;
}

function createBrowserUrlEffectCallback(
  browserUrl: string | null,
  runEffect: ReturnType<typeof useEffectEvent<BrowserUrlEffect>>,
) {
  if (!browserUrl) {
    return undefined;
  }

  const cleanup = runEffect({
    browserUrl,
    isCurrent: () => isCurrentBrowserUrl(browserUrl),
  });
  if (typeof cleanup !== "function") {
    return cleanup;
  }

  return () => {
    try {
      cleanup();
    } catch (error) {
      console.warn("Failed to cleanup browser URL effect.", error);
    }
  };
}

export function useAsyncCommandLifecycle(): AsyncCommandLifecycle {
  const latestRequestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const isInFlight = useCallback(() => inFlightRef.current, []);

  const reset = useCallback(() => {
    latestRequestIdRef.current += 1;
    inFlightRef.current = false;
  }, []);

  const start = useCallback((): AsyncCommandLifecycleRun => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    inFlightRef.current = true;

    return {
      requestId,
      isLatest: () => latestRequestIdRef.current === requestId,
      finish: () => {
        if (latestRequestIdRef.current === requestId) {
          inFlightRef.current = false;
        }
      },
    };
  }, []);

  return useMemo(
    () => ({ isInFlight, reset, start }),
    [isInFlight, reset, start],
  );
}

export function useBrowserUrlEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useEffect(
    () => createBrowserUrlEffectCallback(browserUrl, runEffect),
    [browserUrl, ...dependencies],
  );
}

export function useBrowserUrlLayoutEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useLayoutEffect(
    () => createBrowserUrlEffectCallback(browserUrl, runEffect),
    [browserUrl, ...dependencies],
  );
}
