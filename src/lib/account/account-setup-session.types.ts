export type AccountSetupSessionOwner = "add-account" | "account-detail";

export type AccountSetupVerificationSessionState = "verifying";
export type AccountSetupTrackedAccountSessionState =
  | "syncing"
  | "failed"
  | "succeeded";
export type AccountSetupSessionState =
  | AccountSetupVerificationSessionState
  | AccountSetupTrackedAccountSessionState;

export type AccountSetupAddAccountVerificationSession = {
  owner: "add-account";
  state: AccountSetupVerificationSessionState;
};

// Add-account verification happens before an account id exists. Account ids are
// introduced only after native account creation and credential persistence both
// succeed, so a failed create cannot resume as a tracked setup session.
type AccountSetupTrackedAccountSessionBase<
  State extends AccountSetupTrackedAccountSessionState,
> = {
  accountId: string;
  owner: AccountSetupSessionOwner;
  state: State;
};

export type AccountSetupTrackedAccountSyncingSession =
  AccountSetupTrackedAccountSessionBase<"syncing">;

export type AccountSetupTrackedAccountFailedSession =
  AccountSetupTrackedAccountSessionBase<"failed"> & {
    errorMessage?: string;
  };

export type AccountSetupTrackedAccountSucceededSession =
  AccountSetupTrackedAccountSessionBase<"succeeded">;

export type AccountSetupTrackedAccountSession =
  | AccountSetupTrackedAccountSyncingSession
  | AccountSetupTrackedAccountFailedSession
  | AccountSetupTrackedAccountSucceededSession;

export type AccountSetupSession =
  | AccountSetupAddAccountVerificationSession
  | AccountSetupTrackedAccountSession;
