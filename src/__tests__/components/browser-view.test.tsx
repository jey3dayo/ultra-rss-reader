import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserView } from "@/components/reader/browser-view";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

function BrowserViewHarness({ scope = "main-stage" }: { scope?: "content-pane" | "main-stage" } = {}) {
  const contentMode = useUiStore((s) => s.contentMode);
  return (
    <div data-browser-overlay-root="" className="relative h-[900px] w-[1400px]">
      {contentMode === "browser" ? (
        <BrowserView
          scope={scope}
          onCloseOverlay={() => useUiStore.getState().closeBrowser()}
          labels={{
            closeOverlay: "Close browser overlay",
          }}
        />
      ) : null}
    </div>
  );
}

describe("BrowserView", () => {
  let commands: BrowserCommand[];
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    commands = [];
    listenMock.mockClear();
    registeredHandlers.clear();
    resizeObserverCallbacks.clear();
    mockHostRect({ left: 0, top: 0, width: 0, height: 0 });
    getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => createDomRect(hostRect));
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
    expect(screen.getByRole("button", { name: "Close browser overlay" })).toBeInTheDocument();
    expect(screen.queryByTestId("browser-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/article")).not.toBeInTheDocument();
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
