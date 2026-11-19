import { Result } from "@praha/byethrow";
import { useEffect, useState } from "react";
import type { CredentialStorageDto } from "@/api/schemas";
import { getCredentialStorage } from "@/api/tauri-commands";
import { type CredentialStoreKind, resolveCredentialStoreKind } from "@/lib/account/credential-failure";
import { usePlatformStore } from "@/stores/platform-store";

export function useCredentialStoreInfo(): { kind: CredentialStoreKind; configurable: boolean } {
  const platformKind = usePlatformStore((s) => s.platform.kind);
  const usesDevFileCredentials = usePlatformStore((s) => s.platform.capabilities.uses_dev_file_credentials);
  const [storage, setStorage] = useState<CredentialStorageDto | null>(null);

  useEffect(() => {
    let active = true;
    void getCredentialStorage().then((result) => {
      if (!active) return;
      if (Result.isFailure(result)) {
        console.error("Failed to get credential storage:", Result.unwrapError(result));
        return;
      }
      setStorage(Result.unwrap(result));
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    kind: resolveCredentialStoreKind({
      platform: platformKind,
      storage: storage?.storage ?? null,
      usesDevFileCredentials,
    }),
    configurable: storage?.configurable ?? false,
  };
}

export function useCredentialStoreKind(): CredentialStoreKind {
  return useCredentialStoreInfo().kind;
}
