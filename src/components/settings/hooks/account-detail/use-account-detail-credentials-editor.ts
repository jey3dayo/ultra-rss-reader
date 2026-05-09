import { Result } from "@praha/byethrow";
import { type RefObject, useEffect, useReducer, useRef } from "react";
import { copyToClipboard, testAccountConnection, updateAccountCredentials } from "@/api/tauri-commands";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailEditorContext } from "../../account-detail/types";
import { focusFirstAccountDetailInput } from "./account-detail-editor-focus";

type AccountDetailCredentialsEditorParams = AccountDetailEditorContext;

export type AccountDetailCredentialsEditorResult = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  passwordDisplayValue: string;
  testingConnection: boolean;
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
  draftRevision: number;
};

type AccountDetailCredentialsEditorAction =
  | { type: "set-cred-server-url"; value: string | null }
  | { type: "set-cred-username"; value: string | null }
  | { type: "set-cred-password"; value: string | null }
  | { type: "set-testing-connection"; value: boolean }
  | { type: "sync-saved-password-presence"; value: boolean }
  | { type: "clear-credential-drafts"; passwordWasSaved: boolean; draftRevision: number }
  | { type: "clear-password-input" };

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
    testingConnection: false,
    draftRevision: 0,
  };
}

function accountDetailCredentialsEditorReducer(
  state: AccountDetailCredentialsEditorState,
  action: AccountDetailCredentialsEditorAction,
): AccountDetailCredentialsEditorState {
  switch (action.type) {
    case "set-cred-server-url":
      return { ...state, credServerUrl: action.value, draftRevision: state.draftRevision + 1 };
    case "set-cred-username":
      return { ...state, credUsername: action.value, draftRevision: state.draftRevision + 1 };
    case "set-cred-password":
      return { ...state, credPassword: action.value, draftRevision: state.draftRevision + 1 };
    case "set-testing-connection":
      return { ...state, testingConnection: action.value };
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
  const { credServerUrl, credUsername, credPassword, hasSavedPassword, testingConnection } = state;
  const pendingCredentialSaveRef = useRef<Promise<boolean> | null>(null);
  const pendingCredentialSaveRevisionRef = useRef<number | null>(null);
  const pendingConnectionTestRef = useRef(false);
  const activeAccountIdRef = useRef(account.id);
  const draftRevisionRef = useRef(state.draftRevision);
  const serverUrlInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");
  const showCopyServerUrlError = createAccountDetailErrorToast(t, "account.copy_server_url_failed");
  const savedPasswordPresence = accountMayHaveSavedPassword(account);
  const passwordDisplayValue = credPassword ?? (hasSavedPassword ? MASKED_PASSWORD_VALUE : "");
  activeAccountIdRef.current = account.id;
  draftRevisionRef.current = state.draftRevision;

  useEffect(() => {
    dispatch({ type: "sync-saved-password-presence", value: savedPasswordPresence });
  }, [savedPasswordPresence]);

  const commitCredentials = async (): Promise<boolean> => {
    if (pendingCredentialSaveRef.current) {
      if (state.draftRevision === pendingCredentialSaveRevisionRef.current) {
        return pendingCredentialSaveRef.current;
      }
      return pendingCredentialSaveRef.current.then(() => commitCredentials());
    }

    const draftRevision = state.draftRevision;
    const saveTask = (async () => {
      const serverUrl = (credServerUrl ?? account.server_url ?? "").trim() || undefined;
      const username = (credUsername ?? account.username ?? "").trim() || undefined;
      const password = credPassword || undefined;
      const serverUrlChanged = credServerUrl !== null && serverUrl !== ((account.server_url ?? "").trim() || undefined);
      const usernameChanged = credUsername !== null && username !== ((account.username ?? "").trim() || undefined);
      const passwordChanged = credPassword !== null && credPassword !== "";

      if (serverUrl && !isValidServerUrl(serverUrl)) {
        useUiStore.getState().showToast(t("account.error_server_url_invalid"));
        return false;
      }

      if (!serverUrlChanged && !usernameChanged && !passwordChanged) {
        dispatch({ type: "clear-password-input" });
        return true;
      }

      let saved = false;
      let saveResult: Awaited<ReturnType<typeof updateAccountCredentials>>;
      try {
        saveResult = await updateAccountCredentials(account.id, serverUrl, username, password);
      } catch (error) {
        if (activeAccountIdRef.current !== account.id || draftRevisionRef.current !== draftRevision) {
          return false;
        }
        showCredentialSaveError({ message: getErrorMessage(error) });
        return false;
      }

      if (activeAccountIdRef.current !== account.id || draftRevisionRef.current !== draftRevision) {
        return false;
      }

      Result.pipe(
        saveResult,
        Result.inspectError(showCredentialSaveError),
        Result.inspect((updated) => {
          saved = true;
          updateCachedAccount(queryClient, updated);
          dispatch({ type: "clear-credential-drafts", passwordWasSaved: passwordChanged, draftRevision });
          useUiStore.getState().showToast(t("account.credentials_saved"));
        }),
      );

      return saved;
    })();

    pendingCredentialSaveRevisionRef.current = draftRevision;
    pendingCredentialSaveRef.current = saveTask.finally(() => {
      pendingCredentialSaveRef.current = null;
      pendingCredentialSaveRevisionRef.current = null;
    });

    return pendingCredentialSaveRef.current;
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
      const credentialsSaved = await commitCredentials();
      if (!credentialsSaved) {
        return;
      }
      if (activeAccountIdRef.current !== requestAccountId || draftRevisionRef.current !== requestDraftRevision) {
        return;
      }

      const result = await testAccountConnection(requestAccountId);
      if (activeAccountIdRef.current !== requestAccountId || draftRevisionRef.current !== requestDraftRevision) {
        return;
      }
      if (Result.isFailure(result)) {
        showConnectionError(Result.unwrapError(result));
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        return;
      }

      const updated = Result.unwrap(result);
      updateCachedAccount(queryClient, updated);
      useUiStore.getState().showToast(t("account.connection_success"));
    } finally {
      pendingConnectionTestRef.current = false;
      dispatch({ type: "set-testing-connection", value: false });
    }
  };

  const handleCopyServerUrl = async () => {
    const value = (credServerUrl ?? account.server_url ?? "").trim();
    if (!value) {
      showCopyServerUrlError({ message: t("account.error_server_url_required") });
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
    focusFirstAccountDetailInput([serverUrlInputRef, usernameInputRef]);
  };

  return {
    credServerUrl,
    credUsername,
    credPassword,
    passwordDisplayValue,
    testingConnection,
    serverUrlInputRef,
    usernameInputRef,
    setCredServerUrl: (value) => dispatch({ type: "set-cred-server-url", value }),
    setCredUsername: (value) => dispatch({ type: "set-cred-username", value }),
    setCredPassword: (value) => dispatch({ type: "set-cred-password", value }),
    commitCredentials,
    handleTestConnection,
    handleCopyServerUrl,
    onPasswordFocus,
    focusCredentialsEditor,
  };
}
