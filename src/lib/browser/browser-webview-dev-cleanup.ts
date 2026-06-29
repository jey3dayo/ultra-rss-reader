import { Result } from "@praha/byethrow";
import { type AppError, closeBrowserWebview } from "@/api/tauri-commands";

type BrowserWebviewDevCleanupRegistration = {
  registered: boolean;
};

const cleanupRegistration = globalThis as typeof globalThis & {
  __ultraBrowserWebviewDevCleanup?: BrowserWebviewDevCleanupRegistration;
};

function isAlreadyClosedBrowserWebviewError(error: AppError | unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("not open") || normalizedMessage.includes("not found");
}

function logDevCleanupFailure(error: AppError | unknown) {
  if (isAlreadyClosedBrowserWebviewError(error)) {
    console.info("Embedded browser webview was already closed during dev cleanup:", error);
    return;
  }

  console.error("Failed to close embedded browser webview during dev cleanup:", error);
}

function closeBrowserWebviewForDevCleanup() {
  void closeBrowserWebview()
    .then((result) => {
      Result.pipe(
        result,
        Result.inspectError((error) => {
          logDevCleanupFailure(error);
        }),
      );
    })
    .catch((error: unknown) => {
      logDevCleanupFailure(error);
    });
}

export function registerBrowserWebviewDevCleanup() {
  if (!import.meta.hot) {
    return;
  }

  if (!cleanupRegistration.__ultraBrowserWebviewDevCleanup) {
    cleanupRegistration.__ultraBrowserWebviewDevCleanup = { registered: false };
  }
  const registration = cleanupRegistration.__ultraBrowserWebviewDevCleanup;
  if (registration.registered) {
    return;
  }
  registration.registered = true;

  const handlePageHide = () => {
    closeBrowserWebviewForDevCleanup();
  };
  const handleHotUpdate = () => {
    closeBrowserWebviewForDevCleanup();
  };

  window.addEventListener("pagehide", handlePageHide);
  import.meta.hot.on("vite:beforeUpdate", handleHotUpdate);
  import.meta.hot.on("vite:beforeFullReload", handleHotUpdate);
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", handlePageHide);
    closeBrowserWebviewForDevCleanup();
    registration.registered = false;
  });
}
