import { useQueryClient } from "@tanstack/react-query";
import {
  type AccountDetailCredentialsEditorResult,
  useAccountDetailCredentialsEditor,
} from "./use-account-detail-credentials-editor";
import { type AccountDetailDangerZoneResult, useAccountDetailDangerZone } from "./use-account-detail-danger-zone";
import { type AccountDetailNameEditorResult, useAccountDetailNameEditor } from "./use-account-detail-name-editor";
import {
  type AccountDetailSyncControlsParams,
  type AccountDetailSyncControlsResult,
  useAccountDetailSyncControls,
} from "./use-account-detail-sync-controls";

type AccountDetailControllerParams = Omit<AccountDetailSyncControlsParams, "queryClient"> & {
  onAccountDeleted: () => void;
};

export type AccountDetailControllerResult = AccountDetailNameEditorResult &
  AccountDetailCredentialsEditorResult &
  AccountDetailSyncControlsResult &
  AccountDetailDangerZoneResult;

export function useAccountDetailController({
  account,
  t,
  onAccountDeleted,
  onSyncStatusChanged,
  accountSetupState,
}: AccountDetailControllerParams): AccountDetailControllerResult {
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
    accountSetupState,
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
