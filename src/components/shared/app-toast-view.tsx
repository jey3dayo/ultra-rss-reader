import { cva } from "class-variance-authority";
import { cn } from "cn";
import { CircleAlert, type LucideIcon, TriangleAlert, X } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import type { ToastData, ToastSeverity } from "@/lib/ui/toast.types";
import { segmentToastMessage } from "@/lib/ui/toast-message";
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
  hideClose?: boolean;
};

const UPDATE_TOAST_WIDTH_CLASS_NAME = "w-[min(320px,calc(100vw-2rem))]";

const toastBorderVariants = cva("", {
  variants: {
    severity: {
      info: "border-border",
      success: "border-border",
      warning: "border-state-warning-border",
      error: "border-state-danger-border",
    },
  },
  defaultVariants: { severity: "info" },
});

const toastSeverityIconVariants = cva("mt-[calc((1lh-1rem)/2)] size-4 shrink-0", {
  variants: {
    severity: {
      info: "",
      success: "",
      warning: "text-state-warning-foreground",
      error: "text-state-danger-foreground",
    },
  },
});

const TOAST_SEVERITY_ICONS: Partial<Record<ToastSeverity, LucideIcon>> = {
  warning: TriangleAlert,
  error: CircleAlert,
};

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
  hideClose = false,
}: AppToastViewProps) {
  const { t, i18n } = useTranslation("common");
  const { message, progress, actions, variant, severity } = toastMessage;
  const messageSegments = segmentToastMessage(message, i18n.language);
  let segmentOffset = 0;
  const SeverityIcon = severity ? TOAST_SEVERITY_ICONS[severity] : undefined;
  const showInBrowserRail = position === "fixed" && placement === APP_TOAST_PLACEMENTS.browserRail;
  // A decision toast (primary + trailing dismiss action) uses the form action-pair pattern:
  // right-aligned, quiet secondary first, primary-filled CTA last, and no duplicate corner ×.
  const isDecision = (actions?.length ?? 0) >= 2;
  const showClose = !isDecision && !hideClose;
  const orderedActions = isDecision && actions ? [...actions.slice(1), actions[0]] : (actions ?? []);
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
        "flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 rounded-md border",
        toastBorderVariants({ severity }),
        "bg-card px-3 py-2 text-sm text-foreground shadow-elevation-2",
        "[--toast-accent:color-mix(in_srgb,var(--primary)_68%,var(--foreground))]",
        "[--toast-accent-hover:color-mix(in_srgb,var(--primary)_58%,var(--foreground))]",
        showInBrowserRail &&
          "max-w-[min(22rem,calc(100vw-12rem))] gap-0 rounded-md px-3 py-0.5 text-xs shadow-elevation-1",
        variant === "update" && UPDATE_TOAST_WIDTH_CLASS_NAME,
        variant === "update" && "gap-3 px-4 py-3",
      )}
    >
      <div className={cn("flex items-center", showClose && "min-h-8")}>
        <div className={cn("relative flex min-w-0 flex-1 items-start gap-2 leading-snug", showClose && "pr-8")}>
          {SeverityIcon && (
            <SeverityIcon
              aria-hidden="true"
              data-testid={`${testId}-severity-icon`}
              className={toastSeverityIconVariants({ severity })}
            />
          )}
          <span className="min-w-0 flex-1 break-keep whitespace-normal [overflow-wrap:anywhere]">
            {messageSegments
              ? messageSegments.map((segment, index) => {
                  const startOffset = segmentOffset;
                  segmentOffset += segment.length;
                  return (
                    <Fragment key={startOffset}>
                      {segment}
                      {index < messageSegments.length - 1 && <wbr />}
                    </Fragment>
                  );
                })
              : message}
          </span>
          {showClose && (
            <Button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              variant="ghost"
              size="icon-sm"
              className={cn(
                "absolute -right-3 top-[calc((1lh-2rem)/2)] size-8 shrink-0 leading-[inherit]",
                "text-[length:inherit] text-foreground-soft hover:text-foreground",
              )}
            >
              <X aria-hidden="true" viewBox="2 2 20 20" strokeWidth={1.5} className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-1/72">
          {progress != null ? (
            <div
              className={cn(
                "h-full w-full origin-left bg-primary transition-transform duration-200",
                "motion-reduce:transition-none",
              )}
              style={{
                transform: `scaleX(${clampProgressWidth(progress) / 100})`,
              }}
            />
          ) : (
            <div className="h-full w-1/3 animate-indeterminate rounded-full bg-primary" />
          )}
        </div>
      )}
      {orderedActions.length > 0 &&
        (isDecision ? (
          <div className="flex flex-wrap items-center justify-end gap-2" data-testid={`${testId}-action-pair`}>
            {orderedActions.map((action, index) => {
              const isPrimary = index === orderedActions.length - 1;
              return (
                <Button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={resolveActionDisabled(action.disabled)}
                  variant={isPrimary ? "default" : "outline"}
                  size="sm"
                  data-action-role={isPrimary ? "primary" : "secondary"}
                  className={cn(
                    "min-h-8 min-w-16 rounded-md px-3 text-xs font-medium",
                    isPrimary && "border-transparent bg-[var(--toast-accent)] text-primary-foreground",
                    isPrimary && "hover:bg-[var(--toast-accent-hover)] hover:text-primary-foreground",
                  )}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className={cn("flex flex-wrap items-center gap-2", SeverityIcon && "pl-6")}>
            {orderedActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={resolveActionDisabled(action.disabled)}
                variant="ghost"
                size="sm"
                className={cn(
                  "min-h-8 px-0 py-1 text-xs font-medium",
                  "text-[color:var(--toast-accent)] hover:text-[color:var(--toast-accent-hover)]",
                )}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ))}
    </div>
  );
}
