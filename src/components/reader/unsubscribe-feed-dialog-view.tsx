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
  confirmAccessibleLabel,
  confirmDisabled,
  confirmDisabledReason,
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
      confirmAccessibleLabel={confirmAccessibleLabel}
      confirmDisabled={confirmDisabled}
      confirmDisabledReason={confirmDisabledReason}
      pending={pending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
