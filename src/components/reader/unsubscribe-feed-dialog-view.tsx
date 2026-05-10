import type { ReactNode } from "react";
import {
  DestructiveConfirmDialogView,
  type DestructiveConfirmDialogViewProps,
} from "@/components/shared/destructive-confirm-dialog-view";

type UnsubscribeFeedDialogViewProps = Omit<DestructiveConfirmDialogViewProps, "description"> & {
  description: ReactNode;
};

export function UnsubscribeFeedDialogView({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pending,
  onOpenChange,
  onConfirm,
}: UnsubscribeFeedDialogViewProps) {
  return (
    <DestructiveConfirmDialogView
      open={open}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      pending={pending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
