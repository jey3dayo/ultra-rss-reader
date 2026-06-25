import { Result } from "@praha/byethrow";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOpmlExportFilename,
  useAccountDetailDangerZone,
} from "@/components/settings/hooks/account-detail/use-account-detail-danger-zone";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const TAGS_QUERY_KEY = ["tags"] as const;
const ARTICLE_TAGS_QUERY_KEY = ["articleTags"] as const;
const MUTE_KEYWORD_QUERY_KEY = ["muteKeywords"] as const;

const {
  deleteAccountMock,
  exportLocalAccountSyncOperationsMock,
  exportOpmlMock,
  getLocalAccountSyncSettingsMock,
  getPreferencesMock,
  importLocalAccountSyncOperationsMock,
  importOpmlMock,
  setLocalAccountSyncSettingsMock,
  setPreferenceMock,
} = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  exportLocalAccountSyncOperationsMock: vi.fn(),
  exportOpmlMock: vi.fn(),
  getLocalAccountSyncSettingsMock: vi.fn(),
  getPreferencesMock: vi.fn(),
  importLocalAccountSyncOperationsMock: vi.fn(),
  importOpmlMock: vi.fn(),
  setLocalAccountSyncSettingsMock: vi.fn(),
  setPreferenceMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  deleteAccount: deleteAccountMock,
  exportLocalAccountSyncOperations: exportLocalAccountSyncOperationsMock,
  exportOpml: exportOpmlMock,
  getLocalAccountSyncSettings: getLocalAccountSyncSettingsMock,
  getPreferences: getPreferencesMock,
  importLocalAccountSyncOperations: importLocalAccountSyncOperationsMock,
  importOpml: importOpmlMock,
  setLocalAccountSyncSettings: setLocalAccountSyncSettingsMock,
  setPreference: setPreferenceMock,
}));

setupBrowserTestDom();

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
    vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
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
    exportLocalAccountSyncOperationsMock.mockReset();
    deleteAccountMock.mockReset();
    getLocalAccountSyncSettingsMock.mockReset();
    getPreferencesMock.mockReset();
    importLocalAccountSyncOperationsMock.mockReset();
    importOpmlMock.mockReset();
    setLocalAccountSyncSettingsMock.mockReset();
    setPreferenceMock.mockReset();
    getLocalAccountSyncSettingsMock.mockResolvedValue(Result.succeed(null));
    exportLocalAccountSyncOperationsMock.mockResolvedValue(Result.succeed({ operations_written: 0 }));
    importLocalAccountSyncOperationsMock.mockResolvedValue(
      Result.succeed({
        loaded_operations: 0,
        applied_operations: 0,
        rejected_operations: 0,
        rejected_files: 0,
        conflicted_candidates: 0,
        applied: true,
        folders_upserted: 0,
        feeds_upserted: 0,
        article_states_applied: 0,
        tags_upserted: 0,
        article_tags_added: 0,
        article_tags_removed: 0,
        mute_keywords_upserted: 0,
        mute_keywords_removed: 0,
        unmatched_article_keys: 0,
        skipped_removed_tags: 0,
        conflict_count: 0,
      }),
    );
    setLocalAccountSyncSettingsMock.mockResolvedValue(
      Result.succeed({
        account_id: "acc-1",
        sync_folder_path: "/tmp/UltraRSSReader",
        sync_account_id: "sync-account-1",
        device_id: "device-1",
        enabled: true,
      }),
    );
    setPreferenceMock.mockResolvedValue(Result.succeed(null));
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  afterEach(async () => {
    vi.useRealTimers();
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.unstubAllGlobals();
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
    usePreferencesStore.setState({ prefs: {}, loaded: false });
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

    expect(result.current.exportingOpml).toBe(true);
    expect(exportOpmlMock).toHaveBeenCalledTimes(1);
    expect(exportOpmlMock).toHaveBeenCalledWith("acc-1");

    exportResult.resolve(Result.succeed("<opml />"));
    await firstExport;
    await secondExport;

    await waitFor(() => {
      expect(result.current.exportingOpml).toBe(false);
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("exposes import pending state and guards repeated OPML imports while in flight", async () => {
    const importResult = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    importOpmlMock.mockReturnValue(importResult.promise);
    const queryClient = createTestQueryClient();
    const account = { ...sampleAccounts[0], id: "acc-1" };
    const file = new File(["<opml />"], "feeds.opml");

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account,
        queryClient,
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    let firstImport: Promise<void> | undefined;
    let secondImport: Promise<void> | undefined;
    act(() => {
      firstImport = result.current.handleImportOpml(file);
      secondImport = result.current.handleImportOpml(file);
    });

    expect(result.current.importingOpml).toBe(true);
    await waitFor(() => {
      expect(importOpmlMock).toHaveBeenCalledTimes(1);
    });
    expect(importOpmlMock).toHaveBeenCalledWith("acc-1", "<opml />");

    importResult.resolve(Result.succeed(null));
    await firstImport;
    await secondImport;

    await waitFor(() => {
      expect(result.current.importingOpml).toBe(false);
    });
  });

  it("uses the account snapshot from export start for the OPML command and filename", async () => {
    const exportResult = createDeferred<ReturnType<typeof Result.succeed<string>>>();
    const clickedDownloads: string[] = [];
    exportOpmlMock.mockReturnValue(exportResult.promise);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });
    const firstAccount = {
      ...sampleAccounts[0],
      id: "acc-1",
      name: "Local Work",
    };
    const secondAccount = {
      ...sampleAccounts[0],
      id: "acc-2",
      name: "Local Personal",
    };

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailDangerZone({
          account,
          queryClient: createTestQueryClient(),
          t,
          onAccountDeleted: vi.fn(),
        }),
      { initialProps: { account: firstAccount } },
    );

    const exportOpmlPromise = result.current.handleExportOpml();
    rerender({ account: secondAccount });

    exportResult.resolve(Result.succeed("<opml />"));
    await exportOpmlPromise;

    expect(exportOpmlMock).toHaveBeenCalledWith(firstAccount.id);
    expect(clickedDownloads).toEqual(["Local Work-feeds.opml"]);
  });

  it("revokes the active OPML object URL when switching accounts", async () => {
    exportOpmlMock.mockResolvedValue(Result.succeed("<opml />"));
    const revokeObjectUrlMock = vi.mocked(URL.revokeObjectURL);
    const firstAccount = {
      ...sampleAccounts[0],
      id: "acc-1",
      name: "Local Work",
    };
    const secondAccount = {
      ...sampleAccounts[0],
      id: "acc-2",
      name: "Local Personal",
    };

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailDangerZone({
          account,
          queryClient: createTestQueryClient(),
          t,
          onAccountDeleted: vi.fn(),
        }),
      { initialProps: { account: firstAccount } },
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });
    rerender({ account: secondAccount });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:opml");
  });

  it("ignores a completed OPML export after unmount without creating an object URL", async () => {
    const exportResult = createDeferred<ReturnType<typeof Result.succeed<string>>>();
    exportOpmlMock.mockReturnValue(exportResult.promise);

    const { result, unmount } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    const exportOpmlPromise = result.current.handleExportOpml();
    unmount();

    exportResult.resolve(Result.succeed("<opml />"));
    await exportOpmlPromise;

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the previous OPML object URL before replacing it and revokes the active URL on unmount", async () => {
    const createObjectUrlMock = vi.fn().mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    const revokeObjectUrlMock = vi.mocked(URL.revokeObjectURL);
    exportOpmlMock.mockResolvedValue(Result.succeed("<opml />"));

    const { result, unmount } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });
    await act(async () => {
      await result.current.handleExportOpml();
    });
    unmount();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:first");
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:second");
  });

  it("revokes the active OPML object URL after the download grace period", async () => {
    vi.useFakeTimers();
    exportOpmlMock.mockResolvedValue(Result.succeed("<opml />"));
    const revokeObjectUrlMock = vi.mocked(URL.revokeObjectURL);

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:opml");
  });

  it("revokes the OPML object URL immediately when the download click fails", async () => {
    exportOpmlMock.mockResolvedValue(Result.succeed("<opml />"));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });
    const revokeObjectUrlMock = vi.mocked(URL.revokeObjectURL);

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:opml");
  });

  it("invalidates reader article caches after account delete succeeds", async () => {
    deleteAccountMock.mockResolvedValue(Result.succeed(null));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, sampleAccounts);
    queryClient.setQueryData(queryKeys.feeds.root, sampleFeeds);
    queryClient.setQueryData(queryKeys.articles.byFeed("feed-1", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.articles.byFeed("feed-2", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-2", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.recentArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(queryKeys.starredArticles.byAccount("acc-1"), sampleArticles);
    queryClient.setQueryData(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.search.byAccountAndQuery("acc-1", "hello"), sampleArticles);
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onAccountDeleted = vi.fn();
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
      contentMode: "reader",
      recentlyReadIds: new Set(["article-1"]),
      retainedArticleIds: new Set(["article-1"]),
    });
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient,
        t,
        onAccountDeleted,
      }),
    );

    act(() => {
      result.current.handleRequestDelete();
    });

    expect(useUiStore.getState().confirmDialog).toEqual(
      expect.objectContaining({
        message:
          'Delete "Local"? This cannot be undone. Related feeds, local articles, and account settings will be removed.',
        actionAccessibleLabel: 'Delete account "Local". This cannot be undone.',
        variant: "destructive",
      }),
    );

    await act(async () => {
      await useUiStore.getState().confirmDialog.onConfirm?.();
    });

    expect(deleteAccountMock).toHaveBeenCalledWith("acc-1");
    expect(onAccountDeleted).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
    expect(useUiStore.getState().selection).toEqual({ type: "all" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
    expect(useUiStore.getState().recentlyReadIds).toEqual(new Set());
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
    expect(queryClient.getQueryData(queryKeys.articles.byFeed("feed-1", "unread"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.recentArticles.byAccount("acc-1", "all"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.search.byAccountAndQuery("acc-1", "hello"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.articles.byFeed("feed-2", "unread"))).toEqual(sampleArticles);
    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-2", "unread"))).toEqual(sampleArticles);
    expect(usePreferencesStore.getState().prefs.selected_account_id).toBe("acc-2");
    expect(setPreferenceMock).toHaveBeenCalledWith("selected_account_id", "acc-2");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.accounts.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.feeds.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.articles.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.accountArticles.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.folderArticles.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.recentArticles.root,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.tagArticleCounts.root,
    });
  });

  it("surfaces selected account preference save failures after account delete", async () => {
    deleteAccountMock.mockResolvedValue(Result.succeed(null));
    setPreferenceMock.mockResolvedValue(Result.fail({ type: "UserVisible", message: "disk full" }));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, sampleAccounts);
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient,
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleRequestDelete();
    });
    await act(async () => {
      await useUiStore.getState().confirmDialog.onConfirm?.();
    });

    expect(usePreferencesStore.getState().prefs.selected_account_id).toBe("acc-2");
    expect(setPreferenceMock).toHaveBeenCalledWith("selected_account_id", "acc-2");
    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBe("Failed to save setting: disk full");
    });
  });

  it("invalidates local sync import caches for feeds, articles, tags, and mute keywords", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    getLocalAccountSyncSettingsMock.mockResolvedValue(
      Result.succeed({
        account_id: "acc-1",
        sync_folder_path: "/tmp/UltraRSSReader",
        sync_account_id: "sync-account-1",
        device_id: "device-1",
        enabled: true,
      }),
    );
    importLocalAccountSyncOperationsMock.mockResolvedValue(
      Result.succeed({
        loaded_operations: 4,
        applied_operations: 4,
        rejected_operations: 0,
        rejected_files: 0,
        conflicted_candidates: 0,
        applied: true,
        folders_upserted: 1,
        feeds_upserted: 1,
        article_states_applied: 1,
        tags_upserted: 1,
        article_tags_added: 1,
        article_tags_removed: 0,
        mute_keywords_upserted: 1,
        mute_keywords_removed: 0,
        unmatched_article_keys: 0,
        skipped_removed_tags: 0,
        conflict_count: 0,
      }),
    );

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: { ...sampleAccounts[0], kind: "Local" },
        queryClient,
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.localSyncFolderPath).toBe("/tmp/UltraRSSReader");
    });
    await act(async () => {
      await result.current.handleImportLocalSyncOperations();
    });

    expect(importLocalAccountSyncOperationsMock).toHaveBeenCalledWith("acc-1");
    for (const queryKey of [
      queryKeys.feeds.root,
      queryKeys.folders.root,
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
      TAGS_QUERY_KEY,
      ARTICLE_TAGS_QUERY_KEY,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      MUTE_KEYWORD_QUERY_KEY,
    ]) {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey });
    }
  });
});
