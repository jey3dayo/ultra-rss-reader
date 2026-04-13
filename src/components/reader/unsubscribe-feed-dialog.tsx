import { Trans, useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { UnsubscribeFeedDialogView } from "./unsubscribe-feed-dialog-view";

export type UnsubscribeDialogProps = {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function UnsubscribeDialog({ feed, open, onOpenChange, onConfirm }: UnsubscribeDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <UnsubscribeFeedDialogView
      open={open}
      title={t("unsubscribe")}
      description={
        <Trans i18nKey="confirm_unsubscribe" ns="reader" values={{ title: feed.title }}>
          Are you sure you want to unsubscribe from <strong>{{ title: feed.title } as never}</strong>? All articles from
          this feed will be deleted.
        </Trans>
      }
      cancelLabel={tc("cancel")}
      confirmLabel={t("unsubscribe")}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
