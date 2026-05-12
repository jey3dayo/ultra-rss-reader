import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";

export function scheduleBrowserWebviewLoadTimeout(callback: () => void): number | null {
  if (typeof window === "undefined" || typeof window.setTimeout !== "function") {
    console.warn("Browser webview load timeout timer is unavailable.");
    return null;
  }

  try {
    return window.setTimeout(callback, BROWSER_WINDOW_LOAD_TIMEOUT_MS);
  } catch (error) {
    console.warn("Failed to schedule browser webview load timeout.", error);
    return null;
  }
}

export function clearBrowserWebviewLoadTimeout(timeoutId: number | null): void {
  if (timeoutId === null) {
    return;
  }

  try {
    window.clearTimeout(timeoutId);
  } catch (error) {
    console.warn("Failed to clear browser webview load timeout.", error);
  }
}
