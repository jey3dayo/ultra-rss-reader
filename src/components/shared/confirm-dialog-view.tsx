import { AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import type { ConfirmDialogViewProps } from "@/components/shared/dialog.types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const confirmDialogVariantStyles = {
  default: {
    iconContainerClassName: "bg-surface-1/72",
    iconClassName: "text-primary",
    actionButtonVariant: "default" as const,
    actionButtonClassName: "",
    fallbackIcon: CheckCheck,
  },
  warning: {
    iconContainerClassName: "bg-state-warning-surface",
    iconClassName: "text-state-warning-foreground",
    actionButtonVariant: "outline" as const,
    actionButtonClassName:
      "border-state-warning-border bg-state-warning-surface text-state-warning-foreground shadow-none hover:border-state-warning-border hover:bg-state-warning-surface hover:text-state-warning-foreground focus-visible:border-state-warning-border",
    fallbackIcon: AlertTriangle,
  },
  destructive: {
    iconContainerClassName: "bg-state-danger-surface",
    iconClassName: "text-state-danger-foreground",
    actionButtonVariant: "destructive" as const,
    actionButtonClassName: "hover:text-state-danger-foreground",
    fallbackIcon: Trash2,
  },
} as const;

export function ConfirmDialogView({
  open,
  title,
  message,
  actionLabel,
  cancelLabel,
  variant = "default",
  icon,
  onOpenChange,
  onConfirm,
  onCancel,
}: ConfirmDialogViewProps) {
  const tone = confirmDialogVariantStyles[variant];
  const Icon = icon ?? tone.fallbackIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[300px]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div
            data-testid="confirm-dialog-icon"
            className={cn("flex h-11 w-11 items-center justify-center rounded-md", tone.iconContainerClassName)}
          >
            <Icon data-testid="confirm-dialog-icon-svg" className={cn("h-5 w-5", tone.iconClassName)} />
          </div>
          <p className="text-sm text-foreground" aria-hidden="true">
            {message}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={onConfirm}
              variant={tone.actionButtonVariant}
              className={cn("min-h-11 w-full", tone.actionButtonClassName)}
            >
              {actionLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} className="min-h-11 w-full text-foreground-soft">
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
