import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { type RefObject, useReducer, useRef } from "react";
import { copyToClipboard, testAccountConnection, updateAccountCredentials } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailAccount } from "../../account-detail/types";
import { focusFirstAccountDetailInput } from "./account-detail-editor-focus";

type AccountDetailCredentialsEditorParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
};

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
  | { type: "clear-credential-drafts"; passwordWasSaved: boolean; draftRevision: number }
  | { type: "clear-password-input" };

function createInitialAccountDetailCredentialsEditorState(
  account: AccountDetailCredentialsEditorParams["account"],
): AccountDetailCredentialsEditorState {
  return {
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    hasSavedPassword: account.kind === "FreshRss",
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
  const serverUrlInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");
  const showCopyServerUrlError = (error: { message: string }) => {
    const message =
      i18n.language === "ja"
        ? `サーバーURLのコピーに失敗しました: ${error.message}`
        : `Failed to copy server URL: ${error.message}`;
    useUiStore.getState().showToast(message);
  };
  const passwordDisplayValue = credPassword ?? (hasSavedPassword ? MASKED_PASSWORD_VALUE : "");

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
      Result.pipe(
        await updateAccountCredentials(account.id, serverUrl, username, password),
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
    try {
      const credentialsSaved = await commitCredentials();
      if (!credentialsSaved) {
        return;
      }

      const result = await testAccountConnection(account.id);
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
