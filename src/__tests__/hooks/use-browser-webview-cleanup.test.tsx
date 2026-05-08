import { Result } from "@praha/byethrow";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useBrowserWebviewCleanup } from "@/components/reader/hooks/browser/use-browser-webview-cleanup";

vi.mock("@/api/tauri-commands", () => ({
  closeBrowserWebview: vi.fn(),
}));

const closeBrowserWebviewMock = vi.mocked(closeBrowserWebview);

describe("useBrowserWebviewCleanup", () => {
  afterEach(() => {
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
});
