import { Result } from "@praha/byethrow";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleFeeds } from "@tests/helpers/fixtures";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedEditDialogController } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-controller";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

function createOperationClaim() {
  const claimRef = { current: false };
  return {
    claimOperation: () => {
      if (claimRef.current) {
        return false;
      }
      claimRef.current = true;
      return true;
    },
    releaseOperation: () => {
      claimRef.current = false;
    },
  };
}

const { copyTextToClipboardMock } = vi.hoisted(() => ({
  copyTextToClipboardMock: vi.fn(),
}));
const { createFolderMock, renameFeedMock } = vi.hoisted(() => ({
  createFolderMock: vi.fn(),
  renameFeedMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/tauri-commands")>();
  return {
    ...actual,
    createFolder: createFolderMock,
    renameFeed: renameFeedMock,
  };
});

vi.mock("@/lib/runtime/clipboard", () => ({
  copyTextToClipboard: copyTextToClipboardMock,
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-update-feed-display-mode", () => ({
  useUpdateFeedDisplaySettings: () => vi.fn(async () => true),
}));

vi.mock("@/hooks/use-update-feed-folder", () => ({
  useUpdateFeedFolder: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}));

setupBrowserTestDom();

const { i18nTMock } = vi.hoisted(() => ({
  // `localizeUserVisibleAppErrorMessage` imports `@/lib/i18n` directly (not via
  // `useTranslation`), so the react-i18next mock below does not intercept it.
  // Mock the module here too, with output that cannot be confused with the raw
  // backend message, so the regression tests below actually prove the helper ran.
  i18nTMock: vi.fn((key: string) => `translated:${key}`),
}));

vi.mock("@/lib/i18n", () => ({
  default: { t: i18nTMock },
}));

vi.mock("react-i18next", () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: "3rdParty",
    init: () => undefined,
  },
  setI18n: () => undefined,
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; message?: string }) => {
      if (key === "copied_to_clipboard") {
        return "Copied";
      }
      if (key === "title_required") {
        return options?.defaultValue ?? "Title is required";
      }
      if (key === "failed_to_create_folder") {
        return `Failed to create folder: ${options?.message ?? ""}`;
      }
      if (key === "failed_to_rename") {
        return `Failed to rename: ${options?.message ?? ""}`;
      }
      if (key === "no_folder") {
        return "No folder";
      }
      return key;
    },
  }),
}));

describe("useFeedEditDialogController copy action", () => {
  let showToast: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    copyTextToClipboardMock.mockReset();
    createFolderMock.mockReset();
    renameFeedMock.mockReset();
    createFolderMock.mockResolvedValue(Result.succeed({ id: "folder-new" }));
    renameFeedMock.mockResolvedValue(Result.succeed(null));
    showToast = vi.fn();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ showToast });
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it.each([
    ["clipboard unavailable", "runtime_unavailable"],
    ["Permission denied", "permission_denied"],
    ["Invalid clipboard text", "invalid_text"],
  ] as const)("surfaces %s as a categorized copy rejection", async (message, category) => {
    const error = { type: "UserVisible" as const, message, category };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    copyTextToClipboardMock.mockResolvedValue(Result.fail(error));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange: vi.fn(),
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopy(category === "invalid_text" ? "" : "https://example.com/feed.xml");
    });

    expect(showToast).toHaveBeenCalledWith(message);
    expect(consoleError).toHaveBeenCalledWith("Copy failed:", error);
    expect(copyTextToClipboardMock).toHaveBeenCalledWith(
      category === "invalid_text" ? "" : "https://example.com/feed.xml",
    );
  });

  it("localizes a backend database-maintenance-busy failure when copy fails", async () => {
    const error = {
      type: "UserVisible" as const,
      message: "Database maintenance is unavailable while syncing. Try again after sync completes.",
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    copyTextToClipboardMock.mockResolvedValue(Result.fail(error));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange: vi.fn(),
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopy("https://example.com/feed.xml");
    });

    expect(showToast).toHaveBeenCalledWith("translated:errors.database_maintenance_busy");
    expect(consoleError).toHaveBeenCalledWith("Copy failed:", error);
  });

  it("shows the copied toast after a successful readonly URL copy", async () => {
    copyTextToClipboardMock.mockResolvedValue(Result.succeed(undefined));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange: vi.fn(),
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopy("https://example.com/feed.xml");
    });

    expect(showToast).toHaveBeenCalledWith("Copied");
  });

  it("submits rename edits against the feed snapshot captured by the dialog state", async () => {
    const { wrapper } = createQueryWrapper();
    const onOpenChange = vi.fn();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange,
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    act(() => {
      result.current.setTitle("  Snapshot cafe\u0301  ");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(renameFeedMock).toHaveBeenCalledWith(sampleFeeds[0].id, "Snapshot café");
    expect(renameFeedMock).not.toHaveBeenCalledWith(sampleFeeds[1].id, "Snapshot café");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("localizes a backend database-maintenance-busy failure when rename fails", async () => {
    renameFeedMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Database maintenance is unavailable while syncing. Try again after sync completes.",
      }),
    );
    const { wrapper } = createQueryWrapper();
    const onOpenChange = vi.fn();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange,
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    act(() => {
      result.current.setTitle("Renamed feed");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(showToast).toHaveBeenCalledWith("Failed to rename: translated:errors.database_maintenance_busy");
  });

  it("localizes a backend database-maintenance-busy failure when folder creation fails", async () => {
    createFolderMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Database maintenance is unavailable while syncing. Try again after sync completes.",
      }),
    );
    const { wrapper } = createQueryWrapper();
    const onOpenChange = vi.fn();
    const { result } = renderHook(
      () =>
        useFeedEditDialogController({
          feed: sampleFeeds[0],
          open: true,
          onOpenChange,
          ...createOperationClaim(),
        }),
      { wrapper },
    );

    act(() => {
      result.current.folderSelectProps.handleFolderChange("__new__");
    });
    act(() => {
      result.current.folderSelectProps.setNewFolderName("New Folder");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(showToast).toHaveBeenCalledWith("Failed to create folder: translated:errors.database_maintenance_busy");
  });
});
