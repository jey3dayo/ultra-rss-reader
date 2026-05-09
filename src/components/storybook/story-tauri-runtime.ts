export function setStoryTauriRuntimePresent() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: {},
  });
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
}

export function setStoryTauriRuntimeMissing() {
  delete window.__TAURI_INTERNALS__;
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
}

export function setComponentIsolationStoryRuntime() {
  setStoryTauriRuntimeMissing();
}

export function setAppLikeScenarioStoryRuntime() {
  setStoryTauriRuntimePresent();
}
