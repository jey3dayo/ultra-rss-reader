import { Result } from "@praha/byethrow";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
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
  };
}

const feedsByAccount: Record<string, FeedDto[]> = {
  "acc-a": [
    makeFeed("a-error", "acc-a", "A Error Feed"),
    makeFeed("a-keep", "acc-a", "A Keep Feed"),
    makeFeed("a-later", "acc-a", "A Later Feed"),
  ],
  "acc-b": [makeFeed("b-error", "acc-b", "B Error Feed"), makeFeed("b-review", "acc-b", "B Review Feed")],
};

const summaries: FeedArticleSummaryDto[] = ["a-error", "a-keep", "a-later", "b-error", "b-review"].map((feedId) => ({
  feed_id: feedId,
  latest_article_at: "2025-01-01T10:00:00Z",
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
    error_kind: "network",
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
      subscriptionsWorkspace: { kind: "index" },
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    vi.spyOn(accountCommands, "listAccounts").mockResolvedValue(Result.succeed(accounts));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    queryClient.clear();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("applies fetch errors in place without losing review decisions or group disclosure", async () => {
    const user = userEvent.setup();
    await mountSubscriptionsPage();
    await user.click(screen.getByRole("button", { name: /見直し候補/ }));
    await user.click(await screen.findByRole("button", { name: /A Keep Feed/ }));
    await user.click(screen.getByRole("button", { name: "残す" }));
    await user.click(await screen.findByRole("button", { name: /A Later Feed/ }));
    await user.click(screen.getByRole("button", { name: "あとで" }));

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

    await user.click(screen.getByRole("button", { name: /見直し候補/ }));
    await user.click(screen.getByTestId("subscriptions-folder-row-ungrouped"));
    expect(screen.queryByText("A Keep Feed")).not.toBeInTheDocument();
    expect(screen.queryByText("A Later Feed")).not.toBeInTheDocument();
  });

  it("reapplies the request after manual search while ordinary feed updates retain the manual filter", async () => {
    const user = userEvent.setup();
    const { pageQueryClient, wrapper } = createPageEnvironment();
    render(<SubscriptionsIndexPage />, { wrapper });
    await screen.findByRole("heading", { name: "全購読", level: 2 });
    await user.click(screen.getByRole("button", { name: /見直し候補/ }));
    await user.type(screen.getByRole("searchbox", { name: "購読を検索" }), "A Error");
    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A Error Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "購読を検索" })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: /見直し候補/ }));
    await user.type(screen.getByRole("searchbox", { name: "購読を検索" }), "A Error");
    showFetchErrorsAction("acc-a");
    await clickFetchErrorsAction(user);
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /見直し候補/ }));
    const nextFeeds = [...feedsByAccount["acc-a"], makeFeed("a-new", "acc-a", "A New Feed")];
    feedsByAccount["acc-a"] = nextFeeds;
    pageQueryClient.setQueryData(queryKeys.feeds.byAccount("acc-a"), nextFeeds);
    pageQueryClient.setQueryData(queryKeys.feedArticleSummaries.subscriptionsIndex("acc-a"), [
      ...summaries,
      {
        feed_id: "a-new",
        latest_article_at: "2025-01-01T10:00:00Z",
        starred_count: 0,
        recent_article_count: 0,
      },
    ]);
    expect(await screen.findByRole("heading", { name: "見直し候補", level: 2 })).toBeInTheDocument();
    expect(await screen.findByText("A New Feed")).toBeInTheDocument();
  });

  it("navigates to the requested account and shows only that account's fetch errors", async () => {
    const user = userEvent.setup();
    await mountSubscriptionsPage();
    showFetchErrorsAction("acc-b");
    await clickFetchErrorsAction(user);

    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /B Error Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /A Error Feed/ })).not.toBeInTheDocument();
    expect(useUiStore.getState().selectedAccountId).toBe("acc-b");
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
        navigationRequest: { accountId: "acc-a", summaryFilter: "fetch_errors" },
      });
    });

    render(<SubscriptionsIndexPage />, { wrapper });
    expect(await screen.findByRole("heading", { name: "取得エラー", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A Error Feed/ })).toBeInTheDocument();
  });
});
