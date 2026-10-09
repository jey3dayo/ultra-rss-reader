import { Result } from "@praha/byethrow";
import { type RefObject, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import {
  copyToClipboard,
  getAccountCloudflareAccess,
  testAccountConnection,
  updateAccountCredentials,
} from "@/api/tauri-commands";
import {
  type CloudflareAccessDraftError,
  deriveCloudflareAccessDraftState,
  getHttpsOrigin,
} from "@/lib/account/cloudflare-access";
import { isCloudflareAccessRecoveryRequired } from "@/lib/account/cloudflare-access-error";
import { isValidRequiredHttpServerUrl } from "@/lib/account/server-url";
import { focusFirstInput } from "@/lib/dom/input-focus";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { hasTauriRuntime } from "@/lib/window/window-chrome";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailEditorContext } from "../../account-detail/types";
import type { SettingsDirtyStateEntry } from "../settings-dirty-state-registry";
import { useRegisterSettingsDirtyState } from "../use-settings-dirty-state-registry";

type AccountDetailCredentialsEditorParams = AccountDetailEditorContext;

export type AccountDetailCredentialsEditorResult = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  passwordDisplayValue: string;
  cloudflareAccessStatus: "loading" | "ready" | "error" | "unavailable";
  cloudflareAccessRecoveryAction: "replace" | "remove" | null;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessClientId: string;
  cloudflareAccessSecret: string;
  cloudflareAccessValidationError: CloudflareAccessDraftError | null;
  testingConnection: boolean;
  dirtyState: SettingsDirtyStateEntry;
  serverUrlInputRef: RefObject<HTMLInputElement | null>;
  usernameInputRef: RefObject<HTMLInputElement | null>;
  setCredServerUrl: (value: string | null) => void;
  setCredUsername: (value: string | null) => void;
  setCredPassword: (value: string | null) => void;
  setCloudflareAccessRecoveryAction: (action: "replace" | "remove") => void;
  setCloudflareAccessEnabled: (value: boolean) => void;
  setCloudflareAccessClientId: (value: string) => void;
  setCloudflareAccessSecret: (value: string) => void;
  commitCredentials: () => Promise<boolean>;
  handleTestConnection: () => Promise<void>;
  handleCopyServerUrl: () => Promise<void>;
  onPasswordFocus: () => void;
  onPasswordBlur: () => void;
  focusCredentialsEditor: () => void;
};

const MASKED_PASSWORD_VALUE = "••••••••";
const CLOUDFLARE_ACCESS_ERROR_MESSAGE_KEY = {
  client_id_required: "account.error_cloudflare_access_client_id_required",
  client_secret_required: "account.error_cloudflare_access_secret_required",
  https_required: "account.error_cloudflare_access_https_required",
} as const satisfies Record<CloudflareAccessDraftError, string>;
// react-doctor-disable-next-line react-doctor/no-secrets-in-client-code -- false positive (error-message marker, not a secret), docs/react-doctor-warning-classification-300.md:194
const MISSING_PASSWORD_ERROR_MARKER = "Password is not configured";

type AccountDetailCredentialsEditorState = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  hasSavedPassword: boolean;
  cloudflareAccessStatus: "loading" | "ready" | "error" | "unavailable";
  savedCloudflareAccessClientId: string | null;
  savedCloudflareAccessOrigin: string | null;
  cloudflareAccessRecoveryAction: "replace" | "remove" | null;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessClientId: string;
  cloudflareAccessSecret: string;
  cloudflareAccessDraftTouched: boolean;
  cloudflareAccessRemovalRequested: boolean;
  testingConnection: boolean;
  credentialSavePending: boolean;
  draftRevision: number;
};

type CloudflareAccessDraftSnapshot = Pick<
  AccountDetailCredentialsEditorState,
  | "cloudflareAccessRecoveryAction"
  | "cloudflareAccessEnabled"
  | "cloudflareAccessClientId"
  | "cloudflareAccessSecret"
  | "cloudflareAccessDraftTouched"
  | "cloudflareAccessRemovalRequested"
>;

type CredentialDraftSnapshot = Pick<
  AccountDetailCredentialsEditorState,
  "credServerUrl" | "credUsername" | "credPassword"
>;

type CredentialSaveSuccessToastKey = "account.credentials_saved";

type CredentialCommitOutcome = {
  saved: boolean;
  updatedAccount: AccountDetailCredentialsEditorParams["account"] | null;
};

type AccountDetailCredentialsEditorAction =
  | { type: "set-cred-server-url"; value: string | null }
  | { type: "set-cred-username"; value: string | null }
  | { type: "set-cred-password"; value: string | null }
  | { type: "set-cloudflare-access-recovery-action"; value: "replace" | "remove" }
  | { type: "set-cloudflare-access-enabled"; value: boolean }
  | { type: "set-cloudflare-access-client-id"; value: string }
  | { type: "set-cloudflare-access-secret"; value: string }
  | { type: "set-cloudflare-access-status"; value: "loading" | "error" | "unavailable" }
  | { type: "cloudflare-access-loaded"; clientId: string | null; serverUrl: string }
  | {
      type: "record-saved-cloudflare-access";
      clientId: string | null;
      serverUrl: string;
      draft: CloudflareAccessDraftSnapshot;
    }
  | { type: "set-testing-connection"; value: boolean }
  | { type: "set-credential-save-pending"; value: boolean }
  | { type: "sync-saved-password-presence"; value: boolean }
  | {
      type: "clear-credential-drafts";
      passwordWasSaved: boolean;
      draft: CredentialDraftSnapshot;
    };

function getCloudflareAccessDraftSnapshot(state: AccountDetailCredentialsEditorState): CloudflareAccessDraftSnapshot {
  return {
    cloudflareAccessRecoveryAction: state.cloudflareAccessRecoveryAction,
    cloudflareAccessEnabled: state.cloudflareAccessEnabled,
    cloudflareAccessClientId: state.cloudflareAccessClientId,
    cloudflareAccessSecret: state.cloudflareAccessSecret,
    cloudflareAccessDraftTouched: state.cloudflareAccessDraftTouched,
    cloudflareAccessRemovalRequested: state.cloudflareAccessRemovalRequested,
  };
}

function cloudflareAccessDraftMatches(
  state: AccountDetailCredentialsEditorState,
  draft: CloudflareAccessDraftSnapshot,
): boolean {
  return (
    state.cloudflareAccessRecoveryAction === draft.cloudflareAccessRecoveryAction &&
    state.cloudflareAccessEnabled === draft.cloudflareAccessEnabled &&
    state.cloudflareAccessClientId === draft.cloudflareAccessClientId &&
    state.cloudflareAccessSecret === draft.cloudflareAccessSecret &&
    state.cloudflareAccessDraftTouched === draft.cloudflareAccessDraftTouched &&
    state.cloudflareAccessRemovalRequested === draft.cloudflareAccessRemovalRequested
  );
}

function getCredentialDraftSnapshot(state: AccountDetailCredentialsEditorState): CredentialDraftSnapshot {
  return {
    credServerUrl: state.credServerUrl,
    credUsername: state.credUsername,
    credPassword: state.credPassword,
  };
}

function accountHasMissingSavedPassword(account: AccountDetailCredentialsEditorParams["account"]): boolean {
  return (
    account.connection_verification_status === "error" &&
    (account.connection_verification_error ?? "").includes(MISSING_PASSWORD_ERROR_MARKER)
  );
}

function accountMayHaveSavedPassword(account: AccountDetailCredentialsEditorParams["account"]): boolean {
  return account.kind.toLowerCase() === "freshrss" && !accountHasMissingSavedPassword(account);
}

function createInitialAccountDetailCredentialsEditorState(
  account: AccountDetailCredentialsEditorParams["account"],
): AccountDetailCredentialsEditorState {
  return {
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    hasSavedPassword: accountMayHaveSavedPassword(account),
    cloudflareAccessStatus: account.kind.toLowerCase() === "freshrss" ? "loading" : "ready",
    savedCloudflareAccessClientId: null,
    savedCloudflareAccessOrigin: null,
    cloudflareAccessRecoveryAction: null,
    cloudflareAccessEnabled: false,
    cloudflareAccessClientId: "",
    cloudflareAccessSecret: "",
    cloudflareAccessDraftTouched: false,
    cloudflareAccessRemovalRequested: false,
    testingConnection: false,
    credentialSavePending: false,
    draftRevision: 0,
  };
}

function accountDetailCredentialsEditorReducer(
  state: AccountDetailCredentialsEditorState,
  action: AccountDetailCredentialsEditorAction,
): AccountDetailCredentialsEditorState {
  switch (action.type) {
    case "set-cred-server-url":
      return {
        ...state,
        credServerUrl: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cred-username":
      return {
        ...state,
        credUsername: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cred-password":
      return {
        ...state,
        credPassword: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-recovery-action":
      if (state.cloudflareAccessStatus !== "error") {
        return state;
      }
      return {
        ...state,
        cloudflareAccessRecoveryAction: action.value,
        cloudflareAccessDraftTouched: true,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-enabled":
      return {
        ...state,
        cloudflareAccessEnabled: action.value,
        cloudflareAccessDraftTouched: true,
        cloudflareAccessRemovalRequested: !action.value,
        cloudflareAccessSecret: action.value ? state.cloudflareAccessSecret : "",
        cloudflareAccessClientId:
          action.value || state.savedCloudflareAccessClientId !== null ? state.cloudflareAccessClientId : "",
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-client-id":
      return {
        ...state,
        cloudflareAccessClientId: action.value,
        cloudflareAccessDraftTouched: true,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-secret":
      return {
        ...state,
        cloudflareAccessSecret: action.value,
        cloudflareAccessDraftTouched: true,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-status":
      return { ...state, cloudflareAccessStatus: action.value };
    case "cloudflare-access-loaded":
      return !state.cloudflareAccessDraftTouched
        ? {
            ...state,
            cloudflareAccessStatus: "ready",
            cloudflareAccessRecoveryAction: null,
            savedCloudflareAccessClientId: action.clientId,
            savedCloudflareAccessOrigin: action.clientId === null ? null : getHttpsOrigin(action.serverUrl),
            cloudflareAccessEnabled: action.clientId !== null,
            cloudflareAccessClientId: action.clientId ?? "",
            cloudflareAccessSecret: "",
          }
        : {
            ...state,
            cloudflareAccessStatus: "ready",
            cloudflareAccessRecoveryAction: null,
            savedCloudflareAccessClientId: action.clientId,
            savedCloudflareAccessOrigin: action.clientId === null ? null : getHttpsOrigin(action.serverUrl),
          };
    case "record-saved-cloudflare-access": {
      const savedClientId = action.clientId;
      const savedOrigin = savedClientId === null ? null : getHttpsOrigin(action.serverUrl);
      if (!cloudflareAccessDraftMatches(state, action.draft)) {
        return {
          ...state,
          cloudflareAccessStatus: "ready",
          savedCloudflareAccessClientId: savedClientId,
          savedCloudflareAccessOrigin: savedOrigin,
        };
      }
      return {
        ...state,
        cloudflareAccessStatus: "ready",
        cloudflareAccessRecoveryAction: null,
        savedCloudflareAccessClientId: savedClientId,
        savedCloudflareAccessOrigin: savedOrigin,
        cloudflareAccessEnabled: savedClientId !== null,
        cloudflareAccessClientId: savedClientId ?? "",
        cloudflareAccessSecret: "",
        cloudflareAccessDraftTouched: false,
        cloudflareAccessRemovalRequested: false,
      };
    }
    case "set-testing-connection":
      return { ...state, testingConnection: action.value };
    case "set-credential-save-pending":
      return { ...state, credentialSavePending: action.value };
    case "sync-saved-password-presence":
      return { ...state, hasSavedPassword: action.value };
    case "clear-credential-drafts":
      return {
        ...state,
        credServerUrl: state.credServerUrl === action.draft.credServerUrl ? null : state.credServerUrl,
        credUsername: state.credUsername === action.draft.credUsername ? null : state.credUsername,
        credPassword: state.credPassword === action.draft.credPassword ? null : state.credPassword,
        hasSavedPassword: state.hasSavedPassword || action.passwordWasSaved,
      };
    default:
      return state;
  }
}

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
  const { credServerUrl, credUsername, credPassword, hasSavedPassword, testingConnection, credentialSavePending } =
    state;
  const pendingCredentialSaveRef = useRef<Promise<CredentialCommitOutcome> | null>(null);
  const pendingCredentialSaveRevisionRef = useRef<number | null>(null);
  const pendingConnectionTestRef = useRef(false);
  const cloudflareAccessRequestIdRef = useRef(0);
  const activeAccountIdRef = useRef(account.id);
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
  const credentialsDirty =
    credServerUrl !== null || credUsername !== null || (credPassword !== null && credPassword !== "");
  const credentialsOrAccessDirty = credentialsDirty || cloudflareAccessDirty;
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
  useLayoutEffect(() => {
    activeAccountIdRef.current = account.id;
    draftRevisionRef.current = state.draftRevision;
  });
  useRegisterSettingsDirtyState(dirtyState);

  useEffect(() => {
    dispatch({
      type: "sync-saved-password-presence",
      value: savedPasswordPresence,
    });
  }, [savedPasswordPresence]);

  useEffect(() => {
    if (account.kind.toLowerCase() !== "freshrss") {
      return;
    }
    const hasBrowserMock =
      typeof window !== "undefined" &&
      window.__DEV_BROWSER_MOCKS__ === true &&
      window.__ULTRA_RSS_BROWSER_MOCKS__ === true &&
      window.__TAURI_INTERNALS__ !== null &&
      typeof window.__TAURI_INTERNALS__ === "object" &&
      typeof Reflect.get(window.__TAURI_INTERNALS__, "invoke") === "function";
    if (!hasTauriRuntime() && !hasBrowserMock) {
      dispatch({ type: "set-cloudflare-access-status", value: "unavailable" });
      return;
    }

    const requestId = cloudflareAccessRequestIdRef.current + 1;
    cloudflareAccessRequestIdRef.current = requestId;
    let active = true;
    dispatch({ type: "set-cloudflare-access-status", value: "loading" });
    void getAccountCloudflareAccess(account.id)
      .then((result) => {
        if (
          !active ||
          cloudflareAccessRequestIdRef.current !== requestId ||
          activeAccountIdRef.current !== account.id
        ) {
          return;
        }
        if (Result.isFailure(result)) {
          dispatch({ type: "set-cloudflare-access-status", value: "error" });
          return;
        }
        dispatch({
          type: "cloudflare-access-loaded",
          clientId: Result.unwrap(result).client_id,
          serverUrl: account.server_url ?? "",
        });
      })
      .catch(() => {
        if (active && cloudflareAccessRequestIdRef.current === requestId && activeAccountIdRef.current === account.id) {
          dispatch({ type: "set-cloudflare-access-status", value: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [account.id, account.kind, account.server_url]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runConnectionVerification = async (
    requestAccountId: string,
    requestDraftRevision: number,
    verifiedAccountBase?: AccountDetailCredentialsEditorParams["account"],
  ): Promise<boolean> => {
    let result: Awaited<ReturnType<typeof testAccountConnection>>;
    try {
      result = await testAccountConnection(requestAccountId);
    } catch (error) {
      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== requestAccountId ||
        draftRevisionRef.current !== requestDraftRevision
      ) {
        return false;
      }
      showConnectionError({ message: getErrorMessage(error) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.root });
      return false;
    }

    if (
      !mountedRef.current ||
      activeAccountIdRef.current !== requestAccountId ||
      draftRevisionRef.current !== requestDraftRevision
    ) {
      return false;
    }
    if (Result.isFailure(result)) {
      showConnectionError(Result.unwrapError(result));
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.root });
      return false;
    }

    const verifiedAccount = Result.unwrap(result);
    updateCachedAccount(
      queryClient,
      verifiedAccountBase
        ? {
            ...verifiedAccount,
            ...verifiedAccountBase,
            connection_verification_status: verifiedAccount.connection_verification_status,
            connection_verified_at: verifiedAccount.connection_verified_at,
            connection_verification_error: verifiedAccount.connection_verification_error,
          }
        : verifiedAccount,
    );
    return true;
  };

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
    const saveTask = (async () => {
      const serverUrl = (credServerUrl ?? account.server_url ?? "").trim() || undefined;
      const username = (credUsername ?? account.username ?? "").trim() || undefined;
      const password = credPassword || undefined;
      const serverUrlChanged = credServerUrl !== null && serverUrl !== ((account.server_url ?? "").trim() || undefined);
      const usernameChanged = credUsername !== null && username !== ((account.username ?? "").trim() || undefined);
      const passwordChanged = credPassword !== null && credPassword !== "";
      const accessMetadataUnavailable =
        state.cloudflareAccessStatus === "loading" ||
        state.cloudflareAccessStatus === "error" ||
        state.cloudflareAccessStatus === "unavailable";

      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== account.id ||
        draftRevisionRef.current !== draftRevision
      ) {
        return { saved: false, updatedAccount: null };
      }

      if (!serverUrl) {
        useUiStore.getState().showToast(t("account.error_server_url_required"));
        return { saved: false, updatedAccount: null };
      }

      if (!username) {
        useUiStore.getState().showToast(t("account.error_username_required"));
        return { saved: false, updatedAccount: null };
      }

      if (serverUrl && !isValidRequiredHttpServerUrl(serverUrl)) {
        useUiStore.getState().showToast(t("account.error_server_url_invalid"));
        return { saved: false, updatedAccount: null };
      }

      if (cloudflareAccessValidationError !== null) {
        useUiStore.getState().showToast(t(CLOUDFLARE_ACCESS_ERROR_MESSAGE_KEY[cloudflareAccessValidationError]));
        return { saved: false, updatedAccount: null };
      }

      if (
        accessMetadataUnavailable &&
        cloudflareAccessUpdate?.action !== "replace" &&
        cloudflareAccessUpdate?.action !== "remove" &&
        serverUrlChanged &&
        getHttpsOrigin(serverUrl ?? "") !== getHttpsOrigin(account.server_url ?? "")
      ) {
        useUiStore.getState().showToast(t("account.cloudflare_access_metadata_required_for_origin_change"));
        return { saved: false, updatedAccount: null };
      }

      if (!serverUrlChanged && !usernameChanged && !passwordChanged && !cloudflareAccessDirty) {
        dispatch({
          type: "clear-credential-drafts",
          passwordWasSaved: false,
          draft: credentialDraft,
        });
        return { saved: true, updatedAccount: null };
      }

      let saveResult: Awaited<ReturnType<typeof updateAccountCredentials>>;
      const accessOperationPending =
        cloudflareAccessUpdate?.action === "replace" || cloudflareAccessUpdate?.action === "remove";
      try {
        const accessUpdateForRequest = cloudflareAccessUpdate?.action === "keep" ? undefined : cloudflareAccessUpdate;
        saveResult =
          accessUpdateForRequest === undefined
            ? await updateAccountCredentials(account.id, serverUrl, username, password)
            : await updateAccountCredentials(account.id, serverUrl, username, password, accessUpdateForRequest);
      } catch (error) {
        if (
          !mountedRef.current ||
          activeAccountIdRef.current !== account.id ||
          draftRevisionRef.current !== draftRevision
        ) {
          return { saved: false, updatedAccount: null };
        }
        showCredentialSaveError({
          message: accessOperationPending ? t("account.cloudflare_access_save_failed") : getErrorMessage(error),
        });
        return { saved: false, updatedAccount: null };
      }

      if (!mountedRef.current || activeAccountIdRef.current !== account.id) {
        return { saved: false, updatedAccount: null };
      }

      if (Result.isFailure(saveResult)) {
        if (draftRevisionRef.current !== draftRevision) {
          return { saved: false, updatedAccount: null };
        }
        const error = Result.unwrapError(saveResult);
        showCredentialSaveError({
          message: isCloudflareAccessRecoveryRequired(error)
            ? t("account.cloudflare_access_recovery_required")
            : accessOperationPending
              ? t("account.cloudflare_access_save_failed")
              : error.message,
        });
        return { saved: false, updatedAccount: null };
      }

      const updated = Result.unwrap(saveResult);
      if (cloudflareAccessUpdate !== undefined && cloudflareAccessUpdate.action !== "keep") {
        cloudflareAccessRequestIdRef.current += 1;
        const savedClientId = cloudflareAccessUpdate.action === "replace" ? cloudflareAccessUpdate.clientId : null;
        dispatch({
          type: "record-saved-cloudflare-access",
          clientId: savedClientId,
          serverUrl: serverUrl ?? account.server_url ?? "",
          draft: cloudflareAccessDraft,
        });
      }
      updateCachedAccount(queryClient, updated);
      invalidateQueryKeysLogOnly(queryClient, [queryKeys.accounts.root]);
      dispatch({
        type: "clear-credential-drafts",
        passwordWasSaved: passwordChanged,
        draft: credentialDraft,
      });
      if (successToastKey !== null && draftRevisionRef.current === draftRevision) {
        useUiStore.getState().showToast(t(successToastKey));
      }

      return { saved: true, updatedAccount: updated };
    })();

    pendingCredentialSaveRevisionRef.current = draftRevision;
    dispatch({ type: "set-credential-save-pending", value: true });
    pendingCredentialSaveRef.current = saveTask.finally(() => {
      pendingCredentialSaveRef.current = null;
      pendingCredentialSaveRevisionRef.current = null;
      dispatch({ type: "set-credential-save-pending", value: false });
    });

    return saveTask;
  };

  const commitCredentials = async (): Promise<boolean> => {
    const outcome = await commitCredentialDraft("account.credentials_saved");
    return outcome.saved;
  };

  const handleTestConnection = async () => {
    if (pendingConnectionTestRef.current) {
      return;
    }

    pendingConnectionTestRef.current = true;
    dispatch({ type: "set-testing-connection", value: true });
    const requestAccountId = account.id;
    const requestDraftRevision = state.draftRevision;
    try {
      const credentialCommit = await commitCredentialDraft(null);
      if (!credentialCommit.saved) {
        return;
      }
      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== requestAccountId ||
        draftRevisionRef.current !== requestDraftRevision
      ) {
        return;
      }

      const verified = await runConnectionVerification(
        requestAccountId,
        requestDraftRevision,
        credentialCommit.updatedAccount ?? undefined,
      );
      if (!verified) {
        return;
      }

      useUiStore.getState().showToast(t("account.connection_success"));
    } finally {
      pendingConnectionTestRef.current = false;
      dispatch({ type: "set-testing-connection", value: false });
    }
  };

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
    cloudflareAccessValidationError,
    testingConnection,
    dirtyState,
    serverUrlInputRef,
    usernameInputRef,
    setCredServerUrl: (value) => dispatch({ type: "set-cred-server-url", value }),
    setCredUsername: (value) => dispatch({ type: "set-cred-username", value }),
    setCredPassword: (value) => dispatch({ type: "set-cred-password", value }),
    setCloudflareAccessRecoveryAction: (value) => dispatch({ type: "set-cloudflare-access-recovery-action", value }),
    setCloudflareAccessEnabled: (value) => dispatch({ type: "set-cloudflare-access-enabled", value }),
    setCloudflareAccessClientId: (value) => dispatch({ type: "set-cloudflare-access-client-id", value }),
    setCloudflareAccessSecret: (value) => dispatch({ type: "set-cloudflare-access-secret", value }),
    commitCredentials,
    handleTestConnection,
    handleCopyServerUrl,
    onPasswordFocus,
    onPasswordBlur,
    focusCredentialsEditor,
  };
}
