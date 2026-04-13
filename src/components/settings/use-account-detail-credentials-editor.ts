import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";
import { copyToClipboard, testAccountConnection, updateAccountCredentials } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";
import type {
  UseAccountDetailCredentialsEditorParams,
  UseAccountDetailCredentialsEditorResult,
} from "./account-detail.types";
import { updateCachedAccount } from "./account-detail-query-cache";
import { createAccountDetailErrorToast } from "./account-detail-toast";

export function useAccountDetailCredentialsEditor({
  account,
  queryClient,
  t,
}: UseAccountDetailCredentialsEditorParams): UseAccountDetailCredentialsEditorResult {
  const [credServerUrl, setCredServerUrl] = useState<string | null>(null);
  const [credUsername, setCredUsername] = useState<string | null>(null);
  const [credPassword, setCredPassword] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const pendingCredentialSaveRef = useRef<Promise<boolean> | null>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");

  const commitCredentials = async (): Promise<boolean> => {
    if (pendingCredentialSaveRef.current) {
      return pendingCredentialSaveRef.current;
    }

    const saveTask = (async () => {
      const serverUrl = credServerUrl ?? account.server_url ?? undefined;
      const username = credUsername ?? account.username ?? undefined;
      const password = credPassword || undefined;
      const serverUrlChanged = credServerUrl !== null && credServerUrl !== (account.server_url ?? "");
      const usernameChanged = credUsername !== null && credUsername !== (account.username ?? "");
      const passwordChanged = credPassword !== null && credPassword !== "";

      if (!serverUrlChanged && !usernameChanged && !passwordChanged) {
        setCredPassword(null);
        return true;
      }

      let saved = false;
      Result.pipe(
        await updateAccountCredentials(account.id, serverUrl, username, password),
        Result.inspectError(showCredentialSaveError),
        Result.inspect((updated) => {
          saved = true;
          updateCachedAccount(queryClient, updated);
          setCredServerUrl(null);
          setCredUsername(null);
          setCredPassword(null);
          useUiStore.getState().showToast(t("account.credentials_saved"));
        }),
      );

      return saved;
    })();

    pendingCredentialSaveRef.current = saveTask.finally(() => {
      pendingCredentialSaveRef.current = null;
    });

    return pendingCredentialSaveRef.current;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const credentialsSaved = await commitCredentials();
      if (!credentialsSaved) {
        return;
      }

      const result = await testAccountConnection(account.id);
      Result.pipe(
        result,
        Result.inspectError(showConnectionError),
        Result.inspect((connected) => {
          useUiStore
            .getState()
            .showToast(
              connected
                ? t("account.connection_success")
                : t("account.connection_failed", { message: t("account.connection_unsuccessful") }),
            );
        }),
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyServerUrl = async () => {
    const value = credServerUrl ?? account.server_url ?? "";
    if (!value) {
      return;
    }

    Result.pipe(
      await copyToClipboard(value),
      Result.inspect(() => {
        useUiStore.getState().showToast(t("account.copied_to_clipboard"));
      }),
      Result.inspectError((error) => {
        useUiStore.getState().showToast(error.message);
      }),
    );
  };

  const onPasswordFocus = () => {
    if (credPassword === null) {
      setCredPassword("");
    }
  };

  return {
    credServerUrl,
    credUsername,
    credPassword,
    testingConnection,
    setCredServerUrl,
    setCredUsername,
    setCredPassword,
    commitCredentials,
    handleTestConnection,
    handleCopyServerUrl,
    onPasswordFocus,
  };
}
