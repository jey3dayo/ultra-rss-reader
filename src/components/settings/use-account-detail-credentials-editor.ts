import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";
import { copyToClipboard, setPreference, testAccountConnection, updateAccountCredentials } from "@/api/tauri-commands";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type {
  UseAccountDetailCredentialsEditorParams,
  UseAccountDetailCredentialsEditorResult,
} from "./account-detail.types";
import { updateCachedAccount } from "./account-detail-query-cache";
import { createAccountDetailErrorToast } from "./account-detail-toast";

const MASKED_PASSWORD_VALUE = "••••••••";

export function useAccountDetailCredentialsEditor({
  account,
  queryClient,
  t,
}: UseAccountDetailCredentialsEditorParams): UseAccountDetailCredentialsEditorResult {
  const prefs = usePreferencesStore((s) => s.prefs);
  const [credServerUrl, setCredServerUrl] = useState<string | null>(null);
  const [credUsername, setCredUsername] = useState<string | null>(null);
  const [credPassword, setCredPassword] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [appKey, setAppKey] = useState<string | null>(null);
  const [hasSavedAppKey, setHasSavedAppKey] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const pendingCredentialSaveRef = useRef<Promise<boolean> | null>(null);
  const pendingAppCredentialSaveRef = useRef<Promise<boolean> | null>(null);
  const showCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showAppCredentialSaveError = createAccountDetailErrorToast(t, "account.failed_to_save_app_credentials");
  const showConnectionError = createAccountDetailErrorToast(t, "account.connection_failed");
  const currentAppId = resolvePreferenceValue(prefs, "inoreader_app_id");
  const currentAppKey = resolvePreferenceValue(prefs, "inoreader_app_key");
  const appIdValue = appId ?? currentAppId;
  const appKeyValue = appKey ?? (hasSavedAppKey || currentAppKey ? MASKED_PASSWORD_VALUE : "");
  const passwordDisplayValue = credPassword ?? (hasSavedPassword ? MASKED_PASSWORD_VALUE : "");

  const commitCredentials = async (): Promise<boolean> => {
    if (pendingCredentialSaveRef.current) {
      return pendingCredentialSaveRef.current;
    }

    const saveTask = (async () => {
      const serverUrl = (credServerUrl ?? account.server_url ?? "").trim() || undefined;
      const username = (credUsername ?? account.username ?? "").trim() || undefined;
      const password = credPassword || undefined;
      const serverUrlChanged = credServerUrl !== null && serverUrl !== ((account.server_url ?? "").trim() || undefined);
      const usernameChanged = credUsername !== null && username !== ((account.username ?? "").trim() || undefined);
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
          setHasSavedPassword((current) => current || passwordChanged);
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

  const commitAppCredentials = async (): Promise<boolean> => {
    if (account.kind !== "Inoreader") {
      return true;
    }

    if (pendingAppCredentialSaveRef.current) {
      return pendingAppCredentialSaveRef.current;
    }

    const saveTask = (async () => {
      const nextAppId = (appId ?? currentAppId).trim();
      const nextAppKey = (appKey ?? currentAppKey).trim();
      const appIdChanged = appId !== null && nextAppId !== currentAppId;
      const appKeyChanged = appKey !== null && nextAppKey !== currentAppKey;

      if (!appIdChanged && !appKeyChanged) {
        setAppKey(null);
        return true;
      }

      let saved = false;
      const saveAppId = appIdChanged ? await setPreference("inoreader_app_id", nextAppId) : Result.succeed(null);
      const saveAppKey = appKeyChanged ? await setPreference("inoreader_app_key", nextAppKey) : Result.succeed(null);

      if (Result.isFailure(saveAppId)) {
        showAppCredentialSaveError(Result.unwrapError(saveAppId));
        return false;
      }

      if (Result.isFailure(saveAppKey)) {
        showAppCredentialSaveError(Result.unwrapError(saveAppKey));
        return false;
      }

      usePreferencesStore.setState((state) => ({
        prefs: {
          ...state.prefs,
          inoreader_app_id: nextAppId,
          inoreader_app_key: nextAppKey,
        },
      }));
      setAppId(null);
      setAppKey(null);
      setHasSavedAppKey(nextAppKey.length > 0);
      useUiStore.getState().showToast(t("account.app_credentials_saved"));
      saved = true;
      return saved;
    })();

    pendingAppCredentialSaveRef.current = saveTask.finally(() => {
      pendingAppCredentialSaveRef.current = null;
    });

    return pendingAppCredentialSaveRef.current;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const appCredentialsSaved = await commitAppCredentials();
      if (!appCredentialsSaved) {
        return;
      }

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

  const onAppKeyFocus = () => {
    if (appKey === null) {
      setAppKey("");
    }
  };

  return {
    credServerUrl,
    credUsername,
    credPassword,
    appIdValue,
    appKeyValue,
    passwordDisplayValue,
    testingConnection,
    setCredServerUrl,
    setCredUsername,
    setCredPassword,
    setAppId,
    setAppKey,
    commitCredentials,
    commitAppCredentials,
    handleTestConnection,
    handleCopyServerUrl,
    onPasswordFocus,
    onAppKeyFocus,
  };
}
