import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { updateFeedFolder } from "@/api/tauri-commands";
import { invalidateFeedQueries, queryKeys } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

export type UpdateFeedFolderArgs = {
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
      await qc.cancelQueries({ queryKey: queryKeys.feeds.root });
      const previousFeedsQueries = qc.getQueriesData<FeedDto[]>({ queryKey: queryKeys.feeds.root });

      qc.setQueriesData<FeedDto[]>({ queryKey: queryKeys.feeds.root }, (previousFeeds) =>
        previousFeeds?.map((feed) => (feed.id === feedId ? { ...feed, folder_id: folderId } : feed)),
      );

      return { previousFeedsQueries };
    },
    onSuccess: () => {
      invalidateFeedQueries(qc, { includeFolders: false });
    },
    onError: (error, variables, context) => {
      for (const [queryKey, previousFeeds] of context?.previousFeedsQueries ?? []) {
        const previousFeedById = new Map<string, FeedDto>();
        for (const previousFeed of previousFeeds ?? []) {
          previousFeedById.set(previousFeed.id, previousFeed);
        }

        qc.setQueryData<FeedDto[]>(queryKey, (currentFeeds) => {
          if (!currentFeeds) {
            return previousFeeds;
          }

          return currentFeeds.map((feed) => {
            if (feed.id !== variables.feedId || feed.folder_id !== variables.folderId) {
              return feed;
            }

            return previousFeedById.get(variables.feedId) ?? feed;
          });
        });
      }
      showToast(t("failed_to_update_folder", { message: error.message }));
    },
  });
}
