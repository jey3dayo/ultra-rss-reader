import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadCommandPaletteDevScenariosMock, runCommandPaletteDevScenarioMock } = vi.hoisted(() => ({
  loadCommandPaletteDevScenariosMock: vi.fn(),
  runCommandPaletteDevScenarioMock: vi.fn(),
}));

vi.mock("@/lib/dev-scenario-runtime", () => ({
  loadRuntimeDevScenarios: loadCommandPaletteDevScenariosMock,
  runRuntimeDevScenario: runCommandPaletteDevScenarioMock,
}));

import { CommandPalette } from "@/components/reader/command-palette";
import { STORAGE_KEYS } from "@/constants/storage";
import * as actions from "@/lib/actions";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const devScenarioFixtures = [
  {
    id: "open-feed-cleanup-broken-references",
    title: "Open feed cleanup broken references",
    keywords: ["feed", "cleanup", "broken", "references"],
  },
  {
    id: "open-add-feed-dialog",
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
  },
] as const;

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
    loadCommandPaletteDevScenariosMock.mockReset().mockResolvedValue(devScenarioFixtures);
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
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "search_articles":
          return sampleArticles.filter((article) =>
            article.title.toLowerCase().includes(String(args.query).toLowerCase()),
          );
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows recent actions when opened without a query", async () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["action:open-settings"]));

    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(screen.getByRole("dialog")).toHaveClass("rounded-2xl");
    expect(screen.getByRole("dialog")).toHaveClass("bg-surface-2/96", "shadow-elevation-3");
    expect(screen.getByPlaceholderText("Search commands…")).toHaveClass("placeholder:text-foreground-soft");
    expect(screen.getByPlaceholderText("Search commands…").closest('[data-slot="command-input-wrapper"]')).toHaveClass(
      "bg-surface-1/72",
    );
    expect(await screen.findByText("Recent Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector('[data-slot="command"]')).toHaveClass(
      "[&_[cmdk-group-heading]]:text-foreground-soft",
    );
    expect(screen.getByTestId("command-palette-prefix-hints")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("option", { name: /Open settings/ })).toHaveClass("rounded-md");
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();
  });

  it("falls back to the normal action list when history is empty", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByText("Recent Actions")).not.toBeInTheDocument();
  });

  it("renders the no-results helper in foreground-soft tone", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "zzzzzz");

    expect(await screen.findByText("No results found")).toHaveClass("text-foreground-soft");
  });

  it("selecting a feed lands on the first visible article and closes the palette", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "@Tech");
    await user.click(await screen.findByRole("option", { name: /Tech Blog/ }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
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

  it("opens the subscriptions index from the action list and closes the palette", async () => {
    const user = userEvent.setup();

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Manage Subscriptions/ }));

    await waitFor(() => {
      expect(useUiStore.getState().subscriptionsWorkspace).toEqual({ kind: "index", cleanupContext: null });
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

    const openSettings = await screen.findByRole("option", { name: /Open settings/ });
    const markAllRead = screen.getByRole("option", { name: /Mark all as read/ });

    expect(openSettings.querySelector('[data-slot="command-shortcut"]')).toHaveClass("text-foreground-soft");
    expect(openSettings).toHaveTextContent("⌘ .");
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
    expect(overlay).toHaveClass("bg-dialog-overlay-readable");
    expect(overlay).toHaveClass("supports-backdrop-filter:backdrop-blur-none");
  });

  it("shows dev scenarios only in dev builds", async () => {
    const first = render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.queryByText("Dev Scenarios")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open feed cleanup broken references/ })).not.toBeInTheDocument();
    expect(loadCommandPaletteDevScenariosMock).not.toHaveBeenCalled();

    first.unmount();

    vi.stubEnv("DEV", true);
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Dev Scenarios", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open feed cleanup broken references/ })).toBeInTheDocument();
    expect(loadCommandPaletteDevScenariosMock).toHaveBeenCalledTimes(1);
  });

  it("filters dev scenarios by title and keyword", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "broken");

    expect(await screen.findByRole("option", { name: /Open feed cleanup broken references/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open add feed dialog/ })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "dialog");

    expect(await screen.findByRole("option", { name: /Open add feed dialog/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open feed cleanup broken references/ })).not.toBeInTheDocument();
  });

  it("shows a dev-only restart action and executes it", async () => {
    const user = userEvent.setup();
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});
    vi.stubEnv("DEV", true);

    render(<CommandPalette />, { wrapper: createWrapper() });

    const restartOption = await screen.findByRole("option", { name: /Restart app/ });
    expect(restartOption).toHaveTextContent("⌘ Shift + R");

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

    await user.click(await screen.findByRole("option", { name: /Open feed cleanup broken references/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup-broken-references");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
    });
  });

  it("does not change existing recent actions history when a scenario runs", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["action:open-settings"]));

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "broken");
    await user.click(await screen.findByRole("option", { name: /Open feed cleanup broken references/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup-broken-references");
      expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(["action:open-settings"]));
    });
  });

  it("shows a toast when running a dev scenario fails", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);
    runCommandPaletteDevScenarioMock.mockRejectedValueOnce(new Error("boom"));

    render(<CommandPalette />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("option", { name: /Open feed cleanup broken references/ }));

    await waitFor(() => {
      expect(runCommandPaletteDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup-broken-references");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
      expect(useUiStore.getState().toastMessage).toEqual({
        message: 'Failed to run dev scenario "open-feed-cleanup-broken-references": boom',
      });
    });
  });
});
