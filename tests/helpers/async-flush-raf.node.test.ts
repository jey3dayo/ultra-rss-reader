import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it, vi } from "vitest";
import { flushRaf } from "./async-flush";

setupBrowserTestDom();

describe("async flush helpers", () => {
  it("flushes requestAnimationFrame callbacks", async () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const calls: string[] = [];
    const flushed = flushRaf().then(() => calls.push("raf"));

    expect(calls).toEqual([]);
    callbacks.forEach((callback) => {
      callback(1);
    });
    await flushed;

    expect(calls).toEqual(["raf"]);
    requestAnimationFrameSpy.mockRestore();
  });

  it("rejects requestAnimationFrame flushes when RAF is unavailable", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    vi.stubGlobal("requestAnimationFrame", undefined);

    await expect(flushRaf()).rejects.toThrow("requestAnimationFrame is unavailable");

    vi.stubGlobal("requestAnimationFrame", originalRequestAnimationFrame);
  });
});
