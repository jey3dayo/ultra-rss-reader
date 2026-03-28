import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useMenuEvents } from "../hooks/use-menu-events";
import { useUpdater } from "../hooks/use-updater";
import { useUiStore } from "../stores/ui-store";
import { AppLayout } from "./app-layout";
import { SettingsModal } from "./settings/settings-modal";
import { ConfirmDialog } from "./ui/confirm-dialog";

function Toast() {
  const { toastMessage, clearToast } = useUiStore();
  if (!toastMessage) return null;

  const { message, progress, actions } = toastMessage;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={clearToast}
          aria-label="Dismiss"
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>
      {progress != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  useBreakpoint();
  useKeyboard();
  useMenuEvents();
  useUpdater();

  return (
    <div className="flex h-full flex-col">
      <AppLayout />
      <SettingsModal />
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
