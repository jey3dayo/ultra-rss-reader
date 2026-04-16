import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import { usePlatformStore } from "@/stores/platform-store";
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

let rootRect: MockHostRect = { left: 0, top: 0, width: 1400, height: 900 };

function mockRootRect(nextRect: MockHostRect) {
  rootRect = nextRect;
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

function parsePixelValue(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

type InlineStyleKey = "bottom" | "borderRadius" | "height" | "left" | "right" | "top";

function expectInlineStyles(element: HTMLElement, expected: Partial<Record<InlineStyleKey, string>>) {
  for (const [property, value] of Object.entries(expected) as [InlineStyleKey, string][]) {
    expect(element.style[property]).toBe(value);
  }
}

function resolveMockRect(element: HTMLElement): MockHostRect {
  if (element.hasAttribute("data-browser-overlay-root")) {
    return rootRect;
  }

  const testId = element.dataset.testid;
  if (testId === "browser-overlay-shell") {
    return rootRect;
  }

  const parentElement = element.parentElement;
  const parentRect = parentElement ? resolveMockRect(parentElement) : rootRect;
  const style = element.style;

  if (
    testId === "browser-overlay-stage-shell" ||
    testId === "browser-overlay-stage" ||
    testId === "browser-webview-host"
  ) {
    const left = parsePixelValue(style.left) ?? 0;
    const top = parsePixelValue(style.top) ?? 0;
    const right = parsePixelValue(style.right) ?? 0;
    const bottom = parsePixelValue(style.bottom) ?? 0;

    return {
      left: parentRect.left + left,
      top: parentRect.top + top,
      width: parentRect.width - left - right,
      height: parentRect.height - top - bottom,
    };
  }

  return parentRect;
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
            closeWebPreview: "Close Web Preview",
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
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
    getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return createDomRect(resolveMockRect(this));
    });
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    usePlatformStore.setState(usePlatformStore.getInitialState());
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

  it("creates the embedded browser webview with fullscreen bounds on first create", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

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
          bounds: { x: 0, y: 56, width: 1400, height: 844 },
        },
      });
    });
  });

  it("wires browser navigation controls to the embedded webview commands", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "create_or_update_browser_webview") {
        return {
          url: args.url,
          can_go_back: true,
          can_go_forward: false,
          is_loading: false,
        };
      }
      if (cmd === "go_back_browser_webview") {
        return {
          url: "https://example.com/home",
          can_go_back: false,
          can_go_forward: true,
          is_loading: false,
        };
      }
      if (cmd === "reload_browser_webview") {
        return {
          url: "https://example.com/home",
          can_go_back: false,
          can_go_forward: true,
          is_loading: true,
        };
      }
      if (cmd === "set_browser_webview_bounds" || cmd === "close_browser_webview") {
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
      expect(
        within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", { name: "Web back" }),
      ).toBeEnabled();
    });

    await user.click(within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", { name: "Web back" }));
    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(commands.some((call) => call.cmd === "go_back_browser_webview")).toBe(true);
    expect(commands.some((call) => call.cmd === "reload_browser_webview")).toBe(true);
  });

  it("uses physical bounds for Windows child webviews", async () => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1.25,
    });
    usePlatformStore.setState({
      ...usePlatformStore.getInitialState(),
      loaded: true,
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
    });
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
          bounds: { x: 0, y: 70, width: 1750, height: 1055, unit: "physical" },
        },
      });
    });
  });

  it("renders minimal chrome without the legacy preview context", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const shell = screen.getByTestId("browser-overlay-shell");
    const veil = screen.getByTestId("browser-overlay-veil");

    expect(shell).toBeInTheDocument();
    expect(shell).toHaveClass("bg-browser-overlay-shell", "backdrop-blur-sm");
    expect(veil).toHaveStyle({ backgroundImage: "var(--browser-overlay-shell-veil)" });
    expect(screen.getByTestId("browser-overlay-stage-shell")).toBeInTheDocument();
    expect(screen.getByTestId("browser-overlay-stage")).toBeInTheDocument();
    expect(screen.getByTestId("browser-webview-host")).toBeInTheDocument();
    expect(screen.queryByText("Web Preview")).not.toBeInTheDocument();
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const topRail = screen.getByTestId("browser-overlay-top-rail");
    expect(chrome).toBeInTheDocument();
    expect(topRail).toHaveClass("border-b", "backdrop-blur-md");
    expect(topRail.style.backgroundImage).toBe("var(--browser-overlay-rail)");
    expect(topRail.style.borderColor).toBe("var(--color-browser-overlay-rail-border)");
    const closeButton = within(chrome).getByRole("button", { name: "Close Web Preview" });
    const backButton = within(chrome).getByRole("button", { name: "Web back" });
    const forwardButton = within(chrome).getByRole("button", { name: "Web forward" });
    const reloadButton = screen.getByRole("button", { name: /reload page/i });
    const externalButton = screen.getByRole("button", { name: /open in external browser/i });
    const closeSurface = closeButton.closest("[data-overlay-shell='action']");
    const externalSurface = externalButton.closest("[data-overlay-shell='action']");

    expect(closeButton).toBeInTheDocument();
    expect(closeSurface).not.toBeNull();
    expect(closeSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(backButton).toBeDisabled();
    expect(forwardButton).toBeDisabled();
    expect(reloadButton).toBeInTheDocument();
    expect(externalButton).toBeInTheDocument();
    expect(externalSurface).not.toBeNull();
    expect(externalSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(screen.queryByTestId("browser-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/article")).not.toBeInTheDocument();
  });

  it("wraps custom toolbar actions in the shared action shell", () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(
      <BrowserView
        scope="content-pane"
        onCloseOverlay={() => {}}
        labels={{ closeWebPreview: "Close Web Preview" }}
        toolbarActions={({ renderAction }) => (
          <>
            {renderAction(<button type="button">Toolbar Action A</button>, { key: "a" })}
            {renderAction(<button type="button">Toolbar Action B</button>, { key: "b" })}
          </>
        )}
      />,
      { wrapper: createWrapper() },
    );

    expect(
      screen.getByRole("button", { name: "Toolbar Action A" }).closest("[data-overlay-shell='action']"),
    ).toHaveAttribute("data-overlay-shell", "action");
    expect(screen.getByRole("button", { name: "Toolbar Action B" })).toBeInTheDocument();
  });

  it("does not close from the scrim in main-stage", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    const onCloseOverlay = vi.fn();

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness onCloseOverlay={onCloseOverlay} />, { wrapper: createWrapper() });

    await userEvent.setup().click(screen.getByTestId("browser-overlay-scrim"));
    expect(onCloseOverlay).toHaveBeenCalledTimes(0);

    await userEvent.setup().click(screen.getByTestId("browser-webview-host"));
    expect(onCloseOverlay).toHaveBeenCalledTimes(0);
  });

  it("closes from the close button", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    const onCloseOverlay = vi.fn();

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness onCloseOverlay={onCloseOverlay} />, { wrapper: createWrapper() });

    await userEvent.setup().click(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Close Web Preview",
      }),
    );
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
  });

  it("keeps the main-stage content aligned under the rail", () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage-shell");
    expectInlineStyles(stage, {
      left: "0px",
      right: "0px",
      top: "56px",
      bottom: "0px",
      borderRadius: "0px",
    });
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
    expect(screen.getByTestId("browser-webview-host")).toHaveStyle({ top: "0px" });
  });

  it("uses the fullscreen main-stage geometry with a visible top rail", () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage-shell");
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const topRail = screen.getByTestId("browser-overlay-top-rail");
    const host = screen.getByTestId("browser-webview-host");

    expect(stage).toHaveAttribute("data-overlay-shell", "stage");
    expect(stage).toHaveClass("absolute", "z-10", "overflow-hidden", "bg-background");
    expect(stage.className).not.toMatch(/\bborder\b/);
    expect(stage.className).not.toMatch(/\bshadow-/);
    expect(stage.className).not.toMatch(/\brounded-/);
    expectInlineStyles(stage, {
      left: "0px",
      right: "0px",
      top: "56px",
      bottom: "0px",
      borderRadius: "0px",
    });
    expect(topRail).toBeInTheDocument();
    expectInlineStyles(topRail, {
      left: "0px",
      right: "0px",
      top: "0px",
      height: "56px",
      borderRadius: "0px",
    });
    expect(host).toHaveStyle({
      left: "0px",
      right: "0px",
      top: "0px",
      bottom: "0px",
    });
    expect(
      within(chrome).getByRole("button", { name: "Close Web Preview" }).closest("[data-overlay-shell='action']"),
    ).toHaveClass("size-11", "md:size-8");
    expect(
      screen.getByRole("button", { name: /open in external browser/i }).closest("[data-overlay-shell='action']"),
    ).toHaveClass("size-11", "md:size-8");
    expect(chrome).toBeInTheDocument();
  });

  it("keeps the visual header height while moving the leading action away from macOS traffic lights", () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");

    try {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        writable: true,
        value: {},
      });
      mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
      usePlatformStore.setState({
        platform: {
          kind: "macos",
          capabilities: {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: true,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: false,
          },
        },
        loaded: true,
        loadError: false,
        inFlightLoad: null,
      });
      useUiStore.setState({
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });

      render(<BrowserViewHarness />, { wrapper: createWrapper() });

      const stage = screen.getByTestId("browser-overlay-stage-shell");
      const leadingAction = screen.getByTestId("browser-overlay-leading-action");
      const topRail = screen.getByTestId("browser-overlay-top-rail");

      expectInlineStyles(stage, {
        top: "56px",
      });
      expectInlineStyles(topRail, {
        height: "56px",
      });
      expectInlineStyles(leadingAction, {
        left: "72px",
        top: "12px",
      });
      const closeButton = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Close Web Preview",
      });
      expect(closeButton.closest("[data-overlay-shell='action']")).toHaveAttribute("data-overlay-shell", "action");
      expect(closeButton.querySelector(".lucide-x")).not.toBeNull();
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("shows loading feedback while the embedded preview is still starting", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const loadingState = screen.getByTestId("browser-loading-state");

    expect(loadingState.className).not.toMatch(/\bborder\b/);
    expect(loadingState.className).not.toMatch(/\bshadow-/);
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("If this takes too long, open it in your external browser.")).toBeInTheDocument();
  });

  it("keeps the fullscreen stage unchanged when debug hud is enabled", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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

    const stage = screen.getByTestId("browser-overlay-stage-shell");

    await waitFor(() => {
      expect(screen.queryByTestId("browser-overlay-diagnostics")).not.toBeInTheDocument();
    });
    expect(stage).toHaveStyle({ top: "56px" });
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
  });

  it("keeps the fullscreen surface full bleed at narrow widths", async () => {
    setWindowSize(500, 900);
    mockRootRect({ left: 0, top: 0, width: 500, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage-shell");
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const externalButton = screen.getByRole("button", { name: /open in external browser/i });
    const closeButton = within(chrome).getByRole("button", { name: "Close Web Preview" });

    expectInlineStyles(stage, {
      left: "0px",
      right: "0px",
      top: "64px",
      bottom: "0px",
      borderRadius: "0px",
    });
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(externalButton).toBeInTheDocument();
  });

  it("does not render the diagnostics strip at narrow widths", async () => {
    setWindowSize(500, 900);
    mockRootRect({ left: 0, top: 0, width: 500, height: 900 });
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

    const stage = screen.getByTestId("browser-overlay-stage-shell");

    await waitFor(() => {
      expect(screen.queryByTestId("browser-overlay-diagnostics")).not.toBeInTheDocument();
    });
    expect(stage).toHaveStyle({ top: "64px" });
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
  });

  it("renders browser overlay tooltips above the chrome layer", async () => {
    setWindowSize(500, 900);
    mockRootRect({ left: 0, top: 0, width: 500, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await userEvent.setup().hover(screen.getByRole("button", { name: "Close Web Preview" }));

    expect(await screen.findByText("Close Web Preview")).toHaveClass("z-[80]");
  });

  it("hides the debug hud when the saved preference is false", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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

  it("hides technical browser failure details unless debug hud is enabled", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

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
      expect(registeredHandlers.has(BROWSER_WINDOW_EVENTS.fallback)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(BROWSER_WINDOW_EVENTS.fallback)?.({
        payload: {
          url: "https://example.com/article",
          opened_external: false,
          error_message: "Timed out waiting for the embedded browser to load.",
        },
      });
    });

    expect(await screen.findByText("Web Preview couldn't load.")).toBeInTheDocument();
    expect(screen.queryByText("Technical detail")).not.toBeInTheDocument();
    expect(screen.queryByText("Timed out waiting for the embedded browser to load.")).not.toBeInTheDocument();
  });

  it("shows technical browser failure details when debug hud is enabled", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

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

    await waitFor(() => {
      expect(registeredHandlers.has(BROWSER_WINDOW_EVENTS.fallback)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(BROWSER_WINDOW_EVENTS.fallback)?.({
        payload: {
          url: "https://example.com/article",
          opened_external: false,
          error_message: "Timed out waiting for the embedded browser to load.",
        },
      });
    });

    expect(await screen.findByText("Technical detail")).toBeInTheDocument();
    expect(screen.getByText("Timed out waiting for the embedded browser to load.")).toBeInTheDocument();
  });

  it("does not close when clicking the overlay lane outside the close button", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

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

  it("sends updated fullscreen browser bounds when the host resizes", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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
          bounds: { x: 0, y: 56, width: 1400, height: 844 },
        },
      });
    });

    commands = [];
    setWindowSize(1200, 800);
    mockRootRect({ left: 0, top: 0, width: 1200, height: 800 });

    await act(async () => {
      for (const callback of resizeObserverCallbacks) {
        callback();
      }
    });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "set_browser_webview_bounds",
        args: {
          bounds: { x: 0, y: 56, width: 1200, height: 744 },
        },
      });
    });
  });

  it("returns to reader mode when the native browser webview disappears during a resize sync", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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
      if (cmd === "set_browser_webview_bounds") {
        throw { type: "UserVisible", message: "Embedded browser webview is not open" };
      }
      if (cmd === "close_browser_webview") {
        return null;
      }
      return null;
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "create_or_update_browser_webview",
        args: {
          url: "https://example.com/article",
          bounds: { x: 0, y: 56, width: 1400, height: 844 },
        },
      });
    });

    commands = [];
    setWindowSize(1200, 800);
    mockRootRect({ left: 0, top: 0, width: 1200, height: 800 });

    await act(async () => {
      for (const callback of resizeObserverCallbacks) {
        callback();
      }
    });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(screen.queryByTestId("browser-overlay-shell")).not.toBeInTheDocument();
    });
  });

  it("closes browser mode when the embedded browser webview closes natively", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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

  it("routes native browser close events through the shared overlay close handler", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
    const onCloseOverlay = vi.fn();

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness onCloseOverlay={onCloseOverlay} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(registeredHandlers.has(BROWSER_WINDOW_EVENTS.closed)).toBe(true);
    });

    await act(async () => {
      registeredHandlers.get(BROWSER_WINDOW_EVENTS.closed)?.({ payload: null });
    });

    await waitFor(() => {
      expect(onCloseOverlay).toHaveBeenCalledTimes(1);
    });
  });

  it("closes the browser webview once on unmount", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });
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
