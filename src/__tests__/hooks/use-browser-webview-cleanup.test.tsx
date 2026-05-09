import { Result } from "@praha/byethrow";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/tauri-commands";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useBrowserWebviewCleanup } from "@/components/reader/hooks/browser/use-browser-webview-cleanup";

vi.mock("@/api/tauri-commands", () => ({
  closeBrowserWebview: vi.fn(),
}));

const closeBrowserWebviewMock = vi.mocked(closeBrowserWebview);

describe("useBrowserWebviewCleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
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
    expect(consoleError).toHaveBeenCalledWith("Failed to close embedded browser webview:", closeError);
  });

  it("logs rejected close command promises during unmount cleanup", async () => {
    const closeError = new Error("close rejected");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    closeBrowserWebviewMock.mockRejectedValue(closeError);

    const { unmount } = renderHook(() => {
      useBrowserWebviewCleanup();
    });

    unmount();
    await Promise.resolve();
    await Promise.resolve();

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("Failed to close embedded browser webview:", closeError);
  });
});
