import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachTauriListeners,
  createTauriListenerGroup,
  resetTauriEventListenerFailureReportForRuntimeRecovery,
  TAURI_EVENT_LISTENER_FAILURE_EVENT,
} from "@/lib/runtime/tauri-event-listeners";

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
  afterEach(() => {
    resetTauriEventListenerFailureReportForRuntimeRecovery();
    resetTauriRuntimeFlags();
    vi.restoreAllMocks();
  });

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

  it("warns by default when Tauri runtime listener registration fails", async () => {
    setTauriRuntimePresent();
    const error = new Error("listen failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onFailure = vi.fn();
    window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
    const group = createTauriListenerGroup([Promise.reject(error)], { owner: "test-owner" });

    await group.ready;

    expect(warn).toHaveBeenCalledWith(
      "[tauri-event-listeners] Failed to register or cleanup Tauri event listener.",
      error,
    );
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ detail: { owner: "test-owner" } }));
    window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
  });

  it("surfaces partial listener registration failures once per subscription owner", async () => {
    setTauriRuntimePresent();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onFailure = vi.fn();
    window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);

    await createTauriListenerGroup([
      { owner: "first-owner", subscription: Promise.reject(new Error("first listen failed")) },
      { owner: "second-owner", subscription: Promise.reject(new Error("second listen failed")) },
      Promise.resolve(vi.fn()),
      { owner: "first-owner", subscription: Promise.reject(new Error("duplicate first listen failed")) },
    ]).ready;

    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenNthCalledWith(1, expect.objectContaining({ detail: { owner: "first-owner" } }));
    expect(onFailure).toHaveBeenNthCalledWith(2, expect.objectContaining({ detail: { owner: "second-owner" } }));
    window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
  });

  it("allows runtime recovery to make a later listener failure user-visible again", async () => {
    setTauriRuntimePresent();
    const firstError = new Error("first listen failed");
    const secondError = new Error("second listen failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onFailure = vi.fn();
    window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);

    await createTauriListenerGroup([Promise.reject(firstError)], { owner: "test-owner" }).ready;
    await createTauriListenerGroup([Promise.reject(secondError)], { owner: "test-owner" }).ready;

    expect(onFailure).toHaveBeenCalledTimes(1);

    resetTauriEventListenerFailureReportForRuntimeRecovery();
    await createTauriListenerGroup([Promise.reject(secondError)], { owner: "test-owner" }).ready;

    expect(warn).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledTimes(2);
    window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
  });

  it("keeps runtime listener registration failure observable when only unavailable is silenced", async () => {
    setTauriRuntimePresent();
    const error = new Error("listen failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onUnavailable = vi.fn();
    const group = createTauriListenerGroup([Promise.reject(error)], { onUnavailable });

    await group.ready;

    expect(warn).toHaveBeenCalledWith(
      "[tauri-event-listeners] Failed to register or cleanup Tauri event listener.",
      error,
    );
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("keeps browser-dev runtime unavailable listener rejection quiet by default", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    const error = new Error("runtime unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const group = createTauriListenerGroup([Promise.reject(error)]);

    await group.ready;

    expect(warn).not.toHaveBeenCalled();
  });

  it("routes browser-dev runtime unavailable listener rejection to explicit onUnavailable", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    const error = new Error("runtime unavailable");
    const onError = vi.fn();
    const onUnavailable = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const group = createTauriListenerGroup([Promise.reject(error)], { onError, onUnavailable });

    await group.ready;

    expect(onUnavailable).toHaveBeenCalledWith(error);
    expect(onError).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
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
