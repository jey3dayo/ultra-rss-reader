import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type FeedDto, updateFeedDisplaySettings } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

export function useUpdateFeedDisplaySettings() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useCallback(
    async (feedId: string, readerMode: "inherit" | "on" | "off", webPreviewMode: "inherit" | "on" | "off") => {
      const previousFeedsQueries = qc.getQueriesData<FeedDto[]>({ queryKey: ["feeds"] });

      qc.setQueriesData<FeedDto[]>({ queryKey: ["feeds"] }, (prev) =>
        prev?.map((feed) =>
          feed.id === feedId ? { ...feed, reader_mode: readerMode, web_preview_mode: webPreviewMode } : feed,
        ),
      );

      const result = await updateFeedDisplaySettings(feedId, readerMode, webPreviewMode);

      return Result.pipe(
        result,
        Result.inspect(() => {
          void qc.invalidateQueries({ queryKey: ["feeds"] });
        }),
        Result.inspectError((error) => {
          for (const [queryKey, previousFeeds] of previousFeedsQueries) {
            qc.setQueryData(queryKey, previousFeeds);
          }
          showToast(t("failed_to_update_display_settings", { message: error.message }));
        }),
      );
    },
    [qc, showToast, t],
  );
}
