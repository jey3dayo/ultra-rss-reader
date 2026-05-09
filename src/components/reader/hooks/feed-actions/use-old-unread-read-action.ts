import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { countOldUnreadArticles, type OldUnreadScopeKind } from "@/api/tauri-commands";
import { useMarkOldUnreadRead } from "@/hooks/use-articles";
import { getErrorMessage } from "@/lib/ui/errors";
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
      const countOldUnread = async () => {
        const countResult = await countOldUnreadArticles(scopeKind, targetId, olderThanDays).catch((error: unknown) => {
          showToast(getErrorMessage(error));
          return null;
        });
        if (countResult === null) {
          return null;
        }

        if (Result.isFailure(countResult)) {
          showToast(Result.unwrapError(countResult).message);
          return null;
        }

        return Result.unwrap(countResult);
      };

      const count = await countOldUnread();
      if (count === null) {
        return;
      }

      if (count === 0) {
        showToast(t("no_old_unread_to_mark"));
        return;
      }

      const confirmMarkOldUnreadRead = () => {
        void countOldUnread()
          .then((latestCount) => {
            if (latestCount === null) {
              return;
            }

            if (latestCount === 0) {
              showToast(t("no_old_unread_to_mark"));
              return;
            }

            markOldUnreadRead.mutate(
              { scopeKind, targetId, olderThanDays },
              {
                onError: (error) => {
                  showToast(error.message);
                },
              },
            );
          })
          .catch((error: unknown) => {
            showToast(getErrorMessage(error));
          });
      };

      showConfirm(t("confirm_mark_old_unread_read", { count }), confirmMarkOldUnreadRead, {
        actionLabel: tc("mark_as_read_action"),
        variant: "warning",
      });
    },
    [markOldUnreadRead, scopeKind, showConfirm, showToast, t, targetId, tc],
  );
}
