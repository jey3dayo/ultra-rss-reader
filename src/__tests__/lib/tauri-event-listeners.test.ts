import { describe, expect, it, vi } from "vitest";
import { attachTauriListeners, createTauriListenerGroup } from "@/lib/runtime/tauri-event-listeners";

function createDeferredCleanup() {
  let resolveCleanup: (cleanup: () => void) => void = () => {};
  const subscription = new Promise<() => void>((resolve) => {
    resolveCleanup = resolve;
  });

  return { resolveCleanup, subscription };
}

function createFakeTauriEventTarget() {
  const listeners = new Set<() => void>();

  return {
    emit: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    listen: (listener: () => void) => {
      listeners.add(listener);
      return Promise.resolve(() => {
        listeners.delete(listener);
      });
    },
    listenerCount: () => listeners.size,
  };
}

describe("tauri-event-listeners", () => {
  it("runs ready cleanups when disposed", async () => {
    const cleanup = vi.fn();
    const group = createTauriListenerGroup([Promise.resolve(cleanup)]);

    await group.ready;
    group.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not run ready cleanups more than once when disposed repeatedly", async () => {
    const cleanup = vi.fn();
    const group = createTauriListenerGroup([Promise.resolve(cleanup)]);

    await group.ready;
    group.dispose();
    group.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up duplicate listener subscriptions independently", async () => {
    const target = createFakeTauriEventTarget();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const group = createTauriListenerGroup([target.listen(firstListener), target.listen(secondListener)]);

    await group.ready;
    expect(target.listenerCount()).toBe(2);

    group.dispose();

    expect(target.listenerCount()).toBe(0);
  });

  it("does not dispatch events after listener cleanup", async () => {
    const target = createFakeTauriEventTarget();
    const listener = vi.fn();
    const group = createTauriListenerGroup([target.listen(listener)]);

    await group.ready;
    group.dispose();
    target.emit();

    expect(listener).not.toHaveBeenCalled();
  });

  it("continues disposing ready listeners when one cleanup throws", async () => {
    const error = new Error("unlisten failed");
    const throwingCleanup = vi.fn(() => {
      throw error;
    });
    const remainingCleanup = vi.fn();
    const onError = vi.fn();
    const group = createTauriListenerGroup(
      [Promise.resolve(remainingCleanup), Promise.resolve(throwingCleanup)],
      onError,
    );

    await group.ready;
    group.dispose();

    expect(throwingCleanup).toHaveBeenCalledTimes(1);
    expect(remainingCleanup).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("runs cleanup immediately when subscription resolves after dispose", async () => {
    const cleanup = vi.fn();
    const deferred = createDeferredCleanup();
    const group = createTauriListenerGroup([deferred.subscription]);

    group.dispose();
    deferred.resolveCleanup(cleanup);
    await group.ready;

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("routes late cleanup errors to the error handler", async () => {
    const error = new Error("late unlisten failed");
    const cleanup = vi.fn(() => {
      throw error;
    });
    const onError = vi.fn();
    const deferred = createDeferredCleanup();
    const group = createTauriListenerGroup([deferred.subscription], onError);

    group.dispose();
    deferred.resolveCleanup(cleanup);
    await group.ready;

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("does not run late cleanups more than once when disposed repeatedly", async () => {
    const cleanup = vi.fn();
    const deferred = createDeferredCleanup();
    const group = createTauriListenerGroup([deferred.subscription]);

    group.dispose();
    group.dispose();
    deferred.resolveCleanup(cleanup);
    await group.ready;

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("routes subscription errors to the error handler", async () => {
    const error = new Error("listen failed");
    const onError = vi.fn();
    const group = createTauriListenerGroup([Promise.reject(error)], onError);

    await group.ready;

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("treats unavailable runtime subscription rejection as non-fatal", async () => {
    const error = new Error("runtime unavailable");
    const onError = vi.fn();
    const group = createTauriListenerGroup([Promise.reject(error)], onError);

    await expect(group.ready).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("returns a disposer for attached listeners", async () => {
    const cleanup = vi.fn();
    const dispose = attachTauriListeners([Promise.resolve(cleanup)]);

    await Promise.resolve();
    dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
