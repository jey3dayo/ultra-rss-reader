import { Result } from "@praha/byethrow";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CredentialStorageKind } from "@/api/schemas";
import { getCredentialStorage, setCredentialStorage } from "@/api/tauri-commands";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";

type UseCredentialStorageSettingParams = {
  t: TFunction<"settings">;
  showToast: (message: string) => void;
};

type UseCredentialStorageSettingResult = {
  storage: string | null;
  configurable: boolean;
  loaded: boolean;
  saving: boolean;
  handleChange: (next: string) => Promise<void>;
};

type CredentialStorageSettingState = {
  storage: CredentialStorageKind | null;
  configurable: boolean;
  loaded: boolean;
  saving: boolean;
};

const initialCredentialStorageState: CredentialStorageSettingState = {
  storage: null,
  configurable: false,
  loaded: false,
  saving: false,
};

export function useCredentialStorageSetting({
  t,
  showToast,
}: UseCredentialStorageSettingParams): UseCredentialStorageSettingResult {
  const [state, setState] = useState<CredentialStorageSettingState>(initialCredentialStorageState);
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
        return;
      }
      const dto = Result.unwrap(result);
      setState({
        storage: dto.storage,
        configurable: dto.configurable,
        loaded: true,
        saving: false,
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
      setState((prev) => ({ ...prev, saving: true }));
      const result = await setCredentialStorage(next);
      savingRef.current = false;
      if (!mountedRef.current) {
        return;
      }
      if (Result.isFailure(result)) {
        showToast(
          t("data.credential_storage_failed", {
            message: localizeUserVisibleAppErrorMessage(Result.unwrapError(result).message),
          }),
        );
        setState((prev) => ({ ...prev, saving: false }));
        return;
      }
      const dto = Result.unwrap(result);
      setState({
        storage: dto.storage,
        configurable: dto.configurable,
        loaded: true,
        saving: false,
      });
      showToast(t("data.credential_storage_saved"));
    },
    [showToast, t],
  );

  return {
    storage: state.storage,
    configurable: state.configurable,
    loaded: state.loaded,
    saving: state.saving,
    handleChange,
  };
}
