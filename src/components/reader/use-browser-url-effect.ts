import { useEffect, useEffectEvent, useLayoutEffect } from "react";

type BrowserUrlCleanup = ReturnType<typeof useEffect>;
type BrowserUrlEffect = (browserUrl: string) => BrowserUrlCleanup;
type WindowEventBinding = {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

export function bindWindowEvents(bindings: readonly WindowEventBinding[]) {
  for (const { type, listener, options } of bindings) {
    window.addEventListener(type, listener, options);
  }

  return () => {
    for (const { type, listener, options } of bindings) {
      window.removeEventListener(type, listener, options);
    }
  };
}

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
