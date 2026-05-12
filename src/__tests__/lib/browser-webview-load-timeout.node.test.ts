import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBrowserWebviewLoadTimeout,
  scheduleBrowserWebviewLoadTimeout,
} from "@/lib/browser/browser-webview-load-timeout";

setupBrowserTestDom();

describe("browser webview load timeout helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules the callback on the browser load timeout window", () => {
    const callback = vi.fn();

    const timeoutId = scheduleBrowserWebviewLoadTimeout(callback);

    expect(timeoutId).not.toBeNull();
    expect(callback).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("clears a scheduled timeout", () => {
    const callback = vi.fn();
    const timeoutId = scheduleBrowserWebviewLoadTimeout(callback);

    clearBrowserWebviewLoadTimeout(timeoutId);
    vi.runOnlyPendingTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not throw when there is no timeout to clear", () => {
    expect(() => clearBrowserWebviewLoadTimeout(null)).not.toThrow();
  });

  it("warns and skips scheduling when setTimeout throws", () => {
    const error = new Error("setTimeout failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation(() => {
      throw error;
    });

    expect(scheduleBrowserWebviewLoadTimeout(vi.fn())).toBeNull();
    expect(warn).toHaveBeenCalledWith("Failed to schedule browser webview load timeout.", error);
  });

  it("warns when timeout cleanup throws", () => {
    const error = new Error("clearTimeout failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "clearTimeout").mockImplementation(() => {
      throw error;
    });

    clearBrowserWebviewLoadTimeout(1);

    expect(warn).toHaveBeenCalledWith("Failed to clear browser webview load timeout.", error);
  });
});
