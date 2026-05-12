import { render, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/constants/events";
import { useMenuEvents } from "@/hooks/use-menu-events";

const { executeActionMock, emitDebugInputTraceMock, listenMock } = vi.hoisted(() => ({
  executeActionMock: vi.fn(),
  emitDebugInputTraceMock: vi.fn(),
  listenMock: vi.fn(),
}));

type MenuActionHandler = (event: { payload: unknown }) => void;

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("@/lib/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/actions")>()),
  executeAction: executeActionMock,
}));

vi.mock("@/lib/debug/debug-input-trace", () => ({
  emitDebugInputTrace: emitDebugInputTraceMock,
}));

setupBrowserTestDom();

function MenuEventsProbe() {
  useMenuEvents();
  return null;
}

function expectMenuActionHandler(handler: MenuActionHandler | null): MenuActionHandler {
  expect(handler).toBeTypeOf("function");
  if (!handler) {
    throw new Error("Expected menu action handler to be registered");
  }
  return handler;
}

describe("useMenuEvents", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("dispatches known menu actions from the Tauri menu-action event", async () => {
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });
    expectMenuActionHandler(handler)({ payload: "open-settings" });

    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action open-settings");
    expect(executeActionMock).toHaveBeenCalledWith("open-settings");
  });

  it("does not dispatch unknown string menu actions", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });
    expectMenuActionHandler(handler)({ payload: "open-feed-cleanup" });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action open-feed-cleanup");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: open-feed-cleanup");
    warnSpy.mockRestore();
  });

  it("contains synchronous menu action failures inside the diagnostics boundary", async () => {
    const error = new Error("action failed token=raw");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });
    executeActionMock.mockImplementationOnce(() => {
      throw error;
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });

    expect(() => {
      expectMenuActionHandler(handler)({ payload: "open-settings" });
    }).not.toThrow();
    expectMenuActionHandler(handler)({ payload: "open-command-palette" });

    expect(executeActionMock).toHaveBeenCalledWith("open-settings");
    expect(executeActionMock).toHaveBeenCalledWith("open-command-palette");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action failed open-settings");
    expect(errorSpy).toHaveBeenCalledWith("[menu-events] open-settings failed.", expect.any(Error));
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("token=raw");
    errorSpy.mockRestore();
  });

  it("does not dispatch menu actions with non-string payloads", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });
    expectMenuActionHandler(handler)({ payload: { action: "open-settings" } });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith('menu-action {"action":"open-settings"}');
    expect(warnSpy).toHaveBeenCalledWith('[menu-events] Unknown action: {"action":"open-settings"}');
    warnSpy.mockRestore();
  });

  it("redacts and truncates unknown menu action payload diagnostics", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });
    expectMenuActionHandler(handler)({
      payload: {
        action: "open-feed-cleanup",
        token: "raw-token",
        url: `https://example.com/secret-token/feed.xml?token=raw#frag ${"x".repeat(20 * 1024)}`,
        suffix: "kept-after-emergency-truncation",
      },
    });

    const debugPayload = emitDebugInputTraceMock.mock.calls[0]?.[0] ?? "";
    const warningPayload = warnSpy.mock.calls[0]?.[0] ?? "";

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(debugPayload).toContain(
      'menu-action {"action":"open-feed-cleanup","token":"<redacted>","url":"https://example.com/redacted?redacted#redacted ',
    );
    expect(debugPayload).toHaveLength("menu-action ".length + 16 * 1024);
    expect(debugPayload).toContain("[ultra-rss-reader:diagnostics-truncated]");
    expect(debugPayload).toContain("kept-after-emergency-truncation");
    expect(warningPayload).toContain(
      '[menu-events] Unknown action: {"action":"open-feed-cleanup","token":"<redacted>","url":"https://example.com/redacted?redacted#redacted ',
    );
    expect(warningPayload).toHaveLength("[menu-events] Unknown action: ".length + 16 * 1024);
    expect(warningPayload).toContain("[ultra-rss-reader:diagnostics-truncated]");
    expect(warningPayload).toContain("kept-after-emergency-truncation");
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("raw-token");
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("token=raw");
    warnSpy.mockRestore();
  });

  it("safely traces and warns for unknown menu action payloads with unsupported formatting", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    const unsafePayload = {
      toString() {
        throw new Error("toString failed");
      },
    };
    listenMock.mockImplementation((_eventName: string, nextHandler: MenuActionHandler) => {
      handler = nextHandler;
      return Promise.resolve(vi.fn());
    });

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(APP_EVENTS.menuAction, expect.any(Function));
    });
    expect(() => {
      expectMenuActionHandler(handler)({ payload: unsafePayload });
    }).not.toThrow();
    expectMenuActionHandler(handler)({ payload: Symbol("open-settings") });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action {}");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action [Unsupported diagnostics payload]");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: {}");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: [Unsupported diagnostics payload]");
    warnSpy.mockRestore();
  });

  it("traces browser-dev listener unavailability without warning", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    const error = new Error("runtime unavailable");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    listenMock.mockReturnValue(Promise.reject(error));

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action listener unavailable");
    });

    expect(debugSpy).toHaveBeenCalledWith("[menu-events] Tauri menu listener unavailable.", error);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when Tauri runtime menu listener registration fails", async () => {
    setTauriRuntimePresent();
    const error = new Error("listen failed");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    listenMock.mockReturnValue(Promise.reject(error));

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "[tauri-event-listeners] Failed to register or cleanup Tauri event listener.",
        error,
      );
    });

    expect(emitDebugInputTraceMock).not.toHaveBeenCalledWith("menu-action listener unavailable");
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
