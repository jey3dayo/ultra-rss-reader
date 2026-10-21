import type { AppError, CredentialFailure, CredentialStorageKind } from "@/api/schemas";
import type { PlatformKind } from "@/constants/platform";

export type CredentialStoreKind = "keychain" | "credential_manager" | "local_file" | "os_store";

type CredentialFailureOperation = "load" | "save" | "check" | "check_after_save";

export type CredentialFailureNotice = CredentialFailure & { operation: CredentialFailureOperation };

export function getCredentialFailure(error: AppError): CredentialFailure | null {
  return error.type === "UserVisible" ? (error.credential_failure ?? null) : null;
}

export function resolveCredentialStoreKind({
  platform,
  storage,
  usesDevFileCredentials,
}: {
  platform: PlatformKind;
  storage: CredentialStorageKind | null;
  usesDevFileCredentials: boolean;
}): CredentialStoreKind {
  if (usesDevFileCredentials || storage === "local_file") {
    return "local_file";
  }
  if (platform === "macos") {
    return "keychain";
  }
  return platform === "windows" ? "credential_manager" : "os_store";
}
