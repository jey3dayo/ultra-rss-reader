import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { SettingsProfileImportResult } from "@/api/schemas";
import type { AppError } from "@/api/tauri-commands";
import {
  exportSettingsProfile,
  getDatabaseInfo,
  importSettingsProfile,
  openLogDir,
  vacuumDatabase,
} from "@/api/tauri-commands";
import {
  BYTES_PER_KIBIBYTE,
  BYTES_PER_MEBIBYTE,
  DATA_SIZE_FRACTION_DIGITS,
  DATA_SIZE_UNIT_LABELS,
} from "@/constants/data-size";
import { resolveRestoredAccountSelection } from "@/lib/account/account-selection";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import {
  DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY,
  type DatabaseRestoreStorageReconciliationPolicy,
} from "@/schemas/storage";

type UseDataSettingsControllerParams = {
  t: TFunction<"settings">;
  showToast: (message: string) => void;
  setSettingsLoading?: (loading: boolean) => void;
};

type UseDataSettingsControllerResult = {
  databaseSizeStatus: DatabaseSizeStatus;
  databaseSizeValue: string;
  databaseRuntimeRecoverySurface: DatabaseRuntimeRecoverySurface | null;
  vacuuming: boolean;
  openingLogDir: boolean;
  exportingSettingsProfile: boolean;
  importingSettingsProfile: boolean;
  handleVacuum: () => Promise<void>;
  handleOpenLogDir: () => Promise<void>;
  handleExportSettingsProfile: () => Promise<void>;
  handleImportSettingsProfileFile: (file: File) => Promise<void>;
};

export type DatabaseSizeStatus = "loading" | "ready" | "error";

type DataSettingsActionKey = "vacuuming" | "openingLogDir";

export type DatabaseRuntimeFailureKind =
  | "read_corruption"
  | "write_corruption"
  | "migration_failed"
  | "downgrade_blocked"
  | "locked"
  | "permission_denied"
  | "disk_full";

export type DatabaseRuntimeRecoveryMode =
  | "read_only_degraded"
  | "startup_blocked"
  | "retry_when_idle"
  | "user_permission_fix"
  | "free_disk_space";

export type DatabaseRuntimeRecoveryAction =
  | "run_integrity_check"
  | "restore_backup"
  | "preserve_backup_and_restart"
  | "retry"
  | "check_os_permissions"
  | "free_disk_space";

export type DatabaseRecoveryActionSafety = "read_only" | "requires_dry_run" | "requires_explicit_confirmation";

export type DatabaseRuntimeRecoverySurface = {
  failureKind: DatabaseRuntimeFailureKind;
  mode: DatabaseRuntimeRecoveryMode;
  actions: readonly DatabaseRuntimeRecoveryAction[];
  actionSafety: readonly DatabaseRecoveryActionSafety[];
  diagnosticsIdRequired: true;
};

type DatabaseRuntimeOperation = "read" | "write";

type DatabaseRestoreAccount = {
  id: string;
};

type DatabaseRestoreFrontendStateReconciliationParams<T extends DatabaseRestoreAccount> = {
  accounts: readonly T[];
  selectedAccountId: string | null | undefined;
  savedAccountId: string | null | undefined;
  resetReason?: DatabaseRestoreFrontendCacheResetReason;
  queryClient: Pick<QueryClient, "clear">;
  storage: Pick<Storage, "removeItem">;
  restoreAccountSelection: (accountId: string, options: { focusedPane: "list" }) => void;
  clearSelectedAccount: () => void;
  setSelectedAccountPreference: (accountId: string) => void;
  clearSettingsDirtyState?: () => void;
  storagePolicy?: DatabaseRestoreStorageReconciliationPolicy;
};

export type DatabaseRestoreFrontendCacheResetReason = "database-restore" | "private-data-reset";

type DatabaseRestoreFrontendStateReconciliationResult = {
  queryCacheCleared: boolean;
  resetReason: DatabaseRestoreFrontendCacheResetReason;
  removedStorageKeys: readonly string[];
  selectedAccountId: string | null;
  preferenceAccountId: string;
  restartRequired: true;
};

type DataSettingsControllerState = {
  databaseSizeStatus: DatabaseSizeStatus;
  totalSize: number | null;
  databaseRuntimeRecoverySurface: DatabaseRuntimeRecoverySurface | null;
  vacuuming: boolean;
  openingLogDir: boolean;
  exportingSettingsProfile: boolean;
  importingSettingsProfile: boolean;
};

type DataSettingsControllerAction =
  | { type: "set-database-size-ready"; value: number }
  | {
      type: "set-database-size-error";
      recoverySurface: DatabaseRuntimeRecoverySurface | null;
    }
  | {
      type: "set-database-runtime-recovery-surface";
      recoverySurface: DatabaseRuntimeRecoverySurface | null;
    }
  | { type: "set-vacuuming"; value: boolean }
  | { type: "set-opening-log-dir"; value: boolean }
  | { type: "set-exporting-settings-profile"; value: boolean }
  | { type: "set-importing-settings-profile"; value: boolean };

const initialDataSettingsControllerState: DataSettingsControllerState = {
  databaseSizeStatus: "loading",
  totalSize: null,
  databaseRuntimeRecoverySurface: null,
  vacuuming: false,
  openingLogDir: false,
  exportingSettingsProfile: false,
  importingSettingsProfile: false,
};

type DataSettingsActionOwnerId = symbol;

type DataSettingsActionLifecycle = Pick<DataSettingsControllerState, DataSettingsActionKey> & {
  vacuumingOwnerId: DataSettingsActionOwnerId | null;
  lastCompletedVacuumOwnerId: DataSettingsActionOwnerId | null;
};

const dataSettingsActionLifecycle: DataSettingsActionLifecycle = {
  vacuuming: false,
  openingLogDir: false,
  vacuumingOwnerId: null,
  lastCompletedVacuumOwnerId: null,
};

const dataSettingsActionLifecycleListeners = new Set<(lifecycle: DataSettingsActionLifecycle) => void>();

function getDataSettingsActionLifecycle(): DataSettingsActionLifecycle {
  return { ...dataSettingsActionLifecycle };
}

function isDataSettingsActionInFlight(): boolean {
  return dataSettingsActionLifecycle.vacuuming || dataSettingsActionLifecycle.openingLogDir;
}

function subscribeToDataSettingsActionLifecycle(
  listener: (lifecycle: DataSettingsActionLifecycle) => void,
): () => void {
  dataSettingsActionLifecycleListeners.add(listener);
  return () => {
    dataSettingsActionLifecycleListeners.delete(listener);
  };
}

function setDataSettingsActionLifecycle(
  actionKey: DataSettingsActionKey,
  value: boolean,
  ownerId?: DataSettingsActionOwnerId,
): void {
  if (dataSettingsActionLifecycle[actionKey] === value) {
    return;
  }
  dataSettingsActionLifecycle[actionKey] = value;
  if (actionKey === "vacuuming") {
    dataSettingsActionLifecycle.vacuumingOwnerId = value ? (ownerId ?? null) : null;
    dataSettingsActionLifecycle.lastCompletedVacuumOwnerId = value ? null : (ownerId ?? null);
  }
  const lifecycle = getDataSettingsActionLifecycle();
  for (const listener of dataSettingsActionLifecycleListeners) {
    listener(lifecycle);
  }
}

function dataSettingsControllerReducer(
  state: DataSettingsControllerState,
  action: DataSettingsControllerAction,
): DataSettingsControllerState {
  switch (action.type) {
    case "set-database-size-ready":
      return {
        ...state,
        databaseSizeStatus: "ready",
        totalSize: action.value,
        databaseRuntimeRecoverySurface: null,
      };
    case "set-database-size-error":
      return {
        ...state,
        databaseSizeStatus: "error",
        totalSize: null,
        databaseRuntimeRecoverySurface: action.recoverySurface,
      };
    case "set-database-runtime-recovery-surface":
      return {
        ...state,
        databaseRuntimeRecoverySurface: action.recoverySurface,
      };
    case "set-vacuuming":
      return { ...state, vacuuming: action.value };
    case "set-opening-log-dir":
      return { ...state, openingLogDir: action.value };
    case "set-exporting-settings-profile":
      return { ...state, exportingSettingsProfile: action.value };
    case "set-importing-settings-profile":
      return { ...state, importingSettingsProfile: action.value };
    default:
      return state;
  }
}

const SETTINGS_PROFILE_EXPORT_FILENAME = "ultra-rss-reader-settings-profile.json";

function buildSettingsProfileImportSuccessMessage(
  t: TFunction<"settings">,
  result: SettingsProfileImportResult,
): string {
  return t("data.settings_profile_import_success", {
    accountsCreated: result.accounts_created,
    accountsUpdated: result.accounts_updated,
    preferencesImported: result.preferences_imported,
    preferencesSkipped: result.preferences_skipped,
    tagsCreated: result.tags_created,
    tagsUpdated: result.tags_updated,
    muteKeywordsCreated: result.mute_keywords_created,
    muteKeywordsSkipped: result.mute_keywords_skipped,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getAppErrorMessage(error: AppError): string {
  return error.message;
}

function isDatabaseLockedMessage(message: string): boolean {
  return /\b(database is )?(busy|locked)\b/i.test(message);
}

function isPermissionDeniedMessage(message: string): boolean {
  return /permission denied|access denied|readonly database|read-only database/i.test(message);
}

function isDiskFullMessage(message: string): boolean {
  return /disk full|database or disk is full|no space left/i.test(message);
}

function isDatabaseCorruptionMessage(message: string): boolean {
  return /corrupt|malformed|not a database|file is not a database|database disk image is malformed/i.test(message);
}

function isDatabaseDowngradeMessage(message: string): boolean {
  return /newer than this application supports|downgrade startup is blocked/i.test(message);
}

function isDatabaseMigrationMessage(message: string): boolean {
  return /migration error|migration failed|failed migration|schema_version/i.test(message);
}

export function classifyDatabaseRuntimeRecoverySurface(
  error: AppError,
  operation: DatabaseRuntimeOperation,
): DatabaseRuntimeRecoverySurface | null {
  const message = getAppErrorMessage(error);
  if (isDatabaseDowngradeMessage(message)) {
    return {
      failureKind: "downgrade_blocked",
      mode: "startup_blocked",
      actions: ["preserve_backup_and_restart", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseMigrationMessage(message)) {
    return {
      failureKind: "migration_failed",
      mode: "startup_blocked",
      actions: ["preserve_backup_and_restart", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseLockedMessage(message)) {
    return {
      failureKind: "locked",
      mode: "retry_when_idle",
      actions: ["retry"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isPermissionDeniedMessage(message)) {
    return {
      failureKind: "permission_denied",
      mode: "user_permission_fix",
      actions: ["check_os_permissions"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDiskFullMessage(message)) {
    return {
      failureKind: "disk_full",
      mode: "free_disk_space",
      actions: ["free_disk_space"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseCorruptionMessage(message)) {
    return {
      failureKind: operation === "read" ? "read_corruption" : "write_corruption",
      mode: "read_only_degraded",
      actions: ["run_integrity_check", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  return null;
}

function logDatabaseRuntimeRecoverySurface(
  recoverySurface: DatabaseRuntimeRecoverySurface | null,
  operation: DatabaseRuntimeOperation,
  error: AppError,
): void {
  if (recoverySurface === null) {
    return;
  }
  logRuntimeDiagnostic("database-runtime-recovery", "Database runtime recovery surface detected", {
    operation,
    failureKind: recoverySurface.failureKind,
    mode: recoverySurface.mode,
    actions: recoverySurface.actions,
    diagnosticsIdRequired: recoverySurface.diagnosticsIdRequired,
    message: error.message,
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `0 ${DATA_SIZE_UNIT_LABELS.byte}`;
  }
  if (bytes < BYTES_PER_KIBIBYTE) {
    return `${bytes} ${DATA_SIZE_UNIT_LABELS.byte}`;
  }
  if (bytes < BYTES_PER_MEBIBYTE) {
    return `${(bytes / BYTES_PER_KIBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} ${DATA_SIZE_UNIT_LABELS.kibibyte}`;
  }
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} ${DATA_SIZE_UNIT_LABELS.mebibyte}`;
}

export function reconcileDatabaseRestoreFrontendState<T extends DatabaseRestoreAccount>({
  accounts,
  selectedAccountId,
  savedAccountId,
  resetReason = "database-restore",
  queryClient,
  storage,
  restoreAccountSelection,
  clearSelectedAccount,
  setSelectedAccountPreference,
  clearSettingsDirtyState,
  storagePolicy = DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY,
}: DatabaseRestoreFrontendStateReconciliationParams<T>): DatabaseRestoreFrontendStateReconciliationResult {
  queryClient.clear();
  clearSettingsDirtyState?.();

  const removedStorageKeys: string[] = [];
  for (const storageKey of storagePolicy.removeKeys) {
    try {
      storage.removeItem(storageKey);
      removedStorageKeys.push(storageKey);
    } catch {
      // Restore reconciliation must still repair selection even when localStorage is unavailable.
    }
  }

  const accountSelection = resolveRestoredAccountSelection({
    accounts,
    selectedAccountId,
    savedAccountId,
  });

  if (accountSelection.accountId === null) {
    clearSelectedAccount();
  } else {
    restoreAccountSelection(accountSelection.accountId, {
      focusedPane: "list",
    });
  }
  setSelectedAccountPreference(accountSelection.preferenceAccountId);

  return {
    queryCacheCleared: true,
    resetReason,
    removedStorageKeys,
    selectedAccountId: accountSelection.accountId,
    preferenceAccountId: accountSelection.preferenceAccountId,
    restartRequired: true,
  };
}

export function useDataSettingsController({
  t,
  showToast,
  setSettingsLoading,
}: UseDataSettingsControllerParams): UseDataSettingsControllerResult {
  const [state, dispatch] = useReducer(dataSettingsControllerReducer, {
    ...initialDataSettingsControllerState,
    ...getDataSettingsActionLifecycle(),
  });
  const { databaseSizeStatus, totalSize, databaseRuntimeRecoverySurface, vacuuming, openingLogDir } = state;
  const { exportingSettingsProfile, importingSettingsProfile } = state;
  const controllerIdRef = useRef<DataSettingsActionOwnerId>(Symbol("data-settings-controller"));
  const databaseSizeRequestRevisionRef = useRef(0);
  const mountedRef = useRef(false);
  const pendingSettingsProfileExportUrlRef = useRef<string | null>(null);
  const pendingSettingsProfileExportUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokePendingSettingsProfileExportUrl = useCallback(() => {
    if (pendingSettingsProfileExportUrlTimerRef.current !== null) {
      clearTimeout(pendingSettingsProfileExportUrlTimerRef.current);
      pendingSettingsProfileExportUrlTimerRef.current = null;
    }
    if (pendingSettingsProfileExportUrlRef.current !== null) {
      URL.revokeObjectURL(pendingSettingsProfileExportUrlRef.current);
      pendingSettingsProfileExportUrlRef.current = null;
    }
  }, []);

  const isActiveDatabaseSizeRequest = useCallback((requestRevision: number) => {
    return mountedRef.current && requestRevision === databaseSizeRequestRevisionRef.current;
  }, []);

  const fetchDbInfo = useCallback(async () => {
    databaseSizeRequestRevisionRef.current += 1;
    const requestRevision = databaseSizeRequestRevisionRef.current;
    try {
      Result.pipe(
        await getDatabaseInfo(),
        Result.inspect((info) => {
          if (!isActiveDatabaseSizeRequest(requestRevision)) {
            return;
          }
          dispatch({
            type: "set-database-size-ready",
            value: info.total_size_bytes,
          });
        }),
        Result.inspectError((error) => {
          if (!isActiveDatabaseSizeRequest(requestRevision)) {
            return;
          }
          const recoverySurface = classifyDatabaseRuntimeRecoverySurface(error, "read");
          logDatabaseRuntimeRecoverySurface(recoverySurface, "read", error);
          console.error("Failed to get database info:", error);
          dispatch({ type: "set-database-size-error", recoverySurface });
        }),
      );
    } catch (error) {
      if (!isActiveDatabaseSizeRequest(requestRevision)) {
        return;
      }
      console.error("Failed to get database info:", error);
      dispatch({ type: "set-database-size-error", recoverySurface: null });
    }
  }, [isActiveDatabaseSizeRequest]);

  useEffect(() => {
    mountedRef.current = true;
    let previousLifecycle = getDataSettingsActionLifecycle();
    const unsubscribeFromActionLifecycle = subscribeToDataSettingsActionLifecycle((lifecycle) => {
      dispatch({ type: "set-vacuuming", value: lifecycle.vacuuming });
      dispatch({
        type: "set-opening-log-dir",
        value: lifecycle.openingLogDir,
      });
      if (
        previousLifecycle.vacuuming &&
        !lifecycle.vacuuming &&
        lifecycle.lastCompletedVacuumOwnerId !== controllerIdRef.current
      ) {
        void fetchDbInfo();
      }
      previousLifecycle = lifecycle;
    });
    void fetchDbInfo();
    return () => {
      mountedRef.current = false;
      databaseSizeRequestRevisionRef.current += 1;
      unsubscribeFromActionLifecycle();
      revokePendingSettingsProfileExportUrl();
    };
  }, [fetchDbInfo, revokePendingSettingsProfileExportUrl]);

  const handleVacuum = async () => {
    if (!mountedRef.current || databaseSizeStatus !== "ready" || isDataSettingsActionInFlight()) {
      return;
    }

    setDataSettingsActionLifecycle("vacuuming", true, controllerIdRef.current);
    const sizeBefore = totalSize;
    databaseSizeRequestRevisionRef.current += 1;
    const requestRevision = databaseSizeRequestRevisionRef.current;
    setSettingsLoading?.(true);
    dispatch({ type: "set-vacuuming", value: true });
    try {
      Result.pipe(
        await vacuumDatabase(),
        Result.inspect((info) => {
          if (!isActiveDatabaseSizeRequest(requestRevision)) {
            return;
          }
          dispatch({
            type: "set-database-size-ready",
            value: info.total_size_bytes,
          });
          const saved = sizeBefore != null ? sizeBefore - info.total_size_bytes : 0;
          showToast(
            t("data.vacuum_success", {
              saved: saved > 0 ? `-${formatBytes(saved)}` : formatBytes(0),
            }),
          );
        }),
        Result.inspectError((error) => {
          if (!mountedRef.current) {
            return;
          }
          const recoverySurface = classifyDatabaseRuntimeRecoverySurface(error, "write");
          logDatabaseRuntimeRecoverySurface(recoverySurface, "write", error);
          dispatch({
            type: "set-database-runtime-recovery-surface",
            recoverySurface,
          });
          console.error("VACUUM failed:", error);
          showToast(t("data.vacuum_failed", { message: error.message }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("VACUUM failed:", error);
        showToast(t("data.vacuum_failed", { message: getErrorMessage(error) }));
      }
    } finally {
      setDataSettingsActionLifecycle("vacuuming", false, controllerIdRef.current);
      setSettingsLoading?.(false);
    }
  };

  const handleOpenLogDir = async () => {
    if (!mountedRef.current || isDataSettingsActionInFlight()) {
      return;
    }

    setDataSettingsActionLifecycle("openingLogDir", true);
    setSettingsLoading?.(true);
    dispatch({ type: "set-opening-log-dir", value: true });
    try {
      Result.pipe(
        await openLogDir(),
        Result.inspectError((error) => {
          if (!mountedRef.current) {
            return;
          }
          console.error("Failed to open log directory:", error);
          showToast(t("data.open_log_dir_failed", { message: error.message }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to open log directory:", error);
        showToast(t("data.open_log_dir_failed", { message: getErrorMessage(error) }));
      }
    } finally {
      setDataSettingsActionLifecycle("openingLogDir", false);
      setSettingsLoading?.(false);
    }
  };

  const handleExportSettingsProfile = async () => {
    if (!mountedRef.current || exportingSettingsProfile || importingSettingsProfile || isDataSettingsActionInFlight()) {
      return;
    }

    dispatch({ type: "set-exporting-settings-profile", value: true });
    setSettingsLoading?.(true);
    try {
      Result.pipe(
        await exportSettingsProfile(),
        Result.inspect((profileJson) => {
          if (!mountedRef.current) {
            return;
          }
          const blob = new Blob([profileJson], { type: "application/json" });
          revokePendingSettingsProfileExportUrl();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = SETTINGS_PROFILE_EXPORT_FILENAME;
          pendingSettingsProfileExportUrlRef.current = url;
          try {
            anchor.click();
            pendingSettingsProfileExportUrlTimerRef.current = setTimeout(() => {
              revokePendingSettingsProfileExportUrl();
            }, 1000);
            showToast(t("data.settings_profile_export_success"));
          } catch {
            revokePendingSettingsProfileExportUrl();
          }
        }),
        Result.inspectError((error) => {
          if (!mountedRef.current) {
            return;
          }
          console.error("Failed to export settings profile:", error);
          showToast(t("data.settings_profile_export_failed", { message: error.message }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to export settings profile:", error);
        showToast(t("data.settings_profile_export_failed", { message: getErrorMessage(error) }));
      }
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "set-exporting-settings-profile", value: false });
      }
      setSettingsLoading?.(false);
    }
  };

  const handleImportSettingsProfileFile = async (file: File) => {
    if (!mountedRef.current || exportingSettingsProfile || importingSettingsProfile || isDataSettingsActionInFlight()) {
      return;
    }

    dispatch({ type: "set-importing-settings-profile", value: true });
    setSettingsLoading?.(true);
    try {
      const profileJson = await file.text();
      Result.pipe(
        await importSettingsProfile(profileJson),
        Result.inspect((importResult) => {
          if (!mountedRef.current) {
            return;
          }
          showToast(buildSettingsProfileImportSuccessMessage(t, importResult));
          void fetchDbInfo();
        }),
        Result.inspectError((error) => {
          if (!mountedRef.current) {
            return;
          }
          console.error("Failed to import settings profile:", error);
          showToast(t("data.settings_profile_import_failed", { message: error.message }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to import settings profile:", error);
        showToast(t("data.settings_profile_import_failed", { message: getErrorMessage(error) }));
      }
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "set-importing-settings-profile", value: false });
      }
      setSettingsLoading?.(false);
    }
  };

  return {
    databaseSizeStatus,
    databaseSizeValue: totalSize != null ? formatBytes(totalSize) : "",
    databaseRuntimeRecoverySurface,
    vacuuming,
    openingLogDir,
    exportingSettingsProfile,
    importingSettingsProfile,
    handleVacuum,
    handleOpenLogDir,
    handleExportSettingsProfile,
    handleImportSettingsProfileFile,
  };
}
