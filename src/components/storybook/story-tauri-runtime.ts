type StoryRuntimeFlagName = "__TAURI_INTERNALS__" | "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__";

type StoryRuntimeSnapshot = {
  tauriInternalsDescriptor: PropertyDescriptor | undefined;
  devBrowserMocksDescriptor: PropertyDescriptor | undefined;
  ultraRssBrowserMocksDescriptor: PropertyDescriptor | undefined;
};

type StoryTauriRuntimeInternalsOptions = {
  writable?: boolean;
};

export type RestoreStoryRuntime = () => void;

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

export function installStoryRuntimeTauriInternals(
  tauriInternals: object = {},
  options: StoryTauriRuntimeInternalsOptions = {},
): RestoreStoryRuntime {
  const snapshot = captureStoryRuntimeSnapshot();

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: options.writable ?? true,
    value: tauriInternals,
  });

  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

  return () => restoreStoryRuntimeSnapshot(snapshot);
}

export function removeStoryRuntimeTauriInternals(): RestoreStoryRuntime {
  const snapshot = captureStoryRuntimeSnapshot();

  delete window.__TAURI_INTERNALS__;
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

  return () => restoreStoryRuntimeSnapshot(snapshot);
}

export function setStoryTauriRuntimePresent() {
  return installStoryRuntimeTauriInternals();
}

export function setStoryTauriRuntimeMissing() {
  return removeStoryRuntimeTauriInternals();
}

export function setComponentIsolationStoryRuntime() {
  return setStoryTauriRuntimeMissing();
}

export function setAppLikeScenarioStoryRuntime() {
  return setStoryTauriRuntimePresent();
}
