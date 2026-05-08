import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { deleteFeed } from "@/api/tauri-commands";
import { invalidateFeedQueries } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

type DeleteFeedArgs = {
  feedId: string;
  title: string;
  onSuccess?: () => void;
  onError?: () => void;
};

export function useDeleteFeed() {
  const { t } = useTranslation("reader");
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation<null, { message: string }, DeleteFeedArgs>({
    mutationFn: async ({ feedId }) => {
      const result = await deleteFeed(feedId);
      return Result.unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateFeedQueries(queryClient, { includeFolders: false, includeAccountUnreadCount: true });
      void queryClient.invalidateQueries({ queryKey: ["accountArticles"] });
      void queryClient.invalidateQueries({ queryKey: ["feedArticleSummaries"] });
      showToast(t("unsubscribed_from", { title: variables.title }));
      variables.onSuccess?.();
    },
    onError: (error, variables) => {
      showToast(t("failed_to_unsubscribe", { message: error.message }));
      variables.onError?.();
    },
  });
}
