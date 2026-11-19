import { cn } from "cn";
import { AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import { type ComponentProps, type ComponentType, useEffect, useId, useRef } from "react";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import { resolveHoldButtonProps, useHoldToConfirm } from "@/components/shared/hold-to-confirm";
import { stateSurfaceButtonVariants } from "@/components/shared/state-surface-button";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MOTION_HOLD_CONFIRM_CLASS_NAME,
  MOTION_HOLD_CONFIRM_FILL_CLASS_NAME,
  PHRASE_AWARE_TEXT_CLASS_NAME,
} from "@/constants";

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
  errorMessage?: string | null;
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
    actionButtonClassName: stateSurfaceButtonVariants({ tone: "warning" }),
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

type ConfirmDialogHeaderProps = {
  title: ConfirmDialogViewProps["title"];
  message: ConfirmDialogViewProps["message"];
  Icon: NonNullable<ConfirmDialogIcon>;
  tone: ConfirmDialogVariantStyle;
};

function ConfirmDialogHeader({ title, message, Icon, tone }: ConfirmDialogHeaderProps) {
  return (
    <DialogHeader className="min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          data-testid="confirm-dialog-icon"
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", tone.iconContainerClassName)}
        >
          <Icon aria-hidden="true" data-testid="confirm-dialog-icon-svg" className={cn("size-4", tone.iconClassName)} />
        </div>
        <DialogTitle className="min-w-0 break-words text-base leading-snug font-semibold">{title}</DialogTitle>
      </div>
      <DialogDescription className={cn("leading-relaxed", PHRASE_AWARE_TEXT_CLASS_NAME)}>{message}</DialogDescription>
    </DialogHeader>
  );
}

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
  errorMessage,
  onOpenChange,
  onConfirm,
  onCancel,
}: ConfirmDialogViewProps) {
  const tone = confirmDialogVariantStyles[variant];
  const Icon = icon ?? tone.fallbackIcon;
  const holdEnabled = variant === "destructive" && !confirmDisabled;
  const holdHintId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  // Base UI would focus Cancel, so Enter would dismiss instead of confirming.
  // Destructive included; see .claude/rules/dialog-keyboard-confirm.md.
  const initialFocus = confirmDisabled ? undefined : confirmButtonRef;
  const showHoldHint = holdEnabled && holdHint !== undefined;
  const { holding, cancelHold, cancelPointerHold, handlePointerDown, handleClick } = useHoldToConfirm({
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
      <DialogContent
        showCloseButton={false}
        initialFocus={initialFocus}
        overlayPreset="readable"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-sm"
      >
        <div className="flex min-w-0 flex-col gap-6 text-left">
          <ConfirmDialogHeader title={title} message={message} Icon={Icon} tone={tone} />
          {errorMessage ? (
            <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
              <p className="text-sm leading-[1.5]">{errorMessage}</p>
            </SurfaceCard>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={cancelDisabled}
              className="h-auto min-h-11 min-w-0 max-w-full shrink whitespace-normal py-2 text-foreground-soft [overflow-wrap:anywhere]"
            >
              <span className="min-w-0">{cancelLabel}</span>
            </Button>
            <Button
              ref={confirmButtonRef}
              onClick={handleClick}
              {...resolveHoldButtonProps({ holdEnabled, holding, handlePointerDown, cancelPointerHold, cancelHold })}
              disabled={confirmDisabled}
              aria-label={actionAccessibleLabel}
              aria-describedby={showHoldHint ? holdHintId : undefined}
              aria-busy={confirmDisabled || undefined}
              variant={tone.actionButtonVariant}
              className={cn(
                "h-auto min-h-11 min-w-0 max-w-full shrink whitespace-normal py-2 [overflow-wrap:anywhere]",
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
              <span className="relative min-w-0">{actionLabel}</span>
            </Button>
            {showHoldHint ? (
              <p id={holdHintId} className="basis-full text-right text-foreground-soft text-xs leading-relaxed">
                {holdHint}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
