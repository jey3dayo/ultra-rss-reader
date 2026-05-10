export type Deferred<T> = {
  promise: Promise<T>;
  isPending: () => boolean;
  isSettled: () => boolean;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  cleanup: (reason?: unknown) => void;
};

export function createDeferred<T>(): Deferred<T> {
  let settled = false;
  let resolveDeferred: (value: T | PromiseLike<T>) => void = () => {};
  let rejectDeferred: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = (value) => {
      settled = true;
      resolve(value);
    };
    rejectDeferred = (reason) => {
      settled = true;
      reject(reason);
    };
  });

  void promise.catch(() => {});

  return {
    promise,
    isPending: () => !settled,
    isSettled: () => settled,
    resolve: resolveDeferred,
    reject: rejectDeferred,
    cleanup: (
      reason = new Error("Deferred promise was cleaned up before settling"),
    ) => {
      if (!settled) {
        rejectDeferred(reason);
      }
    },
  };
}
