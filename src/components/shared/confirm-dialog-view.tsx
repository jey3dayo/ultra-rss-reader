import { CheckCheck } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ConfirmDialogViewProps = {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  cancelLabel: string;
  icon?: ComponentType<{ className?: string }> | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialogView({
  open,
  title,
  message,
  actionLabel,
  cancelLabel,
  icon,
  onOpenChange,
  onConfirm,
  onCancel,
}: ConfirmDialogViewProps) {
  const Icon = icon ?? CheckCheck;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[300px]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-foreground" aria-hidden="true">
            {message}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={onConfirm} className="w-full">
              {actionLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} className="w-full text-muted-foreground">
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
