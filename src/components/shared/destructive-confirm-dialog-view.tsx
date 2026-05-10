import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DestructiveDialogFooter } from "@/components/shared/destructive-dialog-footer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DestructiveConfirmDialogViewProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  confirmAccessibleLabel?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function DestructiveConfirmDialogView({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmAccessibleLabel,
  pending = false,
  onOpenChange,
  onConfirm,
}: DestructiveConfirmDialogViewProps) {
  const [confirmInFlight, setConfirmInFlight] = useState(false);
  const confirmInFlightRef = useRef(false);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const actionPending = pending || confirmInFlight;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFocusElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    if (!open) {
      confirmInFlightRef.current = false;
      setConfirmInFlight(false);

      if (wasOpenRef.current) {
        const restoreFocusElement = restoreFocusElementRef.current;
        queueMicrotask(() => {
          if (restoreFocusElement && document.contains(restoreFocusElement)) {
            restoreFocusElement.focus();
          }
        });
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
    if (confirmInFlightRef.current || pending) {
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
  }, [onConfirm, pending]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" aria-busy={actionPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{description}</DialogDescription>
        <DestructiveDialogFooter
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          confirmAccessibleLabel={confirmAccessibleLabel}
          pending={actionPending}
          onCancel={() => handleOpenChange(false)}
          onConfirm={handleConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
