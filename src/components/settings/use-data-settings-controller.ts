import { Result } from "@praha/byethrow";
import { openPath } from "@tauri-apps/plugin-opener";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { getDatabaseInfo, getLogDir, vacuumDatabase } from "@/api/tauri-commands";
import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, DATA_SIZE_FRACTION_DIGITS } from "@/constants/data-size";

type UseDataSettingsControllerParams = {
  t: TFunction<"settings">;
  showToast: (message: string) => void;
  setSettingsLoading: (loading: boolean) => void;
};

type UseDataSettingsControllerResult = {
  databaseSizeValue: string;
  vacuuming: boolean;
  handleVacuum: () => Promise<void>;
  handleOpenLogDir: () => Promise<void>;
};

function formatBytes(bytes: number): string {
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
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [vacuuming, setVacuuming] = useState(false);

  const fetchDbInfo = useCallback(async () => {
    Result.pipe(
      await getDatabaseInfo(),
      Result.inspect((info) => setTotalSize(info.total_size_bytes)),
      Result.inspectError((error) => console.error("Failed to get database info:", error)),
    );
  }, []);

  useEffect(() => {
    void fetchDbInfo();
  }, [fetchDbInfo]);

  const handleVacuum = async () => {
    if (vacuuming) {
      return;
    }

    const sizeBefore = totalSize;
    setVacuuming(true);
    setSettingsLoading(true);
    try {
      Result.pipe(
        await vacuumDatabase(),
        Result.inspect((info) => {
          setTotalSize(info.total_size_bytes);
          const saved = sizeBefore != null ? sizeBefore - info.total_size_bytes : 0;
          showToast(t("data.vacuum_success", { saved: saved > 0 ? `-${formatBytes(saved)}` : formatBytes(0) }));
        }),
        Result.inspectError((error) => {
          console.error("VACUUM failed:", error);
          showToast(t("data.vacuum_failed", { message: error.message }));
        }),
      );
    } finally {
      setVacuuming(false);
      setSettingsLoading(false);
    }
  };

  const handleOpenLogDir = async () => {
    Result.pipe(
      await getLogDir(),
      Result.inspect(async (dir) => {
        try {
          await openPath(dir);
        } catch (error) {
          console.error("Failed to open log directory:", error);
          showToast(t("data.open_log_dir_failed", { message: String(error) }));
        }
      }),
      Result.inspectError((error) => {
        console.error("Failed to get log directory:", error);
        showToast(t("data.open_log_dir_failed", { message: error.message }));
      }),
    );
  };

  return {
    databaseSizeValue: totalSize != null ? formatBytes(totalSize) : "…",
    vacuuming,
    handleVacuum,
    handleOpenLogDir,
  };
}
