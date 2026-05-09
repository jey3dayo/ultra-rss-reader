import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as webviewHistory from "@/lib/browser/webview-history";

function removeIframes() {
  for (const iframe of document.querySelectorAll("iframe")) {
    iframe.remove();
  }
}

describe("browser webview history helpers", () => {
  afterEach(() => {
    removeIframes();
    vi.restoreAllMocks();
  });

  it("keeps the frontend fallback helper limited to history navigation and reload", () => {
    expect(Object.keys(webviewHistory).sort()).toEqual(["goBackInWebview", "goForwardInWebview", "reloadWebview"]);
  });

  it("uses the iframe history stack for back and forward availability fallback", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const back = vi.spyOn(iframe.contentWindow?.history ?? window.history, "back").mockImplementation(() => undefined);
    const forward = vi
      .spyOn(iframe.contentWindow?.history ?? window.history, "forward")
      .mockImplementation(() => undefined);

    expect(Result.isSuccess(await webviewHistory.goBackInWebview())).toBe(true);
    expect(Result.isSuccess(await webviewHistory.goForwardInWebview())).toBe(true);

    expect(back).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it("reloads the iframe by resetting the current src instead of owning external-open availability", async () => {
    const iframe = document.createElement("iframe");
    iframe.src = "https://example.com/article";
    document.body.append(iframe);

    expect(Result.isSuccess(await webviewHistory.reloadWebview())).toBe(true);

    expect(iframe.src).toBe("https://example.com/article");
  });

  it("reports a typed failure when the fallback iframe is missing", async () => {
    const result = await webviewHistory.reloadWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe not found");
  });
});
