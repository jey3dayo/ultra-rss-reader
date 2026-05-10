import { Trans, useTranslation } from "react-i18next";
import { DestructiveConfirmDialogView } from "@/components/shared/destructive-confirm-dialog-view";

type DeleteTagDialogViewProps = {
  open: boolean;
  tagName: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteTagDialogView({
  open,
  tagName,
  loading = false,
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
          Are you sure you want to delete <strong>{tagName}</strong>? This tag will be removed from all articles.
        </Trans>
      }
      cancelLabel={tc("cancel")}
      confirmLabel={tc("delete")}
      confirmAccessibleLabel={t("delete_tag_accessible_label", {
        name: tagName,
      })}
      pending={loading}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
