import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseInfoDtoSchema } from "@/api/schemas/database-info";
import { getDatabaseInfo, openLogDir, vacuumDatabase } from "@/api/tauri-commands";
import { formatBytes, useDataSettingsController } from "@/components/settings/hooks/use-data-settings-controller";

vi.mock("@/api/tauri-commands", () => ({
  getDatabaseInfo: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    }),
  ),
  openLogDir: vi.fn(async () => Result.succeed(null)),
  vacuumDatabase: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 512,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 512,
    }),
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDatabaseInfo).mockResolvedValue(
    Result.succeed({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    }),
  );
});

describe("formatBytes", () => {
  it("formats byte, kibibyte, and mebibyte values for data settings", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KiB");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
  });

  it("falls back to 0 B for invalid database size DTO values", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 B");
  });
});

describe("useDataSettingsController", () => {
  const renderDataSettingsController = ({
    setSettingsLoading = vi.fn(),
    showToast = vi.fn(),
  }: {
    setSettingsLoading?: (loading: boolean) => void;
    showToast?: (message: string) => void;
  } = {}) =>
    renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast,
        setSettingsLoading,
      }),
    );

  it("reports loading and ready database size states without using placeholder text as state", async () => {
    const { result } = renderDataSettingsController();

    expect(result.current.databaseSizeStatus).toBe("loading");
    expect(result.current.databaseSizeValue).toBe("");

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    expect(result.current.databaseSizeValue).toBe("1.0 KiB");
  });

  it("uses schema-validated total size including WAL and SHM for display and vacuum saved copy", async () => {
    const initialInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 1024,
      wal_size_bytes: 256,
      shm_size_bytes: 128,
      total_size_bytes: 1408,
    });
    const vacuumedInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 768,
      wal_size_bytes: 256,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    });
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.succeed(initialInfo));
    vi.mocked(vacuumDatabase).mockResolvedValue(Result.succeed(vacuumedInfo));
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { saved?: string }) =>
          key === "data.vacuum_success" ? `Saved ${options?.saved ?? ""}` : key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });
    expect(result.current.databaseSizeValue).toBe("1.4 KiB");

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseSizeValue).toBe("1.0 KiB");
    expect(showToast).toHaveBeenCalledWith("Saved -384 B");
  });

  it("clamps vacuum saved copy when the database grows after cleanup", async () => {
    const initialInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    });
    const vacuumedInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 2048,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 2048,
    });
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.succeed(initialInfo));
    vi.mocked(vacuumDatabase).mockResolvedValue(Result.succeed(vacuumedInfo));
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { saved?: string }) =>
          key === "data.vacuum_success" ? `Saved ${options?.saved ?? ""}` : key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseSizeValue).toBe("2.0 KiB");
    expect(showToast).toHaveBeenCalledWith("Saved 0 B");
  });

  it("reports database size failures separately from loading", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));

    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    expect(result.current.databaseSizeValue).toBe("");
  });

  it("does not run vacuum while database size is unavailable", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));
    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(vacuumDatabase).not.toHaveBeenCalled();
  });

  it("delegates log directory opening to the native command", async () => {
    const showToast = vi.fn();
    const { result } = renderDataSettingsController({ showToast });

    await act(async () => {
      await result.current.handleOpenLogDir();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows non-duplicated copy when opening the log directory fails", async () => {
    vi.mocked(openLogDir).mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "Check OS permissions and try again." }),
    );
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { message?: string }) =>
          key === "data.open_log_dir_failed"
            ? `Failed to open log directory: ${options?.message ?? ""}`
            : key) as never,
        showToast,
        setSettingsLoading: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleOpenLogDir();
    });

    expect(showToast).toHaveBeenCalledWith("Failed to open log directory: Check OS permissions and try again.");
    expect(showToast.mock.calls[0]?.[0].match(/Failed to open log directory/g)).toHaveLength(1);
  });

  it("tracks log directory pending state and suppresses duplicate data actions", async () => {
    let resolveOpenLogDir: (() => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((resolve) => {
        resolveOpenLogDir = () => resolve(Result.succeed(null));
      }),
    );
    const { result } = renderDataSettingsController();

    await act(async () => {
      void result.current.handleOpenLogDir();
    });

    expect(result.current.openingLogDir).toBe(true);

    await act(async () => {
      void result.current.handleOpenLogDir();
      void result.current.handleVacuum();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);
    expect(vacuumDatabase).not.toHaveBeenCalled();

    await act(async () => {
      resolveOpenLogDir?.();
    });

    expect(result.current.openingLogDir).toBe(false);
  });

  it("suppresses duplicate vacuum commands from the same render closure", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const { result } = renderDataSettingsController();
    const { handleVacuum } = result.current;

    await act(async () => {
      void handleVacuum();
      void handleVacuum();
    });

    expect(vacuumDatabase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });
  });

  it("keeps vacuum action in flight across settings close and reopen", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const first = renderDataSettingsController();

    await act(async () => {
      void first.result.current.handleVacuum();
    });

    expect(first.result.current.vacuuming).toBe(true);
    first.unmount();

    const second = renderDataSettingsController();

    expect(second.result.current.vacuuming).toBe(true);

    await act(async () => {
      void second.result.current.handleVacuum();
    });

    expect(vacuumDatabase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });

    expect(second.result.current.vacuuming).toBe(false);
  });

  it("refreshes reopened database size after a pending vacuum completes", async () => {
    let resolveFirstDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolveReopenedDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolvePostVacuumDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(getDatabaseInfo)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstDatabaseInfo = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReopenedDatabaseInfo = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePostVacuumDatabaseInfo = resolve;
        }),
      );
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const first = renderDataSettingsController();

    await act(async () => {
      resolveFirstDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 1024,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 1024,
        }),
      );
    });

    await act(async () => {
      void first.result.current.handleVacuum();
    });

    first.unmount();
    const second = renderDataSettingsController();

    expect(second.result.current.vacuuming).toBe(true);

    await act(async () => {
      resolveReopenedDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 1024,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 1024,
        }),
      );
    });

    expect(second.result.current.databaseSizeValue).toBe("1.0 KiB");

    await act(async () => {
      resolveVacuum?.();
    });

    expect(second.result.current.vacuuming).toBe(false);
    expect(getDatabaseInfo).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolvePostVacuumDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 512,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 512,
        }),
      );
    });

    expect(second.result.current.databaseSizeValue).toBe("512 B");
  });

  it("ignores stale database size fetch responses after cleanup updates the size", async () => {
    let resolveDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((resolve) => {
        resolveDatabaseInfo = resolve;
      }),
    );
    vi.mocked(vacuumDatabase).mockResolvedValue(
      Result.succeed({
        db_size_bytes: 512,
        wal_size_bytes: 0,
        shm_size_bytes: 0,
        total_size_bytes: 512,
      }),
    );
    const { result } = renderDataSettingsController();

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseSizeStatus).toBe("ready");
    expect(result.current.databaseSizeValue).toBe("512 B");

    await act(async () => {
      resolveDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 4096,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 4096,
        }),
      );
    });

    expect(result.current.databaseSizeStatus).toBe("ready");
    expect(result.current.databaseSizeValue).toBe("512 B");
  });

  it("suppresses duplicate open log directory commands from the same render closure", async () => {
    let resolveOpenLogDir: (() => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((resolve) => {
        resolveOpenLogDir = () => resolve(Result.succeed(null));
      }),
    );
    const { result } = renderDataSettingsController();
    const { handleOpenLogDir } = result.current;

    await act(async () => {
      void handleOpenLogDir();
      void handleOpenLogDir();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveOpenLogDir?.();
    });
  });

  it("ignores initial database info resolution after unmount", async () => {
    let resolveDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((resolve) => {
        resolveDatabaseInfo = resolve;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderDataSettingsController();

    unmount();

    await act(async () => {
      resolveDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 4096,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 4096,
        }),
      );
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("ignores initial database info rejection after unmount", async () => {
    let rejectDatabaseInfo: ((error: Error) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((_, reject) => {
        rejectDatabaseInfo = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderDataSettingsController();

    unmount();

    await act(async () => {
      rejectDatabaseInfo?.(new Error("db transport failed"));
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("syncs vacuum loading with settings-wide loading while pending across unmount", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const setSettingsLoading = vi.fn();
    const { result, unmount } = renderDataSettingsController({
      setSettingsLoading,
    });

    await act(async () => {
      void result.current.handleVacuum();
    });
    expect(result.current.vacuuming).toBe(true);
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });

    expect(setSettingsLoading).toHaveBeenLastCalledWith(false);
  });

  it("syncs open log loading with settings-wide loading and suppresses post-unmount errors", async () => {
    let rejectOpenLogDir: ((error: Error) => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((_, reject) => {
        rejectOpenLogDir = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setSettingsLoading = vi.fn();
    const showToast = vi.fn();
    const { result, unmount } = renderDataSettingsController({
      setSettingsLoading,
      showToast,
    });

    await act(async () => {
      void result.current.handleOpenLogDir();
    });
    expect(result.current.openingLogDir).toBe(true);
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectOpenLogDir?.(new Error("open log failed"));
    });

    expect(setSettingsLoading).toHaveBeenLastCalledWith(false);
    expect(showToast).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
