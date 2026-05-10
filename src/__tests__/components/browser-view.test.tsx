import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { setTauriRuntimeMissing, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { flushTestResizeObservers } from "@tests/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import type { BrowserOverlayToolbarAction } from "@/components/reader/browser-view.types";
import type { UseBrowserViewControllerParams } from "@/components/reader/hooks/browser/use-browser-view-controller";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import { APP_EVENTS } from "@/constants/events";
import { MOTION_BROWSER_OVERLAY_CLASS_NAME, MOTION_BROWSER_THEME_WIPE_OVERLAY_CLASS_NAME } from "@/constants/motion";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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

type BrowserDebugGeometryDetail = {
  layoutDiagnostics: {
    hostLogical: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
};

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

let rootRect: MockHostRect = { left: 0, top: 0, width: 1400, height: 900 };

function mockRootRect(nextRect: MockHostRect) {
  rootRect = nextRect;
}

function createDomRect(rect: MockHostRect): DOMRect {
  return new DOMRect(rect.left, rect.top, rect.width, rect.height);
}

function parsePixelValue(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

type InlineStyleKey = "bottom" | "height" | "left" | "right" | "top";
const inlineStyleKeys: InlineStyleKey[] = ["bottom", "height", "left", "right", "top"];

function expectInlineStyles(element: HTMLElement, expected: Partial<Record<InlineStyleKey, string>>) {
  for (const property of inlineStyleKeys) {
    const value = expected[property];
    if (value === undefined) {
      continue;
    }

    expect(element.style[property]).toBe(value);
  }
}

function isBrowserDebugGeometryEvent(event: Event): event is CustomEvent<BrowserDebugGeometryDetail> {
  return event instanceof CustomEvent;
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

function setReducedMotionPreference(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

type MatchMediaChangeEvent = Pick<MediaQueryListEvent, "matches">;

function createControllableMatchMedia(initialMatches: boolean, media: string) {
  let matches = initialMatches;
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: (_type: "change", listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.delete(listener);
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

function createLegacyColorSchemeMatchMedia(matches: boolean, options: { throwOnRemove?: boolean } = {}) {
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      if (options.throwOnRemove) {
        throw new Error("legacy cleanup unavailable");
      }
      listeners.delete(listener);
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

type BrowserViewHarnessProps = {
  controllerParams?: Partial<UseBrowserViewControllerParams>;
};

function buildBrowserViewControllerParams({
  scope = "main-stage",
  onCloseOverlay = () => useUiStore.getState().closeBrowser(),
}: Partial<UseBrowserViewControllerParams> = {}): UseBrowserViewControllerParams {
  return {
    scope,
    onCloseOverlay,
  };
}

function BrowserViewHarness({ controllerParams }: BrowserViewHarnessProps = {}) {
  const contentMode = useUiStore((s) => s.contentMode);
  const { scope, onCloseOverlay } = buildBrowserViewControllerParams(controllerParams);
  return (
    <div data-browser-overlay-root="" className="relative h-[900px] w-[1400px]">
      {contentMode === "browser" ? (
        <BrowserView
          scope={scope}
          onCloseOverlay={onCloseOverlay}
          labels={{
            closeWebPreview: "Close Web Preview",
          }}
        />
      ) : null}
    </div>
  );
}

function BrowserViewWithoutPortalRootHarness({ controllerParams }: BrowserViewHarnessProps = {}) {
  const contentMode = useUiStore((s) => s.contentMode);
  const { scope, onCloseOverlay } = buildBrowserViewControllerParams(controllerParams);
  return (
    <div className="relative h-[900px] w-[1400px]">
      {contentMode === "browser" ? (
        <BrowserView
          scope={scope}
          onCloseOverlay={onCloseOverlay}
          labels={{
            closeWebPreview: "Close Web Preview",
          }}
        />
      ) : null}
    </div>
  );
}

const browserViewToolbarActions: BrowserOverlayToolbarAction[] = [
  {
    key: "a",
    label: "Toolbar Action A",
    onClick: vi.fn(),
    icon: <span aria-hidden="true">A</span>,
  },
  {
    key: "b",
    label: "Toolbar Action B",
    onClick: vi.fn(),
    icon: <span aria-hidden="true">B</span>,
  },
];

describe("BrowserView", () => {
  let commands: MockTauriCommandCall[];
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    commands = [];
    listenMock.mockClear();
    registeredHandlers.clear();
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
    setReducedMotionPreference(false);
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "create_or_update_browser_webview") {
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
          load_generation: 1,
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
    vi.useRealTimers();
  });

  it("creates the embedded browser webview with fullscreen bounds on first create", async () => {
    mockRootRect({ left: 0, top: 18, width: 1400, height: 900 });

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
          bounds: { x: 0, y: 40, width: 1400, height: 860 },
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
          load_generation: 1,
        };
      }
      if (cmd === "go_back_browser_webview") {
        return {
          url: "https://example.com/home",
          can_go_back: false,
          can_go_forward: true,
          is_loading: false,
          load_generation: 1,
        };
      }
      if (cmd === "reload_browser_webview") {
        return {
          url: "https://example.com/home",
          can_go_back: false,
          can_go_forward: true,
          is_loading: true,
          load_generation: 1,
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

    await user.click(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Web back",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(commands.some((call) => call.cmd === "go_back_browser_webview")).toBe(true);
    expect(commands.some((call) => call.cmd === "reload_browser_webview")).toBe(true);
  });

  it("closes browser mode when the web back control has no browser history", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      if (cmd === "create_or_update_browser_webview") {
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
          load_generation: 1,
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

    const backButton = await screen.findByRole("button", {
      name: "Back to Reader",
    });
    await waitFor(() => {
      expect(backButton).toBeEnabled();
    });

    await user.click(backButton);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
    });
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(commands.some((call) => call.cmd === "go_back_browser_webview")).toBe(false);
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
          bounds: { x: 0, y: 50, width: 1750, height: 1075, unit: "physical" },
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
    expect(shell).toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME, "bg-browser-overlay-shell", "backdrop-blur-sm");
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-open", "true");
    });
    expect(veil).toHaveStyle({
      backgroundImage: "var(--browser-overlay-shell-veil)",
    });
    expect(screen.getByTestId("browser-overlay-stage-shell")).toBeInTheDocument();
    expect(screen.getByTestId("browser-overlay-stage-shell")).not.toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME);
    expect(screen.getByTestId("browser-overlay-stage")).not.toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME);
    expect(screen.getByTestId("browser-webview-host")).toBeInTheDocument();
    expect(screen.queryByText("Web Preview")).not.toBeInTheDocument();
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const topRail = screen.getByTestId("browser-overlay-top-rail");
    expect(chrome).toBeInTheDocument();
    expect(topRail).toHaveClass("border-b", "backdrop-blur-md");
    expect(topRail.style.backgroundImage).toBe("var(--browser-overlay-rail)");
    expect(topRail.style.borderColor).toBe("var(--color-browser-overlay-rail-border)");
    const closeButton = within(chrome).getByRole("button", {
      name: "Close Web Preview",
    });
    const backButton = within(chrome).getByRole("button", {
      name: "Back to Reader",
    });
    const forwardButton = within(chrome).getByRole("button", {
      name: "Web forward",
    });
    const reloadButton = screen.getByRole("button", { name: /reload page/i });
    const externalButton = screen.getByRole("button", {
      name: /open in external browser/i,
    });
    const closeSurface = closeButton.closest("[data-overlay-shell='action']");
    const externalSurface = externalButton.closest("[data-overlay-shell='action']");

    expect(closeButton).toBeInTheDocument();
    expect(closeSurface).not.toBeNull();
    expect(closeSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(chrome).not.toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME);
    expect(backButton).toBeEnabled();
    expect(forwardButton).toBeDisabled();
    expect(reloadButton).toBeInTheDocument();
    expect(externalButton).toBeInTheDocument();
    expect(externalSurface).not.toBeNull();
    expect(externalSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(screen.queryByTestId("browser-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/article")).not.toBeInTheDocument();
  });

  it("keeps transform motion limited to the overlay shell", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    const shell = screen.getByTestId("browser-overlay-shell");
    const stageShell = screen.getByTestId("browser-overlay-stage-shell");
    const stage = screen.getByTestId("browser-overlay-stage");
    const host = screen.getByTestId("browser-webview-host");
    const leadingAction = screen.getByTestId("browser-overlay-leading-action");
    const chrome = screen.getByTestId("browser-overlay-chrome");
    const actions = screen.getByTestId("browser-overlay-actions");

    await waitFor(() => {
      expect(shell).toHaveAttribute("data-open", "true");
    });

    expect(shell).toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME);
    for (const element of [stageShell, stage, host, leadingAction, chrome, actions]) {
      expect(element).not.toHaveClass(MOTION_BROWSER_OVERLAY_CLASS_NAME);
      expect(element.style.transform).toBe("");
      expect(element.style.transition).toBe("");
    }
    expect(host).toHaveStyle({
      left: "0px",
      right: "0px",
      top: "0px",
      bottom: "0px",
    });
  });

  it("creates the embedded browser webview without motion delay when reduced motion is preferred", async () => {
    setReducedMotionPreference(true);
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
          bounds: { x: 0, y: 40, width: 1400, height: 860 },
        },
      });
    });
  });

  it("cancels the pending open frame when browser close starts", () => {
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(12345);
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    try {
      mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

      useUiStore.setState({
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });

      render(<BrowserViewHarness />, { wrapper: createWrapper() });

      const shell = screen.getByTestId("browser-overlay-shell");
      expect(shell).toHaveAttribute("data-open", "false");
      expect(requestAnimationFrameSpy).toHaveBeenCalled();

      act(() => {
        useUiStore.getState().setBrowserCloseInFlight(true);
      });

      expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(12345);
      expect(shell).toHaveAttribute("data-open", "false");
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("masks the browser overlay surface with a vertical wipe when the app theme changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("browser-overlay-shell")).toHaveAttribute("data-open", "true");
    });
    expect(screen.queryByTestId("browser-theme-wipe-overlay")).not.toBeInTheDocument();

    act(() => {
      usePreferencesStore.getState().setPref("theme", "dark");
    });

    const wipeOverlay = screen.getByTestId("browser-theme-wipe-overlay");
    expect(wipeOverlay).toHaveClass(MOTION_BROWSER_THEME_WIPE_OVERLAY_CLASS_NAME, "bg-background");
    expect(wipeOverlay).toHaveAttribute("aria-hidden", "true");

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(screen.queryByTestId("browser-theme-wipe-overlay")).not.toBeInTheDocument();
  });

  it("uses legacy system theme listeners for the theme wipe and ignores cleanup failures", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const colorSchemeQuery = createLegacyColorSchemeMatchMedia(false, {
      throwOnRemove: true,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query === "(prefers-color-scheme: dark)") {
          return colorSchemeQuery;
        }

        return {
          matches: false,
          media: query,
          onchange: null,
        };
      }),
    });
    usePreferencesStore.setState({
      prefs: { theme: "system" },
      loaded: true,
    });
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const view = render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("browser-overlay-shell")).toHaveAttribute("data-open", "true");
    });
    expect(screen.queryByTestId("browser-theme-wipe-overlay")).not.toBeInTheDocument();

    act(() => {
      colorSchemeQuery.dispatch(true);
    });

    expect(screen.getByTestId("browser-theme-wipe-overlay")).toBeInTheDocument();
    expect(() => view.unmount()).not.toThrow();
  });

  it("clears a pending theme wipe timer on unmount without leaving stale overlay state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    const view = render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("browser-overlay-shell")).toHaveAttribute("data-open", "true");
    });

    act(() => {
      usePreferencesStore.getState().setPref("theme", "dark");
    });

    expect(screen.getByTestId("browser-theme-wipe-overlay")).toBeInTheDocument();

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(screen.queryByTestId("browser-theme-wipe-overlay")).not.toBeInTheDocument();
    clearTimeoutSpy.mockRestore();
  });

  it("restarts rapid theme wipes and clears the overlay when reduced motion changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reducedMotionQuery = createControllableMatchMedia(false, "(prefers-reduced-motion: reduce)");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query === "(prefers-reduced-motion: reduce)") {
          return reducedMotionQuery;
        }

        return {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        };
      }),
    });
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("browser-overlay-shell")).toHaveAttribute("data-open", "true");
    });

    act(() => {
      usePreferencesStore.getState().setPref("theme", "dark");
    });
    const firstWipe = screen.getByTestId("browser-theme-wipe-overlay");

    act(() => {
      vi.advanceTimersByTime(300);
      usePreferencesStore.getState().setPref("theme", "light");
    });

    expect(screen.getByTestId("browser-theme-wipe-overlay")).not.toBe(firstWipe);

    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(screen.getByTestId("browser-theme-wipe-overlay")).toBeInTheDocument();

    act(() => {
      reducedMotionQuery.dispatch(true);
    });
    expect(screen.queryByTestId("browser-theme-wipe-overlay")).not.toBeInTheDocument();
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
        toolbarActions={browserViewToolbarActions}
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

    render(<BrowserViewHarness controllerParams={{ onCloseOverlay }} />, {
      wrapper: createWrapper(),
    });

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

    render(<BrowserViewHarness controllerParams={{ onCloseOverlay }} />, {
      wrapper: createWrapper(),
    });

    await userEvent.setup().click(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Close Web Preview",
      }),
    );
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
  });

  it("keeps the main-stage content aligned below the floating rail", () => {
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
      top: "40px",
      bottom: "0px",
    });
    expect(stage).toHaveClass("rounded-none");
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
    expect(screen.getByTestId("browser-webview-host")).toHaveStyle({
      top: "0px",
    });
  });

  it("uses content-pane fallback geometry when the main-stage portal target is missing", () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(
      <BrowserView
        scope="main-stage"
        onCloseOverlay={() => useUiStore.getState().closeBrowser()}
        labels={{
          closeWebPreview: "Close Web Preview",
        }}
      />,
      { wrapper: createWrapper() },
    );

    const shell = screen.getByTestId("browser-overlay-shell");
    const stage = screen.getByTestId("browser-overlay-stage-shell");
    expect(shell.closest("[data-browser-overlay-root]")).toBeNull();
    expectInlineStyles(stage, {
      left: "16px",
      right: "16px",
      top: "16px",
      bottom: "16px",
    });
    expect(screen.queryByTestId("browser-overlay-top-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("browser-webview-host")).toHaveStyle({
      top: "0px",
    });
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
    expect(stage).toHaveClass("rounded-none");
    expectInlineStyles(stage, {
      left: "0px",
      right: "0px",
      top: "40px",
      bottom: "0px",
    });
    expect(topRail).toBeInTheDocument();
    expect(topRail).toHaveClass("rounded-none");
    expect(topRail).not.toHaveClass("pointer-events-none");
    expect(topRail).toHaveAttribute("data-tauri-drag-region");
    expectInlineStyles(topRail, {
      left: "0px",
      right: "0px",
      top: "0px",
      height: "40px",
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
      setTauriRuntimePresent();
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
      const trailingActions = screen.getByTestId("browser-overlay-actions");

      expectInlineStyles(stage, {
        top: "40px",
      });
      expectInlineStyles(topRail, {
        height: "40px",
      });
      expect(topRail).toHaveAttribute("data-tauri-drag-region");
      expect(topRail).not.toHaveClass("pointer-events-none");
      expect(leadingAction).toHaveClass("pointer-events-none");
      expect(screen.getByTestId("browser-overlay-chrome")).toHaveClass("pointer-events-auto");
      expect(trailingActions).toHaveClass("pointer-events-none");
      expect(trailingActions.firstElementChild).toHaveClass("pointer-events-auto");
      expectInlineStyles(leadingAction, {
        left: "72px",
        top: "4px",
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
    const loadingTitle = screen.getByText("Loading");
    const loadingHint = screen.getByText("If this takes too long, open it in your external browser.");
    const loadingHalo = loadingState.querySelector(".blur-2xl");
    const loadingSpinner = loadingState.querySelector(".animate-spin");

    expect(loadingState.className).not.toMatch(/\bborder\b/);
    expect(loadingState.className).not.toMatch(/\bshadow-/);
    expect(loadingHalo).toHaveClass("bg-browser-overlay-loading-halo");
    expect(loadingSpinner).toHaveClass("text-foreground");
    expect(loadingTitle).toHaveClass("text-foreground");
    expect(loadingHint).toHaveClass("text-foreground-soft");
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
    expect(stage).toHaveStyle({ top: "40px" });
    expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
  });

  it("keeps native bounds tied to the host rect when diagnostics are visible", async () => {
    mockRootRect({ left: 0, top: 18, width: 1400, height: 900 });
    usePreferencesStore.setState({
      prefs: { debug_browser_hud: "true" },
      loaded: true,
    });
    const geometryEvents: CustomEvent<BrowserDebugGeometryDetail>[] = [];
    const handleGeometryEvent = (event: Event) => {
      if (!isBrowserDebugGeometryEvent(event)) {
        throw new Error("Expected browser debug geometry event");
      }

      geometryEvents.push(event);
    };
    window.addEventListener(APP_EVENTS.browserDebugGeometry, handleGeometryEvent);

    try {
      useUiStore.setState({
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });

      render(<BrowserViewHarness />, { wrapper: createWrapper() });

      expectInlineStyles(screen.getByTestId("browser-overlay-stage-shell"), {
        left: "0px",
        top: "40px",
        right: "0px",
        bottom: "0px",
      });
      expectInlineStyles(screen.getByTestId("browser-webview-host"), {
        left: "0px",
        top: "0px",
        right: "0px",
        bottom: "0px",
      });
      await waitFor(() => {
        expect(commands).toContainEqual({
          cmd: "create_or_update_browser_webview",
          args: {
            url: "https://example.com/article",
            bounds: { x: 0, y: 40, width: 1400, height: 860 },
          },
        });
      });
      await waitFor(() => {
        expect(geometryEvents[geometryEvents.length - 1]?.detail.layoutDiagnostics.hostLogical).toEqual({
          x: 0,
          y: 40,
          width: 1400,
          height: 860,
        });
      });
    } finally {
      window.removeEventListener(APP_EVENTS.browserDebugGeometry, handleGeometryEvent);
    }
  });

  it("falls back to content-pane geometry when the main-stage portal target is missing", async () => {
    mockRootRect({ left: 0, top: 0, width: 1400, height: 900 });

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<BrowserViewWithoutPortalRootHarness />, { wrapper: createWrapper() });

    const stage = screen.getByTestId("browser-overlay-stage-shell");
    expectInlineStyles(stage, {
      left: "16px",
      top: "16px",
      right: "16px",
      bottom: "16px",
    });
    expect(stage).not.toHaveClass("rounded-none");
    expect(screen.queryByTestId("browser-overlay-top-rail")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "create_or_update_browser_webview",
        args: {
          url: "https://example.com/article",
          bounds: { x: 16, y: 16, width: 1368, height: 868 },
        },
      });
    });
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
    const externalButton = screen.getByRole("button", {
      name: /open in external browser/i,
    });
    const closeButton = within(chrome).getByRole("button", {
      name: "Close Web Preview",
    });

    expectInlineStyles(stage, {
      left: "0px",
      right: "0px",
      top: "48px",
      bottom: "0px",
    });
    expect(stage).toHaveClass("rounded-none");
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
    expect(stage).toHaveStyle({ top: "48px" });
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
    setTauriRuntimeMissing();
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
          load_generation: 1,
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
          bounds: { x: 0, y: 40, width: 1400, height: 860 },
        },
      });
    });

    commands = [];
    setWindowSize(1200, 800);
    mockRootRect({ left: 0, top: 0, width: 1200, height: 800 });

    await act(async () => {
      flushTestResizeObservers();
    });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "set_browser_webview_bounds",
        args: {
          bounds: { x: 0, y: 40, width: 1200, height: 760 },
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
          load_generation: 1,
        };
      }
      if (cmd === "set_browser_webview_bounds") {
        throw {
          type: "UserVisible",
          message: "Embedded browser webview is not open",
        };
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
          bounds: { x: 0, y: 40, width: 1400, height: 860 },
        },
      });
    });

    commands = [];
    setWindowSize(1200, 800);
    mockRootRect({ left: 0, top: 0, width: 1200, height: 800 });

    await act(async () => {
      flushTestResizeObservers();
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

    render(<BrowserViewHarness controllerParams={{ onCloseOverlay }} />, {
      wrapper: createWrapper(),
    });

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
