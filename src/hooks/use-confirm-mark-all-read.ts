import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { closeBrowserWebviewBeforeReaderMode } from "@/lib/browser/close-browser-webview-before-reader-mode";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type MarkAllReadConfirmationScope = "feed" | "folder" | "visible";
type ConfirmMessageKey = "confirm_mark_feed_read" | "confirm_mark_folder_read" | "confirm_mark_read";

type ConfirmMarkAllReadOptions = {
  count: number;
  scope: MarkAllReadConfirmationScope;
  onConfirm: () => void;
};

function resolveConfirmMessageKey(scope: MarkAllReadConfirmationScope): ConfirmMessageKey {
  switch (scope) {
    case "feed":
      return "confirm_mark_feed_read";
    case "folder":
      return "confirm_mark_folder_read";
    case "visible":
      return "confirm_mark_read";
  }
}

export function useConfirmMarkAllRead() {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const browserUrl = useUiStore((s) => s.browserUrl);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const setBrowserCloseInFlight = useUiStore((s) => s.setBrowserCloseInFlight);
  const showConfirm = useUiStore((s) => s.showConfirm);

  return useCallback(
    ({ count, scope, onConfirm }: ConfirmMarkAllReadOptions) => {
      if (!Number.isFinite(count) || count <= 0) return;
      const confirmMessage = t(resolveConfirmMessageKey(scope), { count });
      if (askBeforeMarkAll === "true") {
        if (browserUrl) {
          setBrowserCloseInFlight(true);
          void closeBrowserWebviewBeforeReaderMode().finally(() => {
            closeBrowser();
            showConfirm(confirmMessage, onConfirm, {
              actionLabel: tc("mark_as_read_count_action", { count }),
              actionAccessibleLabel: t("mark_read_count_accessible_label", {
                count,
              }),
              variant: "warning",
            });
          });
          return;
        }
        showConfirm(confirmMessage, onConfirm, {
          actionLabel: tc("mark_as_read_count_action", { count }),
          actionAccessibleLabel: t("mark_read_count_accessible_label", {
            count,
          }),
          variant: "warning",
        });
        return;
      }
      onConfirm();
    },
    [askBeforeMarkAll, browserUrl, closeBrowser, setBrowserCloseInFlight, showConfirm, t, tc],
  );
}
