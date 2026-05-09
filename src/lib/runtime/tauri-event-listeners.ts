import { hasTauriRuntime } from "@/lib/window/window-chrome";

type TauriEventCleanup = () => void;
type TauriEventSubscription = Promise<TauriEventCleanup>;
type TauriListenerGroup = {
  ready: Promise<void>;
  dispose: () => void;
};

function defaultTauriListenerErrorHandler(error: unknown) {
  if (!hasTauriRuntime()) {
    return;
  }

  console.warn("[tauri-event-listeners] Failed to register or cleanup Tauri event listener.", error);
}

function runCleanup(cleanup: TauriEventCleanup, onError: (error: unknown) => void) {
  try {
    cleanup();
  } catch (error) {
    onError(error);
  }
}

export function createTauriListenerGroup(
  subscriptions: readonly TauriEventSubscription[],
  onError: (error: unknown) => void = defaultTauriListenerErrorHandler,
): TauriListenerGroup {
  let disposed = false;
  const cleanups: TauriEventCleanup[] = [];
  const ready = Promise.all(
    subscriptions.map((subscription) =>
      subscription
        .then((cleanup) => {
          if (disposed) {
            runCleanup(cleanup, onError);
            return;
          }
          cleanups.push(cleanup);
        })
        .catch(onError),
    ),
  ).then(() => {});

  return {
    ready,
    dispose: () => {
      disposed = true;
      while (cleanups.length > 0) {
        const cleanup = cleanups.pop();
        if (cleanup) {
          runCleanup(cleanup, onError);
        }
      }
    },
  };
}

export function attachTauriListeners(
  subscriptions: readonly TauriEventSubscription[],
  onError: (error: unknown) => void = defaultTauriListenerErrorHandler,
) {
  return createTauriListenerGroup(subscriptions, onError).dispose;
}
