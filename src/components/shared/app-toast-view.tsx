import { useTranslation } from "react-i18next";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { cn } from "@/lib/utils";
import type { ToastData } from "@/stores/ui-store";
import { Button } from "../ui/button";

type AppToastViewProps = {
  toastMessage: ToastData;
  onClose: () => void;
  position?: "fixed" | "static";
  testId?: string;
};

const UPDATE_TOAST_WIDTH_CLASS_NAME = "w-[min(320px,calc(100vw-2rem))]";

export function AppToastView({ toastMessage, onClose, position = "fixed", testId = "app-toast" }: AppToastViewProps) {
  const { t } = useTranslation("common");
  const { message, progress, actions, variant } = toastMessage;

  return (
    <div
      data-open
      data-side="top"
      data-testid={testId}
      className={cn(
        MOTION_POPUP_SURFACE_CLASS_NAME,
        position === "fixed" ? "fixed right-4 bottom-4 z-[100]" : "relative",
        "flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-elevation-2",
        variant === "update" && UPDATE_TOAST_WIDTH_CLASS_NAME,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        <Button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          variant="ghost"
          size="xs"
          className="ml-2 h-7 min-w-7 shrink-0 px-0 text-foreground-soft hover:bg-surface-1/72"
        >
          &times;
        </Button>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-1/72">
          {progress != null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
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
            <Button
              key={action.label}
              type="button"
              onClick={action.onClick}
              variant="ghost"
              size="xs"
              className="min-h-7 px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface-1/72 hover:text-primary"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
