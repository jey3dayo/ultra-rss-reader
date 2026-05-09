import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import { invalidateFeedQueries, invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailAccount } from "../../account-detail/types";

type AccountDetailDangerZoneParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onAccountDeleted: () => void;
};

export type AccountDetailDangerZoneResult = {
  handleExportOpml: () => Promise<void>;
  handleRequestDelete: () => void;
};

export function buildOpmlExportFilename(accountName: string): string {
  const safeName = accountName
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();
  return safeName ? `${safeName}-feeds.opml` : "feeds.opml";
}

export function useAccountDetailDangerZone({
  account,
  queryClient,
  t,
  onAccountDeleted,
}: AccountDetailDangerZoneParams): AccountDetailDangerZoneResult {
  const exportInFlightRef = useRef(false);
  const pendingExportUrlRef = useRef<string | null>(null);
  const pendingExportUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t: tc } = useTranslation("common");
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showExportError = createAccountDetailErrorToast(t, "account.failed_to_export_opml");
  const showDeleteError = createAccountDetailErrorToast(t, "account.failed_to_delete");

  const revokePendingExportUrl = useCallback(() => {
    if (pendingExportUrlTimerRef.current !== null) {
      clearTimeout(pendingExportUrlTimerRef.current);
      pendingExportUrlTimerRef.current = null;
    }

    if (pendingExportUrlRef.current !== null) {
      URL.revokeObjectURL(pendingExportUrlRef.current);
      pendingExportUrlRef.current = null;
    }
  }, []);

  useEffect(() => revokePendingExportUrl, [revokePendingExportUrl]);

  const handleExportOpml = async () => {
    if (exportInFlightRef.current) {
      return;
    }

    exportInFlightRef.current = true;
    try {
      Result.pipe(
        await exportOpml(account.id),
        Result.inspectError(showExportError),
        Result.inspect((opmlString) => {
          const blob = new Blob([opmlString], { type: "application/xml" });
          revokePendingExportUrl();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = buildOpmlExportFilename(account.name);
          pendingExportUrlRef.current = url;
          try {
            anchor.click();
            pendingExportUrlTimerRef.current = setTimeout(() => {
              revokePendingExportUrl();
            }, 1000);
          } catch {
            revokePendingExportUrl();
          }
        }),
      );
    } finally {
      exportInFlightRef.current = false;
    }
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError(showDeleteError),
      Result.inspect(() => {
        invalidateQueryKeysLogOnly(queryClient, [["accounts"]]);
        invalidateFeedQueries(queryClient, { includeFolders: false });
        onAccountDeleted();
      }),
    );
  };

  const handleRequestDelete = () => {
    showConfirm(
      t("account.confirm_delete"),
      () => {
        void handleDelete();
      },
      {
        actionLabel: tc("delete"),
        variant: "destructive",
      },
    );
  };

  return {
    handleExportOpml,
    handleRequestDelete,
  };
}
