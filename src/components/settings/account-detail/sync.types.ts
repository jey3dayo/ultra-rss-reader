export type AccountSyncStatusRow = {
  label: string;
  value: string;
};

export type AccountDetailSyncProgress = {
  total: number;
  completed: number;
  currentAccountName: string | null;
};

export type UpdateAccountSyncParams = {
  syncIntervalSecs?: number;
  syncOnStartup?: boolean;
  syncOnWake?: boolean;
  keepReadItemsDays?: number;
};
