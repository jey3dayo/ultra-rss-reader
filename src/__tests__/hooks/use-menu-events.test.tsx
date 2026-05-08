import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/constants/events";
import { useMenuEvents } from "@/hooks/use-menu-events";

const { executeActionMock, emitDebugInputTraceMock, listenMock } = vi.hoisted(
  () => ({
    executeActionMock: vi.fn(),
    emitDebugInputTraceMock: vi.fn(),
    listenMock: vi.fn(),
  }),
);

type MenuActionHandler = (event: { payload: string }) => void;

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

function expectMenuActionHandler(
  handler: MenuActionHandler | null,
): MenuActionHandler {
  expect(handler).toBeTypeOf("function");
  if (!handler) {
    throw new Error("Expected menu action handler to be registered");
  }
  return handler;
}

describe("useMenuEvents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches known menu actions from the Tauri menu-action event", async () => {
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation(
      (_eventName: string, nextHandler: MenuActionHandler) => {
        handler = nextHandler;
        return Promise.resolve(vi.fn());
      },
    );

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(
        APP_EVENTS.menuAction,
        expect.any(Function),
      );
    });
    expectMenuActionHandler(handler)({ payload: "open-settings" });

    expect(emitDebugInputTraceMock).toHaveBeenCalledWith(
      "menu-action open-settings",
    );
    expect(executeActionMock).toHaveBeenCalledWith("open-settings");
  });

  it("does not dispatch unknown menu actions", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handler: MenuActionHandler | null = null;
    listenMock.mockImplementation(
      (_eventName: string, nextHandler: MenuActionHandler) => {
        handler = nextHandler;
        return Promise.resolve(vi.fn());
      },
    );

    render(<MenuEventsProbe />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith(
        APP_EVENTS.menuAction,
        expect.any(Function),
      );
    });
    expectMenuActionHandler(handler)({ payload: "open-feed-cleanup" });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[menu-events] Unknown action: open-feed-cleanup",
    );
    warnSpy.mockRestore();
  });
});
