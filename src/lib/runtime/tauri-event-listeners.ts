import { hasTauriRuntime } from "@/lib/window/window-chrome";

type TauriEventCleanup = () => void;
type TauriEventSubscription = Promise<TauriEventCleanup>;
type TauriListenerErrorHandler = (error: unknown) => void;
type TauriListenerOptions = {
  onError?: TauriListenerErrorHandler;
  onUnavailable?: TauriListenerErrorHandler;
};
type TauriListenerGroup = {
  ready: Promise<void>;
  dispose: () => void;
};

export const TAURI_EVENT_LISTENER_FAILURE_EVENT = "ultra-rss:tauri-event-listener-failure";

let hasReportedTauriListenerFailure = false;

export function resetTauriEventListenerFailureReportForRuntimeRecovery() {
  hasReportedTauriListenerFailure = false;
}

function dispatchTauriListenerFailureEvent() {
  if (hasReportedTauriListenerFailure || typeof window === "undefined") {
    return;
  }

  hasReportedTauriListenerFailure = true;
  window.dispatchEvent(new CustomEvent(TAURI_EVENT_LISTENER_FAILURE_EVENT));
}

function defaultTauriListenerErrorHandler(error: unknown) {
  if (!hasTauriRuntime()) {
    return;
  }

  console.warn("[tauri-event-listeners] Failed to register or cleanup Tauri event listener.", error);
  dispatchTauriListenerFailureEvent();
}

function defaultTauriUnavailableHandler() {}

function resolveTauriListenerOptions(
  options: TauriListenerErrorHandler | TauriListenerOptions | undefined,
): Required<TauriListenerOptions> {
  if (typeof options === "function") {
    return {
      onError: options,
      onUnavailable: options,
    };
  }

  return {
    onError: options?.onError ?? defaultTauriListenerErrorHandler,
    onUnavailable: options?.onUnavailable ?? defaultTauriUnavailableHandler,
  };
}

function runCleanup(cleanup: TauriEventCleanup, onError: TauriListenerErrorHandler) {
  try {
    cleanup();
  } catch (error) {
    onError(error);
  }
}

function handleSubscriptionError(error: unknown, options: Required<TauriListenerOptions>) {
  if (hasTauriRuntime()) {
    options.onError(error);
    return;
  }

  options.onUnavailable(error);
}

export function createTauriListenerGroup(
  subscriptions: readonly TauriEventSubscription[],
  listenerOptions?: TauriListenerErrorHandler | TauriListenerOptions,
): TauriListenerGroup {
  const options = resolveTauriListenerOptions(listenerOptions);
  let disposed = false;
  const cleanups: TauriEventCleanup[] = [];
  const ready = Promise.all(
    subscriptions.map((subscription) =>
      subscription
        .then((cleanup) => {
          if (disposed) {
            runCleanup(cleanup, options.onError);
            return;
          }
          cleanups.push(cleanup);
        })
        .catch((error: unknown) => {
          handleSubscriptionError(error, options);
        }),
    ),
  ).then(() => {});

  return {
    ready,
    dispose: () => {
      disposed = true;
      while (cleanups.length > 0) {
        const cleanup = cleanups.pop();
        if (cleanup) {
          runCleanup(cleanup, options.onError);
        }
      }
    },
  };
}

export function attachTauriListeners(
  subscriptions: readonly TauriEventSubscription[],
  listenerOptions?: TauriListenerErrorHandler | TauriListenerOptions,
) {
  return createTauriListenerGroup(subscriptions, listenerOptions).dispose;
}
