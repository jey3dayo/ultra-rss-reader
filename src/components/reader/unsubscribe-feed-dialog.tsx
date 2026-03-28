import { Trans, useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function UnsubscribeDialog({
  feed,
  open,
  onOpenChange,
  onConfirm,
}: {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("unsubscribe")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="confirm_unsubscribe" ns="reader" values={{ title: feed.title }}>
            Are you sure you want to unsubscribe from <strong>{{ title: feed.title } as never}</strong>? All articles
            from this feed will be deleted.
          </Trans>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("unsubscribe")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
