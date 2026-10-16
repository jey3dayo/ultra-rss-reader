import type { TFunction } from "i18next";
import type { AppError, CloudflareAccessUpdate } from "@/api/schemas";
import {
  type CloudflareAccessDraftError,
  type CloudflareAccessStatus,
  getHttpsOrigin,
  isCloudflareAccessRecoveryStatus,
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

type AccountDetailCredentialsEditorState = {
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

function cloudflareAccessDraftMatches(
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

type SetCloudflareAccessRecoveryActionAction = Extract<
  AccountDetailCredentialsEditorAction,
  { type: "set-cloudflare-access-recovery-action" }
>;
type SetCloudflareAccessEnabledAction = Extract<
  AccountDetailCredentialsEditorAction,
  { type: "set-cloudflare-access-enabled" }
>;
type SetCloudflareAccessSecretEditingAction = Extract<
  AccountDetailCredentialsEditorAction,
  { type: "set-cloudflare-access-secret-editing" }
>;
type CloudflareAccessLoadedAction = Extract<AccountDetailCredentialsEditorAction, { type: "cloudflare-access-loaded" }>;
type RecordSavedCloudflareAccessAction = Extract<
  AccountDetailCredentialsEditorAction,
  { type: "record-saved-cloudflare-access" }
>;
type ClearCredentialDraftsAction = Extract<AccountDetailCredentialsEditorAction, { type: "clear-credential-drafts" }>;

function reduceSetCloudflareAccessRecoveryAction(
  state: AccountDetailCredentialsEditorState,
  action: SetCloudflareAccessRecoveryActionAction,
): AccountDetailCredentialsEditorState {
  if (!isCloudflareAccessRecoveryStatus(state.cloudflareAccessStatus)) {
    return state;
  }
  return {
    ...state,
    cloudflareAccessRecoveryAction: action.value,
    cloudflareAccessDraftTouched: true,
    draftRevision: state.draftRevision + 1,
  };
}

function reduceSetCloudflareAccessEnabled(
  state: AccountDetailCredentialsEditorState,
  action: SetCloudflareAccessEnabledAction,
): AccountDetailCredentialsEditorState {
  return {
    ...state,
    cloudflareAccessEnabled: action.value,
    cloudflareAccessDraftTouched: true,
    cloudflareAccessRemovalRequested: !action.value,
    cloudflareAccessSecret: action.value ? state.cloudflareAccessSecret : "",
    cloudflareAccessSecretEditing: action.value ? state.cloudflareAccessSecretEditing : false,
    cloudflareAccessSecretVisible: action.value ? state.cloudflareAccessSecretVisible : false,
    cloudflareAccessClientId:
      action.value || state.savedCloudflareAccessClientId !== null ? state.cloudflareAccessClientId : "",
    draftRevision: state.draftRevision + 1,
  };
}

function reduceSetCloudflareAccessSecretEditing(
  state: AccountDetailCredentialsEditorState,
  action: SetCloudflareAccessSecretEditingAction,
): AccountDetailCredentialsEditorState {
  return {
    ...state,
    cloudflareAccessSecret: action.value ? state.cloudflareAccessSecret : "",
    cloudflareAccessSecretEditing: action.value,
    cloudflareAccessSecretVisible: false,
    draftRevision: state.draftRevision + 1,
  };
}

function reduceCloudflareAccessLoaded(
  state: AccountDetailCredentialsEditorState,
  action: CloudflareAccessLoadedAction,
): AccountDetailCredentialsEditorState {
  const savedCloudflareAccessOrigin = action.clientId === null ? null : getHttpsOrigin(action.serverUrl);
  if (state.cloudflareAccessDraftTouched) {
    return {
      ...state,
      cloudflareAccessStatus: "ready",
      cloudflareAccessRecoveryAction: null,
      savedCloudflareAccessClientId: action.clientId,
      savedCloudflareAccessOrigin,
    };
  }
  return {
    ...state,
    cloudflareAccessStatus: "ready",
    cloudflareAccessRecoveryAction: null,
    savedCloudflareAccessClientId: action.clientId,
    savedCloudflareAccessOrigin,
    cloudflareAccessEnabled: action.clientId !== null,
    cloudflareAccessClientId: action.clientId ?? "",
    cloudflareAccessSecret: "",
    cloudflareAccessSecretEditing: false,
    cloudflareAccessSecretVisible: false,
  };
}

function reduceRecordSavedCloudflareAccess(
  state: AccountDetailCredentialsEditorState,
  action: RecordSavedCloudflareAccessAction,
): AccountDetailCredentialsEditorState {
  const savedClientId = action.clientId;
  const savedCloudflareAccessOrigin = savedClientId === null ? null : getHttpsOrigin(action.serverUrl);
  if (!cloudflareAccessDraftMatches(state, action.draft)) {
    return {
      ...state,
      cloudflareAccessStatus: "ready",
      savedCloudflareAccessClientId: savedClientId,
      savedCloudflareAccessOrigin,
    };
  }
  return {
    ...state,
    cloudflareAccessStatus: "ready",
    cloudflareAccessRecoveryAction: null,
    savedCloudflareAccessClientId: savedClientId,
    savedCloudflareAccessOrigin,
    cloudflareAccessEnabled: savedClientId !== null,
    cloudflareAccessClientId: savedClientId ?? "",
    cloudflareAccessSecret: "",
    cloudflareAccessSecretEditing: false,
    cloudflareAccessSecretVisible: false,
    cloudflareAccessDraftTouched: false,
    cloudflareAccessRemovalRequested: false,
  };
}

function reduceClearCredentialDrafts(
  state: AccountDetailCredentialsEditorState,
  action: ClearCredentialDraftsAction,
): AccountDetailCredentialsEditorState {
  return {
    ...state,
    credServerUrl: state.credServerUrl === action.draft.credServerUrl ? null : state.credServerUrl,
    credUsername: state.credUsername === action.draft.credUsername ? null : state.credUsername,
    credPassword: state.credPassword === action.draft.credPassword ? null : state.credPassword,
    hasSavedPassword: state.hasSavedPassword || action.passwordWasSaved,
    ...(cloudflareAccessDraftMatches(state, action.cloudflareAccessDraft)
      ? { cloudflareAccessSecretEditing: false, cloudflareAccessSecretVisible: false }
      : {}),
  };
}

export function accountDetailCredentialsEditorReducer(
  state: AccountDetailCredentialsEditorState,
  action: AccountDetailCredentialsEditorAction,
): AccountDetailCredentialsEditorState {
  switch (action.type) {
    case "set-cred-server-url":
      return {
        ...state,
        credServerUrl: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cred-username":
      return {
        ...state,
        credUsername: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cred-password":
      return {
        ...state,
        credPassword: action.value,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-recovery-action":
      return reduceSetCloudflareAccessRecoveryAction(state, action);
    case "set-cloudflare-access-enabled":
      return reduceSetCloudflareAccessEnabled(state, action);
    case "set-cloudflare-access-client-id":
      return {
        ...state,
        cloudflareAccessClientId: action.value,
        cloudflareAccessDraftTouched: true,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-secret":
      return {
        ...state,
        cloudflareAccessSecret: action.value,
        cloudflareAccessDraftTouched: true,
        draftRevision: state.draftRevision + 1,
      };
    case "set-cloudflare-access-secret-editing":
      return reduceSetCloudflareAccessSecretEditing(state, action);
    case "set-cloudflare-access-secret-visible":
      return { ...state, cloudflareAccessSecretVisible: action.value };
    case "set-cloudflare-access-status":
      return { ...state, cloudflareAccessStatus: action.value };
    case "cloudflare-access-loaded":
      return reduceCloudflareAccessLoaded(state, action);
    case "record-saved-cloudflare-access":
      return reduceRecordSavedCloudflareAccess(state, action);
    case "set-testing-connection":
      return { ...state, testingConnection: action.value };
    case "set-credential-save-pending":
      return { ...state, credentialSavePending: action.value };
    case "sync-saved-password-presence":
      return { ...state, hasSavedPassword: action.value };
    case "clear-credential-drafts":
      return reduceClearCredentialDrafts(state, action);
    default:
      return state;
  }
}
