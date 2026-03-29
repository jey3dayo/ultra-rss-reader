import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useUiStore } from "@/stores/ui-store";

export function AppConfirmDialog() {
  const { t } = useTranslation("common");
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const closeConfirm = useUiStore((s) => s.closeConfirm);

  const handleConfirm = () => {
    confirmDialog.onConfirm?.();
    closeConfirm();
  };

  const Icon = confirmDialog.icon ?? CheckCheck;

  return (
    <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirm()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[300px]">
        <DialogTitle className="sr-only">{t("confirm")}</DialogTitle>
        <DialogDescription className="sr-only">{confirmDialog.message}</DialogDescription>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-foreground" aria-hidden="true">
            {confirmDialog.message}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={handleConfirm} className="w-full">
              {confirmDialog.actionLabel ?? t("ok")}
            </Button>
            <Button variant="ghost" onClick={closeConfirm} className="w-full text-muted-foreground">
              {t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
