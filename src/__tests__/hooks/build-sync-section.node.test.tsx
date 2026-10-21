import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import type { RefObject } from "react";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { buildSyncSection } from "@/components/settings/hooks/account-detail/build-sync-section";
import type { AccountDetailControllerResult } from "@/components/settings/hooks/account-detail/use-account-detail-controller";

function createSyncStatus(overrides: Partial<AccountSyncStatusDto>): AccountSyncStatusDto {
  return {
    last_success_at: null,
    next_retry_at: null,
    error_count: 0,
    last_error: null,
    waiting_for_credential_access: false,
    ...overrides,
  };
}

function createControllerStub(overrides: Partial<AccountDetailControllerResult> = {}): AccountDetailControllerResult {
  const noop = () => {};
  const inputRef: RefObject<HTMLInputElement | null> = { current: null };
  return {
    editingName: false,
    savingName: false,
    nameDraft: "",
    setNameDraft: noop,
    nameInputRef: inputRef,
    startEditingName: noop,
    commitRename: async () => {},
    handleNameKeyDown: noop,
    credServerUrl: null,
    credUsername: null,
    credPassword: null,
    passwordDisplayValue: "",
    cloudflareAccessStatus: "ready",
    cloudflareAccessRecoveryAction: null,
    cloudflareAccessEnabled: false,
    cloudflareAccessClientId: "",
    cloudflareAccessSecret: "",
    cloudflareAccessHasSavedSecret: false,
    cloudflareAccessSecretEditing: false,
    cloudflareAccessSecretVisible: false,
    cloudflareAccessValidationError: null,
    credentialFailure: null,
    testingConnection: false,
    connectionTestSucceeded: false,
    dirtyState: { owner: "account", dirty: false, pending: false, blockingReason: null },
    changedFields: {
      serverUrl: false,
      username: false,
      password: false,
      cloudflareAccess: false,
      cloudflareAccessClientId: false,
      cloudflareAccessSecret: false,
    },
    serverUrlInputRef: inputRef,
    usernameInputRef: inputRef,
    setCredServerUrl: noop,
    setCredUsername: noop,
    setCredPassword: noop,
    setCloudflareAccessRecoveryAction: noop,
    setCloudflareAccessEnabled: noop,
    setCloudflareAccessClientId: noop,
    setCloudflareAccessSecret: noop,
    setCloudflareAccessSecretEditing: noop,
    setCloudflareAccessSecretVisible: noop,
    retryCloudflareAccessLoad: noop,
    commitCredentials: async () => true,
    handleTestConnection: async () => false,
    discardCredentialDrafts: noop,
    handleCopyServerUrl: async () => {},
    onPasswordFocus: noop,
    onPasswordBlur: noop,
    focusCredentialsEditor: noop,
    handleSyncUpdate: async () => {},
    handleSyncNow: async () => {},
    handleSetupRetry: async () => {},
    handleResetDevCredentials: async () => {},
    syncActionInFlight: false,
    syncNowSucceeded: false,
    devCredentialsRecoveryInFlight: false,
    syncIntervalOptions: [],
    keepReadItemsOptions: [],
    handleImportOpml: async () => {},
    handleExportOpml: async () => {},
    localSyncFolderPath: "",
    setLocalSyncFolderPath: noop,
    localSyncEnabled: false,
    handleToggleLocalSyncEnabled: noop,
    handleSaveLocalSyncFolder: async () => {},
    handleExportLocalSyncOperations: async () => {},
    handleImportLocalSyncOperations: async () => {},
    handleRequestDelete: noop,
    importingOpml: false,
    exportingOpml: false,
    loadingLocalSyncSettings: false,
    savingLocalSyncSettings: false,
    exportingLocalSyncOperations: false,
    importingLocalSyncOperations: false,
    ...overrides,
  };
}

describe("buildSyncSection", () => {
  const account = { ...sampleAccounts[1], kind: "FreshRss" };
  const language = "ja";
  const t = i18n.getFixedT(language, "settings");

  it("exposes the test connection secondary action while waiting for credential access", () => {
    const controller = createControllerStub();
    const props = buildSyncSection({
      account,
      controller,
      t,
      syncStatusRows: [],
      accountSetupErrorMessage: null,
      isSyncing: false,
      syncStatus: createSyncStatus({ waiting_for_credential_access: true }),
      canRecoverDevCredentialsStore: false,
      isSetupSyncing: false,
      isSetupFailed: false,
      isSetupActive: false,
      isQuarantined: false,
    });

    expect(props.secondaryActionLabel).toBe(t("account.test_connection"));
    expect(props.onSecondaryAction).toBe(controller.handleTestConnection);
  });

  it("keeps the edit credentials secondary action while waiting during setup failure", () => {
    const controller = createControllerStub();
    const props = buildSyncSection({
      account,
      controller,
      t,
      syncStatusRows: [],
      accountSetupErrorMessage: "setup failed",
      isSyncing: false,
      syncStatus: createSyncStatus({ waiting_for_credential_access: true }),
      canRecoverDevCredentialsStore: false,
      isSetupSyncing: true,
      isSetupFailed: true,
      isSetupActive: true,
      isQuarantined: false,
    });

    expect(props.secondaryActionLabel).toBe(t("account.setup_edit_credentials"));
    expect(props.onSecondaryAction).toBe(controller.focusCredentialsEditor);
  });

  it("does not expose a secondary action otherwise", () => {
    const controller = createControllerStub();
    const props = buildSyncSection({
      account,
      controller,
      t,
      syncStatusRows: [],
      accountSetupErrorMessage: null,
      isSyncing: false,
      syncStatus: createSyncStatus({}),
      canRecoverDevCredentialsStore: false,
      isSetupSyncing: false,
      isSetupFailed: false,
      isSetupActive: false,
      isQuarantined: false,
    });

    expect(props.secondaryActionLabel).toBeUndefined();
    expect(props.onSecondaryAction).toBeUndefined();
  });
});
