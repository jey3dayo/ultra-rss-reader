type TauriEventCleanup = () => void;
type TauriEventSubscription = Promise<TauriEventCleanup>;
type TauriListenerGroup = {
  ready: Promise<void>;
  dispose: () => void;
};

function noop() {}

export function createTauriListenerGroup(
  subscriptions: readonly TauriEventSubscription[],
  onError: (error: unknown) => void = noop,
): TauriListenerGroup {
  let disposed = false;
  const cleanups: TauriEventCleanup[] = [];
  const ready = Promise.all(
    subscriptions.map((subscription) =>
      subscription
        .then((cleanup) => {
          if (disposed) {
            cleanup();
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
        cleanups.pop()?.();
      }
    },
  };
}

export function attachTauriListeners(
  subscriptions: readonly TauriEventSubscription[],
  onError: (error: unknown) => void = noop,
) {
  return createTauriListenerGroup(subscriptions, onError).dispose;
}
