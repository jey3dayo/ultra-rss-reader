import { Result } from "@praha/byethrow";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getDatabaseInfo, openLogDir, vacuumDatabase } from "@/api/tauri-commands";
import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, DATA_SIZE_FRACTION_DIGITS } from "@/constants/data-size";

type UseDataSettingsControllerParams = {
  t: TFunction<"settings">;
  showToast: (message: string) => void;
  setSettingsLoading?: (loading: boolean) => void;
};

type UseDataSettingsControllerResult = {
  databaseSizeStatus: DatabaseSizeStatus;
  databaseSizeValue: string;
  vacuuming: boolean;
  openingLogDir: boolean;
  handleVacuum: () => Promise<void>;
  handleOpenLogDir: () => Promise<void>;
};

export type DatabaseSizeStatus = "loading" | "ready" | "error";

type DataSettingsActionKey = "vacuuming" | "openingLogDir";

type DataSettingsControllerState = {
  databaseSizeStatus: DatabaseSizeStatus;
  totalSize: number | null;
  vacuuming: boolean;
  openingLogDir: boolean;
};

type DataSettingsControllerAction =
  | { type: "set-database-size-ready"; value: number }
  | { type: "set-database-size-error" }
  | { type: "set-vacuuming"; value: boolean }
  | { type: "set-opening-log-dir"; value: boolean };

const initialDataSettingsControllerState: DataSettingsControllerState = {
  databaseSizeStatus: "loading",
  totalSize: null,
  vacuuming: false,
  openingLogDir: false,
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
      return { ...state, databaseSizeStatus: "ready", totalSize: action.value };
    case "set-database-size-error":
      return { ...state, databaseSizeStatus: "error", totalSize: null };
    case "set-vacuuming":
      return { ...state, vacuuming: action.value };
    case "set-opening-log-dir":
      return { ...state, openingLogDir: action.value };
    default:
      return state;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < BYTES_PER_KIBIBYTE) {
    return `${bytes} B`;
  }
  if (bytes < BYTES_PER_MEBIBYTE) {
    return `${(bytes / BYTES_PER_KIBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} KB`;
  }
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} MB`;
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
  const { databaseSizeStatus, totalSize, vacuuming, openingLogDir } = state;
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
          console.error("Failed to get database info:", error);
          dispatch({ type: "set-database-size-error" });
        }),
      );
    } catch (error) {
      if (!isActiveDatabaseSizeRequest(requestRevision)) {
        return;
      }
      console.error("Failed to get database info:", error);
      dispatch({ type: "set-database-size-error" });
    }
  }, [isActiveDatabaseSizeRequest]);

  useEffect(() => {
    mountedRef.current = true;
    let previousLifecycle = getDataSettingsActionLifecycle();
    const unsubscribeFromActionLifecycle = subscribeToDataSettingsActionLifecycle((lifecycle) => {
      dispatch({ type: "set-vacuuming", value: lifecycle.vacuuming });
      dispatch({ type: "set-opening-log-dir", value: lifecycle.openingLogDir });
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
    if (!mountedRef.current || isDataSettingsActionInFlight()) {
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

  return {
    databaseSizeStatus,
    databaseSizeValue: totalSize != null ? formatBytes(totalSize) : "",
    vacuuming,
    openingLogDir,
    handleVacuum,
    handleOpenLogDir,
  };
}
