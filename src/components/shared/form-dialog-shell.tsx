import type { FormEventHandler, ReactNode } from "react";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FormDialogShellSize = "compact" | "wide";

type FormDialogShellProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  size?: FormDialogShellSize;
  contentClassName?: string;
  bodyClassName?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

const formDialogSizeClassName: Record<FormDialogShellSize, string> = {
  compact: "sm:max-w-md",
  wide: "sm:max-w-[640px]",
};

export function FormDialogShell({
  open,
  title,
  description,
  children,
  cancelLabel,
  submitLabel,
  submittingLabel,
  loading = false,
  submitDisabled = false,
  cancelDisabled = false,
  size = "compact",
  contentClassName,
  bodyClassName,
  onOpenChange,
  onSubmit,
}: FormDialogShellProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "overflow-hidden rounded-xl border border-border/70 bg-surface-2 p-0 shadow-elevation-3",
          formDialogSizeClassName[size],
          contentClassName,
        )}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-[1.35rem] font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="max-w-[46ch] text-[0.82rem] leading-5 text-foreground-soft">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className={cn("space-y-4 px-6 py-4", bodyClassName)}>
          {children}
        </form>
        <DialogFooter className="mx-0 mb-0 border-t border-border/70 bg-surface-1/72 px-6 py-4">
          <FormActionButtons
            cancelLabel={cancelLabel}
            submitLabel={submitLabel}
            submittingLabel={submittingLabel}
            loading={loading}
            submitDisabled={submitDisabled}
            cancelDisabled={cancelDisabled}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
