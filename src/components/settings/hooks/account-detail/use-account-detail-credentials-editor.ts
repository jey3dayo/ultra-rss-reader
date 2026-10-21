import { Result } from "@praha/byethrow";
import { type RefObject, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { copyToClipboard } from "@/api/tauri-commands";
import {
  type CloudflareAccessDraftError,
  type CloudflareAccessStatus,
  deriveCloudflareAccessDraftState,
} from "@/lib/account/cloudflare-access";
import type { CredentialFailureNotice } from "@/lib/account/credential-failure";
import { focusFirstInput } from "@/lib/dom/input-focus";
import { useUiStore } from "@/stores/ui-store";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { SettingsDirtyStateEntry } from "../settings-dirty-state-registry";
import { useRegisterSettingsDirtyState } from "../use-settings-dirty-state-registry";
import { runAccountConnectionVerification } from "./account-detail-connection-verification";
import { createCredentialDraftCommitter } from "./account-detail-credential-draft-commit";
import { accountDetailCredentialsEditorReducer } from "./account-detail-credentials-editor-reducer";
import {
  type AccountDetailCredentialsEditorParams,
  accountMayHaveSavedPassword,
  type CredentialChangedFields,
  type CredentialCommitOutcome,
  createInitialAccountDetailCredentialsEditorState,
  isCurrentSuccessfulConnectionTest,
  MASKED_PASSWORD_VALUE,
  resolveCredentialChangedFields,
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
  credentialFailure: CredentialFailureNotice | null;
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
  retryCloudflareAccessLoad: () => void;
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
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.credential_save_failed");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");
  const showSavedConnectionError = createAccountDetailErrorToast(t, "account.saved_connection_unconfirmed");
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
    {
      clientId: state.cloudflareAccessClientId,
      clientSecret: state.cloudflareAccessSecret,
      savedClientId: state.savedCloudflareAccessClientId,
    },
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

  const retryCloudflareAccessLoad = useAccountDetailCloudflareAccessLoader({
    account,
    dispatch,
    cloudflareAccessRequestIdRef,
    activeAccountIdRef,
  });

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
      showSavedConnectionError,
      isStaleVerificationRequest,
      requestAccountId,
      requestDraftRevision,
      verifiedAccountBase,
    });

  const commitCredentialDraft = createCredentialDraftCommitter({
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
  });

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
    credentialFailure: state.credentialFailure,
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
    retryCloudflareAccessLoad,
    commitCredentials,
    handleTestConnection,
    discardCredentialDrafts,
    handleCopyServerUrl,
    onPasswordFocus,
    onPasswordBlur,
    focusCredentialsEditor,
  };
}
