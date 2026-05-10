import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { goBackInWebview, goForwardInWebview, reloadWebview } from "@/lib/browser/webview-history";

function getIframeHistory(iframe: HTMLIFrameElement): History {
  if (!iframe.contentWindow) {
    throw new Error("iframe contentWindow is required for this test");
  }

  return iframe.contentWindow.history;
}

function appendIframe(src = "https://example.com/article") {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  document.body.append(iframe);

  return iframe;
}

function appendTrackedIframe(src = "https://example.com/article") {
  const iframe = document.createElement("iframe");
  const assignedSrcs: string[] = [];
  let currentSrc = src;
  Object.defineProperty(iframe, "src", {
    configurable: true,
    get: () => currentSrc,
    set: (value: string) => {
      assignedSrcs.push(value);
      currentSrc = value;
    },
  });
  document.body.append(iframe);

  return { assignedSrcs, iframe };
}

describe("webview-history", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("fails when no iframe is available", async () => {
    const result = await reloadWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe not found");
  });

  it("fails with a stable error when the owner document is unavailable", async () => {
    const originalDocument = document;
    vi.stubGlobal("document", undefined);

    try {
      const result = await reloadWebview();

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result).message).toBe("document unavailable");
    } finally {
      vi.stubGlobal("document", originalDocument);
    }
  });

  it("returns Result failures when iframe lookup throws", async () => {
    const error = new Error("document runtime unavailable");
    vi.spyOn(document, "querySelector").mockImplementation(() => {
      throw error;
    });

    const result = await goBackInWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toBe(error);
  });

  it("reloads the iframe by restoring its current src", async () => {
    const iframe = appendIframe("https://example.com/article");

    const result = await reloadWebview();

    expect(Result.isSuccess(result)).toBe(true);
    expect(iframe.src).toBe("https://example.com/article");
  });

  it("reloads only the first iframe when multiple iframes exist", async () => {
    const first = appendTrackedIframe("https://example.com/first");
    const second = appendTrackedIframe("https://example.com/second");

    const result = await reloadWebview();

    expect(Result.isSuccess(result)).toBe(true);
    expect(first.assignedSrcs).toEqual(["", "https://example.com/first"]);
    expect(second.assignedSrcs).toEqual([]);
    expect(first.iframe.src).toBe("https://example.com/first");
    expect(second.iframe.src).toBe("https://example.com/second");
  });

  it("fails reload when the first iframe src is empty", async () => {
    const first = appendTrackedIframe("");
    const second = appendTrackedIframe("https://example.com/second");

    const result = await reloadWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe src is empty");
    expect(first.assignedSrcs).toEqual([]);
    expect(second.assignedSrcs).toEqual([]);
    expect(first.iframe.src).toBe("");
  });

  it("calls iframe history navigation when available", async () => {
    appendIframe();

    expect(Result.isSuccess(await goBackInWebview())).toBe(true);
    expect(Result.isSuccess(await goForwardInWebview())).toBe(true);
  });

  it("fails history navigation with a stable error when the iframe runtime is unavailable", async () => {
    const iframe = appendIframe();
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: null,
    });

    const result = await goBackInWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe runtime unavailable");
  });

  it("navigates history only on the first iframe when multiple iframes exist", async () => {
    const first = appendIframe("https://example.com/first");
    const second = appendIframe("https://example.com/second");
    const firstBack = vi.spyOn(getIframeHistory(first), "back").mockImplementation(() => undefined);
    const secondBack = vi.spyOn(getIframeHistory(second), "back").mockImplementation(() => undefined);
    const firstForward = vi.spyOn(getIframeHistory(first), "forward").mockImplementation(() => undefined);
    const secondForward = vi.spyOn(getIframeHistory(second), "forward").mockImplementation(() => undefined);

    expect(Result.isSuccess(await goBackInWebview())).toBe(true);
    expect(Result.isSuccess(await goForwardInWebview())).toBe(true);

    expect(firstBack).toHaveBeenCalledTimes(1);
    expect(secondBack).not.toHaveBeenCalled();
    expect(firstForward).toHaveBeenCalledTimes(1);
    expect(secondForward).not.toHaveBeenCalled();
  });

  it("targets the browser webview iframe when a hidden unrelated iframe appears first", async () => {
    const hidden = appendIframe("https://example.com/hidden");
    hidden.hidden = true;
    const browser = appendIframe("https://example.com/browser");
    browser.setAttribute("data-browser-webview-iframe", "");
    const hiddenBack = vi.spyOn(getIframeHistory(hidden), "back").mockImplementation(() => undefined);
    const browserBack = vi.spyOn(getIframeHistory(browser), "back").mockImplementation(() => undefined);

    expect(Result.isSuccess(await goBackInWebview())).toBe(true);

    expect(hiddenBack).not.toHaveBeenCalled();
    expect(browserBack).toHaveBeenCalledTimes(1);
  });

  it("reloads the browser preview iframe before falling back to the first iframe", async () => {
    const unrelated = appendTrackedIframe("https://example.com/unrelated");
    const preview = appendTrackedIframe("https://example.com/preview");
    preview.iframe.setAttribute("data-browser-preview-iframe", "");

    const result = await reloadWebview();

    expect(Result.isSuccess(result)).toBe(true);
    expect(unrelated.assignedSrcs).toEqual([]);
    expect(preview.assignedSrcs).toEqual(["", "https://example.com/preview"]);
  });

  it("returns Result failures when iframe src reset throws", async () => {
    const error = new Error("src setter unavailable");
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "src", {
      configurable: true,
      get: () => "https://example.com/article",
      set: () => {
        throw error;
      },
    });
    document.body.append(iframe);

    const result = await reloadWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toBe(error);
  });
});
