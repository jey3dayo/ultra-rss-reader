import { Result } from "@praha/byethrow";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { SettingsProfileImportResult } from "@/api/schemas";
import type { AppError } from "@/api/tauri-commands";
import {
  backupDatabase,
  exportSettingsProfileToFile,
  getDatabaseInfo,
  importSettingsProfile,
  openLogDir,
  vacuumDatabase,
} from "@/api/tauri-commands";
import { showSaveDialog } from "@/lib/platform/save-dialog";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import {
  classifyDatabaseRuntimeRecoverySurface,
  type DatabaseRuntimeRecoverySurface,
  type DatabaseSizeStatus,
  formatBytes,
  logDatabaseRuntimeRecoverySurface,
} from "./recovery";

export type {
  DatabaseRecoveryActionSafety,
  DatabaseRuntimeFailureKind,
  DatabaseRuntimeRecoveryAction,
  DatabaseRuntimeRecoveryMode,
  DatabaseRuntimeRecoverySurface,
  DatabaseSizeStatus,
} from "./recovery";
export { classifyDatabaseRuntimeRecoverySurface, formatBytes } from "./recovery";
export type { DatabaseRestoreFrontendCacheResetReason } from "./restore-reconciliation";
export { reconcileDatabaseRestoreFrontendState } from "./restore-reconciliation";

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
  backingUp: boolean;
  openingLogDir: boolean;
  exportingSettingsProfile: boolean;
  importingSettingsProfile: boolean;
  handleVacuum: () => Promise<void>;
  handleBackupDatabase: () => Promise<void>;
  handleOpenLogDir: () => Promise<void>;
  handleExportSettingsProfile: () => Promise<void>;
  handleImportSettingsProfileFile: (file: File) => Promise<void>;
};

type DataSettingsActionKey = "vacuuming" | "openingLogDir";

type DataSettingsControllerState = {
  databaseSizeStatus: DatabaseSizeStatus;
  totalSize: number | null;
  databaseRuntimeRecoverySurface: DatabaseRuntimeRecoverySurface | null;
  vacuuming: boolean;
  backingUp: boolean;
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
  | { type: "set-backing-up"; value: boolean }
  | { type: "set-opening-log-dir"; value: boolean }
  | { type: "set-exporting-settings-profile"; value: boolean }
  | { type: "set-importing-settings-profile"; value: boolean };

const initialDataSettingsControllerState: DataSettingsControllerState = {
  databaseSizeStatus: "loading",
  totalSize: null,
  databaseRuntimeRecoverySurface: null,
  vacuuming: false,
  backingUp: false,
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
    case "set-backing-up":
      return { ...state, backingUp: action.value };
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

function getUserFacingAppErrorMessage(error: AppError): string {
  return localizeUserVisibleAppErrorMessage(error.message);
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
  const { exportingSettingsProfile, importingSettingsProfile, backingUp } = state;
  const controllerIdRef = useRef<DataSettingsActionOwnerId>(Symbol("data-settings-controller"));
  const databaseSizeRequestRevisionRef = useRef(0);
  const mountedRef = useRef(false);

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
    };
  }, [fetchDbInfo]);

  const handleVacuum = async () => {
    if (!mountedRef.current || databaseSizeStatus !== "ready" || backingUp || isDataSettingsActionInFlight()) {
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
          showToast(t("data.vacuum_failed", { message: getUserFacingAppErrorMessage(error) }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("VACUUM failed:", error);
        showToast(t("data.vacuum_failed", { message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)) }));
      }
    } finally {
      setDataSettingsActionLifecycle("vacuuming", false, controllerIdRef.current);
      setSettingsLoading?.(false);
    }
  };

  const handleBackupDatabase = async () => {
    if (
      !mountedRef.current ||
      backingUp ||
      exportingSettingsProfile ||
      importingSettingsProfile ||
      isDataSettingsActionInFlight()
    ) {
      return;
    }

    dispatch({ type: "set-backing-up", value: true });
    setSettingsLoading?.(true);
    try {
      Result.pipe(
        await backupDatabase(),
        Result.inspect(() => {
          if (!mountedRef.current) {
            return;
          }
          showToast(t("data.backup_success"));
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
          console.error("Database backup failed:", error);
          showToast(t("data.backup_failed", { message: getUserFacingAppErrorMessage(error) }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Database backup failed:", error);
        showToast(t("data.backup_failed", { message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)) }));
      }
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "set-backing-up", value: false });
      }
      setSettingsLoading?.(false);
    }
  };

  const handleOpenLogDir = async () => {
    if (!mountedRef.current || backingUp || isDataSettingsActionInFlight()) {
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
          showToast(t("data.open_log_dir_failed", { message: getUserFacingAppErrorMessage(error) }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to open log directory:", error);
        showToast(
          t("data.open_log_dir_failed", { message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)) }),
        );
      }
    } finally {
      setDataSettingsActionLifecycle("openingLogDir", false);
      setSettingsLoading?.(false);
    }
  };

  const handleExportSettingsProfile = async () => {
    if (
      !mountedRef.current ||
      backingUp ||
      exportingSettingsProfile ||
      importingSettingsProfile ||
      isDataSettingsActionInFlight()
    ) {
      return;
    }

    dispatch({ type: "set-exporting-settings-profile", value: true });
    setSettingsLoading?.(true);
    try {
      const path = await showSaveDialog({
        defaultPath: SETTINGS_PROFILE_EXPORT_FILENAME,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path === null || !mountedRef.current) {
        return;
      }
      Result.pipe(
        await exportSettingsProfileToFile(path),
        Result.inspect(() => {
          if (!mountedRef.current) {
            return;
          }
          showToast(t("data.settings_profile_export_success"));
        }),
        Result.inspectError((error) => {
          if (!mountedRef.current) {
            return;
          }
          console.error("Failed to export settings profile:", error);
          showToast(t("data.settings_profile_export_failed", { message: getUserFacingAppErrorMessage(error) }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to export settings profile:", error);
        showToast(
          t("data.settings_profile_export_failed", {
            message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)),
          }),
        );
      }
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "set-exporting-settings-profile", value: false });
      }
      setSettingsLoading?.(false);
    }
  };

  const handleImportSettingsProfileFile = async (file: File) => {
    if (
      !mountedRef.current ||
      backingUp ||
      exportingSettingsProfile ||
      importingSettingsProfile ||
      isDataSettingsActionInFlight()
    ) {
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
          showToast(t("data.settings_profile_import_failed", { message: getUserFacingAppErrorMessage(error) }));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to import settings profile:", error);
        showToast(
          t("data.settings_profile_import_failed", {
            message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)),
          }),
        );
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
    backingUp,
    openingLogDir,
    exportingSettingsProfile,
    importingSettingsProfile,
    handleVacuum,
    handleBackupDatabase,
    handleOpenLogDir,
    handleExportSettingsProfile,
    handleImportSettingsProfileFile,
  };
}
