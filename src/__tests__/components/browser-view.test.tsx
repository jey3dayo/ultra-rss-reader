import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const { listenMock, registeredHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, (event: { payload: unknown }) => void>();
  return {
    listenMock: vi.fn(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(eventName, handler);
      return () => {
        handlers.delete(eventName);
      };
    }),
    registeredHandlers: handlers,
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("BrowserView", () => {
  beforeEach(() => {
    listenMock.mockClear();
    registeredHandlers.clear();
    useUiStore.setState(useUiStore.getInitialState());
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      }
      if (cmd === "create_or_update_browser_webview") {
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
        };
      }
      if (cmd === "go_back_browser_webview") {
        return {
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: true,
          is_loading: false,
        };
      }
      if (cmd === "go_forward_browser_webview") {
        return {
          url: "https://example.com/article",
          can_go_back: true,
          can_go_forward: false,
          is_loading: false,
        };
      }
      if (cmd === "reload_browser_webview") {
        return {
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        };
      }
      if (cmd === "close_browser_webview" || cmd === "set_browser_webview_bounds") {
        return null;
      }
      return null;
    });
    Object.assign(globalThis, { __browserCommands: commands });
  });

  it("creates the inline browser webview on mount and keeps the loading hint visible until finish", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserView />, { wrapper: createWrapper() });

    expect(screen.getByText("Loading page...")).toBeInTheDocument();
    expect(screen.getByText("If this takes too long, open it in your external browser.")).toBeInTheDocument();

    await waitFor(() => {
      const commands = (
        globalThis as typeof globalThis & {
          __browserCommands: Array<{ cmd: string; args: Record<string, unknown> }>;
        }
      ).__browserCommands;
      expect(commands.some(({ cmd }) => cmd === "create_or_update_browser_webview")).toBe(true);
    });

    await waitFor(() => {
      expect(registeredHandlers.has("browser-webview-state-changed")).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get("browser-webview-state-changed")?.({
        payload: {
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        },
      });
    });

    expect(screen.queryByText("Loading page...")).not.toBeInTheDocument();
  });

  it("registers the browser-webview listener before creating the inline webview", async () => {
    let listenerReadyWhenCreate = false;

    setupTauriMocks((cmd, args) => {
      if (cmd === "create_or_update_browser_webview") {
        listenerReadyWhenCreate = registeredHandlers.has("browser-webview-state-changed");
        registeredHandlers.get("browser-webview-state-changed")?.({
          payload: {
            url: String(args.url),
            can_go_back: false,
            can_go_forward: false,
            is_loading: false,
          },
        });
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
        };
      }
      if (cmd === "set_browser_webview_bounds" || cmd === "close_browser_webview") {
        return null;
      }
      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      }
      return null;
    });

    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listenerReadyWhenCreate).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByText("Loading page...")).not.toBeInTheDocument();
    });
  });

  it("keeps widescreen browser chrome hidden outside direct feed selection", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "list_feeds") {
        return sampleFeeds
          .filter((feed) => feed.account_id === args.accountId)
          .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "widescreen" } : feed));
      }
      if (cmd === "list_account_articles") {
        return sampleArticles;
      }
      return null;
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    });
  });

  it("updates the visible URL and enabled history controls from browser-webview-state events", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/1",
    });

    render(<BrowserView />, { wrapper: createWrapper() });

    expect(screen.queryByRole("group", { name: "Display Mode" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(registeredHandlers.has("browser-webview-state-changed")).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get("browser-webview-state-changed")?.({
        payload: {
          url: "https://example.com/2",
          can_go_back: true,
          can_go_forward: false,
          is_loading: false,
        },
      });
    });

    expect(screen.getByText("https://example.com/2")).toBeInTheDocument();

    const backButton = await screen.findByRole("button", { name: "Web back" });
    const forwardButton = await screen.findByRole("button", { name: "Web forward" });
    expect(backButton).toBeEnabled();
    expect(forwardButton).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Close view" })).toBeInTheDocument();
  });

  it("dispatches browser navigation commands to Tauri", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/1",
    });

    const user = userEvent.setup();
    render(<BrowserView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has("browser-webview-state-changed")).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get("browser-webview-state-changed")?.({
        payload: {
          url: "https://example.com/2",
          can_go_back: true,
          can_go_forward: true,
          is_loading: false,
        },
      });
    });

    await user.click(await screen.findByRole("button", { name: "Web back" }));
    await user.click(await screen.findByRole("button", { name: "Web forward" }));
    await user.click(await screen.findByRole("button", { name: "Reload page" }));

    const commands = (
      globalThis as typeof globalThis & {
        __browserCommands: Array<{ cmd: string; args: Record<string, unknown> }>;
      }
    ).__browserCommands.map(({ cmd }) => cmd);

    expect(commands).toContain("go_back_browser_webview");
    expect(commands).toContain("go_forward_browser_webview");
    expect(commands).toContain("reload_browser_webview");
  });

  it("closes the inline browser webview when unmounted", async () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const view = render(<BrowserView />, { wrapper: createWrapper() });
    view.unmount();

    await waitFor(() => {
      const commands = (
        globalThis as typeof globalThis & {
          __browserCommands: Array<{ cmd: string; args: Record<string, unknown> }>;
        }
      ).__browserCommands;
      expect(commands.some(({ cmd }) => cmd === "close_browser_webview")).toBe(true);
    });
  });
});
