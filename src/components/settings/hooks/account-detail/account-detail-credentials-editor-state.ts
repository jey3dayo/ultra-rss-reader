import type { TFunction } from "i18next";
import type { AppError, CloudflareAccessUpdate } from "@/api/schemas";
import {
  type CloudflareAccessDraftError,
  type CloudflareAccessStatus,
  getHttpsOrigin,
} from "@/lib/account/cloudflare-access";
import { isCloudflareAccessRecoveryRequired } from "@/lib/account/cloudflare-access-error";
import { isValidRequiredHttpServerUrl } from "@/lib/account/server-url";
import type { AccountDetailEditorContext } from "../../account-detail/types";

export type AccountDetailCredentialsEditorParams = AccountDetailEditorContext;

export function mergeVerifiedAccount(
  verifiedAccount: AccountDetailCredentialsEditorParams["account"],
  verifiedAccountBase?: AccountDetailCredentialsEditorParams["account"],
): AccountDetailCredentialsEditorParams["account"] {
  if (!verifiedAccountBase) {
    return verifiedAccount;
  }
  return {
    ...verifiedAccount,
    ...verifiedAccountBase,
    connection_verification_status: verifiedAccount.connection_verification_status,
    connection_verified_at: verifiedAccount.connection_verified_at,
    connection_verification_error: verifiedAccount.connection_verification_error,
  };
}

export const MASKED_PASSWORD_VALUE = "••••••••";
const CLOUDFLARE_ACCESS_ERROR_MESSAGE_KEY = {
  client_id_required: "account.error_cloudflare_access_client_id_required",
  client_secret_required: "account.error_cloudflare_access_secret_required",
  https_required: "account.error_cloudflare_access_https_required",
} as const satisfies Record<CloudflareAccessDraftError, string>;
// react-doctor-disable-next-line react-doctor/no-secrets-in-client-code -- false positive (error-message marker, not a secret), docs/react-doctor-warning-classification-300.md:194
const MISSING_PASSWORD_ERROR_MARKER = "Password is not configured";

export type AccountDetailCredentialsEditorState = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  hasSavedPassword: boolean;
  cloudflareAccessStatus: CloudflareAccessStatus;
  savedCloudflareAccessClientId: string | null;
  savedCloudflareAccessOrigin: string | null;
  cloudflareAccessRecoveryAction: "replace" | "remove" | null;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessClientId: string;
  cloudflareAccessSecret: string;
  cloudflareAccessSecretEditing: boolean;
  cloudflareAccessSecretVisible: boolean;
  cloudflareAccessDraftTouched: boolean;
  cloudflareAccessRemovalRequested: boolean;
  testingConnection: boolean;
  credentialSavePending: boolean;
  draftRevision: number;
};

type CloudflareAccessDraftSnapshot = Pick<
  AccountDetailCredentialsEditorState,
  | "cloudflareAccessRecoveryAction"
  | "cloudflareAccessEnabled"
  | "cloudflareAccessClientId"
  | "cloudflareAccessSecret"
  | "cloudflareAccessSecretEditing"
  | "cloudflareAccessDraftTouched"
  | "cloudflareAccessRemovalRequested"
>;

type CredentialDraftSnapshot = Pick<
  AccountDetailCredentialsEditorState,
  "credServerUrl" | "credUsername" | "credPassword"
>;

export type CredentialSaveSuccessToastKey = "account.credentials_saved";

export type CredentialCommitOutcome = {
  saved: boolean;
  updatedAccount: AccountDetailCredentialsEditorParams["account"] | null;
};

export type SuccessfulConnectionTest = {
  accountId: string;
  accountGeneration: number;
  draftRevision: number;
};

export function isCurrentSuccessfulConnectionTest(
  successfulTest: SuccessfulConnectionTest | null,
  accountId: string,
  accountGeneration: number,
  draftRevision: number,
): boolean {
  return (
    successfulTest !== null &&
    successfulTest.accountId === accountId &&
    successfulTest.accountGeneration === accountGeneration &&
    successfulTest.draftRevision === draftRevision
  );
}

export type AccountDetailCredentialsEditorAction =
  | { type: "set-cred-server-url"; value: string | null }
  | { type: "set-cred-username"; value: string | null }
  | { type: "set-cred-password"; value: string | null }
  | { type: "set-cloudflare-access-recovery-action"; value: "replace" | "remove" }
  | { type: "set-cloudflare-access-enabled"; value: boolean }
  | { type: "set-cloudflare-access-client-id"; value: string }
  | { type: "set-cloudflare-access-secret"; value: string }
  | { type: "set-cloudflare-access-secret-editing"; value: boolean }
  | { type: "set-cloudflare-access-secret-visible"; value: boolean }
  | { type: "set-cloudflare-access-status"; value: "loading" | "error" | "unavailable" | "authorization_required" }
  | { type: "cloudflare-access-loaded"; clientId: string | null; serverUrl: string }
  | {
      type: "record-saved-cloudflare-access";
      clientId: string | null;
      serverUrl: string;
      draft: CloudflareAccessDraftSnapshot;
    }
  | { type: "set-testing-connection"; value: boolean }
  | { type: "set-credential-save-pending"; value: boolean }
  | { type: "sync-saved-password-presence"; value: boolean }
  | { type: "discard-credential-drafts" }
  | {
      type: "clear-credential-drafts";
      passwordWasSaved: boolean;
      draft: CredentialDraftSnapshot;
      cloudflareAccessDraft: CloudflareAccessDraftSnapshot;
    };

export function getCloudflareAccessDraftSnapshot(
  state: AccountDetailCredentialsEditorState,
): CloudflareAccessDraftSnapshot {
  return {
    cloudflareAccessRecoveryAction: state.cloudflareAccessRecoveryAction,
    cloudflareAccessEnabled: state.cloudflareAccessEnabled,
    cloudflareAccessClientId: state.cloudflareAccessClientId,
    cloudflareAccessSecret: state.cloudflareAccessSecret,
    cloudflareAccessSecretEditing: state.cloudflareAccessSecretEditing,
    cloudflareAccessDraftTouched: state.cloudflareAccessDraftTouched,
    cloudflareAccessRemovalRequested: state.cloudflareAccessRemovalRequested,
  };
}

export function cloudflareAccessDraftMatches(
  state: AccountDetailCredentialsEditorState,
  draft: CloudflareAccessDraftSnapshot,
): boolean {
  return (
    state.cloudflareAccessRecoveryAction === draft.cloudflareAccessRecoveryAction &&
    state.cloudflareAccessEnabled === draft.cloudflareAccessEnabled &&
    state.cloudflareAccessClientId === draft.cloudflareAccessClientId &&
    state.cloudflareAccessSecret === draft.cloudflareAccessSecret &&
    state.cloudflareAccessSecretEditing === draft.cloudflareAccessSecretEditing &&
    state.cloudflareAccessDraftTouched === draft.cloudflareAccessDraftTouched &&
    state.cloudflareAccessRemovalRequested === draft.cloudflareAccessRemovalRequested
  );
}

export function getCredentialDraftSnapshot(state: AccountDetailCredentialsEditorState): CredentialDraftSnapshot {
  return {
    credServerUrl: state.credServerUrl,
    credUsername: state.credUsername,
    credPassword: state.credPassword,
  };
}

function accountHasMissingSavedPassword(account: AccountDetailCredentialsEditorParams["account"]): boolean {
  return (
    account.connection_verification_status === "error" &&
    (account.connection_verification_error ?? "").includes(MISSING_PASSWORD_ERROR_MARKER)
  );
}

export function accountMayHaveSavedPassword(account: AccountDetailCredentialsEditorParams["account"]): boolean {
  return account.kind.toLowerCase() === "freshrss" && !accountHasMissingSavedPassword(account);
}

export function createInitialAccountDetailCredentialsEditorState(
  account: AccountDetailCredentialsEditorParams["account"],
): AccountDetailCredentialsEditorState {
  return {
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    hasSavedPassword: accountMayHaveSavedPassword(account),
    cloudflareAccessStatus: account.kind.toLowerCase() === "freshrss" ? "loading" : "ready",
    savedCloudflareAccessClientId: null,
    savedCloudflareAccessOrigin: null,
    cloudflareAccessRecoveryAction: null,
    cloudflareAccessEnabled: false,
    cloudflareAccessClientId: "",
    cloudflareAccessSecret: "",
    cloudflareAccessSecretEditing: false,
    cloudflareAccessSecretVisible: false,
    cloudflareAccessDraftTouched: false,
    cloudflareAccessRemovalRequested: false,
    testingConnection: false,
    credentialSavePending: false,
    draftRevision: 0,
  };
}

export type CredentialDraftValues = {
  serverUrl: string | undefined;
  username: string | undefined;
  password: string | undefined;
  serverUrlChanged: boolean;
  usernameChanged: boolean;
  passwordChanged: boolean;
};

export function resolveCredentialDraftValues(
  account: AccountDetailCredentialsEditorParams["account"],
  credServerUrl: string | null,
  credUsername: string | null,
  credPassword: string | null,
): CredentialDraftValues {
  const serverUrl = (credServerUrl ?? account.server_url ?? "").trim() || undefined;
  const username = (credUsername ?? account.username ?? "").trim() || undefined;
  const password = credPassword || undefined;
  const serverUrlChanged = credServerUrl !== null && serverUrl !== ((account.server_url ?? "").trim() || undefined);
  const usernameChanged = credUsername !== null && username !== ((account.username ?? "").trim() || undefined);
  const passwordChanged = credPassword !== null && credPassword !== "";
  return { serverUrl, username, password, serverUrlChanged, usernameChanged, passwordChanged };
}

export type CredentialChangedFields = {
  serverUrl: boolean;
  username: boolean;
  password: boolean;
  cloudflareAccess: boolean;
};

export function resolveCredentialChangedFields(
  account: AccountDetailCredentialsEditorParams["account"],
  credServerUrl: string | null,
  credUsername: string | null,
  credPassword: string | null,
  cloudflareAccessDirty: boolean,
): CredentialChangedFields {
  const { serverUrlChanged, usernameChanged, passwordChanged } = resolveCredentialDraftValues(
    account,
    credServerUrl,
    credUsername,
    credPassword,
  );
  return {
    serverUrl: serverUrlChanged,
    username: usernameChanged,
    password: passwordChanged,
    cloudflareAccess: cloudflareAccessDirty,
  };
}

export function isCloudflareAccessMetadataUnavailable(status: CloudflareAccessStatus): boolean {
  return status === "loading" || status === "error" || status === "unavailable";
}

type CredentialSaveValidationErrorKey =
  | "account.error_server_url_required"
  | "account.error_username_required"
  | "account.error_server_url_invalid"
  | (typeof CLOUDFLARE_ACCESS_ERROR_MESSAGE_KEY)[CloudflareAccessDraftError]
  | "account.cloudflare_access_metadata_required_for_origin_change";

export function resolveCredentialSaveValidationErrorKey({
  serverUrl,
  username,
  cloudflareAccessValidationError,
  accessMetadataUnavailable,
  cloudflareAccessUpdate,
  serverUrlChanged,
  accountServerUrl,
}: {
  serverUrl: string | undefined;
  username: string | undefined;
  cloudflareAccessValidationError: CloudflareAccessDraftError | null;
  accessMetadataUnavailable: boolean;
  cloudflareAccessUpdate: CloudflareAccessUpdate | undefined;
  serverUrlChanged: boolean;
  accountServerUrl: string | null;
}): CredentialSaveValidationErrorKey | null {
  if (!serverUrl) {
    return "account.error_server_url_required";
  }
  if (!username) {
    return "account.error_username_required";
  }
  if (!isValidRequiredHttpServerUrl(serverUrl)) {
    return "account.error_server_url_invalid";
  }
  if (cloudflareAccessValidationError !== null) {
    return CLOUDFLARE_ACCESS_ERROR_MESSAGE_KEY[cloudflareAccessValidationError];
  }
  if (
    accessMetadataUnavailable &&
    cloudflareAccessUpdate?.action !== "replace" &&
    cloudflareAccessUpdate?.action !== "remove" &&
    serverUrlChanged &&
    getHttpsOrigin(serverUrl) !== getHttpsOrigin(accountServerUrl ?? "")
  ) {
    return "account.cloudflare_access_metadata_required_for_origin_change";
  }
  return null;
}

export function resolveCredentialSaveFailureMessage(
  error: AppError,
  accessOperationPending: boolean,
  t: TFunction<"settings">,
): string {
  if (isCloudflareAccessRecoveryRequired(error)) {
    return t("account.cloudflare_access_recovery_required");
  }
  if (accessOperationPending) {
    return t("account.cloudflare_access_save_failed");
  }
  return error.message;
}
