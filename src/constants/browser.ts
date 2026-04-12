export const BROWSER_WINDOW_EVENTS = {
  stateChanged: "browser-webview-state-changed",
  closed: "browser-webview-closed",
  fallback: "browser-webview-fallback",
  diagnostics: "browser-webview-diagnostics",
} as const;

export const BROWSER_WINDOW_LOAD_TIMEOUT_MS = 10_000;
export const BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR = 1;
export const BROWSER_GEOMETRY_PERCENT_FRACTION_DIGITS = 1;
export const BROWSER_GEOMETRY_SCALE_FACTOR_FRACTION_DIGITS = 2;
