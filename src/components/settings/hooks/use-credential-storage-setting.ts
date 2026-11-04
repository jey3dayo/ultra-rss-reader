import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CredentialStorageKind } from "@/api/schemas";
import { getCredentialStorage, setCredentialStorage } from "@/api/tauri-commands";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import { invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import type { ToastData } from "@/lib/ui/toast.types";

type UseCredentialStorageSettingParams = {
  t: TFunction<"settings">;
  showToast: (message: string | ToastData) => void;
};

type UseCredentialStorageSettingResult = {
  storage: string | null;
  configurable: boolean;
  loaded: boolean;
  loadErrorMessage: string | null;
  saving: boolean;
  errorMessage: string | null;
  cleanupNotice: string | null;
  handleChange: (next: string) => Promise<void>;
};

type CredentialStorageSettingState = {
  storage: CredentialStorageKind | null;
  configurable: boolean;
  loaded: boolean;
  loadFailed: boolean;
  saving: boolean;
  errorMessage: string | null;
  cleanupNotice: string | null;
};

const initialCredentialStorageState: CredentialStorageSettingState = {
  storage: null,
  configurable: false,
  loaded: false,
  loadFailed: false,
  saving: false,
  errorMessage: null,
  cleanupNotice: null,
};

export function useCredentialStorageSetting({
  t,
  showToast,
}: UseCredentialStorageSettingParams): UseCredentialStorageSettingResult {
  const [state, setState] = useState<CredentialStorageSettingState>(initialCredentialStorageState);
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const result = await getCredentialStorage();
      if (!mountedRef.current) {
        return;
      }
      if (Result.isFailure(result)) {
        console.error("Failed to get credential storage:", Result.unwrapError(result));
        setState((prev) => ({ ...prev, loadFailed: true }));
        return;
      }
      const dto = Result.unwrap(result);
      setState({
        storage: dto.storage,
        configurable: dto.configurable,
        loaded: true,
        loadFailed: false,
        saving: false,
        errorMessage: null,
        cleanupNotice: null,
      });
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleChange = useCallback(
    async (next: string) => {
      if (!mountedRef.current || savingRef.current) {
        return;
      }
      if (next !== "os_keychain" && next !== "local_file") {
        return;
      }
      savingRef.current = true;
      setState((prev) => ({ ...prev, saving: true, errorMessage: null, cleanupNotice: null }));
      const result = await setCredentialStorage(next);
      savingRef.current = false;
      if (!mountedRef.current) {
        return;
      }
      if (Result.isFailure(result)) {
        const failureMessage = t("data.credential_storage_failed", {
          message: localizeUserVisibleAppErrorMessage(Result.unwrapError(result).message),
        });
        showToast({ message: failureMessage, severity: "error" });
        setState((prev) => ({ ...prev, saving: false, errorMessage: failureMessage }));
        return;
      }
      const dto = Result.unwrap(result);
      const cleanupNotice = dto.cleanup_incomplete ? t("data.credential_storage_cleanup_incomplete") : null;
      setState({
        storage: dto.storage,
        configurable: dto.configurable,
        loaded: true,
        loadFailed: false,
        saving: false,
        errorMessage: null,
        cleanupNotice,
      });
      showToast(cleanupNotice ? { message: cleanupNotice, severity: "warning" } : t("data.credential_storage_saved"));
      await invalidateQueryKeysLogOnly(queryClient, [accountSyncStatusQueryKey()]);
    },
    [queryClient, showToast, t],
  );

  return {
    storage: state.storage,
    configurable: state.configurable,
    loaded: state.loaded,
    loadErrorMessage: state.loadFailed ? t("data.credential_storage_load_failed") : null,
    saving: state.saving,
    errorMessage: state.errorMessage,
    cleanupNotice: state.cleanupNotice,
    handleChange,
  };
}
