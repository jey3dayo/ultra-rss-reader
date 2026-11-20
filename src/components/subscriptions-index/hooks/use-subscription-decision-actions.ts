import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { buildSubscriptionDecisionActions } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import { useUiStore } from "@/stores/ui-store";
import type { SubscriptionManagementActions } from "../subscription-detail-pane";

type UseSubscriptionDecisionActionsParams = {
  selectedRow: SubscriptionListRow | null;
  keptFeedIds: ReadonlySet<string>;
  markSelectedFeedKept: () => void;
  unkeepFeed: (feedId: string) => void;
  setDeleteTargetFeed: (feed: FeedDto | null) => void;
  setEditTargetFeed: (feed: FeedDto | null) => void;
};

export function useSubscriptionDecisionActions({
  selectedRow,
  keptFeedIds,
  markSelectedFeedKept,
  unkeepFeed,
  setDeleteTargetFeed,
  setEditTargetFeed,
}: UseSubscriptionDecisionActionsParams) {
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

  const decisionActions = buildSubscriptionDecisionActions({
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
      const keptFeedId = row.feed.id;
      markSelectedFeedKept();
      showToast({
        message: t("decision_kept", { title: row.feed.title }),
        actions: [
          {
            label: t("decision_undo_keep"),
            onClick: () => {
              unkeepFeed(keptFeedId);
              clearToast();
            },
          },
        ],
      });
    },
    onUnkeep: (row) => unkeepFeed(row.feed.id),
    onEdit: editSelectedFeed,
    onDelete: deleteSelectedFeed,
  });

  const managementActions: SubscriptionManagementActions | null =
    selectedRow && !decisionActions
      ? {
          editLabel: tc("edit"),
          deleteLabel: t("unsubscribe_action"),
          onEdit: editSelectedFeed,
          onDelete: deleteSelectedFeed,
        }
      : null;

  return { decisionActions, managementActions };
}
