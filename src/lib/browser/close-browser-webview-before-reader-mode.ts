import { Result } from "@praha/byethrow";
import { closeBrowserWebview } from "@/api/tauri-commands";

const BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS = 2_000;

export async function closeBrowserWebviewBeforeReaderMode(): Promise<void> {
  let timeoutId: number | null = null;
  const closeCommand = closeBrowserWebview()
    .then((result) => {
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.error("Failed to close embedded browser webview before returning to reader mode:", error);
        }),
      );
      return "closed" as const;
    })
    .catch((error: unknown) => {
      console.error("Embedded browser webview close command rejected before returning to reader mode:", error);
      return "closed" as const;
    });

  const timeout = new Promise<"timeout">((resolve) => {
    try {
      timeoutId = window.setTimeout(() => resolve("timeout"), BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS);
    } catch (error) {
      console.warn("Failed to schedule embedded browser webview close timeout.", error);
      resolve("timeout");
    }
  });

  const result = await Promise.race([closeCommand, timeout]);
  if (timeoutId !== null) {
    try {
      window.clearTimeout(timeoutId);
    } catch (error) {
      console.warn("Failed to clear embedded browser webview close timeout.", error);
    }
  }
  if (result === "timeout") {
    console.warn("Timed out closing embedded browser webview before returning to reader mode.");
  }
}
