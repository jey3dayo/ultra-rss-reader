import { Result } from "@praha/byethrow";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AccountDto,
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  LocalFeedSyncStatusDto,
} from "@/api/tauri-commands";
import * as accountCommands from "@/api/tauri-commands/accounts";
import { SubscriptionsIndexPage } from "@/components/subscriptions-index/subscriptions-index-page";
import { createFetchErrorsToastAction } from "@/lib/actions";
import i18n from "@/lib/i18n";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const originalViewportWidth = window.innerWidth;

const accounts: AccountDto[] = [
  {
    id: "acc-a",
    kind: "Local",
    name: "Local A",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    sync_enabled: true,
    keep_read_items_days: 30,
  },
  {
    id: "acc-b",
    kind: "Local",
    name: "Local B",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    sync_enabled: true,
    keep_read_items_days: 30,
  },
];

function makeFeed(id: string, accountId: string, title: string): FeedDto {
  return {
    id,
    account_id: accountId,
    folder_id: null,
    remote_id: null,
    title,
    url: `https://example.com/${id}.xml`,
    site_url: "https://example.com",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
  };
}

const feedsByAccount: Record<string, FeedDto[]> = {
  "acc-a": [
    makeFeed("a-error", "acc-a", "A Error Feed"),
    makeFeed("a-keep", "acc-a", "A Keep Feed"),
    makeFeed("a-keep-two", "acc-a", "A Keep Two Feed"),
  ],
  "acc-b": [makeFeed("b-error", "acc-b", "B Error Feed"), makeFeed("b-review", "acc-b", "B Review Feed")],
};

const summaries: FeedArticleSummaryDto[] = ["a-error", "a-keep", "a-keep-two", "b-error", "b-review"].map((feedId) => ({
  feed_id: feedId,
  latest_article_at: "2025-01-01T10:00:00Z",
  last_seen_article_at: null,
  last_seen_article_probe_completed: false,
  starred_count: 0,
  recent_article_count: 0,
}));
const failedStatuses: LocalFeedSyncStatusDto[] = [
  {
    feed_id: "a-error",
    last_attempt_at: "2026-10-11T02:15:00Z",
    last_success_at: null,
    error_kind: "network",
    error_count: 1,
    diagnostic_id: "b68d9be4-76b3-4fef-9ac5-d1decb40c9b8",
  },
  {
    feed_id: "b-error",
    last_attempt_at: "2026-10-11T02:15:00Z",
    last_success_at: null,
    error_kind: "private_address_blocked",
    error_count: 1,
    diagnostic_id: "cb5442ec-30ba-4af2-baf7-48f556a81825",
  },
];

function showFetchErrorsAction(accountId: string) {
  const action = createFetchErrorsToastAction(accountId, "取得エラーを表示");
  if (!action) {
    throw new Error(`Expected a fetch errors action for ${accountId}`);
  }
  useUiStore.getState().showToast({ message: "同期に失敗しました", actions: [action] });
}

async function clickFetchErrorsAction(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "取得エラーを表示" }));
}

function createPageEnvironment() {
  const { queryClient: pageQueryClient, wrapper } = createQueryWrapper({
    includeToastHost: true,
    queryClientConfig: { defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } },
  });
  pageQueryClient.setQueryData(queryKeys.accounts.root, accounts);
  for (const account of accounts) {
    pageQueryClient.setQueryData(queryKeys.feeds.byAccount(account.id), feedsByAccount[account.id] ?? []);
    pageQueryClient.setQueryData([...queryKeys.folders.root, account.id], []);
    pageQueryClient.setQueryData(queryKeys.accountArticles.byAccount(account.id, "all"), {
      pages: [[]] satisfies ArticleDto[][],
      pageParams: [0],
    });
    pageQueryClient.setQueryData(queryKeys.feedArticleSummaries.subscriptionsIndex(account.id), summaries);
    pageQueryClient.setQueryData(
      queryKeys.localFeedSyncStatuses.byAccount(account.id),
      failedStatuses.filter((status) => feedsByAccount[account.id]?.some((feed) => feed.id === status.feed_id)),
    );
  }
  return { pageQueryClient, wrapper };
}

async function mountSubscriptionsPage() {
  const environment = createPageEnvironment();
  render(<SubscriptionsIndexPage />, { wrapper: environment.wrapper });
  await screen.findByRole("heading", { name: "全購読", level: 2 });
  return environment;
}

describe("fetch error toast navigation", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ja");
    queryClient.clear();
    queryClient.setQueryData(queryKeys.accounts.root, accounts);
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-a",
      subscriptionsWorkspace: { kind: "index", accountId: "acc-a" },
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    vi.spyOn(accountCommands, "listAccounts").mockResolvedValue(Result.succeed(accounts));
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalViewportWidth });
    vi.restoreAllMocks();
    queryClient.clear();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("applies fetch errors in place without losing review decisions or group disclosure", async () => {
    const user = userEvent.setup();
    await mountSubscriptionsPage();
    await user.click(screen.getByRole("button", { name: /90日以上未更新/ }));
    await user.click(await screen.findByRole("button", { name: /A Keep Feed/ }));
    await user.click(screen.getByRole("button", { name: "見直し対象外にする" }));
    await user.click(await screen.findByRole("button", { name: /A Keep Two Feed/ }));
    await user.click(screen.getByRole("button", { name: "見直し対象外にする" }));

    const group = screen.getByTestId("subscriptions-folder-row-ungrouped");
    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");

    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-expanded", "false");
    await user.click(group);
    expect(screen.getByRole("button", { name: /A Error Feed/ })).toBeInTheDocument();
    await user.click(group);

    await user.click(screen.getByRole("button", { name: /90日以上未更新/ }));
    await user.click(screen.getByTestId("subscriptions-folder-row-ungrouped"));
    expect(screen.queryByText("A Keep Feed")).not.toBeInTheDocument();
    expect(screen.queryByText("A Keep Two Feed")).not.toBeInTheDocument();
  });

  it("reapplies the request after manual search while ordinary feed updates retain the manual filter", async () => {
    const user = userEvent.setup();
    const { pageQueryClient, wrapper } = createPageEnvironment();
    render(<SubscriptionsIndexPage />, { wrapper });
    await screen.findByRole("heading", { name: "全購読", level: 2 });
    await user.click(screen.getByRole("button", { name: /90日以上未更新/ }));
    await user.type(screen.getByRole("searchbox", { name: "購読を検索" }), "A Error");
    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A Error Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "購読を検索" })).toHaveValue("A Error");

    await user.click(screen.getByRole("button", { name: /90日以上未更新/ }));
    expect(screen.getByRole("searchbox", { name: "購読を検索" })).toHaveValue("A Error");
    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /90日以上未更新/ }));
    await user.clear(screen.getByRole("searchbox", { name: "購読を検索" }));
    const nextFeeds = [...feedsByAccount["acc-a"], makeFeed("a-new", "acc-a", "A New Feed")];
    feedsByAccount["acc-a"] = nextFeeds;
    pageQueryClient.setQueryData(queryKeys.feeds.byAccount("acc-a"), nextFeeds);
    pageQueryClient.setQueryData(queryKeys.feedArticleSummaries.subscriptionsIndex("acc-a"), [
      ...summaries,
      {
        feed_id: "a-new",
        latest_article_at: "2025-01-01T10:00:00Z",
        last_seen_article_at: null,
        last_seen_article_probe_completed: false,
        starred_count: 0,
        recent_article_count: 0,
      },
    ]);
    expect(await screen.findByRole("heading", { name: "90日以上未更新", level: 2 })).toBeInTheDocument();
    expect(await screen.findByText("A New Feed")).toBeInTheDocument();
  });

  it("switches accounts without changing the reader and restores the previous account state", async () => {
    const user = userEvent.setup();
    const calls: { cmd: string; args: Record<string, unknown> }[] = [];
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 });
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "trigger_sync_feed") return { synced: true, total: 1, succeeded: 1, failed: [], warnings: [] };
      if (cmd === "rename_feed") return null;
      if (cmd === "list_feeds") return feedsByAccount["acc-b"];
      if (cmd === "list_folders" || cmd === "list_feed_article_summaries" || cmd === "get_local_feed_sync_statuses")
        return [];
      return null;
    });
    useUiStore.setState({ selectedArticleId: "article-a" });
    const { pageQueryClient } = await mountSubscriptionsPage();
    await user.type(screen.getByRole("searchbox", { name: "購読を検索" }), "A Error");
    const scrollRegion = screen.getByTestId("subscriptions-workspace-scroll-region");
    scrollRegion.scrollTop = 120;
    fireEvent.scroll(scrollRegion);
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-b"));
    expect(await screen.findByRole("button", { name: /B Error Feed/ })).toBeInTheDocument();
    expect(useUiStore.getState().selectedAccountId).toBe("acc-a");
    expect(useUiStore.getState().subscriptionsWorkspace?.accountId).toBe("acc-b");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-a"));
    expect(await screen.findByRole("searchbox", { name: "購読を検索" })).toHaveValue("A Error");
    await waitFor(() => expect(screen.getByTestId("subscriptions-workspace-scroll-region").scrollTop).toBe(120));
    showFetchErrorsAction("acc-b");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /B Error Feed/ })).toBeInTheDocument();
    expect(useUiStore.getState().selectedAccountId).toBe("acc-a");
    expect(useUiStore.getState().subscriptionsWorkspace?.accountId).toBe("acc-b");
    await user.click(screen.getByRole("button", { name: /B Error Feed/ }));
    await user.click(screen.getByRole("button", { name: "フィード設定を確認" }));
    let dialog = await screen.findByRole("dialog", { name: "フィードを編集" });
    const retryAction = createFetchErrorsToastAction("acc-a", "取得エラーを表示");
    act(() => retryAction?.onClick());
    await waitFor(() =>
      expect(useUiStore.getState().toastMessage?.message).toBe(
        "フィードのダイアログを閉じてから、もう一度お試しください。",
      ),
    );
    expect(useUiStore.getState().subscriptionsWorkspace?.accountId).toBe("acc-b");
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    await clickFetchErrorsAction(user);
    await waitFor(() => expect(useUiStore.getState().subscriptionsWorkspace?.accountId).toBe("acc-a"));
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(useUiStore.getState().subscriptionsIndexReturnStates.has("acc-b")).toBe(true);
    expect(useUiStore.getState().selectedAccountId).toBe("acc-a");
    showFetchErrorsAction("acc-b");
    await clickFetchErrorsAction(user);
    await user.click(await screen.findByRole("button", { name: /B Error Feed/ }));
    await user.click(screen.getByRole("button", { name: "フィード設定を確認" }));
    dialog = await screen.findByRole("dialog", { name: "フィードを編集" });
    const titleInput = within(dialog).getByDisplayValue("B Error Feed");
    await user.clear(titleInput);
    await user.type(titleInput, "B Edited Feed");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({ cmd: "rename_feed", args: expect.objectContaining({ feedId: "b-error" }) }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "再取得" }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({ cmd: "trigger_sync_feed", args: expect.objectContaining({ feedId: "b-error" }) }),
      ),
    );
    act(() => pageQueryClient.setQueryData(queryKeys.accounts.root, [accounts[1]]));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect(useUiStore.getState().selectedAccountId).toBe("acc-a");
    expect(useUiStore.getState().selectedArticleId).toBe("article-a");
  });

  it("restores the selected error and scroll after delayed statuses load", async () => {
    const user = userEvent.setup();
    let resolveStatuses: (statuses: LocalFeedSyncStatusDto[]) => void = () => {};
    const pendingStatuses = new Promise<LocalFeedSyncStatusDto[]>((resolve) => {
      resolveStatuses = resolve;
    });
    setupTauriMocks((cmd) => (cmd === "get_local_feed_sync_statuses" ? pendingStatuses : undefined));
    const { pageQueryClient, wrapper } = createPageEnvironment();
    pageQueryClient.removeQueries({ queryKey: queryKeys.localFeedSyncStatuses.byAccount("acc-a") });
    useUiStore.setState({
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-a",
        returnState: {
          accountId: "acc-a",
          activeSummaryFilter: "fetch_errors",
          selectedFeedId: "a-keep",
          expandedGroups: {},
          listScrollTop: {
            scrollTop: 120,
            layoutGeneration: "a-error\na-keep",
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          },
          searchQuery: "",
        },
      },
    });
    render(<SubscriptionsIndexPage />, { wrapper });
    await screen.findByRole("heading", { name: "取得エラー", level: 2 });
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(useUiStore.getState().subscriptionsIndexReturnStates.get("acc-a")?.listScrollTop.scrollTop).toBe(120);
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-b"));
    await screen.findByRole("heading", { name: "全購読", level: 2 });
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-a"));
    await screen.findByRole("heading", { name: "取得エラー", level: 2 });
    await act(async () => resolveStatuses([failedStatuses[0], { ...failedStatuses[0], feed_id: "a-keep" }]));
    expect(await screen.findByRole("button", { name: /A Keep Feed/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByTestId("subscriptions-list-scroll-region").scrollTop).toBe(120));
  });

  it("resets the shared scroll for an empty account and restores it when returning", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 });
    const { pageQueryClient, wrapper } = createPageEnvironment();
    pageQueryClient.setQueryData(queryKeys.feeds.byAccount("acc-b"), []);
    render(<SubscriptionsIndexPage />, { wrapper });
    await screen.findByRole("button", { name: /A Error Feed/ });
    const scrollRegion = screen.getByTestId("subscriptions-workspace-scroll-region");
    scrollRegion.scrollTop = 120;
    fireEvent.scroll(scrollRegion);
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-b"));
    await waitFor(() => expect(screen.getByTestId("subscriptions-workspace-scroll-region").scrollTop).toBe(0));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    act(() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, "acc-a"));
    await waitFor(() => expect(screen.getByTestId("subscriptions-workspace-scroll-region").scrollTop).toBe(120));
    screen.getByTestId("subscriptions-workspace-scroll-region").scrollTop = 120;
    showFetchErrorsAction("acc-b");
    await clickFetchErrorsAction(user);
    await waitFor(() => expect(screen.getByTestId("subscriptions-workspace-scroll-region").scrollTop).toBe(0));
    expect(useUiStore.getState().subscriptionsWorkspace?.accountId).toBe("acc-b");
  });

  it("shows a translated error toast when the account lookup fails", async () => {
    const user = userEvent.setup();
    const { wrapper } = createPageEnvironment();
    render(<div />, { wrapper });
    vi.spyOn(accountCommands, "listAccounts").mockRejectedValueOnce(new Error("lookup failed"));

    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);

    expect(await screen.findByText("取得エラーの詳細を開けませんでした。もう一度お試しください。")).toBeInTheDocument();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "取得エラーの詳細を開けませんでした。もう一度お試しください。",
      severity: "error",
    });
  });

  it("keeps a pending toast request until the subscriptions page mounts", async () => {
    const user = userEvent.setup();
    let resolveAccounts: ((value: Awaited<ReturnType<typeof accountCommands.listAccounts>>) => void) | undefined;
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const accountsPending = new Promise<Awaited<ReturnType<typeof accountCommands.listAccounts>>>((resolve) => {
      resolveAccounts = resolve;
    });
    vi.spyOn(accountCommands, "listAccounts").mockImplementation(() => {
      markRequestStarted?.();
      return accountsPending;
    });
    const { wrapper } = createPageEnvironment();
    render(<div />, { wrapper });

    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    await requestStarted;
    expect(useUiStore.getState().subscriptionsWorkspace).not.toHaveProperty("navigationRequest");
    if (!resolveAccounts) {
      throw new Error("Expected the account lookup to remain pending.");
    }
    resolveAccounts(Result.succeed(accounts));
    await waitFor(() => {
      expect(useUiStore.getState().subscriptionsWorkspace).toMatchObject({
        kind: "index",
        accountId: "acc-a",
        navigationRequest: { accountId: "acc-a", summaryFilter: "fetch_errors" },
      });
    });

    render(<SubscriptionsIndexPage />, { wrapper });
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A Error Feed/ })).toBeInTheDocument();
  });
});
