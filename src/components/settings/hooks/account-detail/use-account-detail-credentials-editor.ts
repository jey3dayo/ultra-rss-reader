import { Result } from "@praha/byethrow";
import { type RefObject, useEffect, useReducer, useRef } from "react";
import {
  copyToClipboard,
  testAccountConnection,
  updateAccountCredentials,
} from "@/api/tauri-commands";
import { invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailEditorContext } from "../../account-detail/types";
import {
  type SettingsDirtyStateEntry,
  useRegisterSettingsDirtyState,
} from "../use-settings-dirty-state-registry";
import { focusFirstAccountDetailInput } from "./account-detail-editor-focus";

type AccountDetailCredentialsEditorParams = AccountDetailEditorContext;

export type AccountDetailCredentialsEditorResult = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  passwordDisplayValue: string;
  testingConnection: boolean;
  dirtyState: SettingsDirtyStateEntry;
  serverUrlInputRef: RefObject<HTMLInputElement | null>;
  usernameInputRef: RefObject<HTMLInputElement | null>;
  setCredServerUrl: (value: string | null) => void;
  setCredUsername: (value: string | null) => void;
  setCredPassword: (value: string | null) => void;
  commitCredentials: () => Promise<boolean>;
  handleTestConnection: () => Promise<void>;
  handleCopyServerUrl: () => Promise<void>;
  onPasswordFocus: () => void;
  focusCredentialsEditor: () => void;
};

const MASKED_PASSWORD_VALUE = "••••••••";
const MISSING_PASSWORD_ERROR_MARKER = "Password is not configured";

function isValidServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type AccountDetailCredentialsEditorState = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  hasSavedPassword: boolean;
  testingConnection: boolean;
  credentialSavePending: boolean;
  draftRevision: number;
};

type CredentialSaveSuccessToastKey =
  | "account.credentials_saved"
  | "account.connection_success";

type CredentialCommitOutcome = {
  saved: boolean;
  verified: boolean;
};

type AccountDetailCredentialsEditorAction =
  | { type: "set-cred-server-url"; value: string | null }
  | { type: "set-cred-username"; value: string | null }
  | { type: "set-cred-password"; value: string | null }
  | { type: "set-testing-connection"; value: boolean }
  | { type: "set-credential-save-pending"; value: boolean }
  | { type: "sync-saved-password-presence"; value: boolean }
  | {
      type: "clear-credential-drafts";
      passwordWasSaved: boolean;
      draftRevision: number;
    }
  | { type: "clear-password-input" };

function accountHasMissingSavedPassword(
  account: AccountDetailCredentialsEditorParams["account"],
): boolean {
  return (
    account.connection_verification_status === "error" &&
    (account.connection_verification_error ?? "").includes(
      MISSING_PASSWORD_ERROR_MARKER,
    )
  );
}

function accountMayHaveSavedPassword(
  account: AccountDetailCredentialsEditorParams["account"],
): boolean {
  return (
    account.kind.toLowerCase() === "freshrss" &&
    !accountHasMissingSavedPassword(account)
  );
}

function createInitialAccountDetailCredentialsEditorState(
  account: AccountDetailCredentialsEditorParams["account"],
): AccountDetailCredentialsEditorState {
  return {
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    hasSavedPassword: accountMayHaveSavedPassword(account),
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
    case "set-testing-connection":
      return { ...state, testingConnection: action.value };
    case "set-credential-save-pending":
      return { ...state, credentialSavePending: action.value };
    case "sync-saved-password-presence":
      return { ...state, hasSavedPassword: action.value };
    case "clear-credential-drafts":
      if (state.draftRevision !== action.draftRevision) {
        return {
          ...state,
          hasSavedPassword: state.hasSavedPassword || action.passwordWasSaved,
        };
      }
      return {
        ...state,
        credServerUrl: null,
        credUsername: null,
        credPassword: null,
        hasSavedPassword: state.hasSavedPassword || action.passwordWasSaved,
      };
    case "clear-password-input":
      return { ...state, credPassword: null };
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
  const {
    credServerUrl,
    credUsername,
    credPassword,
    hasSavedPassword,
    testingConnection,
    credentialSavePending,
  } = state;
  const pendingCredentialSaveRef =
    useRef<Promise<CredentialCommitOutcome> | null>(null);
  const pendingCredentialSaveRevisionRef = useRef<number | null>(null);
  const pendingConnectionTestRef = useRef(false);
  const activeAccountIdRef = useRef(account.id);
  const draftRevisionRef = useRef(state.draftRevision);
  const mountedRef = useRef(true);
  const serverUrlInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(
    t,
    "account.failed_to_update_sync",
  );
  const showConnectionError = createAccountDetailErrorToast(
    t,
    "account.connection_failed",
  );
  const showCopyServerUrlError = createAccountDetailErrorToast(
    t,
    "account.copy_server_url_failed",
  );
  const savedPasswordPresence = accountMayHaveSavedPassword(account);
  const passwordDisplayValue =
    credPassword ?? (hasSavedPassword ? MASKED_PASSWORD_VALUE : "");
  const credentialsDirty =
    credServerUrl !== null ||
    credUsername !== null ||
    (credPassword !== null && credPassword !== "");
  const dirtyState: SettingsDirtyStateEntry = {
    owner: "account",
    dirty: credentialsDirty,
    pending: credentialSavePending || testingConnection,
    blockingReason:
      credentialSavePending || testingConnection
        ? "account-credentials-pending"
        : credentialsDirty
          ? "account-credentials-dirty"
          : null,
  };
  activeAccountIdRef.current = account.id;
  draftRevisionRef.current = state.draftRevision;
  useRegisterSettingsDirtyState(dirtyState);

  useEffect(() => {
    dispatch({
      type: "sync-saved-password-presence",
      value: savedPasswordPresence,
    });
  }, [savedPasswordPresence]);

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
        activeAccountIdRef.current !== requestAccountId ||
        draftRevisionRef.current !== requestDraftRevision
      ) {
        return false;
      }
      showConnectionError({ message: getErrorMessage(error) });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      return false;
    }

    if (
      activeAccountIdRef.current !== requestAccountId ||
      draftRevisionRef.current !== requestDraftRevision
    ) {
      return false;
    }
    if (Result.isFailure(result)) {
      showConnectionError(Result.unwrapError(result));
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      return false;
    }

    const verifiedAccount = Result.unwrap(result);
    updateCachedAccount(
      queryClient,
      verifiedAccountBase
        ? {
            ...verifiedAccount,
            ...verifiedAccountBase,
            connection_verification_status:
              verifiedAccount.connection_verification_status,
            connection_verified_at: verifiedAccount.connection_verified_at,
            connection_verification_error:
              verifiedAccount.connection_verification_error,
          }
        : verifiedAccount,
    );
    return true;
  };

  const commitCredentialDraft = async (
    successToastKey: CredentialSaveSuccessToastKey,
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
          return { saved: false, verified: false };
        }
        return commitCredentialDraft(successToastKey);
      });
    }

    const draftRevision = state.draftRevision;
    const saveTask = (async () => {
      const serverUrl =
        (credServerUrl ?? account.server_url ?? "").trim() || undefined;
      const username =
        (credUsername ?? account.username ?? "").trim() || undefined;
      const password = credPassword || undefined;
      const serverUrlChanged =
        credServerUrl !== null &&
        serverUrl !== ((account.server_url ?? "").trim() || undefined);
      const usernameChanged =
        credUsername !== null &&
        username !== ((account.username ?? "").trim() || undefined);
      const passwordChanged = credPassword !== null && credPassword !== "";

      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== account.id ||
        draftRevisionRef.current !== draftRevision
      ) {
        return { saved: false, verified: false };
      }

      if (serverUrl && !isValidServerUrl(serverUrl)) {
        useUiStore.getState().showToast(t("account.error_server_url_invalid"));
        return { saved: false, verified: false };
      }

      if (!serverUrlChanged && !usernameChanged && !passwordChanged) {
        dispatch({ type: "clear-password-input" });
        return { saved: true, verified: false };
      }

      let saved = false;
      let saveResult: Awaited<ReturnType<typeof updateAccountCredentials>>;
      try {
        saveResult = await updateAccountCredentials(
          account.id,
          serverUrl,
          username,
          password,
        );
      } catch (error) {
        if (
          !mountedRef.current ||
          activeAccountIdRef.current !== account.id ||
          draftRevisionRef.current !== draftRevision
        ) {
          return { saved: false, verified: false };
        }
        showCredentialSaveError({ message: getErrorMessage(error) });
        return { saved: false, verified: false };
      }

      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== account.id ||
        draftRevisionRef.current !== draftRevision
      ) {
        return { saved: false, verified: false };
      }

      if (Result.isFailure(saveResult)) {
        showCredentialSaveError(Result.unwrapError(saveResult));
        return { saved: false, verified: false };
      }

      const updated = Result.unwrap(saveResult);
      saved = true;
      updateCachedAccount(queryClient, updated);
      invalidateQueryKeysLogOnly(queryClient, [["accounts"]]);

      const verified = await runConnectionVerification(
        account.id,
        draftRevision,
        updated,
      );
      if (!verified) {
        return { saved: true, verified: false };
      }

      if (
        !mountedRef.current ||
        activeAccountIdRef.current !== account.id ||
        draftRevisionRef.current !== draftRevision
      ) {
        return { saved: false, verified: false };
      }

      dispatch({
        type: "clear-credential-drafts",
        passwordWasSaved: passwordChanged,
        draftRevision,
      });
      useUiStore.getState().showToast(t(successToastKey));

      return { saved, verified };
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
    return outcome.saved && (outcome.verified || !credentialsDirty);
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
      const credentialCommit = await commitCredentialDraft(
        "account.connection_success",
      );
      if (!credentialCommit.saved) {
        return;
      }
      if (
        activeAccountIdRef.current !== requestAccountId ||
        draftRevisionRef.current !== requestDraftRevision
      ) {
        return;
      }
      if (credentialCommit.verified) {
        return;
      }

      const verified = await runConnectionVerification(
        requestAccountId,
        requestDraftRevision,
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

  const focusCredentialsEditor = () => {
    const requestAccountId = account.id;
    if (
      !mountedRef.current ||
      activeAccountIdRef.current !== requestAccountId
    ) {
      return;
    }

    focusFirstAccountDetailInput([serverUrlInputRef, usernameInputRef]);
  };

  return {
    credServerUrl,
    credUsername,
    credPassword,
    passwordDisplayValue,
    testingConnection,
    dirtyState,
    serverUrlInputRef,
    usernameInputRef,
    setCredServerUrl: (value) =>
      dispatch({ type: "set-cred-server-url", value }),
    setCredUsername: (value) => dispatch({ type: "set-cred-username", value }),
    setCredPassword: (value) => dispatch({ type: "set-cred-password", value }),
    commitCredentials,
    handleTestConnection,
    handleCopyServerUrl,
    onPasswordFocus,
    focusCredentialsEditor,
  };
}
