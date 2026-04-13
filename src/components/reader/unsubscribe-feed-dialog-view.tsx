import type { ReactNode } from "react";
import { DestructiveConfirmDialogView } from "@/components/shared/destructive-confirm-dialog-view";

export type UnsubscribeFeedDialogViewProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function UnsubscribeFeedDialogView({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: UnsubscribeFeedDialogViewProps) {
  return (
    <DestructiveConfirmDialogView
      open={open}
      title={title}
      description={<p className="text-sm text-muted-foreground">{description}</p>}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
