type StoryRuntimeFlagName = "__TAURI_INTERNALS__" | "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__";

type StoryRuntimeSnapshot = {
  tauriInternalsDescriptor: PropertyDescriptor | undefined;
  devBrowserMocksDescriptor: PropertyDescriptor | undefined;
  ultraRssBrowserMocksDescriptor: PropertyDescriptor | undefined;
};

function captureStoryRuntimeSnapshot(): StoryRuntimeSnapshot {
  return {
    tauriInternalsDescriptor: Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__"),
    devBrowserMocksDescriptor: Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__"),
    ultraRssBrowserMocksDescriptor: Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__"),
  };
}

function restoreWindowDescriptor(name: StoryRuntimeFlagName, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor);
    return;
  }

  delete window[name];
}

function restoreStoryRuntimeSnapshot(snapshot: StoryRuntimeSnapshot) {
  restoreWindowDescriptor("__TAURI_INTERNALS__", snapshot.tauriInternalsDescriptor);
  restoreWindowDescriptor("__DEV_BROWSER_MOCKS__", snapshot.devBrowserMocksDescriptor);
  restoreWindowDescriptor("__ULTRA_RSS_BROWSER_MOCKS__", snapshot.ultraRssBrowserMocksDescriptor);
}

export function setStoryTauriRuntimePresent() {
  const snapshot = captureStoryRuntimeSnapshot();

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: {},
  });
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

  return () => restoreStoryRuntimeSnapshot(snapshot);
}

export function setStoryTauriRuntimeMissing() {
  const snapshot = captureStoryRuntimeSnapshot();

  delete window.__TAURI_INTERNALS__;
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

  return () => restoreStoryRuntimeSnapshot(snapshot);
}

export function setComponentIsolationStoryRuntime() {
  return setStoryTauriRuntimeMissing();
}

export function setAppLikeScenarioStoryRuntime() {
  return setStoryTauriRuntimePresent();
}
