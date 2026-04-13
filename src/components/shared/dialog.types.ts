import type { ComponentType, ReactNode } from "react";

export type ConfirmDialogIcon = ComponentType<{ className?: string }> | null;

export type ConfirmDialogViewProps = {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  cancelLabel: string;
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
