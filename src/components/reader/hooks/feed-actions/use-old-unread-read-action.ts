import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { countOldUnreadArticles, type OldUnreadScopeKind } from "@/api/tauri-commands";
import { useMarkOldUnreadRead } from "@/hooks/use-articles";
import { useUiStore } from "@/stores/ui-store";
import type { OldUnreadDayPreset } from "../../old-unread-context-menu-items";

export function useOldUnreadReadAction(scopeKind: OldUnreadScopeKind, targetId: string) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const markOldUnreadRead = useMarkOldUnreadRead();
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showToast = useUiStore((state) => state.showToast);

  return useCallback(
    async (olderThanDays: OldUnreadDayPreset) => {
      const countResult = await countOldUnreadArticles(scopeKind, targetId, olderThanDays);
      if (Result.isFailure(countResult)) {
        showToast(Result.unwrapError(countResult).message);
        return;
      }

      const count = Result.unwrap(countResult);
      if (count === 0) {
        showToast(t("no_old_unread_to_mark"));
        return;
      }

      showConfirm(
        t("confirm_mark_old_unread_read", { count }),
        () => markOldUnreadRead.mutate({ scopeKind, targetId, olderThanDays }),
        {
          actionLabel: tc("mark_as_read_action"),
          variant: "warning",
        },
      );
    },
    [markOldUnreadRead, scopeKind, showConfirm, showToast, t, targetId, tc],
  );
}
