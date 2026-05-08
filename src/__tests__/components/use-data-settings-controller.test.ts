import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openLogDir } from "@/api/tauri-commands";
import {
  formatBytes,
  useDataSettingsController,
} from "@/components/settings/hooks/use-data-settings-controller";

vi.mock("@/api/tauri-commands", () => ({
  getDatabaseInfo: vi.fn(async () =>
    Result.succeed({ total_size_bytes: 1024 }),
  ),
  openLogDir: vi.fn(async () => Result.succeed(null)),
  vacuumDatabase: vi.fn(async () => Result.succeed({ total_size_bytes: 512 })),
}));

describe("formatBytes", () => {
  it("formats byte, kibibyte, and mebibyte values for data settings", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("useDataSettingsController", () => {
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
