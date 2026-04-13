import { Result } from "@praha/byethrow";
import { useState } from "react";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";
import type { UseAccountDetailDangerZoneParams, UseAccountDetailDangerZoneResult } from "./account-detail.types";

export function useAccountDetailDangerZone({
  account,
  queryClient,
  t,
  onAccountDeleted,
}: UseAccountDetailDangerZoneParams): UseAccountDetailDangerZoneResult {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((error) =>
        useUiStore.getState().showToast(t("account.failed_to_export_opml", { message: error.message })),
      ),
      Result.inspect((opmlString) => {
        const blob = new Blob([opmlString], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const safeName = account.name.replace(/[<>:"/\\|?*]/g, "_");
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeName}-feeds.opml`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    );
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError((error) =>
        useUiStore.getState().showToast(t("account.failed_to_delete", { message: error.message })),
      ),
      Result.inspect(() => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["feeds"] });
        onAccountDeleted();
      }),
    );
  };

  return {
    confirmDelete,
    setConfirmDelete,
    handleExportOpml,
    handleDelete,
  };
}
