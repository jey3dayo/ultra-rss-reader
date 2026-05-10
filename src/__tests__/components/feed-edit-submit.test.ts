import { expectTauriCommandError, suppressConsoleError } from "@tests/helpers/console-spies";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, FeedDto } from "@/api/tauri-commands";
import { submitFeedEdits } from "@/components/reader/feed-edit-submit";
import type { SubmitFeedEditsParams } from "@/components/reader/rename-feed-dialog.types";

const feed: FeedDto = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: "folder-1",
  remote_id: null,
  title: "Tech Blog",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 5,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
};

function createParams(overrides: Partial<SubmitFeedEditsParams> = {}): SubmitFeedEditsParams {
  return {
    feed,
    title: feed.title,
    displayPreset: "default",
    folderSelection: {
      selectedFolderId: feed.folder_id,
      isCreatingFolder: false,
      newFolderName: "",
    },
    queryClient: createTestQueryClient(),
    showToast: vi.fn(),
    createFolderErrorMessage: (error) => `Create folder failed: ${error.message}`,
    renameErrorMessage: (error) => `Rename failed: ${error.message}`,
    updateFeedFolder: vi.fn(async () => true),
    updateDisplaySettings: vi.fn(async () => true),
    ...overrides,
  };
}

describe("submitFeedEdits", () => {
  let recorder = createTauriMockCallRecorder();

  beforeEach(() => {
    recorder = createTauriMockCallRecorder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips rename, folder move, and display updates when nothing changed", async () => {
    const updateFeedFolder = vi.fn(async () => true);
    const updateDisplaySettings = vi.fn(async () => true);
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ updateFeedFolder, updateDisplaySettings }))).resolves.toBe(true);

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).not.toHaveBeenCalled();
    expect(updateDisplaySettings).not.toHaveBeenCalled();
  });

  it("returns false and shows a toast when rename fails", async () => {
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Name already exists",
    };
    const showToast = vi.fn();
    recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "rename_feed") {
        throw appError;
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ title: "Renamed", showToast }))).resolves.toBe(false);

    expect(recorder.calls).toContainEqual({
      cmd: "rename_feed",
      args: { feedId: feed.id, title: "Renamed" },
    });
    expect(showToast).toHaveBeenCalledWith("Rename failed: Name already exists");
    expectTauriCommandError(consoleError, "rename_feed", appError);
  });

  it("updates feed display settings when the display preset changes", async () => {
    const updateDisplaySettings = vi.fn(async () => true);
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ displayPreset: "preview", updateDisplaySettings }))).resolves.toBe(
      true,
    );

    expect(updateDisplaySettings).toHaveBeenCalledWith(feed.id, "on", "on");
  });

  it("invalidates feed and folder caches when submit only moves the feed folder", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const updateFeedFolder = vi.fn(async () => true);
    setupTauriMocks(recorder.handler);

    await expect(
      submitFeedEdits(
        createParams({
          queryClient,
          folderSelection: {
            selectedFolderId: "folder-2",
            isCreatingFolder: false,
            newFolderName: "",
          },
          updateFeedFolder,
        }),
      ),
    ).resolves.toBe(true);

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: "folder-2",
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["folders"],
    });
  });

  it("moves the feed to no folder when the selected folder disappears before submit", async () => {
    const updateFeedFolder = vi.fn(async () => true);
    setupTauriMocks(recorder.handler);

    await expect(
      submitFeedEdits(
        createParams({
          folderSelection: {
            selectedFolderId: "folder-deleted",
            isCreatingFolder: false,
            newFolderName: "",
            availableFolderIds: ["folder-2"],
          },
          updateFeedFolder,
        }),
      ),
    ).resolves.toBe(true);

    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: null,
    });
  });

  it("returns false when only the folder move fails", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const updateFeedFolder = vi.fn(async () => false);
    setupTauriMocks(recorder.handler);

    await expect(
      submitFeedEdits(
        createParams({
          queryClient,
          folderSelection: {
            selectedFolderId: "folder-2",
            isCreatingFolder: false,
            newFolderName: "",
          },
          updateFeedFolder,
        }),
      ),
    ).resolves.toBe(false);

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: "folder-2",
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["feeds"],
    });
  });
});
