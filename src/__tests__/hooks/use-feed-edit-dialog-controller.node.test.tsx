import { Result } from "@praha/byethrow";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleFeeds } from "@tests/helpers/fixtures";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
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
const { createFolderMock, renameFeedMock, updateDisplaySettingsMock } = vi.hoisted(() => ({
  createFolderMock: vi.fn(),
  renameFeedMock: vi.fn(),
  updateDisplaySettingsMock: vi.fn(),
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
  useUpdateFeedDisplaySettings: () => updateDisplaySettingsMock,
}));

vi.mock("@/hooks/use-update-feed-folder", () => ({
  useUpdateFeedFolder: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}));

setupBrowserTestDom();

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
    updateDisplaySettingsMock.mockReset();
    createFolderMock.mockResolvedValue(Result.succeed({ id: "folder-new" }));
    renameFeedMock.mockResolvedValue(Result.succeed(null));
    updateDisplaySettingsMock.mockResolvedValue(true);
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

    expect(showToast).toHaveBeenCalledWith({ message, severity: "error" });
    expect(consoleError).toHaveBeenCalledWith("Copy failed:", error);
    expect(copyTextToClipboardMock).toHaveBeenCalledWith(
      category === "invalid_text" ? "" : "https://example.com/feed.xml",
    );
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

  describe("form initialization", () => {
    const feed: FeedDto = { ...sampleFeeds[0], id: "feed-init", folder_id: "folder-1", title: "Original" };

    function renderController(initialProps: { feed: FeedDto; open: boolean }) {
      const { wrapper } = createQueryWrapper();
      return renderHook(
        (props: { feed: FeedDto; open: boolean }) =>
          useFeedEditDialogController({ ...props, onOpenChange: vi.fn(), ...createOperationClaim() }),
        { wrapper, initialProps },
      );
    }

    it("keeps in-progress edits when a refetch hands back the same feed as a new object", () => {
      const { result, rerender } = renderController({ feed, open: true });

      act(() => {
        result.current.setTitle("Typed title");
        result.current.folderSelectProps.handleFolderChange("folder-2");
      });
      rerender({ feed: { ...feed, title: "Renamed elsewhere", folder_id: "folder-3" }, open: true });

      expect(result.current.title).toBe("Typed title");
      expect(result.current.folderSelectProps.folderSelectValue).toBe("folder-2");
    });

    it("compares edits with the refetched feed, so reverting a title the server already changed is saved", async () => {
      const { result, rerender } = renderController({ feed, open: true });

      rerender({ feed: { ...feed, title: "Renamed elsewhere" }, open: true });
      act(() => {
        result.current.setTitle("Original");
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(renameFeedMock).toHaveBeenCalledWith(feed.id, "Original");
    });

    it("re-initializes the form when the dialog is reopened", () => {
      const { result, rerender } = renderController({ feed, open: true });

      act(() => {
        result.current.setTitle("Typed title");
      });
      rerender({ feed, open: false });
      rerender({ feed: { ...feed, title: "Latest title", folder_id: "folder-3" }, open: true });

      expect(result.current.title).toBe("Latest title");
      expect(result.current.folderSelectProps.folderSelectValue).toBe("folder-3");
    });

    it("re-initializes the form when a different feed is shown", () => {
      const { result, rerender } = renderController({ feed, open: true });

      act(() => {
        result.current.setTitle("Typed title");
      });
      rerender({ feed: { ...feed, id: "feed-other", title: "Other feed", folder_id: null }, open: true });

      expect(result.current.title).toBe("Other feed");
      expect(result.current.folderSelectProps.folderSelectValue).toBe("");
    });
  });

  describe("failure display", () => {
    function renderOpenController(onOpenChange = vi.fn()) {
      const { wrapper } = createQueryWrapper();
      return renderHook(
        () =>
          useFeedEditDialogController({ feed: sampleFeeds[0], open: true, onOpenChange, ...createOperationClaim() }),
        { wrapper },
      );
    }

    it("flags a blank title on the field without a toast, and clears it on the next edit", async () => {
      const { result } = renderOpenController();

      act(() => {
        result.current.setTitle("   ");
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.titleError).toBe("required");
      expect(showToast).not.toHaveBeenCalled();
      expect(renameFeedMock).not.toHaveBeenCalled();

      act(() => {
        result.current.setTitle("Fixed");
      });

      expect(result.current.titleError).toBeNull();
    });

    it("summarizes which edits were saved when only some steps succeed", async () => {
      updateDisplaySettingsMock.mockResolvedValue(false);
      const onOpenChange = vi.fn();
      const { result } = renderOpenController(onOpenChange);

      act(() => {
        result.current.setTitle("Renamed");
        result.current.setDisplayPreset("preview");
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.saveSummary).toEqual({ saved: ["rename"], remaining: ["display"] });
      expect(onOpenChange).not.toHaveBeenCalled();

      act(() => {
        result.current.setTitle("Renamed again");
      });
      expect(result.current.saveSummary).toBeNull();
    });

    it("keeps the dialog open and shows a rename failure in the dialog instead of a toast", async () => {
      renameFeedMock.mockResolvedValue(Result.fail({ type: "UserVisible", message: "Name already exists" }));
      const onOpenChange = vi.fn();
      const { result } = renderOpenController(onOpenChange);

      act(() => {
        result.current.setTitle("Renamed");
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.saveErrorMessages).toEqual(["Failed to rename: Name already exists"]);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });

    it("clears the save failure when the user edits again or saves again", async () => {
      renameFeedMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "Name already exists" }));
      const { result } = renderOpenController();

      act(() => {
        result.current.setTitle("Renamed");
      });
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.saveErrorMessages).toHaveLength(1);

      act(() => {
        result.current.setDisplayPreset("preview");
      });
      expect(result.current.saveErrorMessages).toEqual([]);

      renameFeedMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "Still failing" }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.saveErrorMessages).toEqual(["Failed to rename: Still failing"]);

      renameFeedMock.mockResolvedValueOnce(Result.succeed(null));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.saveErrorMessages).toEqual([]);
    });
  });
});
