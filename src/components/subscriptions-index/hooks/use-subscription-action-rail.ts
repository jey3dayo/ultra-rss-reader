import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { buildSubscriptionActionRail } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type { ToastCoalesceItem } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

const REVIEW_KEEP_TOAST_KEY = "review-keep";

type UseSubscriptionActionRailParams = {
  selectedRow: SubscriptionListRow | null;
  keptFeedIds: ReadonlySet<string>;
  markSelectedFeedKept: () => void;
  unkeepFeed: (feedId: string) => void;
  setDeleteTargetFeed: (feed: FeedDto | null) => void;
  setEditTargetFeed: (feed: FeedDto | null) => void;
};

export function useSubscriptionActionRail({
  selectedRow,
  keptFeedIds,
  markSelectedFeedKept,
  unkeepFeed,
  setDeleteTargetFeed,
  setEditTargetFeed,
}: UseSubscriptionActionRailParams) {
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");
  const showToast = useUiStore((state) => state.showToast);
  const clearToast = useUiStore((state) => state.clearToast);

  const editSelectedFeed = () => {
    if (selectedRow) {
      setEditTargetFeed(selectedRow.feed);
    }
  };
  const deleteSelectedFeed = () => {
    if (selectedRow) {
      setDeleteTargetFeed(selectedRow.feed);
    }
  };

  return buildSubscriptionActionRail({
    selectedRow,
    isKept: selectedRow ? keptFeedIds.has(selectedRow.feed.id) : false,
    labels: {
      keep: t("decision_keep"),
      unkeep: t("decision_unkeep"),
      delete: t("unsubscribe_action"),
      edit: tc("edit"),
      keptChip: t("kept_chip"),
      keptEffect: t("decision_kept_effect"),
    },
    onKeep: (row) => {
      markSelectedFeedKept();
      const compose = (items: ToastCoalesceItem[]) => ({
        message: t("decision_kept", { title: items.map((item) => item.label).join(t("decision_kept_separator")) }),
        actions: [
          {
            label: t("decision_undo_keep"),
            onClick: () => {
              for (const item of items) unkeepFeed(item.id);
              clearToast();
            },
          },
        ],
      });
      const items = [{ id: row.feed.id, label: row.feed.title }];
      showToast({ ...compose(items), coalesce: { key: REVIEW_KEEP_TOAST_KEY, items, compose } });
    },
    onUnkeep: (row) => unkeepFeed(row.feed.id),
    onEdit: editSelectedFeed,
    onDelete: deleteSelectedFeed,
  });
}
