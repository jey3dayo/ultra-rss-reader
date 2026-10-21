import { createAccountDetailControllerStub } from "@tests/helpers/account-detail-controller-stub";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { buildSyncSection } from "@/components/settings/hooks/account-detail/build-sync-section";

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

describe("buildSyncSection", () => {
  const account = { ...sampleAccounts[1], kind: "FreshRss" };
  const language = "ja";
  const t = i18n.getFixedT(language, "settings");

  it("exposes the test connection secondary action while waiting for credential access", () => {
    const controller = createAccountDetailControllerStub();
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
    const controller = createAccountDetailControllerStub();
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
    const controller = createAccountDetailControllerStub();
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
