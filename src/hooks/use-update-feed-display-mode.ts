import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type FeedDto, updateFeedDisplaySettings } from "@/api/tauri-commands";
import type { TriStateDisplayMode } from "@/lib/articles/article-display";
import { invalidateFeedQueries, queryKeys } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

export function useUpdateFeedDisplaySettings() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const latestRequestIdRef = useRef(0);

  return useCallback(
    async (feedId: string, readerMode: TriStateDisplayMode, webPreviewMode: TriStateDisplayMode): Promise<boolean> => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      await qc.cancelQueries({ queryKey: queryKeys.feeds.root });
      const previousFeedsQueries = qc.getQueriesData<FeedDto[]>({ queryKey: queryKeys.feeds.root });

      qc.setQueriesData<FeedDto[]>({ queryKey: queryKeys.feeds.root }, (prev) =>
        prev?.map((feed) =>
          feed.id === feedId ? { ...feed, reader_mode: readerMode, web_preview_mode: webPreviewMode } : feed,
        ),
      );

      const result = await updateFeedDisplaySettings(feedId, readerMode, webPreviewMode);
      if (Result.isFailure(result)) {
        if (requestId !== latestRequestIdRef.current) {
          return false;
        }
        for (const [queryKey, previousFeeds] of previousFeedsQueries) {
          qc.setQueryData(queryKey, previousFeeds);
        }
        showToast(t("failed_to_update_display_settings", { message: Result.unwrapError(result).message }));
        return false;
      }

      invalidateFeedQueries(qc, { includeFolders: false });
      return true;
    },
    [qc, showToast, t],
  );
}
