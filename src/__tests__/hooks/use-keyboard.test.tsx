import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

type MockCall = {
  cmd: string;
  args: Record<string, unknown>;
};

function renderAppShell(calls: MockCall[]) {
  setupTauriMocks((cmd, args) => {
    calls.push({ cmd, args });

    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      case "list_articles":
        return sampleArticles.filter((article) => article.feed_id === args.feedId);
      case "list_account_articles":
        return sampleArticles.filter((article) =>
          sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
        );
      case "list_folders":
      case "list_tags":
      case "get_article_tags":
      case "search_articles":
        return [];
      case "mark_article_read":
      case "mark_articles_read":
      case "toggle_article_star":
      case "open_in_browser":
      case "trigger_sync":
        return null;
      default:
        return undefined;
    }
  });

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    layoutMode: "wide",
    selectedAccountId: "acc-1",
    selection: { type: "feed", feedId: "feed-1" },
    selectedArticleId: "art-1",
    contentMode: "reader",
  });
  usePreferencesStore.setState({
    prefs: {
      after_reading: "do_nothing",
      ask_before_mark_all: "false",
    },
    loaded: true,
  });

  return render(<AppShell />, { wrapper: createWrapper() });
}

describe("useKeyboard", () => {
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
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1400,
    });
  });

  it("pressing m toggles the selected article to read", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "m" });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "mark_article_read",
        args: { articleId: "art-1", read: true },
      });
    });
  });

  it("pressing m toggles the selected article back to unread", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_folders":
        case "list_tags":
        case "get_article_tags":
        case "search_articles":
          return [];
        case "mark_article_read":
        case "mark_articles_read":
        case "toggle_article_star":
        case "open_in_browser":
        case "trigger_sync":
          return null;
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-2",
      viewMode: "all",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: {
        after_reading: "do_nothing",
        ask_before_mark_all: "false",
      },
      loaded: true,
    });

    render(<AppShell />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "Second Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "m" });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "mark_article_read",
        args: { articleId: "art-2", read: false },
      });
    });
  });

  it("pressing s toggles the selected article star", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "s" });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "toggle_article_star",
        args: { articleId: "art-1", starred: true },
      });
    });
  });

  it("pressing v opens the selected article in Web Preview", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "v" });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    expect(calls.map(({ cmd }) => cmd)).not.toContain("open_in_browser");
  });

  it("pressing b opens the selected article in the external browser", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "b" });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/1", background: false },
      });
    });
  });

  it("pressing a marks unread articles in the current list as read", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    calls.length = 0;

    fireEvent.keyDown(window, { key: "a" });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "mark_articles_read",
        args: { articleIds: ["art-1"] },
      });
    });
  });

  it("pressing slash opens and focuses the article search input", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    expect(screen.queryByPlaceholderText("Search articles…")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/" });

    const input = await screen.findByPlaceholderText("Search articles…");
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("pressing Cmd+K opens the command palette", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    });
    expect(await screen.findByPlaceholderText("Search commands…")).toBeInTheDocument();
  });

  it("pressing Cmd+Backslash toggles the desktop sidebar", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    expect(useUiStore.getState().sidebarOpen).toBe(true);

    fireEvent.keyDown(window, { key: "\\", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });

    fireEvent.keyDown(window, { key: "\\", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().sidebarOpen).toBe(true);
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
    });
  });

  it("pressing Cmd+1 switches to the unread filter", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    useUiStore.setState({ viewMode: "all" });

    fireEvent.keyDown(window, { key: "1", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().viewMode).toBe("unread");
    });
  });

  it("pressing Cmd+2 switches to the all filter", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    useUiStore.setState({ viewMode: "starred" });

    fireEvent.keyDown(window, { key: "2", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().viewMode).toBe("all");
    });
  });

  it("pressing Cmd+3 switches to the starred filter", async () => {
    const calls: MockCall[] = [];
    renderAppShell(calls);

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    useUiStore.setState({ viewMode: "all" });

    fireEvent.keyDown(window, { key: "3", metaKey: true });

    await waitFor(() => {
      expect(useUiStore.getState().viewMode).toBe("starred");
    });
  });

  it("pressing Escape in the tag picker closes the picker without clearing the article", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_folders":
        case "search_articles":
          return [];
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "mark_article_read":
        case "mark_articles_read":
        case "toggle_article_star":
        case "open_in_browser":
        case "trigger_sync":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: {
        after_reading: "do_nothing",
        ask_before_mark_all: "false",
      },
      loaded: true,
    });

    render(<AppShell />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    fireEvent.click(await screen.findByRole("button", { name: "Add tag" }));
    const listbox = await screen.findByRole("listbox", { name: "Available tags" });

    fireEvent.keyDown(listbox, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Available tags" })).not.toBeInTheDocument();
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
    });
  });
});
