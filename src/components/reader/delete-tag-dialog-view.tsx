import { Trans, useTranslation } from "react-i18next";
import { DestructiveConfirmDialogView } from "@/design-system";

type DeleteTagDialogViewProps = {
  open: boolean;
  tagName: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteTagDialogView({
  open,
  tagName,
  loading = false,
  confirmDisabled = false,
  confirmDisabledReason,
  onOpenChange,
  onConfirm,
}: DeleteTagDialogViewProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <DestructiveConfirmDialogView
      open={open}
      title={t("delete_tag")}
      description={
        <Trans i18nKey="confirm_delete_tag" ns="reader" values={{ name: tagName }}>
          Are you sure you want to delete <strong>{tagName}</strong>? This tag will be removed from all articles. This
          cannot be undone.
        </Trans>
      }
      cancelLabel={tc("cancel")}
      confirmLabel={tc("delete")}
      confirmAccessibleLabel={t("delete_tag_accessible_label", {
        name: tagName,
      })}
      confirmDisabled={confirmDisabled}
      confirmDisabledReason={confirmDisabledReason}
      pending={loading}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
