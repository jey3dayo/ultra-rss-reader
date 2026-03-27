import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useUiStore } from "../stores/ui-store";
import { AppLayout } from "./app-layout";
import { SettingsModal } from "./settings/settings-modal";

function Toast() {
  const { toastMessage, clearToast } = useUiStore();
  if (!toastMessage) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
      <span>{toastMessage}</span>
      <button
        type="button"
        onClick={clearToast}
        aria-label="Dismiss"
        className="ml-2 text-muted-foreground hover:text-foreground"
      >
        &times;
      </button>
    </div>
  );
}

export function AppShell() {
  useBreakpoint();
  useKeyboard();

  return (
    <div className="flex h-full flex-col">
      <AppLayout />
      <SettingsModal />
      <Toast />
    </div>
  );
}
