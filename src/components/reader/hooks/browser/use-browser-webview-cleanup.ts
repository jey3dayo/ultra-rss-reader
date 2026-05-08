import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";

export function useBrowserWebviewCleanup() {
  useEffect(() => {
    return () => {
      void closeBrowserWebview().then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview:", error);
          }),
        );
      });
    };
  }, []);
}
