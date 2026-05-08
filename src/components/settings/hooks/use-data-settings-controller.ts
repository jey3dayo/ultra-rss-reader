import { Result } from "@praha/byethrow";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useReducer } from "react";
import { getDatabaseInfo, openLogDir, vacuumDatabase } from "@/api/tauri-commands";
import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, DATA_SIZE_FRACTION_DIGITS } from "@/constants/data-size";

type UseDataSettingsControllerParams = {
  t: TFunction<"settings">;
  showToast: (message: string) => void;
  setSettingsLoading: (loading: boolean) => void;
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

export function formatBytes(bytes: number): string {
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
  const [state, dispatch] = useReducer(dataSettingsControllerReducer, initialDataSettingsControllerState);
  const { databaseSizeStatus, totalSize, vacuuming, openingLogDir } = state;

  const fetchDbInfo = useCallback(async () => {
    Result.pipe(
      await getDatabaseInfo(),
      Result.inspect((info) =>
        dispatch({
          type: "set-database-size-ready",
          value: info.total_size_bytes,
        }),
      ),
      Result.inspectError((error) => {
        console.error("Failed to get database info:", error);
        dispatch({ type: "set-database-size-error" });
      }),
    );
  }, []);

  useEffect(() => {
    void fetchDbInfo();
  }, [fetchDbInfo]);

  const handleVacuum = async () => {
    if (vacuuming || openingLogDir) {
      return;
    }

    const sizeBefore = totalSize;
    dispatch({ type: "set-vacuuming", value: true });
    setSettingsLoading(true);
    try {
      Result.pipe(
        await vacuumDatabase(),
        Result.inspect((info) => {
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
          console.error("VACUUM failed:", error);
          showToast(t("data.vacuum_failed", { message: error.message }));
        }),
      );
    } finally {
      dispatch({ type: "set-vacuuming", value: false });
      setSettingsLoading(false);
    }
  };

  const handleOpenLogDir = async () => {
    if (openingLogDir || vacuuming) {
      return;
    }

    dispatch({ type: "set-opening-log-dir", value: true });
    setSettingsLoading(true);
    try {
      Result.pipe(
        await openLogDir(),
        Result.inspectError((error) => {
          console.error("Failed to open log directory:", error);
          showToast(t("data.open_log_dir_failed", { message: error.message }));
        }),
      );
    } finally {
      dispatch({ type: "set-opening-log-dir", value: false });
      setSettingsLoading(false);
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
