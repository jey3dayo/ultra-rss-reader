import { Result } from "@praha/byethrow";

function getIframe(): Result.Result<HTMLIFrameElement, Error> {
  const iframe = document.querySelector<HTMLIFrameElement>("iframe");
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
      iframe.src = "";
      iframe.src = currentSrc;
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}