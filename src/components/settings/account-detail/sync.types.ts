import type { TFunction } from "i18next";

export type AccountSelectOption = {
  value: string;
  label: string;
};

export type AccountSyncStatusRow = {
  label: string;
  value: string;
};

export type AccountDetailSyncProgress = {
  total: number;
  completed: number;
  currentAccountName: string | null;
};

export type AccountDetailSyncStatusTranslator =
  | TFunction<"settings">
  | ((key: string, options?: { count?: number }) => string);

export type UpdateAccountSyncParams = {
  syncIntervalSecs?: number;
  syncOnStartup?: boolean;
  syncOnWake?: boolean;
  keepReadItemsDays?: number;
};
