import type { ComponentProps, FormEventHandler, ReactNode } from "react";
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

type FormDialogShellSize = "compact" | "wide";

type FormDialogShellProps = {
  open: boolean;
  modal?: boolean;
  portalContainer?: ComponentProps<typeof DialogContent>["portalContainer"];
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
  modal = true,
  portalContainer,
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
  const submitBlocked = loading || submitDisabled;

  const submitWithGuard = () => {
    if (submitBlocked) {
      return;
    }

    onSubmit();
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    submitWithGuard();
  };

  return (
    <Dialog modal={modal} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        portalContainer={portalContainer}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-border/70 bg-surface-2 p-0 shadow-elevation-3",
          formDialogSizeClassName[size],
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-[1.35rem] font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="max-w-[46ch] text-[0.82rem] leading-5 text-foreground-soft">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4", bodyClassName)}
        >
          {children}
        </form>
        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border/70 bg-surface-1/72 px-6 py-4">
          <FormActionButtons
            cancelLabel={cancelLabel}
            submitLabel={submitLabel}
            submittingLabel={submittingLabel}
            loading={loading}
            submitDisabled={submitBlocked}
            cancelDisabled={cancelDisabled}
            onCancel={() => onOpenChange(false)}
            onSubmit={submitWithGuard}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
