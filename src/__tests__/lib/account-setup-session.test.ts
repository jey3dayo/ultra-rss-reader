import { beforeEach, describe, expect, it } from "vitest";
import type {
  AccountSetupAddAccountVerificationSession,
  AccountSetupSession,
  AccountSetupSessionState,
  AccountSetupTrackedAccountSession,
  AccountSetupTrackedAccountSessionState,
  AccountSetupVerificationSessionState,
} from "@/lib/account/account-setup-session.types";
import { useUiStore } from "@/stores/ui-store";

describe("account setup session", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("locks verification to the add-account owner until a created account session starts", () => {
    useUiStore.getState().startAccountSetupVerification();

    expect(useUiStore.getState().accountSetupSession).toEqual({
      owner: "add-account",
      state: "verifying",
    });

    useUiStore.getState().markAccountSetupFailed("acc-new", "Sync failed");
    useUiStore.getState().markAccountSetupSucceeded("acc-new");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      owner: "add-account",
      state: "verifying",
    });

    useUiStore.getState().startAccountSetup("acc-new");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-new",
      owner: "add-account",
      state: "syncing",
    });
  });

  it("keeps verifying and account sessions as distinct type contracts", () => {
    const verificationState =
      "verifying" satisfies AccountSetupVerificationSessionState;
    const trackedAccountState =
      "syncing" satisfies AccountSetupTrackedAccountSessionState;
    const sessionState = verificationState satisfies AccountSetupSessionState;

    const verificationSession = {
      owner: "add-account",
      state: verificationState,
    } satisfies AccountSetupAddAccountVerificationSession;

    const accountSession = {
      accountId: "acc-1",
      owner: "account-detail",
      state: trackedAccountState,
    } satisfies AccountSetupTrackedAccountSession;

    const failedAccountSession = {
      accountId: "acc-1",
      owner: "add-account",
      state: "failed",
      errorMessage: "Sync failed",
    } satisfies AccountSetupSession;

    expect(verificationSession).not.toHaveProperty("accountId");
    expect(accountSession.accountId).toBe("acc-1");
    expect(sessionState).toBe("verifying");
    expect(failedAccountSession.errorMessage).toBe("Sync failed");
  });

  it("keeps partial create rollback accountId-free until native create succeeds", () => {
    const verificationSession = {
      owner: "add-account",
      state: "verifying",
    } satisfies AccountSetupSession;

    const accountDetailSession = {
      accountId: "acc-1",
      owner: "account-detail",
      state: "syncing",
    } satisfies AccountSetupSession;

    const addAccountCreatedSession = {
      accountId: "acc-2",
      owner: "add-account",
      state: "failed",
      errorMessage: "Sync failed",
    } satisfies AccountSetupSession;

    expect(verificationSession).not.toHaveProperty("accountId");
    expect(accountDetailSession.accountId).toBe("acc-1");
    expect(addAccountCreatedSession.accountId).toBe("acc-2");
  });

  it("keeps account setup status updates scoped to the owning account", () => {
    useUiStore
      .getState()
      .startAccountSetup("acc-1", { owner: "account-detail" });

    useUiStore.getState().markAccountSetupFailed("acc-2", "Wrong account");
    useUiStore.getState().markAccountSetupSucceeded("acc-2");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-1",
      owner: "account-detail",
      state: "syncing",
    });

    useUiStore.getState().markAccountSetupFailed("acc-1", "Retry available");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-1",
      owner: "account-detail",
      state: "failed",
      errorMessage: "Retry available",
    });
  });

  it("retries with the existing owner and cancel clears the session", () => {
    useUiStore.getState().startAccountSetup("acc-1", { owner: "add-account" });
    useUiStore
      .getState()
      .markAccountSetupFailed("acc-1", "Initial sync failed");

    useUiStore.getState().startAccountSetup("acc-1");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-1",
      owner: "add-account",
      state: "syncing",
    });

    useUiStore.getState().clearAccountSetup();

    expect(useUiStore.getState().accountSetupSession).toBeNull();
  });

  it("ignores blank account ids for account setup state changes", () => {
    useUiStore.getState().startAccountSetup("   ", { owner: "account-detail" });
    useUiStore.getState().markAccountSetupFailed("   ", "Blank failure");
    useUiStore.getState().markAccountSetupSucceeded("   ");

    expect(useUiStore.getState().accountSetupSession).toBeNull();

    useUiStore.getState().startAccountSetup("acc-1", { owner: "add-account" });

    useUiStore.getState().startAccountSetup("   ", { owner: "account-detail" });
    useUiStore.getState().markAccountSetupFailed("   ", "Blank failure");
    useUiStore.getState().markAccountSetupSucceeded("   ");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-1",
      owner: "add-account",
      state: "syncing",
    });
  });

  it("trims account ids before starting or updating account setup sessions while preserving the existing owner", () => {
    useUiStore
      .getState()
      .startAccountSetup("  acc-trimmed  ", { owner: "account-detail" });

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-trimmed",
      owner: "account-detail",
      state: "syncing",
    });

    useUiStore
      .getState()
      .markAccountSetupFailed("  acc-trimmed  ", "Sync failed");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-trimmed",
      owner: "account-detail",
      state: "failed",
      errorMessage: "Sync failed",
    });

    useUiStore.getState().startAccountSetup("  acc-trimmed  ");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-trimmed",
      owner: "account-detail",
      state: "syncing",
    });

    useUiStore.getState().markAccountSetupSucceeded("  acc-trimmed  ");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-trimmed",
      owner: "account-detail",
      state: "succeeded",
    });
  });
});
