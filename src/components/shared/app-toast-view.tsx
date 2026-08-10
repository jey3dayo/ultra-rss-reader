import { useTranslation } from "react-i18next";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import type { ToastData } from "@/lib/ui/toast.types";
import { cn } from "@/lib/utils";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";
import { Button } from "../ui/button";
import { APP_TOAST_PLACEMENTS, type AppToastPlacement } from "./app-toast-placement";

type AppToastViewProps = {
  toastMessage: ToastData;
  onClose: () => void;
  position?: "fixed" | "static";
  placement?: AppToastPlacement;
  testId?: string;
  syncActionState?: boolean;
  ending?: boolean;
};

const UPDATE_TOAST_WIDTH_CLASS_NAME = "w-[min(320px,calc(100vw-2rem))]";

function clampProgressWidth(progress: number) {
  return Math.min(Math.max(progress, 0), 100);
}

function resolveActionDisabled(disabled: boolean | (() => boolean) | undefined): boolean {
  return typeof disabled === "function" ? disabled() : disabled === true;
}

export function AppToastView({
  toastMessage,
  onClose,
  position = "fixed",
  placement = APP_TOAST_PLACEMENTS.bottomRight,
  testId = "app-toast",
  syncActionState = false,
  ending = false,
}: AppToastViewProps) {
  const { t } = useTranslation("common");
  const { message, progress, actions, variant } = toastMessage;
  const showInBrowserRail = position === "fixed" && placement === APP_TOAST_PLACEMENTS.browserRail;
  void syncActionState;

  return (
    <div
      data-open
      data-ending-style={ending ? "" : undefined}
      data-side={showInBrowserRail ? "bottom" : "top"}
      data-testid={testId}
      aria-hidden={ending || undefined}
      inert={ending || undefined}
      className={cn(
        MOTION_POPUP_SURFACE_CLASS_NAME,
        position === "fixed" && placement === APP_TOAST_PLACEMENTS.bottomRight && "fixed right-4 bottom-4",
        showInBrowserRail && "fixed top-1 right-20",
        position === "fixed" && APP_STACKING_CLASS_NAMES.toast,
        position === "static" && "relative",
        "flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-elevation-2",
        showInBrowserRail &&
          "max-w-[min(22rem,calc(100vw-12rem))] gap-0 rounded-md px-3 py-1 text-xs shadow-elevation-1",
        variant === "update" && UPDATE_TOAST_WIDTH_CLASS_NAME,
        variant === "update" && "gap-3 px-4 py-3",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 break-words leading-snug">{message}</span>
        <Button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          variant="ghost"
          size="icon-sm"
          className="ml-1 size-8 shrink-0 text-foreground-soft"
        >
          &times;
        </Button>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-1/72">
          {progress != null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${clampProgressWidth(progress)}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-indeterminate rounded-full bg-primary" />
          )}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className={cn("flex items-center gap-2", variant === "update" && "-ml-3 gap-3")}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={resolveActionDisabled(action.disabled)}
              variant="ghost"
              size="sm"
              className={cn(
                "min-h-8 px-3 py-1 text-xs font-medium text-primary hover:text-primary",
                variant === "update" && index > 0 && "text-foreground-soft hover:text-foreground",
              )}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
