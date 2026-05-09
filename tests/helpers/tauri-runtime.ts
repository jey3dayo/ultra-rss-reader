export function setTauriRuntimePresent() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: {},
  });
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
}

export function setTauriRuntimeMissing() {
  delete window.__TAURI_INTERNALS__;
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
}

export function resetTauriRuntimeFlags() {
  setTauriRuntimeMissing();
}
