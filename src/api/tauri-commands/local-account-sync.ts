import {
  exportLocalAccountSyncOperationsArgs,
  getLocalAccountSyncSettingsArgs,
  importLocalAccountSyncOperationsArgs,
  LocalAccountSyncExportReportDtoSchema,
  LocalAccountSyncImportReportDtoSchema,
  LocalAccountSyncSettingsDtoSchema,
  setLocalAccountSyncSettingsArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const getLocalAccountSyncSettings = (accountId: string) =>
  safeInvoke(
    "get_local_account_sync_settings",
    {
      response: LocalAccountSyncSettingsDtoSchema.nullable(),
      args: getLocalAccountSyncSettingsArgs,
    },
    { accountId },
  );

export const setLocalAccountSyncSettings = (accountId: string, syncFolderPath: string, enabled: boolean) =>
  safeInvoke(
    "set_local_account_sync_settings",
    {
      response: LocalAccountSyncSettingsDtoSchema,
      args: setLocalAccountSyncSettingsArgs,
    },
    { accountId, syncFolderPath, enabled },
  );

export const exportLocalAccountSyncOperations = (accountId: string) =>
  safeInvoke(
    "export_local_account_sync_operations",
    {
      response: LocalAccountSyncExportReportDtoSchema,
      args: exportLocalAccountSyncOperationsArgs,
    },
    { accountId },
  );

export const importLocalAccountSyncOperations = (accountId: string) =>
  safeInvoke(
    "import_local_account_sync_operations",
    {
      response: LocalAccountSyncImportReportDtoSchema,
      args: importLocalAccountSyncOperationsArgs,
    },
    { accountId },
  );
