import { expectTauriCommandError, suppressConsoleError } from "@tests/helpers/console-spies";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, FeedDto } from "@/api/tauri-commands";
import type { SubmitFeedEditsParams } from "@/components/reader/feed-edit-dialog.types";
import { submitFeedEdits, validateFeedEditTitle } from "@/components/reader/feed-edit-submit";
import { queryKeys } from "@/lib/query/query-invalidation";

const feed: FeedDto = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: "folder-1",
  remote_id: null,
  title: "Tech Blog",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  icon_url: null,
  unread_count: 5,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
  created_at: null,
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
    reportError: vi.fn(),
    feedUrl: null,
    createFolderErrorMessage: (error) => `Create folder failed: ${error.message}`,
    renameErrorMessage: (error) => `Rename failed: ${error.message}`,
    updateUrlErrorMessage: (error) => `Update URL failed: ${error.message}`,
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

    await expect(submitFeedEdits(createParams({ updateFeedFolder, updateDisplaySettings }))).resolves.toEqual({
      success: true,
      partialOutcomes: null,
    });

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).not.toHaveBeenCalled();
    expect(updateDisplaySettings).not.toHaveBeenCalled();
  });

  it("returns false and reports the message when rename fails", async () => {
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Name already exists",
    };
    const reportError = vi.fn();
    recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "rename_feed") {
        throw appError;
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ title: "Renamed", reportError }))).resolves.toEqual({
      success: false,
      partialOutcomes: null,
    });

    expect(recorder.calls).toContainEqual({
      cmd: "rename_feed",
      args: { feedId: feed.id, title: "Renamed" },
    });
    expect(reportError).toHaveBeenCalledWith("Rename failed: Name already exists");
    expectTauriCommandError(consoleError, "rename_feed", appError);
  });

  it("updates the feed URL when it changes", async () => {
    recorder = createTauriMockCallRecorder((cmd) => (cmd === "update_feed_url" ? null : undefined));
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ feedUrl: "https://example.com/new-feed.xml" }))).resolves.toEqual({
      success: true,
      partialOutcomes: null,
    });

    expect(recorder.calls).toContainEqual({
      cmd: "update_feed_url",
      args: { feedId: feed.id, url: "https://example.com/new-feed.xml" },
    });
  });

  it("skips the feed URL update when the URL is unchanged or not editable", async () => {
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ feedUrl: feed.url }))).resolves.toEqual({
      success: true,
      partialOutcomes: null,
    });

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "update_feed_url" }));
  });

  it("returns false and reports the message when the URL update fails", async () => {
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Feed URL is already subscribed",
    };
    const reportError = vi.fn();
    recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "update_feed_url") {
        throw appError;
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    await expect(
      submitFeedEdits(createParams({ feedUrl: "https://example.com/other.xml", reportError })),
    ).resolves.toEqual({
      success: false,
      partialOutcomes: null,
    });

    expect(reportError).toHaveBeenCalledWith("Update URL failed: Feed URL is already subscribed");
    expectTauriCommandError(consoleError, "update_feed_url", appError);
  });

  it("updates feed display settings when the display preset changes", async () => {
    const updateDisplaySettings = vi.fn(async () => true);
    setupTauriMocks(recorder.handler);

    await expect(submitFeedEdits(createParams({ displayPreset: "preview", updateDisplaySettings }))).resolves.toEqual({
      success: true,
      partialOutcomes: null,
    });

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
    ).resolves.toEqual({ success: true, partialOutcomes: null });

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: "folder-2",
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.folders.root,
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
    ).resolves.toEqual({ success: true, partialOutcomes: null });

    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: null,
    });
  });

  it("reports failure without partial outcomes when the only attempted step fails", async () => {
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
    ).resolves.toEqual({ success: false, partialOutcomes: null });

    expect(recorder.calls).not.toContainEqual(expect.objectContaining({ cmd: "rename_feed" }));
    expect(updateFeedFolder).toHaveBeenCalledWith({
      feedId: feed.id,
      folderId: "folder-2",
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.feeds.root,
    });
  });

  it("reports per-step outcomes when some steps succeed and others fail", async () => {
    const updateFeedFolder = vi.fn(async () => false);
    recorder = createTauriMockCallRecorder((cmd) => (cmd === "rename_feed" ? null : undefined));
    setupTauriMocks(recorder.handler);

    await expect(
      submitFeedEdits(
        createParams({
          title: "Renamed",
          folderSelection: {
            selectedFolderId: "folder-2",
            isCreatingFolder: false,
            newFolderName: "",
          },
          updateFeedFolder,
        }),
      ),
    ).resolves.toEqual({
      success: false,
      partialOutcomes: [
        { step: "rename", succeeded: true },
        { step: "folder", succeeded: false },
      ],
    });

    expect(recorder.calls).toContainEqual({
      cmd: "rename_feed",
      args: { feedId: feed.id, title: "Renamed" },
    });
  });
});

describe("validateFeedEditTitle", () => {
  it.each(["", "   ", "\u3000"])("requires a title when %j has no visible text", (title) => {
    expect(validateFeedEditTitle(title)).toBe("required");
  });

  it("accepts a title with surrounding whitespace", () => {
    expect(validateFeedEditTitle("  Tech Blog ")).toBeNull();
  });
});
