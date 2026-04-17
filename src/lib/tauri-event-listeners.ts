type TauriEventCleanup = () => void;
type TauriEventSubscription = Promise<TauriEventCleanup>;

function noop() {}

export function attachTauriListeners(
  subscriptions: readonly TauriEventSubscription[],
  onError: (error: unknown) => void = noop,
) {
  let disposed = false;
  const cleanups: TauriEventCleanup[] = [];

  for (const subscription of subscriptions) {
    subscription
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        cleanups.push(cleanup);
      })
      .catch(onError);
  }

  return () => {
    disposed = true;
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  };
}
