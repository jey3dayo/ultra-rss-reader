import { render, waitFor } from "@testing-library/react";
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
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action [object Object]");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: [object Object]");
    warnSpy.mockRestore();
  });

  it("safely traces and warns for unknown menu action payloads with unsafe formatting", async () => {
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
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action [unformattable payload]");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("menu-action Symbol(open-settings)");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: [unformattable payload]");
    expect(warnSpy).toHaveBeenCalledWith("[menu-events] Unknown action: Symbol(open-settings)");
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
