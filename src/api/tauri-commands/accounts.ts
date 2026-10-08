import {
  AccountDtoListSchema,
  AccountDtoSchema,
  AccountSyncStatusSchema,
  addAccountArgs,
  CloudflareAccessMetadataSchema,
  type CloudflareAccessUpdate,
  deleteAccountArgs,
  getAccountCloudflareAccessArgs,
  getAccountSyncStatusArgs,
  NullResponseSchema,
  renameAccountArgs,
  testAccountConnectionArgs,
  updateAccountCredentialsArgs,
  updateAccountSyncArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const listAccounts = () => safeInvoke("list_accounts", { response: AccountDtoListSchema });

export const addAccount = (
  kind: string,
  name: string,
  serverUrl?: string,
  username?: string,
  password?: string,
  cloudflareAccess?: CloudflareAccessUpdate,
) =>
  safeInvoke(
    "add_account",
    {
      response: AccountDtoSchema,
      args: addAccountArgs,
      redactErrorDetails: cloudflareAccess?.action === "replace" || cloudflareAccess?.action === "remove",
    },
    { kind, name, serverUrl, username, password, ...(cloudflareAccess ? { cloudflareAccess } : {}) },
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

export const updateAccountCredentials = (
  accountId: string,
  serverUrl?: string,
  username?: string,
  password?: string,
  cloudflareAccess?: CloudflareAccessUpdate,
) =>
  safeInvoke(
    "update_account_credentials",
    {
      response: AccountDtoSchema,
      args: updateAccountCredentialsArgs,
      redactErrorDetails: cloudflareAccess?.action === "replace" || cloudflareAccess?.action === "remove",
    },
    { accountId, serverUrl, username, password, ...(cloudflareAccess ? { cloudflareAccess } : {}) },
  );

export const getAccountCloudflareAccess = (accountId: string) =>
  safeInvoke(
    "get_account_cloudflare_access",
    { response: CloudflareAccessMetadataSchema, args: getAccountCloudflareAccessArgs },
    { accountId },
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
