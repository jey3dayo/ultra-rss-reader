import { Result } from "@praha/byethrow";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as webviewHistory from "@/lib/browser/webview-history";

setupBrowserTestDom();

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
    expect(Object.keys(webviewHistory).toSorted()).toEqual([
      "MAX_WEBVIEW_HISTORY_LENGTH",
      "createWebviewHistorySnapshot",
      "goBackInWebview",
      "goForwardInWebview",
      "normalizeWebviewHistoryUrl",
      "reloadWebview",
    ]);
  });

  it("normalizes duplicate and hash-only URL changes before computing fallback history availability", () => {
    const snapshot = webviewHistory.createWebviewHistorySnapshot([
      " https://example.com/article#comments ",
      "https://example.com/article#latest",
      "https://example.com/next",
      "https://example.com/next#section",
    ]);

    expect(snapshot).toEqual({
      entries: ["https://example.com/article", "https://example.com/next"],
      index: 1,
      canGoBack: true,
      canGoForward: false,
    });
  });

  it("keeps fallback history bounded to the same single pending close action shape", () => {
    const urls = Array.from(
      { length: webviewHistory.MAX_WEBVIEW_HISTORY_LENGTH + 2 },
      (_, index) => `https://example.com/articles/${index}`,
    );

    const snapshot = webviewHistory.createWebviewHistorySnapshot(urls);

    expect(snapshot.entries).toHaveLength(webviewHistory.MAX_WEBVIEW_HISTORY_LENGTH);
    expect(snapshot.entries[0]).toBe("https://example.com/articles/2");
    expect(snapshot.entries.at(-1)).toBe("https://example.com/articles/51");
    expect(snapshot.index).toBe(webviewHistory.MAX_WEBVIEW_HISTORY_LENGTH - 1);
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

  it("prefers the embedded browser webview iframe before preview and generic iframe fallbacks", async () => {
    const genericIframe = document.createElement("iframe");
    const previewIframe = document.createElement("iframe");
    const browserIframe = document.createElement("iframe");
    previewIframe.setAttribute("data-browser-preview-iframe", "");
    browserIframe.setAttribute("data-browser-webview-iframe", "");
    document.body.append(genericIframe, previewIframe, browserIframe);
    const genericBack = vi
      .spyOn(genericIframe.contentWindow?.history ?? window.history, "back")
      .mockImplementation(() => undefined);
    const previewBack = vi
      .spyOn(previewIframe.contentWindow?.history ?? window.history, "back")
      .mockImplementation(() => undefined);
    const browserBack = vi
      .spyOn(browserIframe.contentWindow?.history ?? window.history, "back")
      .mockImplementation(() => undefined);

    expect(Result.isSuccess(await webviewHistory.goBackInWebview())).toBe(true);

    expect(browserBack).toHaveBeenCalledTimes(1);
    expect(previewBack).not.toHaveBeenCalled();
    expect(genericBack).not.toHaveBeenCalled();
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

  it("reports a typed failure when the iframe owner document is unavailable", async () => {
    const originalDocument = document;
    vi.stubGlobal("document", undefined);

    try {
      const result = await webviewHistory.goBackInWebview();

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result).message).toBe("document unavailable");
    } finally {
      vi.stubGlobal("document", originalDocument);
    }
  });

  it("reports a typed failure when the iframe history runtime is unavailable", async () => {
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: null,
    });
    document.body.append(iframe);

    const result = await webviewHistory.goForwardInWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe runtime unavailable");
  });
});
