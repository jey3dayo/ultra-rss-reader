import { describe, expect, it, vi } from "vitest";
import { attachTauriListeners, createTauriListenerGroup } from "@/lib/tauri-event-listeners";

function createDeferredCleanup() {
  let resolveCleanup: (cleanup: () => void) => void = () => {};
  const subscription = new Promise<() => void>((resolve) => {
    resolveCleanup = resolve;
  });

  return { resolveCleanup, subscription };
}

describe("tauri-event-listeners", () => {
  it("runs ready cleanups when disposed", async () => {
    const cleanup = vi.fn();
    const group = createTauriListenerGroup([Promise.resolve(cleanup)]);

    await group.ready;
    group.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
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

  it("routes subscription errors to the error handler", async () => {
    const error = new Error("listen failed");
    const onError = vi.fn();
    const group = createTauriListenerGroup([Promise.reject(error)], onError);

    await group.ready;

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
