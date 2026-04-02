import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type FeedDto, updateFeedDisplayMode } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

export function useUpdateFeedDisplayMode() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useCallback(
    async (feedId: string, displayMode: "normal" | "widescreen") => {
      const previousFeedsQueries = qc.getQueriesData<FeedDto[]>({ queryKey: ["feeds"] });

      qc.setQueriesData<FeedDto[]>({ queryKey: ["feeds"] }, (prev) =>
        prev?.map((feed) => (feed.id === feedId ? { ...feed, display_mode: displayMode } : feed)),
      );

      const result = await updateFeedDisplayMode(feedId, displayMode);

      return Result.pipe(
        result,
        Result.inspect(() => {
          void qc.invalidateQueries({ queryKey: ["feeds"] });
        }),
        Result.inspectError((error) => {
          for (const [queryKey, previousFeeds] of previousFeedsQueries) {
            qc.setQueryData(queryKey, previousFeeds);
          }
          showToast(t("failed_to_update_display_mode", { message: error.message }));
        }),
      );
    },
    [qc, showToast, t],
  );
}
