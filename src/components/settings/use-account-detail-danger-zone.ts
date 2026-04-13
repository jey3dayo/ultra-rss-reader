import { Result } from "@praha/byethrow";
import { useState } from "react";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import type { UseAccountDetailDangerZoneParams, UseAccountDetailDangerZoneResult } from "./account-detail.types";
import { createAccountDetailErrorToast } from "./account-detail-toast";

export function useAccountDetailDangerZone({
  account,
  queryClient,
  t,
  onAccountDeleted,
}: UseAccountDetailDangerZoneParams): UseAccountDetailDangerZoneResult {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showExportError = createAccountDetailErrorToast(t, "account.failed_to_export_opml");
  const showDeleteError = createAccountDetailErrorToast(t, "account.failed_to_delete");

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError(showExportError),
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
      Result.inspectError(showDeleteError),
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
