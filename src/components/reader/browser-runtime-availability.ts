import { hasTauriRuntime } from "@/lib/window-chrome";

export function isBrowserRuntimeUnavailable(): boolean {
  if (typeof window !== "undefined") {
    if (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true) {
      return true;
    }
  }

  return !hasTauriRuntime();
}
