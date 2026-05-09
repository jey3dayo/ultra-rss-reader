import { Result } from "@praha/byethrow";

const BROWSER_IFRAME_SELECTORS = [
  "iframe[data-browser-webview-iframe]",
  "iframe[data-browser-preview-iframe]",
  "iframe",
] as const;

function getIframe(): Result.Result<HTMLIFrameElement, Error> {
  const iframe = BROWSER_IFRAME_SELECTORS.map((selector) => document.querySelector<HTMLIFrameElement>(selector)).find(
    (candidate) => candidate !== null,
  );
  return iframe ? Result.succeed(iframe) : Result.fail(new Error("iframe not found"));
}

export function goBackInWebview() {
  return Result.try({
    try: async () => {
      const iframe = Result.unwrap(getIframe());
      iframe.contentWindow?.history.back();
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}

export function goForwardInWebview() {
  return Result.try({
    try: async () => {
      const iframe = Result.unwrap(getIframe());
      iframe.contentWindow?.history.forward();
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}

export function reloadWebview() {
  return Result.try({
    try: async () => {
      const iframe = Result.unwrap(getIframe());
      // cross-origin では contentWindow.location.reload() が SecurityError になるため
      // src を再設定してリロードする
      const currentSrc = iframe.src;
      if (currentSrc.length === 0) {
        throw new Error("iframe src is empty");
      }
      iframe.src = "";
      iframe.src = currentSrc;
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}
