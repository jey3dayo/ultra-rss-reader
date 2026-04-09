import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { type MockTauriCommandCall, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

type BrowserViewHarnessProps = {
  scope?: "content-pane" | "main-stage";
  onCloseOverlay?: () => void;
};

function BrowserViewHarness({ scope = "main-stage", onCloseOverlay }: BrowserViewHarnessProps = {}) {
  const contentMode = useUiStore((s) => s.contentMode);
  return (
    <div data-browser-overlay-root="" className="relative h-[900px] w-[1400px]">
      {contentMode === "browser" ? (
        <BrowserView
          scope={scope}
          onCloseOverlay={onCloseOverlay ?? (() => useUiStore.getState().closeBrowser())}
          labels={{
            closeOverlay: "Close Web Preview",
          }}
        />
      ) : null}
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
    setWindowSize(1400, 900);
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

  it("renders minimal chrome without the legacy preview context", async () => {
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
    expect(screen.queryByText("Web Preview")).not.toBeInTheDocument();
    const chrome = screen.getByTestId("browser-overlay-chrome");
    expect(chrome).toBeInTheDocument();
    expect(within(chrome).getByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in external browser/i })).toBeInTheDocument();
    expect(screen.queryByTestId("browser-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/article")).not.toBeInTheDocument();
  });

  it("closes from the scrim but not from the webview host", async () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    const onCloseOverlay = vi.fn();

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness onCloseOverlay={onCloseOverlay} />, { wrapper: createWrapper() });

    await userEvent.setup().click(screen.getByTestId("browser-overlay-scrim"));
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);

    await userEvent.setup().click(screen.getByTestId("browser-webview-host"));
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
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

  it("uses the immersive main-stage geometry above a dedicated scrim", () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const scrim = screen.getByTestId("browser-overlay-scrim");
    const stage = screen.getByTestId("browser-overlay-stage");
    const chrome = screen.getByTestId("browser-overlay-chrome");

    expect(scrim.className).toContain("absolute inset-0");
    expect(stage).toHaveStyle({
      left: "16px",
      right: "16px",
      top: "16px",
      bottom: "16px",
      borderRadius: "24px",
    });
    expect(chrome).toHaveStyle({
      left: "16px",
      top: "16px",
    });
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
    const stage = screen.getByTestId("browser-overlay-stage");

    expect(diagnostics).toBeInTheDocument();
    expect(diagnostics.className).toContain("left-1/2");
    expect(diagnostics.className).toContain("-translate-x-1/2");
    expect(diagnostics.className).toContain("z-[90]");
    expect(diagnostics.firstElementChild?.className).toContain("rounded-full");
    expect(diagnostics.firstElementChild?.className).toContain("bg-black/62");
    expect(diagnostics).toHaveStyle({ top: "16px" });
    expect(stage).toHaveStyle({ top: "54px" });
    expect(screen.getByText(/vp/i)).toBeInTheDocument();
    expect(screen.getByText(/fill/i)).toBeInTheDocument();
  });

  it("keeps wide viewer chrome readable against the scrim", () => {
    mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const closeButton = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Close Web Preview",
    });
    const externalButton = screen.getByRole("button", { name: /open in external browser/i });

    expect(closeButton.className).toContain("bg-black/30");
    expect(closeButton.className).toContain("border-white/12");
    expect(externalButton.className).toContain("bg-black/26");
    expect(externalButton.className).toContain("border-white/12");
  });

  it("compacts the viewer layout at narrow widths instead of keeping desktop spacing", async () => {
    setWindowSize(500, 900);
    mockHostRect({ left: 12, top: 64, width: 476, height: 820 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage");
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const rail = screen.getByTestId("browser-overlay-top-rail");
    const externalButton = screen.getByRole("button", { name: /open in external browser/i });
    const closeButton = within(chrome).getByRole("button", { name: "Close Web Preview" });

    expect(stage).toHaveStyle({
      left: "10px",
      right: "10px",
      top: "60px",
      bottom: "10px",
      borderRadius: "18px",
    });
    expect(chrome).toHaveStyle({
      left: "12px",
      top: "12px",
    });
    expect(rail).toHaveStyle({
      left: "12px",
      right: "12px",
      top: "12px",
      height: "40px",
      borderRadius: "16px",
    });
    expect(closeButton.className).toContain("size-10");
    expect(closeButton.className).toContain("bg-black/32");
    expect(externalButton.className).toContain("size-10");
    expect(externalButton.className).toContain("bg-black/32");
  });

  it("compacts the debug hud at narrow widths so it stays readable", async () => {
    setWindowSize(500, 900);
    mockHostRect({ left: 12, top: 64, width: 476, height: 820 });
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
    const stage = screen.getByTestId("browser-overlay-stage");

    expect(diagnostics.className).toContain("w-[calc(100vw-7.5rem)]");
    expect(diagnostics.firstElementChild?.className).toContain("rounded-2xl");
    expect(diagnostics.firstElementChild?.className).toContain("justify-start");
    expect(diagnostics.firstElementChild?.className).toContain("overflow-x-auto");
    expect(diagnostics).toHaveStyle({ top: "62px" });
    expect(stage).toHaveStyle({ top: "94px" });
    expect(screen.getByText(/vp/i)).toBeInTheDocument();
    expect(screen.getByText(/fill/i)).toBeInTheDocument();
    expect(screen.queryByText(/lane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rust/i)).not.toBeInTheDocument();
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
    expect(screen.getAllByRole("button", { name: "Open in External Browser" })).toHaveLength(2);
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
