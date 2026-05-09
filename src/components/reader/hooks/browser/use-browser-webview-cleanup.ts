import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { closeBrowserWebview, type AppError } from "@/api/tauri-commands";

type BrowserWebviewCloseFailureCategory =
  | "already-closed"
  | "beforeunload-blocked"
  | "page-script-failed"
  | "native-close-failed";

function categorizeBrowserWebviewCloseFailure(
  error: AppError | unknown,
): BrowserWebviewCloseFailureCategory {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("not open") ||
    normalizedMessage.includes("not found")
  ) {
    return "already-closed";
  }
  if (normalizedMessage.includes("beforeunload")) {
    return "beforeunload-blocked";
  }
  if (
    normalizedMessage.includes("script") ||
    normalizedMessage.includes("javascript")
  ) {
    return "page-script-failed";
  }
  return "native-close-failed";
}

function logBrowserWebviewCloseFailure(error: AppError | unknown) {
  const category = categorizeBrowserWebviewCloseFailure(error);

  if (category === "already-closed") {
    console.info(
      "Embedded browser webview was already closed during cleanup:",
      error,
    );
    return;
  }

  console.error(
    `Failed to close embedded browser webview (${category}):`,
    error,
  );
}

export function useBrowserWebviewCleanup() {
  useEffect(() => {
    return () => {
      void closeBrowserWebview()
        .then((result) => {
          Result.pipe(
            result,
            Result.inspectError((error) => {
              logBrowserWebviewCloseFailure(error);
            }),
          );
        })
        .catch((error: unknown) => {
          logBrowserWebviewCloseFailure(error);
        });
    };
  }, []);
}
