import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOpmlExportFilename,
  useAccountDetailDangerZone,
} from "@/components/settings/hooks/account-detail/use-account-detail-danger-zone";
import { useUiStore } from "@/stores/ui-store";

const { deleteAccountMock, exportOpmlMock } = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  exportOpmlMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  deleteAccount: deleteAccountMock,
  exportOpml: exportOpmlMock,
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe("useAccountDetailDangerZone", () => {
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined;
  const t = i18n.getFixedT("en", "settings");

  beforeEach(() => {
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:opml"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    exportOpmlMock.mockReset();
    deleteAccountMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("builds a safe OPML filename and falls back when the account name is empty or only forbidden characters", () => {
    expect(buildOpmlExportFilename("FreshRSS")).toBe("FreshRSS-feeds.opml");
    expect(buildOpmlExportFilename("  ")).toBe("feeds.opml");
    expect(buildOpmlExportFilename('<>:"/\\|?*')).toBe("feeds.opml");
  });

  it("guards repeated OPML exports while the current export is in flight", async () => {
    const exportResult = createDeferred<ReturnType<typeof Result.succeed<string>>>();
    exportOpmlMock.mockReturnValue(exportResult.promise);
    const queryClient = createTestQueryClient();
    const account = { ...sampleAccounts[0], name: '<>:"/\\|?*' };

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account,
        queryClient,
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    let firstExport: Promise<void> | undefined;
    let secondExport: Promise<void> | undefined;
    act(() => {
      firstExport = result.current.handleExportOpml();
      secondExport = result.current.handleExportOpml();
    });

    expect(exportOpmlMock).toHaveBeenCalledTimes(1);
    expect(exportOpmlMock).toHaveBeenCalledWith("acc-1");

    exportResult.resolve(Result.succeed("<opml />"));
    await firstExport;
    await secondExport;

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });
});
