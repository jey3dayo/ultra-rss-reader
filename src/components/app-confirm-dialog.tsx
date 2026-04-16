import { useTranslation } from "react-i18next";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";
import { useUiStore } from "@/stores/ui-store";

export function AppConfirmDialog() {
  const { t } = useTranslation("common");
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const closeConfirm = useUiStore((s) => s.closeConfirm);

  const handleConfirm = () => {
    confirmDialog.onConfirm?.();
    closeConfirm();
  };

  return (
    <ConfirmDialogView
      open={confirmDialog.open}
      title={t("confirm")}
      message={confirmDialog.message}
      actionLabel={confirmDialog.actionLabel ?? t("ok")}
      cancelLabel={t("cancel")}
      variant={confirmDialog.variant}
      icon={confirmDialog.icon}
      onOpenChange={(open) => !open && closeConfirm()}
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
    />
  );
}
