import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DestructiveDialogFooter } from "@/components/shared/destructive-dialog-footer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getRestorableActiveElement, restoreFocusOnMicrotask } from "@/lib/dom/focus-restore";

export type DestructiveConfirmDialogViewProps = {
  open: boolean;
  modal?: boolean;
  portalContainer?: ComponentProps<typeof DialogContent>["portalContainer"];
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  confirmAccessibleLabel?: string;
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function DestructiveConfirmDialogView({
  open,
  modal = true,
  portalContainer,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmAccessibleLabel,
  confirmDisabled = false,
  confirmDisabledReason,
  pending = false,
  onOpenChange,
  onConfirm,
}: DestructiveConfirmDialogViewProps) {
  const [confirmInFlight, setConfirmInFlight] = useState(false);
  const confirmInFlightRef = useRef(false);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const actionPending = pending || confirmInFlight;
  const confirmDisabledReasonId = useId();
  const confirmDescriptionId = confirmDisabled && confirmDisabledReason ? confirmDisabledReasonId : undefined;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFocusElementRef.current = getRestorableActiveElement();
    }

    if (!open) {
      confirmInFlightRef.current = false;
      setConfirmInFlight(false);

      if (wasOpenRef.current) {
        restoreFocusOnMicrotask(restoreFocusElementRef.current);
      }
    }

    wasOpenRef.current = open;
  }, [open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (actionPending && !nextOpen) {
        return;
      }
      onOpenChange(nextOpen);
    },
    [actionPending, onOpenChange],
  );

  const handleConfirm = useCallback(async () => {
    if (confirmInFlightRef.current || pending || confirmDisabled) {
      return;
    }

    confirmInFlightRef.current = true;
    setConfirmInFlight(true);

    try {
      await onConfirm();
    } catch (error) {
      console.error("Failed to run destructive confirm dialog action.", error);
    } finally {
      confirmInFlightRef.current = false;
      setConfirmInFlight(false);
    }
  }, [confirmDisabled, onConfirm, pending]);

  return (
    <Dialog modal={modal} open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        portalContainer={portalContainer}
        className="sm:max-w-md"
        aria-busy={actionPending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{description}</DialogDescription>
        {confirmDescriptionId ? (
          <p id={confirmDescriptionId} className="text-sm text-state-danger-foreground">
            {confirmDisabledReason}
          </p>
        ) : null}
        <DestructiveDialogFooter
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          confirmAccessibleLabel={confirmAccessibleLabel}
          confirmDescriptionId={confirmDescriptionId}
          confirmDisabled={confirmDisabled}
          pending={actionPending}
          onCancel={() => handleOpenChange(false)}
          onConfirm={handleConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
