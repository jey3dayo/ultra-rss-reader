import {
  BooleanResponseSchema,
  DatabaseInfoDtoSchema,
  DevRuntimeOptionsSchema,
  NullResponseSchema,
  PlatformInfoSchema,
  PlatformPermissionDeniedRecoveryListSchema,
  UpdateInfoDtoSchema,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const getPlatformInfo = () => safeInvoke("get_platform_info", { response: PlatformInfoSchema });
export const getDevRuntimeOptions = () => safeInvoke("get_dev_runtime_options", { response: DevRuntimeOptionsSchema });
export const getPlatformPermissionDeniedRecovery = () =>
  safeInvoke("get_platform_permission_denied_recovery", {
    response: PlatformPermissionDeniedRecoveryListSchema,
  });
export const resetOversizedDevCredentialsStore = () =>
  safeInvoke("reset_oversized_dev_credentials_store", {
    response: BooleanResponseSchema,
  });

// Updater
export const checkForUpdate = () => safeInvoke("check_for_update", { response: UpdateInfoDtoSchema.nullable() });

export const downloadAndInstallUpdate = () =>
  safeInvoke("download_and_install_update", { response: NullResponseSchema });

export const restartApp = () => safeInvoke("restart_app", { response: NullResponseSchema });

// Database
export const getDatabaseInfo = () => safeInvoke("get_database_info", { response: DatabaseInfoDtoSchema });

export const vacuumDatabase = () => safeInvoke("vacuum_database", { response: DatabaseInfoDtoSchema });

// Logs
export const openLogDir = () => safeInvoke("open_log_dir", { response: NullResponseSchema });
