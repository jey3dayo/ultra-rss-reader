import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabaseInfo, openLogDir, vacuumDatabase } from "@/api/tauri-commands";
import { formatBytes, useDataSettingsController } from "@/components/settings/hooks/use-data-settings-controller";

vi.mock("@/api/tauri-commands", () => ({
  getDatabaseInfo: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      total_size_bytes: 1024,
    }),
  ),
  openLogDir: vi.fn(async () => Result.succeed(null)),
  vacuumDatabase: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 512,
      wal_size_bytes: 0,
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
      total_size_bytes: 1024,
    }),
  );
});

describe("formatBytes", () => {
  it("formats byte, kibibyte, and mebibyte values for data settings", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
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

    expect(result.current.databaseSizeValue).toBe("1.0 KB");
  });

  it("reports database size failures separately from loading", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));

    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    expect(result.current.databaseSizeValue).toBe("");
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

  it("clears settings loading when vacuum is still pending during unmount", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
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
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledWith(false);

    await act(async () => {
      resolveVacuum?.();
    });

    expect(setSettingsLoading).toHaveBeenCalledTimes(2);
  });

  it("clears settings loading and suppresses errors when open log directory rejects post-unmount", async () => {
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
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledWith(false);

    await act(async () => {
      rejectOpenLogDir?.(new Error("open log failed"));
    });

    expect(setSettingsLoading).toHaveBeenCalledTimes(2);
    expect(showToast).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
