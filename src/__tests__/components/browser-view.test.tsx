import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS, BrowserView } from "@/components/reader/browser-view";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const browserWebviewStateChangedEvent = "browser-webview-state-changed";
const browserWebviewClosedEvent = "browser-webview-closed";

type BrowserCommand = {
  cmd: string;
  args: Record<string, unknown>;
};

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

function BrowserViewHarness() {
  const contentMode = useUiStore((s) => s.contentMode);
  return contentMode === "browser" ? <BrowserView /> : null;
}

async function flushBrowserViewEffects() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("BrowserView", () => {
  let commands: BrowserCommand[];

  beforeEach(() => {
    commands = [];
    listenMock.mockClear();
    registeredHandlers.clear();
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
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
      if (cmd === "close_browser_webview" || cmd === "open_in_browser") {
        return null;
      }
      return null;
    });
  });

  it("opens the dedicated browser window on mount and keeps the loading hint visible until finish", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
    expect(screen.getByText("Loading page...")).toBeInTheDocument();
    expect(screen.getByText("If this takes too long, open it in your external browser.")).toBeInTheDocument();

    await waitFor(() => {
      expect(commands.some(({ cmd }) => cmd === "create_or_update_browser_webview")).toBe(true);
    });

    expect(commands.some(({ cmd }) => cmd === "set_browser_webview_bounds")).toBe(false);

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewStateChangedEvent)).toBe(true);
      expect(registeredHandlers.has(browserWebviewClosedEvent)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
        payload: {
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        },
      });
    });

    expect(screen.queryByText("Loading page...")).not.toBeInTheDocument();
    expect(screen.getByText("Showing in a separate window.")).toBeInTheDocument();
  });

  it("registers both browser window listeners before opening the dedicated window", async () => {
    let listenersReadyWhenCreate = false;

    setupTauriMocks((cmd, args) => {
      if (cmd === "create_or_update_browser_webview") {
        listenersReadyWhenCreate =
          registeredHandlers.has(browserWebviewStateChangedEvent) && registeredHandlers.has(browserWebviewClosedEvent);
        registeredHandlers.get(browserWebviewStateChangedEvent)?.({
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
      if (cmd === "close_browser_webview" || cmd === "open_in_browser") {
        return null;
      }
      return null;
    });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(listenersReadyWhenCreate).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByText("Loading page...")).not.toBeInTheDocument();
    });
  });

  it("updates the visible URL and enabled history controls from browser state events", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/1",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewStateChangedEvent)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
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
    expect(await screen.findByRole("button", { name: "Close browser window" })).toBeInTheDocument();
  });

  it("does not re-navigate the dedicated browser window when an iframe URL is reported", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewStateChangedEvent)).toBe(true);
    });

    await waitFor(() => {
      expect(commands.filter(({ cmd }) => cmd === "create_or_update_browser_webview")).toHaveLength(1);
    });

    const iframeUrl = "https://tpc.googlesyndication.com/safeframe/1-0-0/html/container.html";

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
        payload: {
          url: iframeUrl,
          can_go_back: true,
          can_go_forward: false,
          is_loading: true,
        },
      });
    });

    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
    expect(screen.queryByText(iframeUrl)).not.toBeInTheDocument();
    expect(screen.getByText("Loading page...")).toBeInTheDocument();
    expect(commands.filter(({ cmd }) => cmd === "create_or_update_browser_webview")).toHaveLength(1);
  });

  it("preserves history button state when ignoring subresource loading URLs", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://togetter.com/li/123456",
    });

    const user = userEvent.setup();
    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewStateChangedEvent)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
        payload: {
          url: "https://togetter.com/li/123456",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        },
      });
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
        payload: {
          url: "https://gum.criteo.com/syncframe?origin=criteoPrebidAdapter",
          can_go_back: true,
          can_go_forward: false,
          is_loading: true,
        },
      });
    });

    const backButton = await screen.findByRole("button", { name: "Web back" });
    const forwardButton = await screen.findByRole("button", { name: "Web forward" });
    expect(backButton).toBeEnabled();
    expect(forwardButton).toBeDisabled();

    await user.click(backButton);

    expect(commands.map(({ cmd }) => cmd)).toContain("go_back_browser_webview");
  });

  it("dispatches browser navigation commands to Tauri", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/1",
    });

    const user = userEvent.setup();
    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewStateChangedEvent)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewStateChangedEvent)?.({
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

    expect(commands.map(({ cmd }) => cmd)).toEqual(
      expect.arrayContaining(["go_back_browser_webview", "go_forward_browser_webview", "reload_browser_webview"]),
    );
  });

  it("falls back to the external browser when the dedicated window cannot be created", async () => {
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "create_or_update_browser_webview") {
        throw { type: "UserVisible", message: "window creation failed" };
      }
      if (cmd === "open_in_browser" || cmd === "close_browser_webview") {
        return null;
      }
      return null;
    });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(commands.map(({ cmd }) => cmd)).toContain("open_in_browser");
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("falls back to the external browser when the dedicated window stays loading past the timeout", async () => {
    vi.useFakeTimers();

    try {
      useUiStore.setState({
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });

      render(<BrowserViewHarness />, { wrapper: createWrapper() });
      await flushBrowserViewEffects();

      expect(commands.map(({ cmd }) => cmd)).toContain("create_or_update_browser_webview");
      expect(commands.map(({ cmd }) => cmd)).not.toContain("open_in_browser");

      await act(async () => {
        vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS + 1);
        for (let i = 0; i < 6; i += 1) {
          await Promise.resolve();
        }
      });

      expect(commands.map(({ cmd }) => cmd)).toContain("open_in_browser");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves browser mode when the dedicated browser window closes natively", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(browserWebviewClosedEvent)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(browserWebviewClosedEvent)?.({ payload: null });
    });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("closes the browser window only once across explicit close and eventual unmount", async () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const user = userEvent.setup();
    const view = render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Close browser window" }));
    view.unmount();

    await waitFor(() => {
      expect(commands.filter(({ cmd }) => cmd === "close_browser_webview")).toHaveLength(1);
    });
  });
});
