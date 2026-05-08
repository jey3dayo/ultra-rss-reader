import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabaseInfo, openLogDir } from "@/api/tauri-commands";
import { formatBytes, useDataSettingsController } from "@/components/settings/hooks/use-data-settings-controller";

vi.mock("@/api/tauri-commands", () => ({
  getDatabaseInfo: vi.fn(async () =>
    Result.succeed({ db_size_bytes: 1024, wal_size_bytes: 0, total_size_bytes: 1024 }),
  ),
  openLogDir: vi.fn(async () => Result.succeed(null)),
  vacuumDatabase: vi.fn(async () => Result.succeed({ db_size_bytes: 512, wal_size_bytes: 0, total_size_bytes: 512 })),
}));

beforeEach(() => {
  vi.mocked(getDatabaseInfo).mockResolvedValue(
    Result.succeed({ db_size_bytes: 1024, wal_size_bytes: 0, total_size_bytes: 1024 }),
  );
});

describe("formatBytes", () => {
  it("formats byte, kibibyte, and mebibyte values for data settings", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("useDataSettingsController", () => {
  it("reports loading and ready database size states without using placeholder text as state", async () => {
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast: vi.fn(),
        setSettingsLoading: vi.fn(),
      }),
    );

    expect(result.current.databaseSizeStatus).toBe("loading");
    expect(result.current.databaseSizeValue).toBe("");

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    expect(result.current.databaseSizeValue).toBe("1.0 KB");
  });

  it("reports database size failures separately from loading", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));

    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast: vi.fn(),
        setSettingsLoading: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    expect(result.current.databaseSizeValue).toBe("");
  });

  it("delegates log directory opening to the native command", async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast,
        setSettingsLoading: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleOpenLogDir();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });
});
