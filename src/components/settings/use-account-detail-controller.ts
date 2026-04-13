import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";
import type { UseAccountDetailControllerParams, UseAccountDetailControllerResult } from "./account-detail.types";
import { useAccountDetailCredentialsEditor } from "./use-account-detail-credentials-editor";
import { useAccountDetailNameEditor } from "./use-account-detail-name-editor";
import { useAccountDetailSyncControls } from "./use-account-detail-sync-controls";

export function useAccountDetailController({
  account,
  t,
  onAccountDeleted,
  onSyncStatusChanged,
}: UseAccountDetailControllerParams): UseAccountDetailControllerResult {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameEditor = useAccountDetailNameEditor({
    account,
    queryClient: qc,
    t,
  });
  const credentialsEditor = useAccountDetailCredentialsEditor({
    account,
    queryClient: qc,
    t,
  });
  const syncControls = useAccountDetailSyncControls({
    account,
    queryClient: qc,
    t,
    onSyncStatusChanged,
  });

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_export_opml", { message: e.message })),
      ),
      Result.inspect((opmlString) => {
        const blob = new Blob([opmlString], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const safeName = account.name.replace(/[<>:"/\\|?*]/g, "_");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName}-feeds.opml`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    );
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_delete", { message: e.message })),
      ),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        onAccountDeleted();
      }),
    );
  };

  return {
    confirmDelete,
    setConfirmDelete,
    ...nameEditor,
    ...credentialsEditor,
    ...syncControls,
    handleExportOpml,
    handleDelete,
  };
}
