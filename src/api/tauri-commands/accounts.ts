import {
  AccountDtoListSchema,
  AccountDtoSchema,
  AccountSyncStatusSchema,
  addAccountArgs,
  deleteAccountArgs,
  getAccountSyncStatusArgs,
  NullResponseSchema,
  renameAccountArgs,
  testAccountConnectionArgs,
  updateAccountCredentialsArgs,
  updateAccountSyncArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const listAccounts = () => safeInvoke("list_accounts", { response: AccountDtoListSchema });

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke(
    "add_account",
    { response: AccountDtoSchema, args: addAccountArgs },
    { kind, name, serverUrl, username, password },
  );

export const updateAccountSync = (
  accountId: string,
  syncIntervalSecs: number,
  syncOnStartup: boolean,
  syncOnWake: boolean,
  keepReadItemsDays: number,
) =>
  safeInvoke(
    "update_account_sync",
    { response: AccountDtoSchema, args: updateAccountSyncArgs },
    {
      accountId,
      syncIntervalSecs,
      syncOnStartup,
      syncOnWake,
      keepReadItemsDays,
    },
  );

export const updateAccountCredentials = (accountId: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke(
    "update_account_credentials",
    { response: AccountDtoSchema, args: updateAccountCredentialsArgs },
    { accountId, serverUrl, username, password },
  );

export const renameAccount = (accountId: string, name: string) =>
  safeInvoke("rename_account", { response: AccountDtoSchema, args: renameAccountArgs }, { accountId, name });

export const testAccountConnection = (accountId: string) =>
  safeInvoke("test_account_connection", { response: AccountDtoSchema, args: testAccountConnectionArgs }, { accountId });

export const deleteAccount = (accountId: string) =>
  safeInvoke("delete_account", { response: NullResponseSchema, args: deleteAccountArgs }, { accountId });

export const getAccountSyncStatus = (accountId: string) =>
  safeInvoke(
    "get_account_sync_status",
    { response: AccountSyncStatusSchema, args: getAccountSyncStatusArgs },
    { accountId },
  );
