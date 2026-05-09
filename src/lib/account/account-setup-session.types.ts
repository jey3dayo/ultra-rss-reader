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
