import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { deleteFeed } from "@/api/tauri-commands";
import { invalidateDeleteFeedQueries } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";

type DeleteFeedArgs = {
  feedId: string;
  accountId: string | null;
  title: string;
  onSuccess?: () => void;
  onError?: () => void;
};

function callOptionalCallback(callback: (() => void) | undefined, failureMessage: string) {
  try {
    callback?.();
    return null;
  } catch (error) {
    console.error(failureMessage, error);
    return getErrorMessage(error);
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
      invalidateDeleteFeedQueries(queryClient, {
        accountId: variables.accountId,
      });
      showToast(t("unsubscribed_from", { title: getDeletedFeedTitle(variables) }));
      const callbackErrorMessage = callOptionalCallback(variables.onSuccess, "Delete feed success callback failed");
      if (callbackErrorMessage !== null) {
        showToast(`Unsubscribe completed, but UI cleanup failed: ${callbackErrorMessage}`);
      }
    },
    onError: (error, variables) => {
      showToast(t("failed_to_unsubscribe", { message: error.message }));
      const callbackErrorMessage = callOptionalCallback(variables.onError, "Delete feed error callback failed");
      if (callbackErrorMessage !== null) {
        showToast(`Unsubscribe failed, and UI cleanup failed: ${callbackErrorMessage}`);
      }
    },
  });
}
