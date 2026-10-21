import { getHttpsOrigin, isCloudflareAccessRecoveryStatus } from "@/lib/account/cloudflare-access";
import type {
  AccountDetailCredentialsEditorAction,
  AccountDetailCredentialsEditorState,
} from "./account-detail-credentials-editor-state";
import { cloudflareAccessDraftMatches } from "./account-detail-credentials-editor-state";

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
      cloudflareAccessLoadFailure: null,
      cloudflareAccessStatus: "ready",
      cloudflareAccessRecoveryAction: null,
      savedCloudflareAccessClientId: action.clientId,
      savedCloudflareAccessOrigin,
    };
  }
  return {
    ...state,
    cloudflareAccessLoadFailure: null,
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
    credentialFailure: null,
    credServerUrl: state.credServerUrl === action.draft.credServerUrl ? null : state.credServerUrl,
    credUsername: state.credUsername === action.draft.credUsername ? null : state.credUsername,
    credPassword: state.credPassword === action.draft.credPassword ? null : state.credPassword,
    hasSavedPassword: state.hasSavedPassword || action.passwordWasSaved,
    ...(cloudflareAccessDraftMatches(state, action.cloudflareAccessDraft)
      ? { cloudflareAccessSecretEditing: false, cloudflareAccessSecretVisible: false }
      : {}),
  };
}

function reduceDiscardCredentialDrafts(
  state: AccountDetailCredentialsEditorState,
): AccountDetailCredentialsEditorState {
  return {
    ...state,
    credentialFailure: null,
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    cloudflareAccessEnabled: state.savedCloudflareAccessClientId !== null,
    cloudflareAccessClientId: state.savedCloudflareAccessClientId ?? "",
    cloudflareAccessSecret: "",
    cloudflareAccessSecretEditing: false,
    cloudflareAccessSecretVisible: false,
    cloudflareAccessRecoveryAction: null,
    cloudflareAccessDraftTouched: false,
    cloudflareAccessRemovalRequested: false,
    draftRevision: state.draftRevision + 1,
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
    case "set-credential-failure":
      return action.value?.operation === "load"
        ? { ...state, cloudflareAccessLoadFailure: action.value }
        : { ...state, credentialFailure: action.value };
    case "retry-cloudflare-access-load":
      return {
        ...state,
        cloudflareAccessLoadFailure: null,
        cloudflareAccessStatus: "loading",
      };
    case "sync-saved-password-presence":
      return { ...state, hasSavedPassword: action.value };
    case "discard-credential-drafts":
      return reduceDiscardCredentialDrafts(state);
    case "clear-credential-drafts":
      return reduceClearCredentialDrafts(state, action);
    default:
      return state;
  }
}
