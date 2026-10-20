import { Result } from "@praha/byethrow";
import { type RefObject, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { copyToClipboard, updateAccountCredentials } from "@/api/tauri-commands";
import {
  type CloudflareAccessDraftError,
  type CloudflareAccessStatus,
  deriveCloudflareAccessDraftState,
} from "@/lib/account/cloudflare-access";
import { focusFirstInput } from "@/lib/dom/input-focus";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { SettingsDirtyStateEntry } from "../settings-dirty-state-registry";
import { useRegisterSettingsDirtyState } from "../use-settings-dirty-state-registry";
import { runAccountConnectionVerification } from "./account-detail-connection-verification";
import { accountDetailCredentialsEditorReducer } from "./account-detail-credentials-editor-reducer";
import {
  type AccountDetailCredentialsEditorParams,
  accountMayHaveSavedPassword,
  type CredentialChangedFields,
  type CredentialCommitOutcome,
  type CredentialDraftValues,
  type CredentialSaveSuccessToastKey,
  createInitialAccountDetailCredentialsEditorState,
  getCloudflareAccessDraftSnapshot,
  getCredentialDraftSnapshot,
  isCloudflareAccessMetadataUnavailable,
  isCurrentSuccessfulConnectionTest,
  MASKED_PASSWORD_VALUE,
  resolveCredentialChangedFields,
  resolveCredentialDraftValues,
  resolveCredentialSaveFailureMessage,
  resolveCredentialSaveValidationErrorKey,
  type SuccessfulConnectionTest,
} from "./account-detail-credentials-editor-state";
import { useAccountDetailCloudflareAccessLoader } from "./use-account-detail-cloudflare-access-loader";

export type AccountDetailCredentialsEditorResult = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  passwordDisplayValue: string;
  cloudflareAccessStatus: CloudflareAccessStatus;
  cloudflareAccessRecoveryAction: "replace" | "remove" | null;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessClientId: string;
  cloudflareAccessSecret: string;
  cloudflareAccessHasSavedSecret: boolean;
  cloudflareAccessSecretEditing: boolean;
  cloudflareAccessSecretVisible: boolean;
  cloudflareAccessValidationError: CloudflareAccessDraftError | null;
  testingConnection: boolean;
  connectionTestSucceeded: boolean;
  dirtyState: SettingsDirtyStateEntry;
  changedFields: CredentialChangedFields;
  serverUrlInputRef: RefObject<HTMLInputElement | null>;
  usernameInputRef: RefObject<HTMLInputElement | null>;
  setCredServerUrl: (value: string | null) => void;
  setCredUsername: (value: string | null) => void;
  setCredPassword: (value: string | null) => void;
  setCloudflareAccessRecoveryAction: (action: "replace" | "remove") => void;
  setCloudflareAccessEnabled: (value: boolean) => void;
  setCloudflareAccessClientId: (value: string) => void;
  setCloudflareAccessSecret: (value: string) => void;
  setCloudflareAccessSecretEditing: (value: boolean) => void;
  setCloudflareAccessSecretVisible: (value: boolean) => void;
  commitCredentials: () => Promise<boolean>;
  handleTestConnection: () => Promise<boolean>;
  discardCredentialDrafts: () => void;
  handleCopyServerUrl: () => Promise<void>;
  onPasswordFocus: () => void;
  onPasswordBlur: () => void;
  focusCredentialsEditor: () => void;
};

export function useAccountDetailCredentialsEditor({
  account,
  queryClient,
  t,
}: AccountDetailCredentialsEditorParams): AccountDetailCredentialsEditorResult {
  const [state, dispatch] = useReducer(
    accountDetailCredentialsEditorReducer,
    account,
    createInitialAccountDetailCredentialsEditorState,
  );
  const [successfulConnectionTest, setSuccessfulConnectionTest] = useState<SuccessfulConnectionTest | null>(null);
  const { credServerUrl, credUsername, credPassword, hasSavedPassword, testingConnection, credentialSavePending } =
    state;
  const pendingCredentialSaveRef = useRef<Promise<CredentialCommitOutcome> | null>(null);
  const pendingCredentialSaveRevisionRef = useRef<number | null>(null);
  const pendingConnectionTestRef = useRef(false);
  const cloudflareAccessRequestIdRef = useRef(0);
  const activeAccountIdRef = useRef(account.id);
  const connectionTestAccountIdRef = useRef(account.id);
  const connectionTestAccountGenerationRef = useRef(0);
  const draftRevisionRef = useRef(state.draftRevision);
  const mountedRef = useRef(true);
  const serverUrlInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");
  const showCopyServerUrlError = createAccountDetailErrorToast(t, "account.copy_server_url_failed");
  const savedPasswordPresence = accountMayHaveSavedPassword(account);
  const passwordDisplayValue = credPassword ?? (hasSavedPassword ? MASKED_PASSWORD_VALUE : "");
  const currentServerUrl = (credServerUrl ?? account.server_url ?? "").trim();
  const {
    validationError: cloudflareAccessValidationError,
    update: cloudflareAccessUpdate,
    dirty: cloudflareAccessDirty,
  } = deriveCloudflareAccessDraftState({
    status: state.cloudflareAccessStatus,
    enabled: state.cloudflareAccessEnabled,
    removalRequested: state.cloudflareAccessRemovalRequested,
    recoveryAction: state.cloudflareAccessRecoveryAction,
    clientId: state.cloudflareAccessClientId,
    clientSecret: state.cloudflareAccessSecret,
    savedClientId: state.savedCloudflareAccessClientId,
    savedOrigin: state.savedCloudflareAccessOrigin,
    serverUrl: currentServerUrl,
  });
  const changedFields = resolveCredentialChangedFields(
    account,
    credServerUrl,
    credUsername,
    credPassword,
    cloudflareAccessDirty,
  );
  const credentialsOrAccessDirty =
    changedFields.serverUrl || changedFields.username || changedFields.password || changedFields.cloudflareAccess;
  const dirtyState: SettingsDirtyStateEntry = {
    owner: "account",
    dirty: credentialsOrAccessDirty,
    pending: credentialSavePending || testingConnection,
    blockingReason:
      credentialSavePending || testingConnection
        ? "account-credentials-pending"
        : credentialsOrAccessDirty
          ? "account-credentials-dirty"
          : null,
  };
  const connectionTestSucceeded = isCurrentSuccessfulConnectionTest(
    successfulConnectionTest,
    account.id,
    connectionTestAccountGenerationRef.current,
    state.draftRevision,
  );
  useLayoutEffect(() => {
    if (connectionTestAccountIdRef.current !== account.id) {
      connectionTestAccountIdRef.current = account.id;
      connectionTestAccountGenerationRef.current += 1;
    }
    activeAccountIdRef.current = account.id;
    draftRevisionRef.current = state.draftRevision;
  });

  useEffect(() => {
    dispatch({
      type: "sync-saved-password-presence",
      value: savedPasswordPresence,
    });
  }, [savedPasswordPresence]);

  useAccountDetailCloudflareAccessLoader({ account, dispatch, cloudflareAccessRequestIdRef, activeAccountIdRef });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isStaleVerificationRequest = (requestAccountId: string, requestDraftRevision: number): boolean =>
    !mountedRef.current ||
    activeAccountIdRef.current !== requestAccountId ||
    draftRevisionRef.current !== requestDraftRevision;

  const runConnectionVerification = (
    requestAccountId: string,
    requestDraftRevision: number,
    verifiedAccountBase?: AccountDetailCredentialsEditorParams["account"],
  ): Promise<boolean> =>
    runAccountConnectionVerification({
      account,
      queryClient,
      dispatch,
      showConnectionError,
      isStaleVerificationRequest,
      requestAccountId,
      requestDraftRevision,
      verifiedAccountBase,
    });

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

  const discardCredentialDrafts = () => dispatch({ type: "discard-credential-drafts" });

  const commitCredentials = async (): Promise<boolean> => {
    const outcome = await commitCredentialDraft("account.credentials_saved");
    return outcome.saved;
  };

  const handleTestConnection = async (): Promise<boolean> => {
    if (pendingConnectionTestRef.current) {
      return false;
    }

    setSuccessfulConnectionTest(null);
    pendingConnectionTestRef.current = true;
    dispatch({ type: "set-testing-connection", value: true });
    const requestAccountId = account.id;
    const requestAccountGeneration = connectionTestAccountGenerationRef.current;
    const requestDraftRevision = state.draftRevision;
    try {
      const credentialCommit = await commitCredentialDraft(null);
      if (!credentialCommit.saved) {
        return false;
      }
      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== requestAccountId ||
        draftRevisionRef.current !== requestDraftRevision
      ) {
        return false;
      }

      const verified = await runConnectionVerification(
        requestAccountId,
        requestDraftRevision,
        credentialCommit.updatedAccount ?? undefined,
      );
      if (!verified || connectionTestAccountGenerationRef.current !== requestAccountGeneration) {
        return false;
      }

      setSuccessfulConnectionTest({
        accountId: requestAccountId,
        accountGeneration: requestAccountGeneration,
        draftRevision: requestDraftRevision,
      });
      useUiStore.getState().showToast(t("account.connection_success"));
      return true;
    } finally {
      pendingConnectionTestRef.current = false;
      dispatch({ type: "set-testing-connection", value: false });
    }
  };

  useRegisterSettingsDirtyState(dirtyState, {
    save: handleTestConnection,
    discard: discardCredentialDrafts,
  });

  const handleCopyServerUrl = async () => {
    const value = (credServerUrl ?? account.server_url ?? "").trim();
    if (!value) {
      showCopyServerUrlError({
        message: t("account.error_server_url_required"),
      });
      return;
    }

    Result.pipe(
      await copyToClipboard(value),
      Result.inspect(() => {
        useUiStore.getState().showToast(t("account.copied_to_clipboard"));
      }),
      Result.inspectError(showCopyServerUrlError),
    );
  };

  const onPasswordFocus = () => {
    if (credPassword === null) {
      dispatch({ type: "set-cred-password", value: "" });
    }
  };

  const onPasswordBlur = () => {
    if (credPassword === "") {
      dispatch({ type: "set-cred-password", value: null });
    }
  };

  const focusCredentialsEditor = () => {
    const requestAccountId = account.id;
    if (!mountedRef.current || activeAccountIdRef.current !== requestAccountId) {
      return;
    }

    focusFirstInput([serverUrlInputRef, usernameInputRef]);
  };

  return {
    credServerUrl,
    credUsername,
    credPassword,
    passwordDisplayValue,
    cloudflareAccessStatus: state.cloudflareAccessStatus,
    cloudflareAccessRecoveryAction: state.cloudflareAccessRecoveryAction,
    cloudflareAccessEnabled: state.cloudflareAccessEnabled,
    cloudflareAccessClientId: state.cloudflareAccessClientId,
    cloudflareAccessSecret: state.cloudflareAccessSecret,
    cloudflareAccessHasSavedSecret: state.savedCloudflareAccessClientId !== null,
    cloudflareAccessSecretEditing: state.cloudflareAccessSecretEditing,
    cloudflareAccessSecretVisible: state.cloudflareAccessSecretVisible,
    cloudflareAccessValidationError,
    testingConnection,
    connectionTestSucceeded,
    dirtyState,
    changedFields,
    serverUrlInputRef,
    usernameInputRef,
    setCredServerUrl: (value) => dispatch({ type: "set-cred-server-url", value }),
    setCredUsername: (value) => dispatch({ type: "set-cred-username", value }),
    setCredPassword: (value) => dispatch({ type: "set-cred-password", value }),
    setCloudflareAccessRecoveryAction: (value) => dispatch({ type: "set-cloudflare-access-recovery-action", value }),
    setCloudflareAccessEnabled: (value) => dispatch({ type: "set-cloudflare-access-enabled", value }),
    setCloudflareAccessClientId: (value) => dispatch({ type: "set-cloudflare-access-client-id", value }),
    setCloudflareAccessSecret: (value) => dispatch({ type: "set-cloudflare-access-secret", value }),
    setCloudflareAccessSecretEditing: (value) => dispatch({ type: "set-cloudflare-access-secret-editing", value }),
    setCloudflareAccessSecretVisible: (value) => dispatch({ type: "set-cloudflare-access-secret-visible", value }),
    commitCredentials,
    handleTestConnection,
    discardCredentialDrafts,
    handleCopyServerUrl,
    onPasswordFocus,
    onPasswordBlur,
    focusCredentialsEditor,
  };
}
