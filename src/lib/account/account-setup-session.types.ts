export type AccountSetupSessionState = "syncing" | "failed" | "succeeded";

export type AccountSetupSession = {
  accountId: string;
  state: AccountSetupSessionState;
  errorMessage?: string;
};
