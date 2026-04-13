import type { ComponentProps, ReactNode } from "react";
import type { Button } from "@/components/ui/button";

export type LoadingButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  disabledWhenLoading?: boolean;
  spinner?: ReactNode;
};

export type DeleteButtonProps = ComponentProps<typeof Button> & {
  showIcon?: boolean;
};

export type DestructiveDialogFooterProps = {
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export type FormActionButtonsProps = {
  cancelLabel: string;
  submitLabel: string;
  submittingLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onSubmit?: () => void;
  cancelType?: "button" | "submit";
  submitType?: "button" | "submit";
};
