import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DeleteTagDialogView({
  open,
  tagName,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  tagName: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("delete_tag")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="confirm_delete_tag" ns="reader" values={{ name: tagName }}>
            Are you sure you want to delete <strong>{{ name: tagName } as never}</strong>? This tag will be removed from
            all articles.
          </Trans>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
