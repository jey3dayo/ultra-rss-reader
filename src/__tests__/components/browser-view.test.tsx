import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { type MockTauriCommandCall, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const BrowserViewWithUnknownContext = BrowserView as unknown as ComponentType<Record<string, unknown>>;

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

type MockHostRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const { ResizeObserverMock, resizeObserverCallbacks } = vi.hoisted(() => {
  const callbacks = new Set<() => void>();

  class ResizeObserverMock {
    private readonly callback: () => void;

    constructor(callback: ResizeObserverCallback) {
      this.callback = () => callback([], this as unknown as ResizeObserver);
      callbacks.add(this.callback);
    }

    observe() {}

    disconnect() {
      callbacks.delete(this.callback);
    }

    unobserve() {}
  }

  return {
    ResizeObserverMock,
    resizeObserverCallbacks: callbacks,
  };
});

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

let hostRect: MockHostRect = { left: 0, top: 0, width: 0, height: 0 };

function mockHostRect(nextRect: MockHostRect) {
  hostRect = nextRect;
}

function createDomRect(rect: MockHostRect): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => rect,
  } as DOMRect;
}

type BrowserViewHarnessProps = {
  scope?: "content-pane" | "main-stage";
  context?: {
    modeLabel: string;
    title: string;
    feedName?: string;
    publishedLabel?: string;
  };
};

function BrowserViewHarness({ scope = "main-stage", context }: BrowserViewHarnessProps = {}) {
  const contentMode = useUiStore((s) => s.contentMode);
  return (
    <div data-browser-overlay-root="" className="relative h-[900px] w-[1400px]">
      {contentMode === "browser"
        ? createElement(BrowserViewWithUnknownContext, {
            scope,
            onCloseOverlay: () => useUiStore.getState().closeBrowser(),
            labels: {
              closeOverlay: "Close Web Preview",
            },
            context,
          })
        : null}
    </div>
  );
}

describe("BrowserView", () => {
  let commands: MockTauriCommandCall[];
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    commands = [];
    listenMock.mockClear();
    registeredHandlers.clear();
    resizeObserverCallbacks.clear();
    window.__DEV_BROWSER_MOCKS__ = false;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
    mockHostRect({ left: 0, top: 0, width: 0, height: 0 });
    getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => createDomRect(hostRect));
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
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
      if (cmd === "set_browser_webview_bounds") {
        return null;
      }
      if (cmd === "close_browser_webview") {
        return null;
      }
      return null;
    });
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
  });

  it("creates the embedded browser webview with host bounds", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "create_or_update_browser_webview",
        args: {
          url: "https://example.com/article",
          bounds: { x: 380, y: 48, width: 900, height: 720 },
        },
      });
    });
  });

  it("renders only the host surface and close chrome for the overlay", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    expect(screen.getByTestId("browser-overlay-shell")).toBeInTheDocument();
    expect(screen.getByTestId("browser-overlay-stage")).toBeInTheDocument();
    expect(screen.getByTestId("browser-webview-host")).toBeInTheDocument();
    expect(screen.getByTestId("browser-overlay-chrome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.queryByTestId("browser-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/article")).not.toBeInTheDocument();
  });

  it("keeps the overlay stage visually separated from the scrim", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage");

    expect(stage.className).toContain("border");
    expect(stage.className).toContain("border-white/6");
  });

  it("uses edge-hugging stage insets in the main-stage overlay", () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage");

    expect(stage.className).toContain("left-2");
    expect(stage.className).toContain("right-0");
    expect(stage.className).toContain("top-14");
  });

  it("renders web preview context when article metadata is provided", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(
      <BrowserViewHarness
        context={{
          modeLabel: "Web Preview",
          title: "Designing Better Reader Panes",
          feedName: "UX Notes",
          publishedLabel: "Apr 6, 2026",
        }}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("browser-preview-context")).toBeInTheDocument();
    expect(screen.getByText("Web Preview")).toBeInTheDocument();
    expect(screen.getByText("Designing Better Reader Panes")).toBeInTheDocument();
    expect(screen.getByText(/UX Notes/)).toBeInTheDocument();
    expect(screen.getByText(/Apr 6, 2026/)).toBeInTheDocument();
  });

  it("shows loading feedback while the embedded preview is still starting", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("If this takes too long, open it in your external browser.")).toBeInTheDocument();
  });

  it("shows the debug hud when the debug preference is enabled", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    usePreferencesStore.setState({
      prefs: { debug_browser_hud: "true" },
      loaded: true,
    });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const diagnostics = await screen.findByTestId("browser-overlay-diagnostics");

    expect(diagnostics).toBeInTheDocument();
    expect(diagnostics.className).toContain("top-3");
    expect(diagnostics.className).toContain("right-3");
    expect(diagnostics.className).toContain("left-24");
    expect(diagnostics.className).toContain("z-[80]");
    expect(screen.getByText(/vp/i)).toBeInTheDocument();
    expect(screen.getByText(/fill/i)).toBeInTheDocument();
  });

  it("hides the debug hud when the saved preference is false", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    usePreferencesStore.setState({
      prefs: { debug_browser_hud: "false" },
      loaded: true,
    });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByTestId("browser-overlay-diagnostics")).not.toBeInTheDocument();
    });
  });

  it("shows a browser-mode fallback panel instead of a blank surface when no Tauri runtime is available", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    window.__DEV_BROWSER_MOCKS__ = true;

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "create_or_update_browser_webview") {
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        };
      }
      if (cmd === "set_browser_webview_bounds" || cmd === "close_browser_webview") {
        return null;
      }
      return null;
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    expect(await screen.findByText("Embedded preview isn't available in browser mode.")).toBeInTheDocument();
    expect(
      screen.getByText("Use the desktop app for the native preview, or open this page in your external browser."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
  });

  it("does not close when clicking the overlay lane outside the close button", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const chrome = screen.getByTestId("browser-overlay-chrome");
    fireEvent.click(chrome);

    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/article");
  });

  it("sends updated embedded browser bounds when the host resizes", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "create_or_update_browser_webview",
        args: {
          url: "https://example.com/article",
          bounds: { x: 380, y: 48, width: 900, height: 720 },
        },
      });
    });

    commands = [];
    mockHostRect({ left: 420, top: 60, width: 840, height: 680 });

    await act(async () => {
      for (const callback of resizeObserverCallbacks) {
        callback();
      }
    });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "set_browser_webview_bounds",
        args: {
          bounds: { x: 420, y: 60, width: 840, height: 680 },
        },
      });
    });
  });

  it("closes browser mode when the embedded browser webview closes natively", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(BROWSER_WINDOW_EVENTS.closed)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(BROWSER_WINDOW_EVENTS.closed)?.({ payload: null });
    });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("closes the browser webview once on unmount", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const view = render(<BrowserViewHarness />, { wrapper: createWrapper() });

    view.unmount();

    await waitFor(() => {
      expect(commands.filter(({ cmd }) => cmd === "close_browser_webview")).toHaveLength(1);
    });
  });
});
