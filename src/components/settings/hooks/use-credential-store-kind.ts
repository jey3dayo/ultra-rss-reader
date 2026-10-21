import { Result } from "@praha/byethrow";
import { useEffect, useState } from "react";
import type { CredentialStorageKind } from "@/api/schemas";
import { getCredentialStorage } from "@/api/tauri-commands";
import { type CredentialStoreKind, resolveCredentialStoreKind } from "@/lib/account/credential-failure";
import { usePlatformStore } from "@/stores/platform-store";

export function useCredentialStoreKind(): CredentialStoreKind {
  const platformKind = usePlatformStore((s) => s.platform.kind);
  const usesDevFileCredentials = usePlatformStore((s) => s.platform.capabilities.uses_dev_file_credentials);
  const [storage, setStorage] = useState<CredentialStorageKind | null>(null);

  useEffect(() => {
    let active = true;
    void getCredentialStorage().then((result) => {
      if (active && Result.isSuccess(result)) {
        setStorage(Result.unwrap(result).storage);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return resolveCredentialStoreKind({ platform: platformKind, storage, usesDevFileCredentials });
}
