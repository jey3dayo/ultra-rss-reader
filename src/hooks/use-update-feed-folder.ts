import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { updateFeedFolder } from "@/api/tauri-commands";
import { invalidateFeedQueries } from "@/lib/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

type UpdateFeedFolderArgs = {
  feedId: string;
  folderId: string | null;
};

type UpdateFeedFolderContext = {
  previousFeedsQueries: Array<readonly [readonly unknown[], FeedDto[] | undefined]>;
};

export function useUpdateFeedFolder() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation<null, { message: string }, UpdateFeedFolderArgs, UpdateFeedFolderContext>({
    mutationFn: async ({ feedId, folderId }) => {
      const result = await updateFeedFolder(feedId, folderId);
      return Result.unwrap(result);
    },
    onMutate: async ({ feedId, folderId }) => {
      await qc.cancelQueries({ queryKey: ["feeds"] });
      const previousFeedsQueries = qc.getQueriesData<FeedDto[]>({ queryKey: ["feeds"] });

      qc.setQueriesData<FeedDto[]>({ queryKey: ["feeds"] }, (previousFeeds) =>
        previousFeeds?.map((feed) => (feed.id === feedId ? { ...feed, folder_id: folderId } : feed)),
      );

      return { previousFeedsQueries };
    },
    onSuccess: () => {
      invalidateFeedQueries(qc, { includeFolders: false });
    },
    onError: (error, _variables, context) => {
      for (const [queryKey, previousFeeds] of context?.previousFeedsQueries ?? []) {
        qc.setQueryData(queryKey, previousFeeds);
      }
      showToast(t("failed_to_update_folder", { message: error.message }));
    },
  });
}
