import { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/stores/ui-store";
import { useRegisterSettingsDirtyState } from "../use-settings-dirty-state-registry";
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
  const pending = nameEditor.savingName || credentialsEditor.dirtyState.pending || syncControls.syncSavePending;
  useRegisterSettingsDirtyState(
    {
      owner: "account",
      dirty: nameEditor.nameDirty || credentialsEditor.dirtyState.dirty,
      pending,
      blockingReason: pending
        ? "account-save-pending"
        : nameEditor.nameDirty || credentialsEditor.dirtyState.dirty
          ? "account-dirty"
          : null,
    },
    {
      save: async () => {
        if (nameEditor.nameDirty && !(await nameEditor.commitRename())) return false;
        return !credentialsEditor.dirtyState.dirty || (await credentialsEditor.commitCredentials());
      },
      discard: () => {
        nameEditor.cancelRename();
        credentialsEditor.discardCredentialDrafts();
      },
    },
  );

  return {
    ...nameEditor,
    ...credentialsEditor,
    ...syncControls,
    ...dangerZone,
    handleSetupRetry: async () => {
      if (credentialsEditor.dirtyState.dirty || credentialsEditor.dirtyState.pending) {
        useUiStore.getState().showToast(t("account.setup_failed_credentials_note"));
        credentialsEditor.focusCredentialsEditor();
        return;
      }
      await syncControls.handleSetupRetry();
    },
  };
}
