import { Result } from "@praha/byethrow";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadCommandPaletteDevScenariosMock, runCommandPaletteDevScenarioMock } = vi.hoisted(() => ({
  loadCommandPaletteDevScenariosMock: vi.fn(),
  runCommandPaletteDevScenarioMock: vi.fn(),
}));

vi.mock("@/dev/scenario-runtime", () => ({
  loadRuntimeDevScenariosResult: loadCommandPaletteDevScenariosMock,
  runRuntimeDevScenario: runCommandPaletteDevScenarioMock,
}));

import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { CommandPalette } from "@/components/reader/command-palette";
import { useCommandPaletteHandlers } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import { STORAGE_KEYS } from "@/constants/storage";
import * as actions from "@/lib/actions";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const devScenarioFixtures = [
  {
    id: "open-add-feed-dialog",
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
  },
  {
    id: "open-subscriptions-index",
    title: "Open subscriptions index",
    keywords: ["subscriptions", "workspace"],
  },
] as const;

function seedCommandHistory(entries: string[]) {
  localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(entries));
}

function expectCommandHistory(entries: string[]) {
  expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(entries));
}

function expectCommandHistoryCleared() {
  expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    vi.stubEnv("DEV", false);
    loadCommandPaletteDevScenariosMock.mockReset().mockResolvedValue(Result.succeed(devScenarioFixtures));
    runCommandPaletteDevScenarioMock.mockReset().mockResolvedValue(undefined);
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      commandPaletteOpen: true,
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_recent_articles":
          return sampleArticles;
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "search_articles":
          return sampleArticles.filter((article) =>
            article.title.toLowerCase().includes(String(args.query).toLowerCase()),
          );
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows recent actions when opened without a query", async () => {
    seedCommandHistory(["action:open-settings"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const dialog = screen.getByRole("dialog", {
      name: "Open command palette",
      description: "Search commands…",
    });

    expect(dialog).toHaveClass("rounded-2xl");
    expect(dialog).toHaveClass("bg-surface-2/96", "shadow-elevation-3");
    expect(screen.getByPlaceholderText("Search commands…")).toHaveClass("placeholder:text-foreground-soft");
    expect(screen.getByPlaceholderText("Search commands…").closest('[data-slot="command-input-wrapper"]')).toHaveClass(
      "bg-surface-1/72",
    );
    expect(
      await screen.findByText("Recent Actions", {
        selector: "[cmdk-group-heading]",
      }),
    ).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="command"]')).toHaveClass("[&_[cmdk-group-heading]]:text-foreground-soft");
    expect(screen.getByTestId("command-palette-results")).toHaveAttribute("data-motion-phase", "entering");
    expect(screen.getByTestId("command-palette-results")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("command-palette-prefix-hints")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("option", { name: /Open settings/ })).toHaveClass("rounded-md");
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();
  });

  it("uses the command palette top-layer stack contract", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    const dialog = screen.getByRole("dialog", {
      name: "Open command palette",
      description: "Search commands…",
    });
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(dialog).toHaveAttribute("data-stack-layer", "commandPalette");
    expect(dialog).toHaveClass("z-50");
    expect(overlay).toHaveClass("z-50");
  });

  it("shows recent resources without duplicating persisted history entries", async () => {
    seedCommandHistory(["feed:feed-1", "feed:feed-1", "tag:tag-1", "tag:tag-1", "article:art-1", "article:art-1"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const feedsGroup = await screen.findByRole("group", { name: "Feeds" });
    const tagsGroup = screen.getByRole("group", { name: "Tags" });
    const articlesGroup = screen.getByRole("group", { name: "Articles" });

    expect(within(feedsGroup).getAllByRole("option", { name: /Tech Blog/ })).toHaveLength(1);
    expect(within(tagsGroup).getAllByRole("option", { name: /Later/ })).toHaveLength(1);
    expect(within(articlesGroup).getAllByRole("option", { name: /First Article/ })).toHaveLength(1);
    expect(screen.queryByText("Recent Actions")).not.toBeInTheDocument();
  });

  it("adds feed context to article resource results", async () => {
    seedCommandHistory(["article:art-1"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const articleOption = await screen.findByRole("option", { name: /First Article/ });

    expect(articleOption).toHaveTextContent("Tech Blog");
    expect(articleOption).toHaveTextContent("https://example.com/1");
  });

  it("falls back to the normal action list when history is empty", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByText("Recent Actions")).not.toBeInTheDocument();
  });

  it("falls back to the normal action list when recent history entries are stale", async () => {
    seedCommandHistory(["action:removed-action", "feed:feed-1"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByText("Recent Actions")).not.toBeInTheDocument();
  });

  it("does not request feeds when no account is selected", async () => {
    const requestedCommands: string[] = [];
    useUiStore.setState({ selectedAccountId: null });
    setupTauriMocks((cmd, args) => {
      requestedCommands.push(cmd);
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "search_articles":
          return sampleArticles.filter((article) =>
            article.title.toLowerCase().includes(String(args.query).toLowerCase()),
          );
        default:
          return undefined;
      }
    });

    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(requestedCommands).not.toContain("list_feeds");
    expect(screen.queryByRole("option", { name: /Add Feed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sync/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mark all as read/ })).not.toBeInTheDocument();
  });

  it("hides sync actions while a sync is active", async () => {
    useUiStore.setState({
      syncProgress: {
        active: true,
        kind: "manual_all",
        stage: "account_started",
        total: 1,
        completed: 0,
        currentAccountName: "Local",
        activeAccountIds: new Set(["acc-1"]),
      },
    });

    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByRole("option", { name: /Add Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sync/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mark all as read/ })).toBeInTheDocument();
  });

  it("guards unavailable action dispatches from command handlers", () => {
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});
    const closePalette = vi.fn();
    const { result } = renderHook(() =>
      useCommandPaletteHandlers({
        closePalette,
        openShortcutsHelp: vi.fn(),
        showToast: vi.fn(),
        selectedAccountId: null,
        isSyncing: true,
        selectFeedFromCurrentContext: vi.fn(),
        selectTagFromCurrentContext: vi.fn(),
        selectArticle: vi.fn(),
        openFeedLanding: vi.fn(),
        paletteSessionId: 1,
      }),
    );

    result.current.handleActionSelect("sync-all");
    result.current.handleActionSelect("open-add-feed");
    result.current.handleActionSelect("mark-all-read");

    expect(executeAction).not.toHaveBeenCalled();
    expect(closePalette).not.toHaveBeenCalled();
    expectCommandHistoryCleared();
  });

  it("renders the no-results helper in foreground-soft tone", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "zzzzzz");

    expect(await screen.findByText("No results found")).toHaveClass("text-foreground-soft");
  });

  it("removes the no-results live region when command palette results are visible", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    await screen.findByRole("option", { name: /open[-_ ]settings/i });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const input = await screen.findByPlaceholderText(/search commands|command_palette\.placeholder/i);
    await user.type(input, "zzzzzz");

    const emptyStatus = await screen.findByRole("status");
    expect(emptyStatus).toHaveAttribute("aria-live", "polite");
    expect(emptyStatus).toHaveTextContent(/No results found|command_palette\.no_results/);

    await user.clear(input);
    await user.type(input, ">settings");

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("exposes result groups, shortcuts, and empty state with stable accessibility semantics", async () => {
    const user = userEvent.setup();
    seedCommandHistory(["action:open-settings"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const results = await screen.findByRole("listbox", { name: "Command palette results" });
    const recentGroup = screen.getByRole("group", { name: "Recent Actions" });
    const recentSettings = within(recentGroup).getByRole("option", { name: "Open settings" });

    expect(results).toContainElement(recentGroup);
    expect(recentSettings.querySelector('[data-slot="command-shortcut"]')).toHaveAttribute("aria-hidden", "true");

    const input = screen.getByPlaceholderText("Search commands…");
    await user.clear(input);
    await user.type(input, "zzzzzz");

    expect(await screen.findByRole("status")).toHaveTextContent("No results found");
  });

  it("selecting a feed lands on the first visible article and closes the palette", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "@Tech");
    await user.click(await screen.findByRole("option", { name: /Tech Blog/ }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("closes open palette results when the selected account changes", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByRole("option", { name: /Tech Blog/ })).toBeInTheDocument();

    useUiStore.getState().selectAccount("acc-2");

    await waitFor(() => {
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
    expect(screen.getByRole("dialog", { name: "Open command palette" })).toHaveAttribute("data-closed");
  });

  it("filters to action results for the action prefix", async () => {
    const user = userEvent.setup();
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">settings");

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Open settings/ }));

    await waitFor(() => {
      expect(executeAction).toHaveBeenCalledWith("open-settings");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("opens shortcuts help as a pseudo-action without dispatching or rewriting action history", async () => {
    const user = userEvent.setup();
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});
    seedCommandHistory(["action:open-settings"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">shortcuts");
    await user.click(await screen.findByRole("option", { name: /Open shortcuts help/ }));

    await waitFor(() => {
      expect(useUiStore.getState().shortcutsHelpOpen).toBe(true);
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
    expect(executeAction).not.toHaveBeenCalled();
    expectCommandHistory(["action:open-settings"]);
  });

  it("keeps settings discoverable by Japanese and previous settings terms", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">サイドバー");

    expect(await screen.findByRole("option", { name: /Open settings/ })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, ">ナビゲーション");

    expect(await screen.findByRole("option", { name: /Open settings/ })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, ">データ管理");

    expect(await screen.findByRole("option", { name: /Open settings/ })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, ">データ");

    expect(await screen.findByRole("option", { name: /Open settings/ })).toBeInTheDocument();
  });

  it("keeps theme actions discoverable by Japanese settings terms", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">テーマ");

    expect(await screen.findByRole("option", { name: /Theme: Light/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Theme: Dark/ })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, ">外観");

    expect(await screen.findByRole("option", { name: /Theme: Light/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Theme: Dark/ })).toBeInTheDocument();
  });

  it("opens the selected account settings from the action list and closes the palette", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">account");
    await user.click(await screen.findByRole("option", { name: /Account settings/ }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-1");
      expect(useUiStore.getState().settingsAddAccount).toBe(false);
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("opens the accounts settings category from the palette when no account is selected", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ selectedAccountId: null });

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">account");
    await user.click(await screen.findByRole("option", { name: /Account settings/ }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAccountId).toBeNull();
      expect(useUiStore.getState().settingsAddAccount).toBe(false);
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("filters to tag results for the tag prefix and selects the tag", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "#lat");

    expect(await screen.findByText("Tags", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Later/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Later/ }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "tag",
        tagId: "tag-1",
      });
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
      expectCommandHistory(["tag:tag-1"]);
    });
  });

  it("opens the subscriptions index from the action list and closes the palette", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Manage Subscriptions/ }));

    await waitFor(() => {
      expect(useUiStore.getState().subscriptionsWorkspace).toMatchObject({
        kind: "index",
      });
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("shows the current configured shortcuts for palette actions", async () => {
    usePreferencesStore.setState({
      prefs: {
        shortcut_open_settings: "⌘+.",
        shortcut_mark_all_read: "Shift+A",
      },
      loaded: true,
    });

    render(<CommandPalette />, { wrapper: createWrapper() });

    const openSettings = await screen.findByRole("option", {
      name: /Open settings/,
    });
    const markAllRead = screen.getByRole("option", {
      name: /Mark all as read/,
    });

    expect(openSettings.querySelector('[data-slot="command-shortcut"]')).toHaveClass("text-foreground-soft");
    expect(openSettings).toHaveTextContent("⌘ ,");
    expect(markAllRead).toHaveTextContent("Shift + A");
  });

  it("opens shortcuts help from the command palette", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Open shortcuts help/i }));

    await waitFor(() => {
      expect(useUiStore.getState().shortcutsHelpOpen).toBe(true);
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("switches to the dark theme from the command palette and closes it", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Theme: Dark/i }));

    await waitFor(() => {
      expect(usePreferencesStore.getState().prefs.theme).toBe("dark");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("wraps prefix hints so they stay readable on narrow layouts", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByTestId("command-palette-prefix-hints")).toHaveClass("flex-wrap");
    expect(screen.getByTestId("command-palette-prefix-hint-actions")).toHaveClass("rounded-md", "bg-surface-1/72");
    expect(screen.getByTestId("command-palette-prefix-hint-feeds")).toHaveClass("rounded-md", "bg-surface-1/72");
    expect(screen.getByTestId("command-palette-prefix-hint-tags")).toHaveClass("rounded-md", "bg-surface-1/72");
  });

  it("keeps the backdrop readable for feed lookup by disabling blur on the overlay", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    await screen.findByPlaceholderText("Search commands…");

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    const dialog = screen.getByRole("dialog");

    expect(overlay).toHaveClass("bg-dialog-overlay-readable");
    expect(overlay).toHaveClass("supports-backdrop-filter:backdrop-blur-none");
    expect(overlay).toHaveClass("motion-popup-overlay");
    expect(dialog).toHaveClass("motion-popup-dialog");
  });

  it("shows dev scenarios only in dev builds", async () => {
    const first = render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.queryByText("Dev Scenarios")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open add feed dialog/ })).not.toBeInTheDocument();
    expect(loadCommandPaletteDevScenariosMock).not.toHaveBeenCalled();

    first.unmount();

    vi.stubEnv("DEV", true);
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(
      await screen.findByText("Dev Scenarios", {
        selector: "[cmdk-group-heading]",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open add feed dialog/ })).toBeInTheDocument();
    expect(loadCommandPaletteDevScenariosMock).toHaveBeenCalledTimes(1);
  });

  it("filters dev scenarios by title and keyword", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "add");

    expect(await screen.findByRole("option", { name: /Open add feed dialog/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open subscriptions index/ })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "subscriptions");

    expect(await screen.findByRole("option", { name: /Open subscriptions index/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open add feed dialog/ })).not.toBeInTheDocument();
  });

  it("shows a dev-only restart action and executes it", async () => {
    const user = userEvent.setup();
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});
    vi.stubEnv("DEV", true);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const restartOption = await screen.findByRole("option", {
      name: /Restart app/,
    });
    expect(restartOption).not.toHaveTextContent("⌘ Shift + R");

    await user.click(restartOption);

    await waitFor(() => {
      expect(executeAction).toHaveBeenCalledWith("restart-app");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("runs a dev scenario without writing to recent history and closes the palette", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Open add feed dialog/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-add-feed-dialog");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
      expectCommandHistoryCleared();
    });
  });

  it("does not change existing recent actions history when a scenario runs", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);
    seedCommandHistory(["action:open-settings"]);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "add");
    await user.click(await screen.findByRole("option", { name: /Open add feed dialog/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-add-feed-dialog");
      expectCommandHistory(["action:open-settings"]);
    });
  });

  it("shows a toast when running a dev scenario fails", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);
    runCommandPaletteDevScenarioMock.mockRejectedValueOnce(new Error("boom"));

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Open add feed dialog/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-add-feed-dialog");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
      expect(useUiStore.getState().toastMessage).toEqual({
        message: 'Failed to run dev scenario "open-add-feed-dialog": boom',
      });
    });
  });
});
