import { useEffect, useEffectEvent, useLayoutEffect } from "react";

type BrowserUrlCleanup = ReturnType<typeof useEffect>;
type BrowserUrlEffect = (browserUrl: string) => BrowserUrlCleanup;

export function useBrowserUrlEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useEffect(() => {
    if (!browserUrl) {
      return undefined;
    }

    return runEffect(browserUrl);
  }, [browserUrl, ...dependencies]);
}

export function useBrowserUrlLayoutEffect(
  browserUrl: string | null,
  effect: BrowserUrlEffect,
  dependencies: ReadonlyArray<unknown>,
) {
  const runEffect = useEffectEvent(effect);

  useLayoutEffect(() => {
    if (!browserUrl) {
      return undefined;
    }

    return runEffect(browserUrl);
  }, [browserUrl, ...dependencies]);
}
