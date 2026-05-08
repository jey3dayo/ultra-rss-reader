export function setStoryTauriRuntimePresent() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: {},
  });
}

export function setStoryTauriRuntimeMissing() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}
