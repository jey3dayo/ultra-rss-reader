import { useTranslation } from "react-i18next";
import { ConfirmDialogView } from "@/design-system";
import { useSubscriptionReviewStore } from "@/stores/subscription-review-store";
import { useUiStore } from "@/stores/ui-store";

type ResetKeptDialogProps = {
  open: boolean;
  accountId: string | null;
  accountName: string;
  keptCount: number;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
};

export function ResetKeptDialog({
  open,
  accountId,
  accountName,
  keptCount,
  onOpenChange,
  onReset,
}: ResetKeptDialogProps) {
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");
  const showToast = useUiStore((state) => state.showToast);
  const clearToast = useUiStore((state) => state.clearToast);

  const confirmReset = () => {
    onOpenChange(false);
    if (accountId === null) {
      return;
    }
    const snapshot = useSubscriptionReviewStore.getState().clear(accountId);
    onReset();
    showToast({
      message: t("kept_reset_done", { count: keptCount }),
      actions: [
        {
          label: t("decision_undo_keep"),
          onClick: () => {
            useSubscriptionReviewStore.getState().restore(accountId, snapshot);
            clearToast();
          },
        },
      ],
    });
  };

  return (
    <ConfirmDialogView
      open={open}
      title={t("kept_reset_dialog_title")}
      message={t("kept_reset_dialog_message", { account: accountName, count: keptCount })}
      actionLabel={t("kept_banner_reset")}
      cancelLabel={tc("cancel")}
      onOpenChange={onOpenChange}
      onConfirm={confirmReset}
      onCancel={() => onOpenChange(false)}
    />
  );
}
