import { AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import {
  type ComponentProps,
  type ComponentType,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import { stateSurfaceButtonClassName } from "@/components/shared/state-surface-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  MOTION_DATA_HOLD_ATTRIBUTE,
  MOTION_HOLD_CONFIRM_CLASS_NAME,
  MOTION_HOLD_CONFIRM_DURATION_MS,
  MOTION_HOLD_CONFIRM_FILL_CLASS_NAME,
  PHRASE_AWARE_TEXT_CLASS_NAME,
} from "@/constants";
import { cn } from "@/lib/utils";

type UseHoldToConfirmOptions = {
  enabled: boolean;
  onConfirm: () => void;
};

/**
 * Pointer press-and-hold gate for destructive confirms. Keyboard activation stays
 * immediate so the action does not depend on key repeat behavior.
 */
function useHoldToConfirm({ enabled, onConfirm }: UseHoldToConfirmOptions) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelHold = useCallback(() => {
    clearTimer();
    setHolding(false);
  }, [clearTimer]);

  useEffect(() => cancelHold, [cancelHold]);

  // Derive the rendered hold state from `enabled` instead of syncing it via an
  // effect; only the pending timer itself needs an explicit side-effect clear.
  useEffect(() => {
    if (!enabled) {
      clearTimer();
    }
  }, [clearTimer, enabled]);

  const handlePointerDown = useCallback(() => {
    if (!enabled || timerRef.current !== null) {
      return;
    }

    setHolding(true);
    const handle = setTimeout(() => {
      // Ignore a timer that a newer press or a cleanup already replaced.
      if (timerRef.current !== handle) {
        return;
      }
      timerRef.current = null;
      setHolding(false);
      onConfirm();
    }, MOTION_HOLD_CONFIRM_DURATION_MS);
    timerRef.current = handle;
  }, [enabled, onConfirm]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      // detail === 0 is keyboard activation (Enter / Space); pointer clicks are
      // handled by the hold timer instead.
      if (enabled && event.detail > 0) {
        return;
      }

      onConfirm();
    },
    [enabled, onConfirm],
  );

  return { holding: holding && enabled, cancelHold, handlePointerDown, handleClick };
}

type ConfirmDialogIcon = ComponentType<{ className?: string }> | null;

type ConfirmDialogViewProps = {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionAccessibleLabel?: string;
  cancelLabel: string;
  variant?: ConfirmDialogVariant;
  /** Localized hint shown under a hold-to-confirm destructive action. */
  holdHint?: string;
  icon?: ConfirmDialogIcon;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

type ConfirmDialogVariantStyle = {
  iconContainerClassName: string;
  iconClassName: string;
  actionButtonVariant: NonNullable<ComponentProps<typeof Button>["variant"]>;
  actionButtonClassName: string;
  fallbackIcon: NonNullable<ConfirmDialogIcon>;
};

const confirmDialogVariantStyles = {
  default: {
    iconContainerClassName: "bg-surface-1/72",
    iconClassName: "text-primary",
    actionButtonVariant: "default",
    actionButtonClassName: "",
    fallbackIcon: CheckCheck,
  },
  warning: {
    iconContainerClassName: "bg-state-warning-surface",
    iconClassName: "text-state-warning-foreground",
    actionButtonVariant: "outline",
    actionButtonClassName: stateSurfaceButtonClassName("warning"),
    fallbackIcon: AlertTriangle,
  },
  destructive: {
    iconContainerClassName: "bg-state-danger-surface",
    iconClassName: "text-state-danger-foreground",
    actionButtonVariant: "destructive",
    actionButtonClassName: "hover:text-state-danger-foreground",
    fallbackIcon: Trash2,
  },
} satisfies Record<ConfirmDialogVariant, ConfirmDialogVariantStyle>;

export function ConfirmDialogView({
  open,
  title,
  message,
  actionLabel,
  actionAccessibleLabel,
  cancelLabel,
  variant = "default",
  holdHint,
  icon,
  confirmDisabled = false,
  cancelDisabled = false,
  onOpenChange,
  onConfirm,
  onCancel,
}: ConfirmDialogViewProps) {
  const tone = confirmDialogVariantStyles[variant];
  const Icon = icon ?? tone.fallbackIcon;
  const holdEnabled = variant === "destructive" && !confirmDisabled;
  const { holding, cancelHold, handlePointerDown, handleClick } = useHoldToConfirm({
    enabled: holdEnabled,
    onConfirm,
  });

  useEffect(() => {
    if (!open) {
      cancelHold();
    }
  }, [cancelHold, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[300px]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div
            data-testid="confirm-dialog-icon"
            className={cn("flex size-11 items-center justify-center rounded-md", tone.iconContainerClassName)}
          >
            <Icon data-testid="confirm-dialog-icon-svg" className={cn("size-5", tone.iconClassName)} />
          </div>
          <p className={cn("text-sm text-foreground", PHRASE_AWARE_TEXT_CLASS_NAME)} aria-hidden="true">
            {message}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={handleClick}
              onPointerDown={holdEnabled ? handlePointerDown : undefined}
              onPointerUp={holdEnabled ? cancelHold : undefined}
              onPointerLeave={holdEnabled ? cancelHold : undefined}
              onPointerCancel={holdEnabled ? cancelHold : undefined}
              onBlur={holdEnabled ? cancelHold : undefined}
              {...(holdEnabled ? { [MOTION_DATA_HOLD_ATTRIBUTE]: holding ? "true" : "false" } : {})}
              disabled={confirmDisabled}
              aria-label={actionAccessibleLabel}
              aria-busy={confirmDisabled || undefined}
              variant={tone.actionButtonVariant}
              className={cn(
                "min-h-11 w-full",
                // A 2s press must not start a text selection or a touch scroll.
                holdEnabled && `${MOTION_HOLD_CONFIRM_CLASS_NAME} touch-none select-none`,
                tone.actionButtonClassName,
              )}
            >
              {holdEnabled ? (
                <span
                  aria-hidden="true"
                  data-testid="confirm-dialog-hold-fill"
                  className={MOTION_HOLD_CONFIRM_FILL_CLASS_NAME}
                />
              ) : null}
              <span className="relative">{actionLabel}</span>
            </Button>
            {holdEnabled && holdHint ? (
              <p aria-hidden="true" className="text-center text-foreground-soft text-xs">
                {holdHint}
              </p>
            ) : null}
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={cancelDisabled}
              className="min-h-11 w-full border-border/45 bg-surface-1/72 text-foreground-soft"
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
