import { Trans, useTranslation } from "react-i18next";
import { DestructiveConfirmDialogView } from "@/components/shared/destructive-confirm-dialog-view";

export function DeleteTagDialogView({
  open,
  tagName,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  tagName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <DestructiveConfirmDialogView
      open={open}
      title={t("delete_tag")}
      description={
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="confirm_delete_tag" ns="reader" values={{ name: tagName }}>
            Are you sure you want to delete <strong>{{ name: tagName } as never}</strong>? This tag will be removed from
            all articles.
          </Trans>
        </p>
      }
      cancelLabel={tc("cancel")}
      confirmLabel={tc("delete")}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
