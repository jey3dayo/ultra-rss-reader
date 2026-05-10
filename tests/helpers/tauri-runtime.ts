import {
  installStoryRuntimeTauriInternals,
  removeStoryRuntimeTauriInternals,
} from "@/components/storybook/story-tauri-runtime";
import { resetTauriEventListenerFailureReportForRuntimeRecovery } from "@/lib/runtime/tauri-event-listeners";

export function setTauriRuntimePresent() {
  return installStoryRuntimeTauriInternals();
}

export function setTauriRuntimeMissing() {
  return removeStoryRuntimeTauriInternals();
}

export function resetTauriRuntimeFlags() {
  resetTauriEventListenerFailureReportForRuntimeRecovery();
  setTauriRuntimeMissing();
}
