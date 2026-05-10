import { Result } from "@praha/byethrow";

export const MAX_WEBVIEW_HISTORY_LENGTH = 50;

const BROWSER_IFRAME_SELECTORS = [
  "iframe[data-browser-webview-iframe]",
  "iframe[data-browser-preview-iframe]",
  "iframe",
] as const;

export type WebviewHistorySnapshot = {
  entries: string[];
  index: number;
  canGoBack: boolean;
  canGoForward: boolean;
};

export function normalizeWebviewHistoryUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return trimmedUrl.replace(/#.*$/u, "");
  }
}

export function createWebviewHistorySnapshot(urls: readonly string[]): WebviewHistorySnapshot {
  const entries: string[] = [];

  for (const url of urls) {
    const normalizedUrl = normalizeWebviewHistoryUrl(url);
    if (normalizedUrl.length === 0 || entries.at(-1) === normalizedUrl) {
      continue;
    }

    entries.push(normalizedUrl);
    if (entries.length > MAX_WEBVIEW_HISTORY_LENGTH) {
      entries.shift();
    }
  }

  const index = entries.length > 0 ? entries.length - 1 : 0;
  return {
    entries,
    index,
    canGoBack: index > 0,
    canGoForward: false,
  };
}

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
