import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { deleteFeed } from "@/api/tauri-commands";
import {
  invalidateArticleQueries,
  invalidateFeedQueries,
  invalidateQueryKeysLogOnly,
  queryKeys,
} from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

type DeleteFeedArgs = {
  feedId: string;
  accountId: string | null;
  title: string;
  onSuccess?: () => void;
  onError?: () => void;
};

function callOptionalCallback(callback: (() => void) | undefined) {
  try {
    callback?.();
  } catch (error) {
    console.error("Delete feed callback failed", error);
  }
}

function getDeletedFeedTitle({ feedId, title }: Pick<DeleteFeedArgs, "feedId" | "title">) {
  return title.trim() || feedId;
}

export function useDeleteFeed() {
  const { t } = useTranslation("reader");
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation<null, { message: string }, DeleteFeedArgs>({
    mutationFn: async ({ feedId }) => {
      if (feedId.trim().length === 0) {
        throw new Error("Feed id is required");
      }
      const result = await deleteFeed(feedId);
      return Result.unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateFeedQueries(queryClient, {
        actionOwner: "delete-feed",
        includeFolders: false,
        includeAccountUnreadCount: true,
      });
      invalidateArticleQueries(queryClient, {
        actionOwner: "delete-feed",
        includeAccountUnreadCount: false,
        includeFeeds: false,
        includeTagArticleCounts: true,
      });
      invalidateQueryKeysLogOnly(
        queryClient,
        [queryKeys.feedArticleSummaries.subscriptionsIndex(variables.accountId)],
        {
          actionOwner: "delete-feed",
        },
      );
      showToast(t("unsubscribed_from", { title: getDeletedFeedTitle(variables) }));
      callOptionalCallback(variables.onSuccess);
    },
    onError: (error, variables) => {
      showToast(t("failed_to_unsubscribe", { message: error.message }));
      callOptionalCallback(variables.onError);
    },
  });
}
