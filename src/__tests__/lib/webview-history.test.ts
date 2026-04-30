import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it } from "vitest";
import { goBackInWebview, goForwardInWebview, reloadWebview } from "@/lib/webview-history";

function appendIframe(src = "https://example.com/article") {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  document.body.append(iframe);

  return iframe;
}

describe("webview-history", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("fails when no iframe is available", async () => {
    const result = await reloadWebview();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toBe("iframe not found");
  });

  it("reloads the iframe by restoring its current src", async () => {
    const iframe = appendIframe("https://example.com/article");

    const result = await reloadWebview();

    expect(Result.isSuccess(result)).toBe(true);
    expect(iframe.src).toBe("https://example.com/article");
  });

  it("calls iframe history navigation when available", async () => {
    appendIframe();

    expect(Result.isSuccess(await goBackInWebview())).toBe(true);
    expect(Result.isSuccess(await goForwardInWebview())).toBe(true);
  });
});
