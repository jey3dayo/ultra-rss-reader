import {
  installStoryRuntimeTauriInternals,
  removeStoryRuntimeTauriInternals,
} from "@/components/storybook/story-tauri-runtime";

export function setTauriRuntimePresent() {
  return installStoryRuntimeTauriInternals();
}

export function setTauriRuntimeMissing() {
  return removeStoryRuntimeTauriInternals();
}

export function resetTauriRuntimeFlags() {
  setTauriRuntimeMissing();
}
