import { describe, expect, it, vi } from "vitest";
import { createDeferred } from "./deferred";

describe("createDeferred", () => {
  it("resolves with the typed value", async () => {
    const deferred = createDeferred<{ id: string }>();

    expect(deferred.isPending()).toBe(true);
    expect(deferred.isSettled()).toBe(false);

    deferred.resolve({ id: "acc-1" });

    expect(deferred.isPending()).toBe(false);
    expect(deferred.isSettled()).toBe(true);
    await expect(deferred.promise).resolves.toEqual({ id: "acc-1" });
  });

  it("rejects with the provided reason", async () => {
    const deferred = createDeferred<string>();
    const reason = new Error("network down");

    expect(deferred.isPending()).toBe(true);

    deferred.reject(reason);

    expect(deferred.isPending()).toBe(false);
    await expect(deferred.promise).rejects.toBe(reason);
  });

  it("cleans up an unsettled promise", async () => {
    const deferred = createDeferred<void>();
    const reason = new Error("test cleanup");

    deferred.cleanup(reason);

    expect(deferred.isPending()).toBe(false);
    await expect(deferred.promise).rejects.toBe(reason);
  });

  it("ignores cleanup after the promise settles", async () => {
    const deferred = createDeferred<string>();

    deferred.resolve("done");
    deferred.cleanup(new Error("late cleanup"));

    await expect(deferred.promise).resolves.toBe("done");
  });

  it("prevents unhandled rejections when callers only use cleanup", async () => {
    const unhandledRejection = vi.fn();
    process.once("unhandledRejection", unhandledRejection);
    const deferred = createDeferred<void>();

    deferred.cleanup(new Error("component unmounted"));
    await Promise.resolve();

    process.off("unhandledRejection", unhandledRejection);
    expect(unhandledRejection).not.toHaveBeenCalled();
    await expect(deferred.promise).rejects.toThrow("component unmounted");
  });
});
