import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/stores/ui-store";

export function ConfirmDialog() {
  const { t } = useTranslation("common");
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const closeConfirm = useUiStore((s) => s.closeConfirm);

  const handleConfirm = () => {
    confirmDialog.onConfirm?.();
    closeConfirm();
  };

  return (
    <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirm()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("confirm")}</DialogTitle>
          <DialogDescription>{confirmDialog.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeConfirm}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm}>{t("ok")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
