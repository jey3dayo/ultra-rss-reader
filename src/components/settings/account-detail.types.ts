import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { AccountDto, AccountSyncStatusDto } from "@/api/tauri-commands";

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
  syncOnStartup: AccountSwitchControl;
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
  dataHeading: string;
  dangerHeading: string;
  exportLabel: string;
  deleteLabel: string;
  onExport: () => void;
  onRequestDelete: () => void;
};

export type AccountCredentialInputRow = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
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

export type UseAccountDetailNameEditorParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
};

export type UseAccountDetailNameEditorResult = {
  editingName: boolean;
  savingName: boolean;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  startEditingName: () => void;
  commitRename: () => Promise<void>;
  handleNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export type UseAccountDetailCredentialsEditorParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
};

export type UseAccountDetailCredentialsEditorResult = {
  credServerUrl: string | null;
  credUsername: string | null;
  credPassword: string | null;
  appIdValue: string;
  appKeyValue: string;
  passwordDisplayValue: string;
  testingConnection: boolean;
  setCredServerUrl: (value: string | null) => void;
  setCredUsername: (value: string | null) => void;
  setCredPassword: (value: string | null) => void;
  setAppId: (value: string | null) => void;
  setAppKey: (value: string | null) => void;
  commitCredentials: () => Promise<boolean>;
  commitAppCredentials: () => Promise<boolean>;
  handleTestConnection: () => Promise<void>;
  handleCopyServerUrl: () => Promise<void>;
  onPasswordFocus: () => void;
  onAppKeyFocus: () => void;
};

export type UseAccountDetailSyncControlsParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onSyncStatusChanged?: () => void;
};

export type UseAccountDetailSyncControlsResult = {
  handleSyncUpdate: (partial: UpdateAccountSyncParams) => Promise<void>;
  handleSyncNow: () => Promise<void>;
  syncIntervalOptions: AccountSelectOption[];
  keepReadItemsOptions: AccountSelectOption[];
};

export type UseAccountDetailDangerZoneParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onAccountDeleted: () => void;
};

export type UseAccountDetailDangerZoneResult = {
  handleExportOpml: () => Promise<void>;
  handleRequestDelete: () => void;
};

export type AccountDetailSyncStatusTranslator =
  | TFunction<"settings">
  | ((key: string, options?: { count?: number }) => string);

export type UseAccountDetailSyncStatusRowsParams = {
  syncStatus: AccountSyncStatusDto | undefined;
  language: string;
  t: AccountDetailSyncStatusTranslator;
};

export type UseAccountDetailSyncStatusRowsResult = AccountSyncStatusRow[];

export type UpdateAccountSyncParams = {
  syncIntervalSecs?: number;
  syncOnStartup?: boolean;
  syncOnWake?: boolean;
  keepReadItemsDays?: number;
};

export type UseAccountDetailControllerResult = {} & UseAccountDetailNameEditorResult &
  UseAccountDetailCredentialsEditorResult &
  UseAccountDetailSyncControlsResult &
  UseAccountDetailDangerZoneResult;

export type UseAccountDetailViewPropsParams = {
  account: AccountDetailAccount;
  controller: UseAccountDetailControllerResult;
  isSyncing: boolean;
  syncStatusRows: AccountSyncStatusRow[];
  t: TFunction<"settings">;
};

export type UseAccountDetailViewPropsResult = Pick<
  AccountDetailViewProps,
  "title" | "generalSection" | "credentialsSection" | "syncSection" | "dangerZone"
>;
