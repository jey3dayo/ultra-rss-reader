import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
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
  const { t: tc } = useTranslation("common");
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showExportError = createAccountDetailErrorToast(t, "account.failed_to_export_opml");
  const showDeleteError = createAccountDetailErrorToast(t, "account.failed_to_delete");

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
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = buildOpmlExportFilename(account.name);
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["feeds"] });
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
