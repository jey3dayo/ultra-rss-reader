export type SyncProgressStage = "started" | "account_started" | "account_finished" | "finished";
export type SyncProgressKind = "manual_all" | "manual_account" | "automatic";

export type SyncProgressEvent = {
  stage: SyncProgressStage;
  kind: SyncProgressKind;
  total: number;
  completed: number;
  account_id?: string | null;
  account_name?: string | null;
  success?: boolean | null;
};

export type SyncProgressState = {
  active: boolean;
  kind: SyncProgressKind | null;
  stage: SyncProgressStage | null;
  total: number;
  completed: number;
  currentAccountName: string | null;
  activeAccountIds: Set<string>;
};
