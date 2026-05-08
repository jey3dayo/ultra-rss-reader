import type { ComponentType, ReactNode } from "react";
import type { ConfirmDialogVariant } from "@/lib/confirm-dialog";

export type ConfirmDialogIcon = ComponentType<{ className?: string }> | null;
export type { ConfirmDialogVariant } from "@/lib/confirm-dialog";

export type ConfirmDialogViewProps = {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  cancelLabel: string;
  variant?: ConfirmDialogVariant;
  icon?: ConfirmDialogIcon;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export type DestructiveConfirmDialogViewProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};
