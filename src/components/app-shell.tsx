import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppIconTheme } from "../hooks/use-app-icon-theme";
import { useBadge } from "../hooks/use-badge";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { useMenuEvents } from "../hooks/use-menu-events";
import { useUpdater } from "../hooks/use-updater";
import { cn } from "../lib/utils";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "../lib/window-chrome";
import { usePlatformStore } from "../stores/platform-store";
import { useUiStore } from "../stores/ui-store";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppLayout } from "./app-layout";
import { CommandPalette } from "./reader/command-palette";
import { SettingsModal } from "./settings/settings-modal";
import { IndeterminateProgress } from "./shared/indeterminate-progress";

function Toast() {
  const { t } = useTranslation("common");
  const { toastMessage, clearToast } = useUiStore();
  if (!toastMessage) return null;

  const { message, progress, actions } = toastMessage;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={clearToast}
          aria-label={t("close")}
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {progress != null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          )}
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
  useAppIconTheme();
  useBadge();
  useBreakpoint();
  useKeyboard();
  useMenuEvents();
  useUpdater();
  const loadPlatformInfo = usePlatformStore((state) => state.loadPlatformInfo);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const appLoading = useUiStore((state) => state.appLoading);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  useEffect(() => {
    loadPlatformInfo();
  }, [loadPlatformInfo]);

  return (
    <div className="relative flex h-full flex-col">
      <div
        data-browser-overlay-root=""
        className={cn(
          "pointer-events-none absolute inset-0 z-40",
          overlayTitlebar && "desktop-titlebar-offset desktop-overlay-titlebar",
        )}
      />
      {appLoading && <IndeterminateProgress className="shrink-0" />}
      <div className="min-h-0 flex-1">
        <AppLayout />
      </div>
      <SettingsModal />
      <AppConfirmDialog />
      <Toast />
      {commandPaletteOpen ? <CommandPalette /> : null}
    </div>
  );
}
