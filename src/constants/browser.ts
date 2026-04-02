export const BROWSER_WINDOW_EVENTS = {
  stateChanged: "browser-webview-state-changed",
  closed: "browser-webview-closed",
  fallback: "browser-webview-fallback",
  diagnostics: "browser-webview-diagnostics",
} as const;

export const BROWSER_WINDOW_LOAD_TIMEOUT_MS = 10_000;
