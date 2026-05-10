type StoryRuntimeFlagName = "__TAURI_INTERNALS__" | "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__";
export type RuntimeWindowDescriptorName = StoryRuntimeFlagName;

type StoryRuntimeSnapshot = {
  tauriInternalsDescriptor: PropertyDescriptor | undefined;
  devBrowserMocksDescriptor: PropertyDescriptor | undefined;
  ultraRssBrowserMocksDescriptor: PropertyDescriptor | undefined;
};

type StoryTauriRuntimeInternalsOptions = {
  writable?: boolean;
};

export type RestoreStoryRuntime = () => void;
export type RuntimeWindowDescriptorsSnapshot = Partial<
  Record<RuntimeWindowDescriptorName, PropertyDescriptor | undefined>
>;

const RUNTIME_WINDOW_DESCRIPTOR_NAMES: readonly RuntimeWindowDescriptorName[] = [
  "__TAURI_INTERNALS__",
  "__DEV_BROWSER_MOCKS__",
  "__ULTRA_RSS_BROWSER_MOCKS__",
];

export function restoreRuntimeWindowDescriptor(
  name: RuntimeWindowDescriptorName,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor);
    return;
  }

  Reflect.deleteProperty(window, name);
}

export function captureRuntimeWindowDescriptors(
  names: readonly RuntimeWindowDescriptorName[],
): RuntimeWindowDescriptorsSnapshot {
  const snapshot: RuntimeWindowDescriptorsSnapshot = {};
  for (const name of names) {
    snapshot[name] = Object.getOwnPropertyDescriptor(window, name);
  }
  return snapshot;
}

export function restoreRuntimeWindowDescriptors(snapshot: RuntimeWindowDescriptorsSnapshot) {
  for (const name of RUNTIME_WINDOW_DESCRIPTOR_NAMES) {
    if (Object.hasOwn(snapshot, name)) {
      restoreRuntimeWindowDescriptor(name, snapshot[name]);
    }
  }
}

export function defineRuntimeWindowDescriptor(name: RuntimeWindowDescriptorName, descriptor: PropertyDescriptor) {
  Object.defineProperty(window, name, {
    configurable: true,
    ...descriptor,
  });
}

function captureStoryRuntimeSnapshot(): StoryRuntimeSnapshot {
  const snapshot = captureRuntimeWindowDescriptors([
    "__TAURI_INTERNALS__",
    "__DEV_BROWSER_MOCKS__",
    "__ULTRA_RSS_BROWSER_MOCKS__",
  ]);

  return {
    tauriInternalsDescriptor: snapshot.__TAURI_INTERNALS__,
    devBrowserMocksDescriptor: snapshot.__DEV_BROWSER_MOCKS__,
    ultraRssBrowserMocksDescriptor: snapshot.__ULTRA_RSS_BROWSER_MOCKS__,
  };
}

function restoreStoryRuntimeSnapshot(snapshot: StoryRuntimeSnapshot) {
  restoreRuntimeWindowDescriptors({
    __TAURI_INTERNALS__: snapshot.tauriInternalsDescriptor,
    __DEV_BROWSER_MOCKS__: snapshot.devBrowserMocksDescriptor,
    __ULTRA_RSS_BROWSER_MOCKS__: snapshot.ultraRssBrowserMocksDescriptor,
  });
}

function setStoryRuntimeBrowserMockFlag(name: "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__", value: boolean) {
  defineRuntimeWindowDescriptor(name, {
    writable: true,
    enumerable: true,
    value,
  });
}

export function installStoryRuntimeTauriInternals(
  tauriInternals: object = {},
  options: StoryTauriRuntimeInternalsOptions = {},
): RestoreStoryRuntime {
  const snapshot = captureStoryRuntimeSnapshot();

  defineRuntimeWindowDescriptor("__TAURI_INTERNALS__", {
    writable: options.writable ?? true,
    value: tauriInternals,
  });

  setStoryRuntimeBrowserMockFlag("__DEV_BROWSER_MOCKS__", false);
  setStoryRuntimeBrowserMockFlag("__ULTRA_RSS_BROWSER_MOCKS__", false);

  return () => restoreStoryRuntimeSnapshot(snapshot);
}

export function removeStoryRuntimeTauriInternals(): RestoreStoryRuntime {
  const snapshot = captureStoryRuntimeSnapshot();

  delete window.__TAURI_INTERNALS__;
  setStoryRuntimeBrowserMockFlag("__DEV_BROWSER_MOCKS__", false);
  setStoryRuntimeBrowserMockFlag("__ULTRA_RSS_BROWSER_MOCKS__", false);

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
