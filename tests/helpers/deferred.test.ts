import { describe, expect, it } from "vitest";
import { createDeferred } from "./deferred";

describe("createDeferred", () => {
  it("resolves with the typed value", async () => {
    const deferred = createDeferred<{ id: string }>();

    deferred.resolve({ id: "acc-1" });

    await expect(deferred.promise).resolves.toEqual({ id: "acc-1" });
  });

  it("rejects with the provided reason", async () => {
    const deferred = createDeferred<string>();
    const reason = new Error("network down");

    deferred.reject(reason);

    await expect(deferred.promise).rejects.toBe(reason);
  });

  it("cleans up an unsettled promise", async () => {
    const deferred = createDeferred<void>();
    const reason = new Error("test cleanup");

    deferred.cleanup(reason);

    await expect(deferred.promise).rejects.toBe(reason);
  });
});
