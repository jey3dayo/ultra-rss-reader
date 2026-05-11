import { Trans, useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { UnsubscribeFeedDialogView } from "./unsubscribe-feed-dialog-view";

type UnsubscribeDialogProps = {
  feed: FeedDto;
  open: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function UnsubscribeDialog({
  feed,
  open,
  pending,
  confirmDisabled,
  confirmDisabledReason,
  onOpenChange,
  onConfirm,
}: UnsubscribeDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <UnsubscribeFeedDialogView
      open={open}
      title={t("unsubscribe")}
      description={
        <Trans i18nKey="confirm_unsubscribe" ns="reader" values={{ title: feed.title }}>
          Are you sure you want to unsubscribe from <strong>{feed.title}</strong>? All articles from this feed will be
          deleted. This cannot be undone.
        </Trans>
      }
      cancelLabel={tc("cancel")}
      confirmLabel={t("unsubscribe")}
      confirmAccessibleLabel={t("unsubscribe_feed_accessible_label", {
        defaultValue: 'Unsubscribe from "{{title}}". This cannot be undone.',
        title: feed.title,
      })}
      confirmDisabled={confirmDisabled}
      confirmDisabledReason={confirmDisabledReason}
      pending={pending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
