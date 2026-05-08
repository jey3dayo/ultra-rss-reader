import type { TFunction } from "i18next";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import type { AccountSetupSessionState } from "@/lib/account/account-setup-session.types";

export type AccountSelectOption = {
  value: string;
  label: string;
};

export type AccountSelectControl = {
  name: string;
  label: string;
  value: string;
  options: AccountSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export type AccountSwitchControl = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type AccountSyncSectionViewProps = {
  heading: string;
  note?: string;
  progressLabel?: string;
  progressValue?: number | null;
  progressCurrentLabel?: string;
  syncInterval: AccountSelectControl;
  syncOnStartup: AccountSwitchControl;
  syncOnWake: AccountSwitchControl;
  keepReadItems: AccountSelectControl;
  statusRows?: AccountSyncStatusRow[];
  syncNowLabel?: string;
  syncingLabel?: string;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export type AccountSyncStatusRow = {
  label: string;
  value: string;
};

export type AccountGeneralInfoRow = {
  label: string;
  value: string;
  truncate?: boolean;
};

export type AccountGeneralSectionViewProps = {
  heading: string;
  nameLabel: string;
  nameValue: string;
  editNameTitle: string;
  isEditingName: boolean;
  isSavingName?: boolean;
  nameDraft: string;
  infoRows: AccountGeneralInfoRow[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onStartEditingName: () => void;
  onNameDraftChange: (value: string) => void;
  onCommitName: () => void;
  onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

export type AccountDangerZoneViewProps = {
  dataHeading: string;
  dangerHeading: string;
  exportLabel: string;
  deleteLabel: string;
  onExport: () => void;
  onRequestDelete: () => void;
  disabled?: boolean;
};

export type AccountCredentialInputRow = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export type AccountDetailViewProps = {
  title: string;
  subtitle?: string;
  headerSummary?: ReactNode;
  generalSection: AccountGeneralSectionViewProps;
  credentialsSection?: ReactNode;
  syncSection: AccountSyncSectionViewProps;
  dangerZone: AccountDangerZoneViewProps;
};

export type AccountDetailAccount = AccountDto;

export type AccountDetailSyncProgress = {
  total: number;
  completed: number;
  currentAccountName: string | null;
};

export type AccountDetailContentProps = {
  account: AccountDetailAccount;
  isSyncing: boolean;
  syncProgress?: AccountDetailSyncProgress;
  accountSetupState: AccountSetupSessionState | null;
  accountSetupErrorMessage?: string | null;
};

export type AccountSelectRowProps = {
  control: AccountSelectControl;
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
