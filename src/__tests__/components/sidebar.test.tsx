import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushMicrotasksAndRealTimer } from "@tests/helpers/async-flush";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { type DevIntentState, resetDevIntentState } from "@tests/helpers/dev-intent";
import { sampleAccounts, sampleFeeds, sampleTags } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { AccountPane } from "@/components/reader/account-pane";
import { ArticleList } from "@/components/reader/article-list";
import { Sidebar } from "@/components/reader/sidebar";
import { APP_EVENTS } from "@/constants/events";
import { STORAGE_KEYS } from "@/constants/storage";
import { formatAccountSyncRetryTime } from "@/lib/account/account-sync-status-format";
import { ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE, ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { resetManualSyncCooldownForTests } from "@/lib/sync/manual-sync";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { devIntentState } = await vi.hoisted(async () => {
  const { createDevIntentState } = await import("@tests/helpers/dev-intent");
  const devIntentState: DevIntentState = createDevIntentState();
  return { devIntentState };
});

type SidebarSourceOverrides = {
  feedsEnabled: boolean;
  feedsData: FeedDto[] | undefined;
  foldersEnabled: boolean;
  foldersData: FolderDto[] | undefined;
  accountArticlesEnabled: boolean;
  accountArticlesData: ArticleDto[] | undefined;
  starredArticlesEnabled: boolean;
  starredArticlesData: ArticleDto[] | undefined;
  starredCountEnabled: boolean;
  starredCountData: number | undefined;
  tagArticleCountsEnabled: boolean;
  tagArticleCountsData: Record<string, number> | undefined;
};

const { sidebarSourceOverrides } = vi.hoisted(() => {
  const sidebarSourceOverrides: SidebarSourceOverrides = {
    feedsEnabled: false,
    feedsData: undefined,
    foldersEnabled: false,
    foldersData: undefined,
    accountArticlesEnabled: false,
    accountArticlesData: undefined,
    starredArticlesEnabled: false,
    starredArticlesData: undefined,
    starredCountEnabled: false,
    starredCountData: undefined,
    tagArticleCountsEnabled: false,
    tagArticleCountsData: undefined,
  };

  return { sidebarSourceOverrides };
});

let syncCompletedListener: (() => void) | null = null;
let syncProgressListener:
  | ((event: {
      stage: string;
      kind: string;
      total: number;
      completed: number;
      account_id?: string | null;
      account_name?: string | null;
      success?: boolean | null;
    }) => void)
  | null = null;
let syncWarningListener:
  | ((
      event: Array<{
        account_id: string;
        account_name: string;
        message: string;
        kind?: "generic" | "retry_pending" | "retry_scheduled";
        retry_at?: string;
        retry_in_seconds?: number;
      }>,
    ) => void)
  | null = null;
const renderedFeedContextMenuFeeds: Array<{ id: string; folder_id: string | null }> = [];

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, callback: (event?: unknown) => void) => {
    if (eventName === "sync-completed") {
      syncCompletedListener = () => callback();
    }
    if (eventName === "sync-progress") {
      syncProgressListener = (event) => callback(event);
    }
    if (eventName === "sync-warning") {
      syncWarningListener = (event) => callback(event);
    }
    return () => {
      if (eventName === "sync-completed") {
        syncCompletedListener = null;
      }
      if (eventName === "sync-progress") {
        syncProgressListener = null;
      }
      if (eventName === "sync-warning") {
        syncWarningListener = null;
      }
    };
  }),
}));

vi.mock("@/hooks/use-feeds", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-feeds")>("@/hooks/use-feeds");
  return {
    ...actual,
    useFeeds: (accountId: string | null) => {
      const result = actual.useFeeds(accountId);
      return sidebarSourceOverrides.feedsEnabled ? { ...result, data: sidebarSourceOverrides.feedsData } : result;
    },
  };
});

vi.mock("@/hooks/use-folders", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-folders")>("@/hooks/use-folders");
  return {
    ...actual,
    useFolders: (accountId: string | null) => {
      const result = actual.useFolders(accountId);
      return sidebarSourceOverrides.foldersEnabled ? { ...result, data: sidebarSourceOverrides.foldersData } : result;
    },
  };
});

vi.mock("@/hooks/use-articles", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-articles")>("@/hooks/use-articles");
  return {
    ...actual,
    useAccountArticles: (accountId: string | null) => {
      const result = actual.useAccountArticles(accountId);
      return sidebarSourceOverrides.accountArticlesEnabled
        ? { ...result, data: sidebarSourceOverrides.accountArticlesData }
        : result;
    },
    useStarredArticles: (accountId: string | null) => {
      const result = actual.useStarredArticles(accountId);
      return sidebarSourceOverrides.starredArticlesEnabled
        ? { ...result, data: sidebarSourceOverrides.starredArticlesData }
        : result;
    },
    useAccountStarredCount: (_accountId: string | null) => {
      const result = actual.useAccountStarredCount(_accountId);
      return sidebarSourceOverrides.starredCountEnabled
        ? { ...result, data: sidebarSourceOverrides.starredCountData }
        : { ...result, data: 0 };
    },
  };
});

vi.mock("@/hooks/use-tags", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-tags")>("@/hooks/use-tags");
  return {
    ...actual,
    useTagArticleCounts: (accountId: string | null) => {
      const result = actual.useTagArticleCounts(accountId);
      return sidebarSourceOverrides.tagArticleCountsEnabled
        ? { ...result, data: sidebarSourceOverrides.tagArticleCountsData }
        : result;
    },
  };
});

vi.mock("@/components/reader/feed-context-menu", () => ({
  FeedContextMenuContent: ({ feed }: { feed: { id: string; folder_id: string | null } }) => {
    renderedFeedContextMenuFeeds.push(feed);
    return null;
  },
}));

vi.mock("@/dev/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({
    intent: devIntentState.intent,
    ready: true,
  }),
}));

const queryFeedButton = (feedId: string): HTMLButtonElement | null => {
  const element = document.querySelector(`[data-feed-id="${feedId}"]`);
  if (element === null) {
    return null;
  }
  expect(element).toBeInstanceOf(HTMLButtonElement);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Expected feed element for ${feedId} to be a button`);
  }
  return element;
};

type SidebarNavigationTargetGetter = () => HTMLButtonElement[];

async function moveFocusDownThroughSidebarTargets(getTargets: SidebarNavigationTargetGetter, steps: number) {
  // Roving focus is order-dependent: each ArrowDown must observe the focus state produced by the previous key event.
  let sequence = Promise.resolve();

  for (let index = 0; index < steps; index += 1) {
    sequence = sequence.then(async () => {
      const currentTarget = getTargets()[index];
      const nextTarget = getTargets()[index + 1];
      if (currentTarget === undefined || nextTarget === undefined) {
        throw new Error(`Expected sidebar navigation target pair at index ${index}`);
      }
      expect(currentTarget).toHaveFocus();
      fireEvent.keyDown(currentTarget, { key: "ArrowDown" });
      await waitFor(() => {
        expect(nextTarget).toHaveFocus();
      });
    });
  }

  await sequence;
}

describe("Sidebar", () => {
  beforeEach(() => {
    syncCompletedListener = null;
    syncProgressListener = null;
    syncWarningListener = null;
    renderedFeedContextMenuFeeds.length = 0;
    resetDevIntentState(devIntentState);
    sidebarSourceOverrides.feedsEnabled = false;
    sidebarSourceOverrides.feedsData = undefined;
    sidebarSourceOverrides.foldersEnabled = false;
    sidebarSourceOverrides.foldersData = undefined;
    sidebarSourceOverrides.accountArticlesEnabled = false;
    sidebarSourceOverrides.accountArticlesData = undefined;
    sidebarSourceOverrides.starredArticlesEnabled = false;
    sidebarSourceOverrides.starredArticlesData = undefined;
    sidebarSourceOverrides.starredCountEnabled = false;
    sidebarSourceOverrides.starredCountData = undefined;
    sidebarSourceOverrides.tagArticleCountsEnabled = false;
    sidebarSourceOverrides.tagArticleCountsData = undefined;
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    resetManualSyncCooldownForTests();
    setupTauriMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the reader locale for the navigation landmark", async () => {
    await i18n.changeLanguage("en");
    const QueryWrapper = createWrapper();
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>,
      { wrapper: QueryWrapper },
    );

    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeInTheDocument();

    await i18n.changeLanguage("ja");
    rerender(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>,
    );

    expect(screen.getByRole("navigation", { name: "サイドバー" })).toBeInTheDocument();
  });

  it("keeps the sidebar in loading state and hides the add-feed CTA while the selected account feeds are unresolved", async () => {
    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
        case "list_feeds":
          return new Promise(() => {});
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(
      screen.queryByRole("button", { name: /Press \+ to add a feed|\+ でフィードを追加/ }),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("sidebar-feed-tree-skeleton")).toBeInTheDocument();
  });

  it("shows the add-feed CTA only after the selected account feeds resolve to empty data", async () => {
    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
        case "list_feeds":
          return [];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText(/Press \+ to add a feed|\+ でフィードを追加/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading…|読み込み中…/)).not.toBeInTheDocument();
  });

  it("opens the subscriptions index from the sidebar footer", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Manage Subscriptions" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
  });

  it("keeps loading when feeds resolve but folders are still unresolved", async () => {
    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return new Promise(() => {});
        case "list_feeds":
          return [];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Loading…|読み込み中…/)).toBeInTheDocument();
  });

  it("keeps loading when folders resolve but feeds are still unresolved", async () => {
    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return new Promise(() => {});
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Loading…|読み込み中…/)).toBeInTheDocument();
  });

  it("keeps the rendered feed tree on the adopted snapshot while selected account data is pending again", async () => {
    sidebarSourceOverrides.feedsEnabled = true;
    sidebarSourceOverrides.foldersEnabled = true;
    sidebarSourceOverrides.feedsData = [{ ...sampleFeeds[0], title: "Snapshot Feed" }];
    sidebarSourceOverrides.foldersData = [];

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Snapshot Feed")).toBeInTheDocument();

    sidebarSourceOverrides.feedsData = undefined;
    sidebarSourceOverrides.foldersData = undefined;
    rerender(<Sidebar />);

    expect(await screen.findByText("Snapshot Feed")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-feed-tree-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
  });

  it("does not reuse the previous account feed tree snapshot while the next account is unresolved", async () => {
    sidebarSourceOverrides.feedsEnabled = true;
    sidebarSourceOverrides.foldersEnabled = true;
    sidebarSourceOverrides.feedsData = [{ ...sampleFeeds[0], title: "Account 1 Snapshot Feed" }];
    sidebarSourceOverrides.foldersData = [];

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Account 1 Snapshot Feed")).toBeInTheDocument();

    useUiStore.setState({
      selectedAccountId: "acc-2",
    });
    sidebarSourceOverrides.feedsData = undefined;
    sidebarSourceOverrides.foldersData = undefined;
    rerender(<Sidebar />);

    expect(screen.queryByText("Account 1 Snapshot Feed")).not.toBeInTheDocument();
    expect(await screen.findByText(/Loading…|読み込み中…/)).toBeInTheDocument();
  });

  it("keeps loading and suppresses the add-feed CTA when an adopted empty snapshot starts refetching", async () => {
    sidebarSourceOverrides.feedsEnabled = true;
    sidebarSourceOverrides.foldersEnabled = true;
    sidebarSourceOverrides.feedsData = [];
    sidebarSourceOverrides.foldersData = [];

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText(/Press \+ to add a feed|\+ でフィードを追加/)).toBeInTheDocument();

    sidebarSourceOverrides.feedsData = undefined;
    sidebarSourceOverrides.foldersData = undefined;
    rerender(<Sidebar />);

    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Loading…|読み込み中…/)).toBeInTheDocument();
  });

  it("keeps the starred smart-view count during refetch", async () => {
    sidebarSourceOverrides.starredCountEnabled = true;
    sidebarSourceOverrides.starredCountData = 1;
    sidebarSourceOverrides.tagArticleCountsEnabled = true;
    sidebarSourceOverrides.tagArticleCountsData = {};
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_folders":
          return [];
        case "list_tags":
          return [];
        case "list_account_articles":
          return [];
        case "count_account_starred_articles":
          return 0;
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Starred/ })).toHaveTextContent("1");

    sidebarSourceOverrides.starredCountData = undefined;
    rerender(<Sidebar />);

    expect(await screen.findByRole("button", { name: /Starred/ })).toHaveTextContent("1");
  });

  it("shows the starred smart-view count from the dedicated starred source", async () => {
    sidebarSourceOverrides.starredCountEnabled = true;
    sidebarSourceOverrides.starredCountData = 1;

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_folders":
          return [];
        case "list_tags":
          return [];
        case "list_account_articles":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({
      prefs: { show_starred_count: "true" },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Starred/ })).toHaveTextContent("1");
  });

  it("keeps tag badge counts during refetch", async () => {
    sidebarSourceOverrides.tagArticleCountsEnabled = true;
    sidebarSourceOverrides.tagArticleCountsData = { "tag-1": 3 };

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_folders":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "list_account_articles":
          return [];
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Important/ })).toHaveTextContent("3");

    sidebarSourceOverrides.tagArticleCountsData = undefined;
    rerender(<Sidebar />);

    expect(await screen.findByRole("button", { name: /Important/ })).toHaveTextContent("3");
  });

  it("shows loading instead of the add-feed CTA when switching to a different account that is still unresolved", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return args.accountId === "acc-1"
            ? [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }]
            : new Promise(() => {});
        case "list_feeds":
          return args.accountId === "acc-1"
            ? [{ ...sampleFeeds[0], title: "Account A Feed", folder_id: "folder-1" }]
            : new Promise(() => {});
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-1"]),
    });

    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Account A Feed")).toBeInTheDocument();

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-2",
      selection: { type: "smart", kind: "unread" },
    });
    rerender(<Sidebar />);

    expect(await screen.findByText(/Loading…|読み込み中…/)).toBeInTheDocument();
    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
  });

  it("keeps smart views and the subscriptions header outside the scroll area and delegates smart view selection", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const smartViewsHeading = screen.getByText("Smart views");
    const unreadButton = screen.getByRole("button", { name: /Unread/ });
    const feedsHeader = screen.getByRole("button", { name: "Subscriptions" });

    expect(smartViewsHeading.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(unreadButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(feedsHeader.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(feedsHeader).toHaveClass("rounded-lg");

    await user.click(unreadButton);
    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
  });

  it("selects starred smart view and the starred footer filter", async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      viewMode: "all",
    });
    render(<Sidebar />, { wrapper: createWrapper() });

    const starredButton = screen.getByRole("button", { name: /Starred/ });

    await user.click(starredButton);

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("opens smart view context menus and confirms unstar-all separately from mark-read preference", async () => {
    const commandCalls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      commandCalls.push({ cmd, args });
      return undefined;
    });
    sidebarSourceOverrides.starredCountEnabled = true;
    sidebarSourceOverrides.starredCountData = 2;
    usePreferencesStore.setState({ prefs: { ask_before_mark_all: "false" }, loaded: true });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: /Unread/ }));
    expect(await screen.findByRole("menuitem", { name: "Mark all as read" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Mark old unread as read" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Mark old unread as read" })).toBeNull());

    fireEvent.contextMenu(await screen.findByRole("button", { name: /Starred/ }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Unstar all" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("menuitem", { name: "Unstar all" }));

    expect(useUiStore.getState().confirmDialog.message).toMatch(/^Unstar \d+ articles\?$/);
    expect(commandCalls.some((call) => call.cmd === "unstar_account_articles")).toBe(false);

    act(() => {
      useUiStore.getState().confirmDialog.onConfirm?.();
    });

    await waitFor(() =>
      expect(commandCalls).toContainEqual({
        cmd: "unstar_account_articles",
        args: { accountId: "acc-1" },
      }),
    );
  });

  it("clears recently viewed history from the recent smart view context menu", async () => {
    const commandCalls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      commandCalls.push({ cmd, args });
      return undefined;
    });

    render(
      <>
        <Sidebar />
        <AppConfirmDialog />
      </>,
      { wrapper: createWrapper() },
    );

    fireEvent.contextMenu(await screen.findByRole("button", { name: /Recently Viewed/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear history" }));
    expect(screen.getAllByText("Clear history").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));

    await waitFor(() =>
      expect(commandCalls).toContainEqual({
        cmd: "clear_article_view_history",
        args: { accountId: "acc-1" },
      }),
    );
  });

  it("opens account settings from the account title context menu", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: /Local/ }));

    const settingsItem = await screen.findByRole("menuitem", { name: "Account settings" });
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    fireEvent.click(settingsItem);

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAccountId).toBe("acc-1");
    expect(useUiStore.getState().settingsAddAccount).toBe(false);
  });

  it("keeps starred subscription context when selecting a feed from the starred smart view", async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Starred/ }));

    expect(await screen.findByRole("button", { name: /Tech Blog/ })).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: /News/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tech Blog/ }));

    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("keeps starred subscription context when selecting a folder from the starred smart view", async () => {
    const user = userEvent.setup();
    sidebarSourceOverrides.feedsEnabled = true;
    sidebarSourceOverrides.feedsData = [
      { ...sampleFeeds[0], id: "feed-starred", title: "Starred Feed", folder_id: "folder-starred", unread_count: 0 },
      { ...sampleFeeds[1], id: "feed-plain", title: "Plain Feed", folder_id: "folder-plain", unread_count: 0 },
    ];
    sidebarSourceOverrides.foldersEnabled = true;
    sidebarSourceOverrides.foldersData = [
      { id: "folder-starred", account_id: "acc-1", name: "Starred Folder", sort_order: 0 },
      { id: "folder-plain", account_id: "acc-1", name: "Plain Folder", sort_order: 1 },
    ];
    sidebarSourceOverrides.starredArticlesEnabled = true;
    sidebarSourceOverrides.starredArticlesData = [
      {
        id: "star-1",
        feed_id: "feed-starred",
        title: "Starred article",
        content_sanitized: "<p>starred</p>",
        summary: null,
        url: "https://example.com/starred",
        author: null,
        published_at: "2026-05-02T00:00:00Z",
        thumbnail: null,
        is_read: true,
        is_starred: true,
      },
    ];
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Starred/ }));

    expect(await screen.findByRole("button", { name: "Select folder Starred Folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select folder Plain Folder" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select folder Starred Folder" }));

    expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-starred" });
    expect(useUiStore.getState().viewMode).toBe("starred");
    expect(screen.getByRole("button", { name: "Select folder Starred Folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select folder Plain Folder" })).not.toBeInTheDocument();
  });

  it("uses the starred article source for the starred subscription tree", async () => {
    const user = userEvent.setup();
    sidebarSourceOverrides.accountArticlesEnabled = true;
    sidebarSourceOverrides.accountArticlesData = [];
    sidebarSourceOverrides.starredArticlesEnabled = true;
    sidebarSourceOverrides.starredArticlesData = [
      {
        id: "star-1",
        feed_id: "feed-1",
        title: "Starred article",
        content_sanitized: "<p>starred</p>",
        summary: null,
        url: "https://example.com/starred",
        author: null,
        published_at: "2026-05-02T00:00:00Z",
        thumbnail: null,
        is_read: true,
        is_starred: true,
      },
    ];
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Starred/ }));

    expect(await screen.findByRole("button", { name: /Tech Blog/ })).toHaveTextContent("1");
    expect(screen.queryByText(/Press \+ to add a feed|\+ でフィードを追加/)).not.toBeInTheDocument();
  });

  it("allows the feed list scroll area to shrink inside the sidebar column layout", () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");

    expect(scrollArea).toHaveClass("flex-1");
    expect(scrollArea).toHaveClass("min-h-0");
  });

  it("marks a subscription feed read from middle click", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      return undefined;
    });
    usePreferencesStore.setState({ prefs: { ask_before_mark_all: "false" }, loaded: true });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.mouseDown(await screen.findByRole("button", { name: /Tech Blog/ }), { button: 1 });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "mark_feed_read",
        args: { feedId: "feed-1" },
      });
    });
  });

  it("marks a subscription folder read from middle click", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: "acc-2", name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], folder_id: "folder-1", unread_count: 5 }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
    usePreferencesStore.setState({ prefs: { ask_before_mark_all: "false" }, loaded: true });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.mouseDown(await screen.findByRole("button", { name: "Select folder Work" }), { button: 1 });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "mark_folder_read",
        args: { folderId: "folder-1" },
      });
    });
  });

  it("preserves folder_id when opening feed context menus for folder-backed feeds", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            {
              ...sampleFeeds[0],
              folder_id: "folder-1",
              title: "Folder Feed",
            },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
    useUiStore.setState({
      ...useUiStore.getState(),
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText("Folder Feed");
    expect(renderedFeedContextMenuFeeds).toContainEqual(
      expect.objectContaining({ id: "feed-1", folder_id: "folder-1" }),
    );
  });

  it("passes the compact sidebar density preference through to folder toggles", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            {
              ...sampleFeeds[0],
              id: "feed-1",
              title: "Folder Feed",
              folder_id: "folder-1",
              unread_count: 2,
            },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    usePreferencesStore.setState({ prefs: { sidebar_density: "compact" }, loaded: true });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const folderToggle = await screen.findByRole("button", { name: "Toggle folder Work" });
    expect(folderToggle).toHaveClass("h-8");
  });

  it("shows only unread feeds from the selected folder when viewMode is unread", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-1" },
      viewMode: "unread",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.queryByText("Read Feed")).not.toBeInTheDocument();
  });

  it("shows all feeds from the selected folder when viewMode is all", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-1" },
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.getByText("Read Feed")).toBeInTheDocument();
  });

  it("hides folders that have no unread feeds in unread smart view", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-unread", account_id: args.accountId, name: "Unread Folder", sort_order: 0 },
            { id: "folder-empty", account_id: args.accountId, name: "Empty Folder", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-unread", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-empty", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
      expandedFolderIds: new Set(["folder-unread", "folder-empty"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Folder")).toBeInTheDocument();
    expect(screen.queryByText("Empty Folder")).not.toBeInTheDocument();
  });

  it("shows only unread feeds in the main list when viewMode is unread", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: null, unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: null, unread_count: 0 },
          ].filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "unread",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.queryByText("Read Feed")).not.toBeInTheDocument();
  });

  it("expands the selected folder when clicking its row", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const folderButton = await screen.findByRole("button", { name: "Select folder Work" });
    await user.click(folderButton);

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-1" });
    expect(useUiStore.getState().expandedFolderIds.has("folder-1")).toBe(true);
  });

  it("updates a feed folder when moving it onto an empty folder", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-empty", account_id: args.accountId, name: "Empty", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], title: "Tech Blog", folder_id: null }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "update_feed_folder":
          return null;
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Drag Tech Blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Empty" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_feed_folder",
        args: { feedId: "feed-1", folderId: "folder-empty" },
      });
    });
  });

  it("moves the feed into the folder panel before the folder update resolves", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let resolveMove: (() => void) | undefined;
    let currentFeeds: Array<(typeof sampleFeeds)[number] & { folder_id: string | null }> = [
      { ...sampleFeeds[0], title: "Tech Blog", folder_id: null },
    ];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-empty", account_id: args.accountId, name: "Empty", sort_order: 0 }];
        case "list_feeds":
          return currentFeeds;
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "update_feed_folder":
          return new Promise((resolve) => {
            resolveMove = () => {
              currentFeeds = [{ ...currentFeeds[0], folder_id: "folder-empty" }];
              resolve(null);
            };
          });
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-empty"]),
    });

    const { container } = render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Drag Tech Blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Empty" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_feed_folder",
        args: { feedId: "feed-1", folderId: "folder-empty" },
      });
    });

    await waitFor(() => {
      const folderPanel = container.querySelector("#feed-tree-folder-panel-folder-empty");
      expect(folderPanel?.querySelector('[data-feed-row-id="feed-1"]')).not.toBeNull();
      expect(container.querySelectorAll('[data-feed-row-id="feed-1"]')).toHaveLength(1);
    });

    resolveMove?.();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Move to Empty" })).not.toBeInTheDocument();
    });
  });

  it("does not call update_feed_folder when moving into the same folder", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], id: "feed-1", title: "Folder Feed", folder_id: "folder-1" }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "update_feed_folder":
          return null;
        default:
          return undefined;
      }
    });
    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-1"]),
    });
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1", startup_folder_expansion: "expand_all" },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Drag Folder Feed" }, { timeout: 5000 }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Work" }, { timeout: 5000 }));

    await flushMicrotasksAndRealTimer();

    expect(calls).not.toContainEqual({
      cmd: "update_feed_folder",
      args: { feedId: "feed-1", folderId: "folder-1" },
    });
  });

  it("clears drag state when the feeds section closes mid-drag", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], title: "Tech Blog", folder_id: null }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const handle = await screen.findByRole("button", { name: "Drag Tech Blog" });
    fireEvent.click(handle);

    expect(await screen.findByRole("button", { name: "Move to Work" })).toBeInTheDocument();

    // These clicks intentionally stay sequential because the second click depends on the collapsed state from the first.
    await user.click(screen.getByRole("button", { name: "Subscriptions" }));
    await user.click(screen.getByRole("button", { name: "Subscriptions" }));

    expect(screen.queryByRole("button", { name: "Move to Work" })).not.toBeInTheDocument();
  });

  it("hides read feeds by default and shows them again in all view", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Tech Blog", account_id: args.accountId, unread_count: 5 },
            {
              ...sampleFeeds[1],
              id: "feed-read",
              title: "News",
              account_id: args.accountId,
              folder_id: null,
              unread_count: 0,
            },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    const { unmount } = render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("News")).not.toBeInTheDocument();

    unmount();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "all",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("News")).toBeInTheDocument();
  });

  it("shows unread count for feeds with unread articles", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Tech Blog has unread_count: 5 (also shown in total unread)
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });

  it("does not auto-select the first account while the direct web preview dev intent is active", async () => {
    devIntentState.intent = "open-web-preview-url";
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_folders":
          return [];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: "https://example.com",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBeNull();
    });

    expect(useUiStore.getState().selectedAccountId).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com");
  });

  it("selects the unread smart view when choosing the startup account", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-1");
      expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
    });

    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("moves focus to the newly selected feed during keyboard feed navigation", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(queryFeedButton("feed-1")).not.toBeNull();
    });
    const alphaFeed = queryFeedButton("feed-1");
    expect(alphaFeed).not.toBeNull();
    if (!alphaFeed) {
      throw new Error("Expected feed button for feed-1");
    }
    await user.click(alphaFeed);
    expect(alphaFeed).toHaveFocus();

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 as const }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-2" });
    });

    const betaFeed = queryFeedButton("feed-2");
    expect(betaFeed).not.toBeNull();
    if (!betaFeed) {
      throw new Error("Expected feed button for feed-2");
    }

    await waitFor(() => {
      expect(betaFeed).toHaveFocus();
    });
  });

  it("moves the selected subscription with arrow keys from a focused feed row", async () => {
    const user = userEvent.setup();

    usePreferencesStore.setState({
      prefs: { open_first_article_on_feed_selection: "true" },
      loaded: true,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_articles":
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                {
                  id: `${args.feedId}-art-1`,
                  feed_id: args.feedId,
                  title: `${args.feedId} Article`,
                  content_sanitized: "<p>hello</p>",
                  summary: "hello",
                  url: `https://example.com/${args.feedId}`,
                  author: null,
                  published_at: "2026-04-24T00:00:00Z",
                  thumbnail: null,
                  is_read: false,
                  is_starred: false,
                },
              ]);
            }, 20);
          });
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(
      <>
        <Sidebar />
        <ArticleList />
      </>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(queryFeedButton("feed-1")).not.toBeNull();
    });
    const alphaFeed = queryFeedButton("feed-1");
    expect(alphaFeed).not.toBeNull();
    if (!alphaFeed) {
      throw new Error("Expected feed button for feed-1");
    }
    await user.click(alphaFeed);
    expect(alphaFeed).toHaveFocus();

    fireEvent.keyDown(alphaFeed, { key: "ArrowDown" });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-2" });
    });

    const betaFeed = queryFeedButton("feed-2");
    expect(betaFeed).not.toBeNull();
    if (!betaFeed) {
      throw new Error("Expected feed button for feed-2");
    }

    await waitFor(() => {
      expect(betaFeed).toHaveFocus();
    });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("feed-2-art-1");
      expect(betaFeed).toHaveFocus();
    });

    fireEvent.keyDown(betaFeed, { key: "ArrowUp" });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(alphaFeed).toHaveFocus();
    });
  });

  it("moves focus through all sidebar navigation rows with arrow keys", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_articles":
        case "list_account_articles":
          return [];
        case "list_tags":
          return sampleTags;
        case "get_tag_article_counts":
          return { "tag-1": 2, "tag-2": 1 };
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await Promise.all([screen.findByText("Alpha Feed"), screen.findByText("Tech")]);
    const getTargets = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sidebar-navigation-target="true"]')).filter(
        (target) => !target.closest('[aria-hidden="true"]'),
      );

    expect(getTargets().length).toBeGreaterThanOrEqual(8);
    getTargets()[0]?.focus();

    await moveFocusDownThroughSidebarTargets(getTargets, 6);

    const currentTarget = getTargets()[6];
    const previousTarget = getTargets()[5];
    expect(currentTarget).toHaveFocus();
    fireEvent.keyDown(currentTarget, { key: "ArrowUp" });

    await waitFor(() => {
      expect(previousTarget).toHaveFocus();
    });
  });

  it("skips collapsed folder children and disabled rows during sidebar roving navigation", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-closed", account_id: args.accountId, name: "Closed Folder", sort_order: 0 },
            { id: "folder-open", account_id: args.accountId, name: "Open Folder", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            {
              ...sampleFeeds[0],
              id: "feed-hidden",
              title: "Hidden Feed",
              folder_id: "folder-closed",
              unread_count: 1,
            },
            { ...sampleFeeds[1], id: "feed-open", title: "Open Feed", folder_id: "folder-open", unread_count: 1 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-open"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const closedFolder = await screen.findByRole("button", { name: "Select folder Closed Folder" });
    const hiddenFeed = queryFeedButton("feed-hidden");
    const openFolder = screen.getByRole("button", { name: "Select folder Open Folder" });

    expect(hiddenFeed).not.toBeNull();
    if (!hiddenFeed) {
      throw new Error("Expected hidden feed button to stay mounted");
    }
    expect(hiddenFeed.closest('[aria-hidden="true"]')).toBeInTheDocument();

    closedFolder.focus();
    fireEvent.keyDown(closedFolder, { key: "ArrowDown" });

    await waitFor(() => {
      expect(openFolder).toHaveFocus();
    });

    openFolder.setAttribute("disabled", "");
    closedFolder.focus();
    fireEvent.keyDown(closedFolder, { key: "ArrowDown" });

    await waitFor(() => {
      expect(queryFeedButton("feed-open")).toHaveFocus();
    });
  });

  it("opens the focused feed with Enter from the sidebar", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      focusedPane: "sidebar",
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText("Beta Feed");
    const betaFeed = queryFeedButton("feed-2");
    expect(betaFeed).not.toBeNull();
    if (!betaFeed) {
      throw new Error("Expected feed button for feed-2");
    }
    betaFeed.focus();
    expect(betaFeed).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-2" });
      expect(useUiStore.getState().focusedPane).toBe("list");
    });
  });

  it("moves focus from a selected feed to the article list with ArrowRight", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      focusedPane: "sidebar",
      viewMode: "all",
    });

    render(
      <>
        <Sidebar />
        <ArticleList />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("button", { name: /Tech Blog/ });
    const selectedFeed = queryFeedButton("feed-1");
    expect(selectedFeed).not.toBeNull();
    if (!selectedFeed) {
      throw new Error("Expected feed button for feed-1");
    }
    selectedFeed.focus();

    fireEvent.keyDown(selectedFeed, { key: "ArrowRight" });

    await waitFor(() => {
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(screen.getByRole("option", { name: /First Article/ })).toHaveFocus();
    });
  });

  it("moves focus from a selected smart view to the article list with ArrowRight", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      focusedPane: "sidebar",
      viewMode: "unread",
    });

    render(
      <>
        <Sidebar />
        <ArticleList />
      </>,
      { wrapper: createWrapper() },
    );

    const unreadButton = await screen.findByRole("button", { name: /Unread/ });
    unreadButton.focus();

    fireEvent.keyDown(unreadButton, { key: "ArrowRight" });

    await waitFor(() => {
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(screen.getByRole("option", { name: /First Article/ })).toHaveFocus();
    });
  });

  it("opens the account pane from a selected feed with ArrowLeft", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      focusedPane: "sidebar",
      viewMode: "all",
    });

    render(
      <>
        <AccountPane />
        <Sidebar />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByText("Tech Blog");
    const selectedFeed = queryFeedButton("feed-1");
    expect(selectedFeed).not.toBeNull();
    if (!selectedFeed) {
      throw new Error("Expected feed button for feed-1");
    }
    selectedFeed.focus();

    fireEvent.keyDown(selectedFeed, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(useUiStore.getState().accountPaneOpen).toBe(true);
      expect(
        within(screen.getByRole("navigation", { name: "Accounts" })).getByRole("button", { name: /Local/ }),
      ).toHaveFocus();
    });
  });

  it("opens the account pane instead of the account switcher popover from the account title on wide layout", async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      focusedPane: "sidebar",
      layoutMode: "wide",
    });

    render(
      <>
        <AccountPane />
        <Sidebar />
      </>,
      { wrapper: createWrapper() },
    );

    const sidebar = screen.getByRole("navigation", { name: "Sidebar" });
    const trigger = await within(sidebar).findByRole("button", { name: /Local/ });

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: "Accounts" })).not.toBeInTheDocument();
      expect(useUiStore.getState().accountPaneOpen).toBe(true);
      expect(
        within(screen.getByRole("navigation", { name: "Accounts" })).getByRole("button", { name: /Local/ }),
      ).toHaveFocus();
    });
  });

  it("keeps the account title as static text on wide layout when only one account exists", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return [sampleAccounts[0]];
        case "list_folders":
          return [];
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      focusedPane: "sidebar",
      layoutMode: "wide",
    });

    render(
      <>
        <AccountPane />
        <Sidebar />
      </>,
      { wrapper: createWrapper() },
    );

    const sidebar = screen.getByRole("navigation", { name: "Sidebar" });
    const trigger = await within(sidebar).findByRole("button", { name: /Local/ });

    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-expanded");

    await user.click(trigger);

    expect(useUiStore.getState().accountPaneOpen).toBe(false);
    expect(
      within(screen.getByRole("navigation", { name: "Accounts" })).getByRole("button", { name: /Local/ }),
    ).not.toHaveFocus();
  });

  it("moves focus inside the account pane with Up and Down keys", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      accountPaneOpen: true,
      focusedPane: "sidebar",
    });

    render(<AccountPane />, { wrapper: createWrapper() });

    const accountPane = screen.getByRole("navigation", { name: "Accounts" });
    const localAccount = await within(accountPane).findByRole("button", { name: /Local/ });
    const freshRssAccount = within(accountPane).getByRole("button", { name: /FreshRSS/ });

    localAccount.focus();
    expect(localAccount).toHaveFocus();

    fireEvent.keyDown(localAccount, { key: "Down" });
    expect(freshRssAccount).toHaveFocus();

    fireEvent.keyDown(freshRssAccount, { key: "Up" });
    expect(localAccount).toHaveFocus();
  });

  it("keeps selected and focused account pane rows visually distinct", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      accountPaneOpen: true,
      focusedPane: "sidebar",
    });

    render(<AccountPane />, { wrapper: createWrapper() });

    const accountPane = screen.getByRole("navigation", { name: "Accounts" });
    const localAccount = await within(accountPane).findByRole("button", { name: /Local/ });
    const freshRssAccount = within(accountPane).getByRole("button", { name: /FreshRSS/ });

    freshRssAccount.focus();

    expect(localAccount).toHaveAttribute("aria-current", "true");
    expect(localAccount).toHaveAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE, "true");
    expect(localAccount).toHaveAttribute(ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE, "true");
    expect(localAccount).not.toHaveAttribute("data-sidebar-navigation-target");
    expect(localAccount).toHaveClass(
      "before:left-0",
      "before:w-0.5",
      "before:bg-border-strong/70",
      "before:opacity-70",
    );
    expect(localAccount.querySelector("svg")).toBeNull();
    expect(freshRssAccount).toHaveFocus();
    expect(freshRssAccount).not.toHaveAttribute("aria-current");
    expect(freshRssAccount).not.toHaveAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE);
    expect(freshRssAccount).toHaveAttribute(ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE, "true");
    expect(freshRssAccount.querySelector("svg")).toBeNull();
  });

  it.each([
    "Enter",
    "ArrowRight",
  ] as const)("selects the focused account with %s and returns focus to the unread smart view", async (key) => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      accountPaneOpen: true,
      focusedPane: "sidebar",
      layoutMode: "wide",
    });

    render(
      <>
        <AccountPane />
        <Sidebar />
      </>,
      { wrapper: createWrapper() },
    );

    const accountPane = screen.getByRole("navigation", { name: "Accounts" });
    const freshRssAccount = await within(accountPane).findByRole("button", { name: /FreshRSS/ });
    const sidebar = screen.getByRole("navigation", { name: "Sidebar" });
    const unreadButton = await within(sidebar).findByRole("button", { name: /Unread/ });

    freshRssAccount.focus();
    fireEvent.keyDown(freshRssAccount, { key });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
      expect(useUiStore.getState().accountPaneOpen).toBe(false);
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
      expect(unreadButton).toHaveFocus();
    });
  });

  it("opens the first article immediately when the reading preference is enabled", async () => {
    const user = userEvent.setup();

    usePreferencesStore.setState({
      prefs: { open_first_article_on_feed_selection: "true" },
      loaded: true,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_articles":
          return [
            {
              id: "art-1",
              feed_id: "feed-2",
              title: "First Beta Article",
              content_sanitized: "<p>hello</p>",
              summary: "hello",
              url: "https://example.com/beta-1",
              author: null,
              published_at: "2026-04-24T00:00:00Z",
              thumbnail: null,
              is_read: false,
              is_starred: false,
            },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      focusedPane: "sidebar",
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const betaFeedButtons = await screen.findAllByRole("button", { name: /Beta Feed/ });
    const betaFeed = betaFeedButtons[betaFeedButtons.length - 1];
    if (!betaFeed) {
      throw new Error("Expected Beta Feed button");
    }
    await user.click(betaFeed);

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-2" });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
    });
  });

  it("moves DOM focus to the selected feed when the sidebar pane becomes active", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-2" },
      focusedPane: "sidebar",
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText("Beta Feed");
    const betaFeed = queryFeedButton("feed-2");
    expect(betaFeed).not.toBeNull();
    if (!betaFeed) {
      throw new Error("Expected feed button for feed-2");
    }

    await waitFor(() => {
      expect(betaFeed).toHaveFocus();
    });
  });

  it("expands folders with unread feeds on startup when that policy is enabled", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-open", account_id: args.accountId, name: "Open Me", sort_order: 0 },
            { id: "folder-closed", account_id: args.accountId, name: "Keep Closed", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-open", title: "Unread Feed", folder_id: "folder-open", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-closed", title: "Read Feed", folder_id: "folder-closed", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    usePreferencesStore.setState({
      prefs: { startup_folder_expansion: "unread_folders" },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Select folder Open Me" });

    await waitFor(() => {
      expect(useUiStore.getState().expandedFolderIds.has("folder-open")).toBe(true);
      expect(useUiStore.getState().expandedFolderIds.has("folder-closed")).toBe(false);
    });
  });

  it("does not overwrite stored expanded folders before startup restore is ready", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-restored", account_id: args.accountId, name: "Restored", sort_order: 0 },
            { id: "folder-temp", account_id: args.accountId, name: "Temporary", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-restored", title: "Restored Feed", folder_id: "folder-restored" },
            { ...sampleFeeds[1], id: "feed-temp", title: "Temporary Feed", folder_id: "folder-temp" },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify({ "acc-1": ["folder-restored"] }));
    usePreferencesStore.setState({
      prefs: {
        selected_account_id: "acc-2",
        startup_folder_expansion: "restore_previous",
      },
      loaded: true,
    });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-temp"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders) ?? "{}")).toEqual({
      "acc-1": ["folder-restored"],
    });

    await screen.findByRole("button", { name: "Select folder Restored" });

    await waitFor(() => {
      expect(useUiStore.getState().expandedFolderIds).toEqual(new Set(["folder-restored"]));
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders) ?? "{}")).toEqual({
        accounts: {
          "acc-1": ["folder-restored"],
        },
        version: 1,
      });
    });
  });

  it("shows the previous successful sync time from account sync status on startup", async () => {
    const lastSuccessAt = new Date().toISOString();

    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: lastSuccessAt,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        };
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });
    expect(screen.queryByText("Not synced yet")).not.toBeInTheDocument();
  });

  it("shows sync-history loading text while account sync status is unresolved", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return new Promise(() => {});
      }
      return undefined;
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(screen.getByText("Checking sync history…")).toBeInTheDocument();
    expect(screen.queryByText("Not synced yet")).not.toBeInTheDocument();
  });

  it("keeps showing the previous successful sync time when sync is skipped", async () => {
    const lastSuccessAt = new Date().toISOString();

    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: lastSuccessAt,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        };
      }
      if (cmd === "trigger_sync") return { synced: false, total: 0, succeeded: 0, failed: [], warnings: [] };
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText(/Today at /);

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });
  });

  it("does not replace the previous successful sync time from sync-completed event alone", async () => {
    const lastSuccessAt = new Date().toISOString();

    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: lastSuccessAt,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        };
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText(/Today at /);
    expect(syncCompletedListener).not.toBeNull();

    syncCompletedListener?.();

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });
  });

  it("keeps showing the previous successful sync time when manual sync fails", async () => {
    const lastSuccessAt = new Date().toISOString();
    const calls: MockTauriCommandCall[] = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: lastSuccessAt,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        };
      }
      if (cmd === "trigger_sync") {
        throw { type: "UserVisible", message: "boom" };
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText(/Today at /);
    calls.length = 0;

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "get_account_sync_status").length).toBeGreaterThan(0);
    });
  });

  it("keeps the sync button hoverable during the manual sync cooldown and shows cooldown feedback on retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T02:12:00+09:00"));
    const lastSuccessAt = new Date("2026-04-18T02:12:00+09:00").toISOString();

    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: lastSuccessAt,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        };
      }
      if (cmd === "trigger_sync") {
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const syncButton = screen.getByLabelText("Sync feeds");
    const expectedLastSyncedTime = new Date("2026-04-18T02:12:00+09:00");
    const expectedLastSyncedTimeLabel = `${expectedLastSyncedTime.getHours().toString().padStart(2, "0")}:${expectedLastSyncedTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    expect(syncButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(syncButton);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(syncButton).not.toBeDisabled();
    expect(syncButton).toHaveAttribute("aria-disabled", "true");
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Sync completed",
    });
    expect(screen.getByText(new RegExp(expectedLastSyncedTimeLabel))).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(syncButton);
      await Promise.resolve();
    });
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Please wait a moment before syncing again",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(syncButton).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText(new RegExp(expectedLastSyncedTimeLabel))).toBeInTheDocument();
  });

  it("shows a warning toast when sync completes with anomalies", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") {
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [{ account_id: "acc-2", account_name: "FreshRSS", message: "Skipped 3 entries." }],
        };
      }
      return null;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed with warnings for: FreshRSS",
      });
    });
  });

  it("shows a retry-pending toast when sync completes with queued retries", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") {
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [
            {
              account_id: "acc-2",
              account_name: "FreshRSS",
              message: "Local change will retry on the next sync.",
              kind: "retry_pending",
            },
          ],
        };
      }
      return null;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed, but some changes for FreshRSS will retry next sync",
      });
    });
  });

  it("shows a warning toast from sync-warning events", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    expect(syncWarningListener).not.toBeNull();

    syncWarningListener?.([
      { account_id: "acc-2", account_name: "FreshRSS", message: "Skipped 3 entries." },
      { account_id: "acc-3", account_name: "Local", message: "Reused stale cursor." },
    ]);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed with warnings for: FreshRSS, Local",
      });
    });
  });

  it("shows a retry-pending toast from sync-warning events when queued retries are present", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    expect(syncWarningListener).not.toBeNull();

    syncWarningListener?.([
      {
        account_id: "acc-2",
        account_name: "FreshRSS",
        message: "Local change will retry on the next sync.",
        kind: "retry_pending",
      },
    ]);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed, but some changes for FreshRSS will retry next sync",
      });
    });
  });

  it("shows a scheduled-retry toast from sync-warning events when background sync enters backoff", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    const retryAt = "2026-04-13T03:15:00Z";
    const retryTime = formatAccountSyncRetryTime(retryAt, "en");

    expect(syncWarningListener).not.toBeNull();

    syncWarningListener?.([
      {
        account_id: "acc-2",
        account_name: "FreshRSS",
        message: "Background sync failed and will retry automatically for 'FreshRSS'.",
        kind: "retry_scheduled",
        retry_at: retryAt,
        retry_in_seconds: 120,
      },
    ]);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: retryTime
          ? `Background sync failed for FreshRSS. Retrying at ${retryTime}`
          : "Background sync failed for FreshRSS. Retrying soon",
      });
    });
  });

  it("shows scheduled retry status in the account switcher after sync warnings refresh account sync status", async () => {
    const user = userEvent.setup();
    let freshRssRetryScheduled = false;
    const retryAt = "2026-04-13T03:15:00Z";
    const retryTime = formatAccountSyncRetryTime(retryAt, "en");
    const expectedStatusLabel = retryTime ? `Retrying at ${retryTime}` : "Retrying soon";
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "sidebar",
    });

    setupTauriMocks((cmd, args) => {
      if (cmd === "get_account_sync_status" && args.accountId === "acc-2") {
        return {
          last_success_at: null,
          last_error: freshRssRetryScheduled ? "Network timeout" : null,
          error_count: freshRssRetryScheduled ? 2 : 0,
          next_retry_at: freshRssRetryScheduled ? retryAt : null,
        };
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const trigger = await screen.findByRole("button", { name: /Local/ });
    await user.click(trigger);

    await screen.findByRole("menu", { name: "Accounts" });
    expect(screen.queryByText(expectedStatusLabel)).not.toBeInTheDocument();
    expect(syncWarningListener).not.toBeNull();

    freshRssRetryScheduled = true;
    syncWarningListener?.([
      {
        account_id: "acc-2",
        account_name: "FreshRSS",
        message: "Background sync failed and will retry automatically for 'FreshRSS'.",
        kind: "retry_scheduled",
        retry_at: retryAt,
        retry_in_seconds: 120,
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText(expectedStatusLabel)).toBeInTheDocument();
    });
  });

  it("keeps the sync button idle for manual account sync progress", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const syncButton = await screen.findByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    expect(syncProgressListener).not.toBeNull();
    expect(icon).not.toHaveClass("animate-spin");

    syncProgressListener?.({
      stage: "started",
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-1",
      account_name: "Local",
      success: null,
    });

    await waitFor(() => {
      expect(icon).not.toHaveClass("animate-spin");
    });
  });

  it("spins only the sync button while full sync-progress is active", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const syncButton = await screen.findByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    expect(syncProgressListener).not.toBeNull();
    expect(icon).not.toHaveClass("animate-spin");

    syncProgressListener?.({
      stage: "started",
      kind: "manual_all",
      total: 2,
      completed: 0,
      account_id: null,
      account_name: null,
      success: null,
    });

    await waitFor(() => {
      expect(icon).toHaveClass("animate-spin");
    });

    syncProgressListener?.({
      stage: "finished",
      kind: "manual_all",
      total: 2,
      completed: 2,
      account_id: null,
      account_name: null,
      success: true,
    });

    await waitFor(() => {
      expect(icon).not.toHaveClass("animate-spin");
    });
  });

  it("opens the account switcher with expanded state and closes it on Escape", async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "sidebar",
    });
    render(<Sidebar />, { wrapper: createWrapper() });

    const trigger = await screen.findByRole("button", { name: /Local/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Accounts" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps the account switcher visible on mobile when restoring a saved account", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "sidebar",
    });
    usePreferencesStore.setState({
      prefs: {
        selected_account_id: "acc-2",
      },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
    });
    expect(screen.getByRole("button", { name: /FreshRSS/ })).toBeInTheDocument();
  });

  it("reselects a valid account when the current selection no longer exists", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-missing",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-1");
    });
    expect(screen.getByRole("button", { name: /Local/ })).toBeInTheDocument();
  });

  it("clears the account selection when no accounts remain", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-missing",
    });

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBeNull();
    });
    expect(screen.getByRole("heading", { name: "Ultra RSS" })).toBeInTheDocument();
  });

  it("keeps the subscriptions pane quiet when onboarding is handled in the reader pane", async () => {
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add account" })).not.toBeInTheDocument();
    });
  });

  it("routes the header add-feed action to account settings when no account is available", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add feed" }));

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAddAccount).toBe(true);
  });

  it("hides configurable sections while keeping accounts and feeds visible", async () => {
    usePreferencesStore.setState({
      prefs: {
        show_sidebar_unread: "false",
        show_sidebar_starred: "false",
        show_sidebar_tags: "false",
      },
      loaded: true,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unread/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Starred/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
  });

  it("keeps the feeds and tags section controls alongside the feed scroll area", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return undefined;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const [feedsButton, tagsButton] = await Promise.all([
      screen.findByRole("button", { name: "Subscriptions" }),
      screen.findByRole("button", { name: "Tags" }),
    ]);
    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");

    expect(feedsButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(tagsButton.closest('[data-slot="scroll-area"]')).toBe(scrollArea);
    expect(scrollArea).toBeInTheDocument();
  });

  it("keeps footer actions outside the scroll area and opens settings from the bottom action row", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");
    const subscriptionsIndexButton = await screen.findByRole("button", { name: "Manage Subscriptions" });
    const settingsButton = screen.getByRole("button", { name: "Settings" });
    const footerRow = subscriptionsIndexButton.parentElement;

    expect(subscriptionsIndexButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(settingsButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(scrollArea).toBeInTheDocument();
    expect(footerRow).toHaveClass("border-[var(--sidebar-frame-border)]", "bg-[var(--sidebar-frame-solid-surface)]");
    expect(subscriptionsIndexButton).toHaveClass("focus-visible:bg-[var(--sidebar-hover-surface)]");
    expect(subscriptionsIndexButton).toHaveClass("focus-visible:ring-0");
    expect(subscriptionsIndexButton).not.toHaveClass("focus-visible:ring-ring/40");

    await user.click(settingsButton);

    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it("opens the subscriptions index from the bottom management area", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Manage Subscriptions" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("keeps footer actions clickable after collapsing the feeds section", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Subscriptions" }));

    expect(screen.queryByText("Tech Blog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(useUiStore.getState().settingsOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: "Manage Subscriptions" }));
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
  });

  it("opens the subscriptions section context menu from the root header", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Subscriptions" }));

    expect(await screen.findByRole("menuitem", { name: "Expand all folders" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Collapse all folders" })).toBeInTheDocument();
  });

  it("expands and collapses all folders from the subscriptions section context menu", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 },
            { id: "folder-2", account_id: args.accountId, name: "Personal", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Work Feed", folder_id: "folder-1", unread_count: 2 },
            { ...sampleFeeds[1], id: "feed-2", title: "Personal Feed", folder_id: "folder-2", unread_count: 1 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Subscriptions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Expand all folders" }));

    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set(["folder-1", "folder-2"]));

    fireEvent.contextMenu(screen.getByRole("button", { name: "Subscriptions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Collapse all folders" }));

    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());
  });

  it("keeps subscriptions section context menu actions as no-ops when no folders exist", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return [{ ...sampleFeeds[0], id: "feed-1", title: "Root Feed", folder_id: null, unread_count: 2 }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(["stale-folder"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Subscriptions" }));
    expect(await screen.findByRole("menuitem", { name: "Expand all folders" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Collapse all folders" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Expand all folders" }));
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());

    fireEvent.contextMenu(screen.getByRole("button", { name: "Subscriptions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Collapse all folders" }));
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());
  });

  it("opens the create tag dialog from the tags section add action", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Tags" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add tag" }));

    const dialog = await screen.findByRole("dialog", { name: "Create tag" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("keeps the create tag dialog open and preserves input when tag creation fails", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      if (cmd === "create_tag") {
        throw new Error("boom");
      }
      return undefined;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Tags" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add tag" }));

    const dialog = await screen.findByRole("dialog", { name: "Create tag" });
    const nameInput = within(dialog).getByRole("textbox", { name: "Name" });
    fireEvent.change(nameInput, { target: { value: "Later" } });
    await user.click(within(dialog).getByRole("button", { name: "Create tag" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Create tag" })).toBeInTheDocument();
      expect(
        within(screen.getByRole("dialog", { name: "Create tag" })).getByRole("textbox", { name: "Name" }),
      ).toHaveValue("Later");
    });
  });

  it("opens tag settings from the tags section manage action", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Tags" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manage tags" }));

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("tags");
  });

  it("falls back away from hidden sidebar states, including viewMode-only flows", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "starred",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    usePreferencesStore.getState().setPref("show_sidebar_starred", "false");

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().viewMode).toBe("all");
    });

    useUiStore.getState().selectSmartView("unread");
    usePreferencesStore.getState().setPref("show_sidebar_unread", "false");

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    });

    usePreferencesStore.getState().setPref("show_sidebar_unread", "true");

    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
  });

  it("falls back to unread when the selected tag is no longer available", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-1",
      selection: { type: "tag", tagId: "tag-missing" },
      viewMode: "unread",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
      expect(useUiStore.getState().viewMode).toBe("unread");
    });
  });
});
