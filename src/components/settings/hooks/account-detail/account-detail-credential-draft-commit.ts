import { Result } from "@praha/byethrow";
import type { Dispatch, RefObject } from "react";
import { updateAccountCredentials } from "@/api/tauri-commands";
import type { deriveCloudflareAccessDraftState } from "@/lib/account/cloudflare-access";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import type { createAccountDetailErrorToast } from "../../account-detail/toast";
import type {
  AccountDetailCredentialsEditorAction,
  AccountDetailCredentialsEditorParams,
  AccountDetailCredentialsEditorState,
  CredentialCommitOutcome,
  CredentialDraftValues,
  CredentialSaveSuccessToastKey,
} from "./account-detail-credentials-editor-state";
import {
  getCloudflareAccessDraftSnapshot,
  getCredentialDraftSnapshot,
  isCloudflareAccessMetadataUnavailable,
  resolveCredentialDraftValues,
  resolveCredentialSaveFailureMessage,
  resolveCredentialSaveValidationErrorKey,
} from "./account-detail-credentials-editor-state";

export type CredentialDraftCommitContext = {
  account: AccountDetailCredentialsEditorParams["account"];
  queryClient: AccountDetailCredentialsEditorParams["queryClient"];
  t: AccountDetailCredentialsEditorParams["t"];
  state: AccountDetailCredentialsEditorState;
  dispatch: Dispatch<AccountDetailCredentialsEditorAction>;
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  cloudflareAccessValidationError: ReturnType<typeof deriveCloudflareAccessDraftState>["validationError"];
  cloudflareAccessUpdate: ReturnType<typeof deriveCloudflareAccessDraftState>["update"];
  cloudflareAccessDirty: ReturnType<typeof deriveCloudflareAccessDraftState>["dirty"];
  showCredentialSaveError: ReturnType<typeof createAccountDetailErrorToast>;
  pendingCredentialSaveRef: RefObject<Promise<CredentialCommitOutcome> | null>;
  pendingCredentialSaveRevisionRef: RefObject<number | null>;
  cloudflareAccessRequestIdRef: RefObject<number>;
  activeAccountIdRef: RefObject<string>;
  draftRevisionRef: RefObject<number>;
  mountedRef: RefObject<boolean>;
};

export function createCredentialDraftCommitter(
  context: CredentialDraftCommitContext,
): (successToastKey: CredentialSaveSuccessToastKey | null) => Promise<CredentialCommitOutcome> {
  const {
    account,
    queryClient,
    t,
    state,
    dispatch,
    credServerUrl,
    credUsername,
    credPassword,
    cloudflareAccessValidationError,
    cloudflareAccessUpdate,
    cloudflareAccessDirty,
    showCredentialSaveError,
    pendingCredentialSaveRef,
    pendingCredentialSaveRevisionRef,
    cloudflareAccessRequestIdRef,
    activeAccountIdRef,
    draftRevisionRef,
    mountedRef,
  } = context;

  const commitCredentialDraft = async (
    successToastKey: CredentialSaveSuccessToastKey | null,
  ): Promise<CredentialCommitOutcome> => {
    if (pendingCredentialSaveRef.current) {
      if (state.draftRevision === pendingCredentialSaveRevisionRef.current) {
        return pendingCredentialSaveRef.current;
      }
      const queuedAccountId = account.id;
      const queuedDraftRevision = state.draftRevision;
      return pendingCredentialSaveRef.current.then(() => {
        if (
          !mountedRef.current ||
          activeAccountIdRef.current !== queuedAccountId ||
          draftRevisionRef.current !== queuedDraftRevision
        ) {
          return { saved: false, updatedAccount: null };
        }
        return commitCredentialDraft(successToastKey);
      });
    }

    const draftRevision = state.draftRevision;
    const credentialDraft = getCredentialDraftSnapshot(state);
    const cloudflareAccessDraft = getCloudflareAccessDraftSnapshot(state);

    const isSaveContextCurrent = (): boolean =>
      mountedRef.current && activeAccountIdRef.current === account.id && draftRevisionRef.current === draftRevision;
    const isSaveAccountCurrent = (): boolean => mountedRef.current && activeAccountIdRef.current === account.id;

    const showCredentialSaveValidationError = (
      credentialValues: CredentialDraftValues,
    ): CredentialCommitOutcome | null => {
      const validationErrorKey = resolveCredentialSaveValidationErrorKey({
        serverUrl: credentialValues.serverUrl,
        username: credentialValues.username,
        cloudflareAccessValidationError,
        accessMetadataUnavailable: isCloudflareAccessMetadataUnavailable(state.cloudflareAccessStatus),
        cloudflareAccessUpdate,
        serverUrlChanged: credentialValues.serverUrlChanged,
        accountServerUrl: account.server_url,
      });
      if (validationErrorKey === null) {
        return null;
      }
      useUiStore.getState().showToast(t(validationErrorKey));
      return { saved: false, updatedAccount: null };
    };

    const runCredentialSaveRequest = async (
      credentialValues: CredentialDraftValues,
      accessOperationPending: boolean,
    ): Promise<Awaited<ReturnType<typeof updateAccountCredentials>> | null> => {
      const accessUpdateForRequest = cloudflareAccessUpdate?.action === "keep" ? undefined : cloudflareAccessUpdate;
      try {
        if (accessUpdateForRequest === undefined) {
          return await updateAccountCredentials(
            account.id,
            credentialValues.serverUrl,
            credentialValues.username,
            credentialValues.password,
          );
        }
        return await updateAccountCredentials(
          account.id,
          credentialValues.serverUrl,
          credentialValues.username,
          credentialValues.password,
          accessUpdateForRequest,
        );
      } catch (error) {
        if (!isSaveContextCurrent()) {
          return null;
        }
        showCredentialSaveError({
          message: accessOperationPending ? t("account.cloudflare_access_save_failed") : getErrorMessage(error),
        });
        return null;
      }
    };

    const resolveCredentialSaveFailure = (
      saveResult: Awaited<ReturnType<typeof updateAccountCredentials>>,
      accessOperationPending: boolean,
    ): CredentialCommitOutcome | null => {
      if (!isSaveAccountCurrent()) {
        return { saved: false, updatedAccount: null };
      }
      if (!Result.isFailure(saveResult)) {
        return null;
      }
      if (draftRevisionRef.current !== draftRevision) {
        return { saved: false, updatedAccount: null };
      }
      showCredentialSaveError({
        message: resolveCredentialSaveFailureMessage(Result.unwrapError(saveResult), accessOperationPending, t),
      });
      return { saved: false, updatedAccount: null };
    };

    const applyCredentialSaveSuccess = (
      updated: AccountDetailCredentialsEditorParams["account"],
      credentialValues: CredentialDraftValues,
    ): CredentialCommitOutcome => {
      if (cloudflareAccessUpdate !== undefined && cloudflareAccessUpdate.action !== "keep") {
        cloudflareAccessRequestIdRef.current += 1;
        dispatch({
          type: "record-saved-cloudflare-access",
          clientId: cloudflareAccessUpdate.action === "replace" ? cloudflareAccessUpdate.clientId : null,
          serverUrl: credentialValues.serverUrl ?? account.server_url ?? "",
          draft: cloudflareAccessDraft,
        });
      }
      updateCachedAccount(queryClient, updated);
      invalidateQueryKeysLogOnly(queryClient, [queryKeys.accounts.root]);
      dispatch({
        type: "clear-credential-drafts",
        passwordWasSaved: credentialValues.passwordChanged,
        draft: credentialDraft,
        cloudflareAccessDraft,
      });
      if (successToastKey !== null && draftRevisionRef.current === draftRevision) {
        useUiStore.getState().showToast(t(successToastKey));
      }
      return { saved: true, updatedAccount: updated };
    };

    const runCredentialSave = async (): Promise<CredentialCommitOutcome> => {
      const credentialValues = resolveCredentialDraftValues(account, credServerUrl, credUsername, credPassword);

      if (!isSaveContextCurrent()) {
        return { saved: false, updatedAccount: null };
      }

      const validationOutcome = showCredentialSaveValidationError(credentialValues);
      if (validationOutcome !== null) {
        return validationOutcome;
      }

      if (
        !credentialValues.serverUrlChanged &&
        !credentialValues.usernameChanged &&
        !credentialValues.passwordChanged &&
        !cloudflareAccessDirty
      ) {
        dispatch({
          type: "clear-credential-drafts",
          passwordWasSaved: false,
          draft: credentialDraft,
          cloudflareAccessDraft,
        });
        return { saved: true, updatedAccount: null };
      }

      const accessOperationPending =
        cloudflareAccessUpdate?.action === "replace" || cloudflareAccessUpdate?.action === "remove";
      const saveResult = await runCredentialSaveRequest(credentialValues, accessOperationPending);
      if (saveResult === null) {
        return { saved: false, updatedAccount: null };
      }

      const failureOutcome = resolveCredentialSaveFailure(saveResult, accessOperationPending);
      if (failureOutcome !== null) {
        return failureOutcome;
      }

      return applyCredentialSaveSuccess(Result.unwrap(saveResult), credentialValues);
    };

    const saveTask = runCredentialSave();

    pendingCredentialSaveRevisionRef.current = draftRevision;
    dispatch({ type: "set-credential-save-pending", value: true });
    pendingCredentialSaveRef.current = saveTask.finally(() => {
      pendingCredentialSaveRef.current = null;
      pendingCredentialSaveRevisionRef.current = null;
      dispatch({ type: "set-credential-save-pending", value: false });
    });

    return saveTask;
  };

  return commitCredentialDraft;
}
