import type { TFunction } from "i18next";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";

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
};

export type AccountSwitchControl = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export type AccountSyncSectionViewProps = {
  heading: string;
  syncInterval: AccountSelectControl;
  syncOnWake: AccountSwitchControl;
  keepReadItems: AccountSelectControl;
  statusRows?: AccountSyncStatusRow[];
  syncNowLabel?: string;
  syncingLabel?: string;
  onSyncNow?: () => void;
  isSyncing?: boolean;
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
};

export type AccountDangerZoneViewProps = {
  exportLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  confirmDeleteLabel: string;
  isConfirmingDelete: boolean;
  onExport: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export type AccountDetailViewProps = {
  title: string;
  subtitle?: string;
  generalSection: AccountGeneralSectionViewProps;
  credentialsSection?: ReactNode;
  syncSection: AccountSyncSectionViewProps;
  dangerZone: AccountDangerZoneViewProps;
};

export type AccountDetailAccount = AccountDto;

export type AccountDetailContentProps = {
  account: AccountDetailAccount;
  isSyncing: boolean;
};

export type AccountSelectRowProps = {
  control: AccountSelectControl;
};

export type UseAccountDetailControllerParams = {
  account: AccountDetailAccount;
  t: TFunction<"settings">;
  onAccountDeleted: () => void;
  onSyncStatusChanged?: () => void;
};

export type UpdateAccountSyncParams = {
  syncIntervalSecs?: number;
  syncOnWake?: boolean;
  keepReadItemsDays?: number;
};

export type UseAccountDetailControllerResult = {
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  editingName: boolean;
  savingName: boolean;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  testingConnection: boolean;
  setCredServerUrl: (value: string | null) => void;
  setCredUsername: (value: string | null) => void;
  setCredPassword: (value: string | null) => void;
  startEditingName: () => void;
  commitRename: () => Promise<void>;
  commitCredentials: () => Promise<boolean>;
  handleNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleSyncUpdate: (partial: UpdateAccountSyncParams) => Promise<void>;
  handleTestConnection: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  handleExportOpml: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleCopyServerUrl: () => Promise<void>;
  onPasswordFocus: () => void;
  syncIntervalOptions: AccountSelectOption[];
  keepReadItemsOptions: AccountSelectOption[];
};

export type UseAccountDetailViewPropsParams = {
  account: AccountDetailAccount;
  controller: UseAccountDetailControllerResult;
  isSyncing: boolean;
  syncStatusRows: AccountSyncStatusRow[];
  t: TFunction<"settings">;
  tc: TFunction<"common">;
};

export type UseAccountDetailViewPropsResult = Pick<
  AccountDetailViewProps,
  "title" | "generalSection" | "credentialsSection" | "syncSection" | "dangerZone"
>;
