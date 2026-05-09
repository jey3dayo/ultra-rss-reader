import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";
import { useUiStore } from "@/stores/ui-store";

export function AppConfirmDialog() {
  const { t } = useTranslation("common");
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const closeConfirm = useUiStore((s) => s.closeConfirm);
  const [confirmInFlight, setConfirmInFlight] = useState(false);

  useEffect(() => {
    if (!confirmDialog.open) {
      setConfirmInFlight(false);
    }
  }, [confirmDialog.open]);

  const handleClose = useCallback(() => {
    if (!confirmInFlight) {
      closeConfirm();
    }
  }, [closeConfirm, confirmInFlight]);

  const handleConfirm = useCallback(async () => {
    if (confirmInFlight) {
      return;
    }

    const onConfirm = confirmDialog.onConfirm;
    if (!onConfirm) {
      closeConfirm();
      return;
    }

    setConfirmInFlight(true);

    try {
      await onConfirm();
      closeConfirm();
    } catch (error) {
      console.error("Failed to run confirm dialog action.", error);
      setConfirmInFlight(false);
    }
  }, [closeConfirm, confirmDialog.onConfirm, confirmInFlight]);

  return (
    <ConfirmDialogView
      open={confirmDialog.open}
      title={t("confirm")}
      message={confirmDialog.message}
      actionLabel={confirmDialog.actionLabel ?? t("ok")}
      cancelLabel={t("cancel")}
      variant={confirmDialog.variant}
      icon={confirmDialog.icon}
      onOpenChange={(open) => !open && handleClose()}
      onConfirm={handleConfirm}
      onCancel={handleClose}
    />
  );
}
