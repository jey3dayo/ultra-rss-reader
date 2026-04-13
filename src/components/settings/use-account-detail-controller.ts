import { useQueryClient } from "@tanstack/react-query";
import type { UseAccountDetailControllerParams, UseAccountDetailControllerResult } from "./account-detail.types";
import { useAccountDetailCredentialsEditor } from "./use-account-detail-credentials-editor";
import { useAccountDetailDangerZone } from "./use-account-detail-danger-zone";
import { useAccountDetailNameEditor } from "./use-account-detail-name-editor";
import { useAccountDetailSyncControls } from "./use-account-detail-sync-controls";

export function useAccountDetailController({
  account,
  t,
  onAccountDeleted,
  onSyncStatusChanged,
}: UseAccountDetailControllerParams): UseAccountDetailControllerResult {
  const qc = useQueryClient();
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
  const dangerZone = useAccountDetailDangerZone({
    account,
    queryClient: qc,
    t,
    onAccountDeleted,
  });

  return {
    ...nameEditor,
    ...credentialsEditor,
    ...syncControls,
    ...dangerZone,
  };
}
