import { Result } from "@praha/byethrow";
import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/tauri-commands";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useBrowserWebviewCleanup } from "@/components/reader/hooks/browser/use-browser-webview-cleanup";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

vi.mock("@/api/tauri-commands", () => ({
  closeBrowserWebview: vi.fn(),
}));

const closeBrowserWebviewMock = vi.mocked(closeBrowserWebview);

describe("useBrowserWebviewCleanup", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("closes the browser webview once on unmount only", async () => {
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));

    const { rerender, unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    expect(closeBrowserWebviewMock).not.toHaveBeenCalled();

    rerender();

    expect(closeBrowserWebviewMock).not.toHaveBeenCalled();

    unmount();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
  });

  it("does not close a newer browser webview from stale controller cleanup", async () => {
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    useUiStore.setState({ browserUrl: "https://example.com/previous" });

    const { unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    useUiStore.setState({ browserUrl: "https://example.com/current" });
    unmount();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).not.toHaveBeenCalled();
  });

  it("logs Result failures from the close command during unmount cleanup", async () => {
    const closeError: AppError = {
      type: "UserVisible",
      message: "close failed",
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    closeBrowserWebviewMock.mockResolvedValue(Result.fail(closeError));

    const { unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    unmount();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to close embedded browser webview (native-close-failed):",
      closeError,
    );
  });

  it.each([
    ["beforeunload-blocked", new Error("close rejected by beforeunload handler")],
    ["page-script-failed", new Error("close rejected after page script failure")],
    ["native-close-failed", new Error("close rejected")],
  ])("logs %s rejected close command promises during unmount cleanup", async (category, closeError) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    closeBrowserWebviewMock.mockRejectedValue(closeError);

    const { unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    unmount();
    await Promise.resolve();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(`Failed to close embedded browser webview (${category}):`, closeError);
  });

  it("logs already-closed cleanup as informational drift", async () => {
    const closeError: AppError = {
      type: "UserVisible",
      message: "Embedded browser webview is not open",
    };
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    closeBrowserWebviewMock.mockResolvedValue(Result.fail(closeError));

    const { unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    unmount();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledWith("Embedded browser webview was already closed during cleanup:", closeError);
  });
});
