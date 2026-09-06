import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { mockObserverConstructors } from "@tests/helpers/typed-test-factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE,
  useReaderPassiveLayout,
} from "@/components/reader/hooks/use-reader-passive-layout";

setupBrowserTestDom();

let cleanupObserverMocks: (() => void) | null = null;

function mockLayoutObservers() {
  const mocks = mockObserverConstructors();
  cleanupObserverMocks = mocks.cleanupObservers;
  return mocks;
}

function setBounds(element: HTMLElement, top: number, bottom: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top,
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  cleanupObserverMocks?.();
  cleanupObserverMocks = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useReaderPassiveLayout", () => {
  it("resolves an unmeasured/newly registered card to the safe fallback state", () => {
    mockLayoutObservers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list", "content"] }));

    expect(result.current.getCardState("list")).toEqual(READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE);
  });

  it("falls back when ResizeObserver is unsupported, even with valid geometry", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list", "content"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const card = document.createElement("div");
    setBounds(card, 0, 100);

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });
    act(() => {
      rafCallback?.(0);
    });

    expect(result.current.getCardState("list")).toEqual(READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE);
  });

  it("anchors a card in normal mode once geometry and ResizeObserver are both available", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list", "content"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000); // H = 1000, Y = 0 + clamp(24, 250, 976) = 250
    const card = document.createElement("div");
    setBounds(card, 0, 100); // small card, fits comfortably

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });
    act(() => {
      rafCallback?.(0);
    });

    expect(result.current.getCardState("list")).toEqual({ mode: "normal", offsetPx: 250 });
  });

  it("falls back a single pane's card when it alone does not fit under the shared anchor", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list", "content"] }));

    const listBody = document.createElement("div");
    setBounds(listBody, 0, 1000); // common bounds: top=0, bottom=1000 (single visible body per pane, shared)
    const contentBody = document.createElement("div");
    setBounds(contentBody, 0, 1000);
    const listCard = document.createElement("div");
    setBounds(listCard, 0, 100); // fits
    const contentCard = document.createElement("div");
    setBounds(contentCard, 0, 900); // Y(250) + C(900) = 1150 overshoots bottom(1000) - S(24)

    act(() => {
      result.current.registerBody("list", listBody);
      result.current.registerBody("content", contentBody);
      result.current.registerCard("list", "identity-a", listCard);
      result.current.registerCard("content", "identity-b", contentCard);
    });
    act(() => {
      rafCallback?.(0);
    });

    expect(result.current.getCardState("list")).toEqual({ mode: "normal", offsetPx: 250 });
    expect(result.current.getCardState("content").mode).toBe("fallback");
    expect(result.current.getCardState("content").offsetPx).toBe(24);
  });

  it("uses only the visible pane's body when the other pane is hidden/unmounted", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const listBody = document.createElement("div");
    setBounds(listBody, 10, 800);
    const listCard = document.createElement("div");
    setBounds(listCard, 0, 50);

    act(() => {
      result.current.registerBody("list", listBody);
      result.current.registerCard("list", "identity-a", listCard);
    });
    act(() => {
      rafCallback?.(0);
    });

    // H = 790, Y = 10 + clamp(24, 197.5, 766) = 207.5; offsetPx = Y - bodyTop = 207.5 - 10 = 197.5
    expect(result.current.getCardState("list")).toEqual({ mode: "normal", offsetPx: 197.5 });
  });

  it("un-registers a body/card cleanly and re-measures", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const card = document.createElement("div");
    setBounds(card, 0, 100);

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.getCardState("list").mode).toBe("normal");

    act(() => {
      result.current.registerCard("list", "identity-a", null);
    });

    expect(result.current.getCardState("list")).toEqual(READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE);
  });

  it("resets fit history to normal when a card's identity changes", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const oversizedCard = document.createElement("div");
    setBounds(oversizedCard, 0, 900); // overshoots -> fallback

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", oversizedCard);
    });
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.getCardState("list").mode).toBe("fallback");

    // Same pane, new identity, and a card that fits: history resets and re-evaluates from normal.
    const fittingCard = document.createElement("div");
    setBounds(fittingCard, 0, 50);

    act(() => {
      result.current.registerCard("list", "identity-b", fittingCard);
    });
    act(() => {
      rafCallback?.(0);
    });

    expect(result.current.getCardState("list").mode).toBe("normal");
  });

  it("keeps a fallback pane in fallback until the recovery hysteresis is cleared", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000); // Y = 250
    const card = document.createElement("div");
    setBounds(card, 0, 900); // F = 1000 - 24 - (250+900) = -174 -> fallback

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.getCardState("list").mode).toBe("fallback");

    // Shrink the card so F sits just under the hysteresis: F = 1000-24-(250+723) = 3 (< 4).
    // notifyLayoutChange() is the public API for "re-measure on the next frame".
    setBounds(card, 0, 723);
    act(() => {
      result.current.notifyLayoutChange();
    });
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.getCardState("list").mode).toBe("fallback");

    // Shrink further so F clears the hysteresis: F = 1000-24-(250+722) = 4
    setBounds(card, 0, 722);
    act(() => {
      result.current.notifyLayoutChange();
    });
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.getCardState("list").mode).toBe("normal");
  });

  it("disconnects observers and cancels the pending frame on unmount", () => {
    const { resizeObservers } = mockLayoutObservers();
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 42);

    const { result, unmount } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000);

    act(() => {
      result.current.registerBody("list", body);
    });

    // registerBody bumps registryVersion, which re-runs the observer effect: the observer active
    // after this registration is the newest one, not necessarily resizeObservers[0] (that one may
    // already belong to the initial mount, before anything was registered).
    const activeObserver = resizeObservers[resizeObservers.length - 1];
    expect(activeObserver?.observe).toHaveBeenCalledWith(body);

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
    expect(activeObserver?.disconnect).toHaveBeenCalled();
  });

  it("ignores a late frame callback that fires after unmount (stale owner generation)", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useReaderPassiveLayout({ enabled: true, visiblePanes: ["list"] }));

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const card = document.createElement("div");
    setBounds(card, 0, 100);

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });

    unmount();

    expect(() => {
      act(() => {
        rafCallback?.(0);
      });
    }).not.toThrow();
  });

  it("does not measure while disabled and re-attaches observers once re-enabled", () => {
    mockLayoutObservers();
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useReaderPassiveLayout({ enabled, visiblePanes: ["list"] }),
      { initialProps: { enabled: false } },
    );

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const card = document.createElement("div");
    setBounds(card, 0, 100);

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });

    // Disabled: no rAF should have been scheduled, so nothing to flush; state stays fallback.
    expect(result.current.getCardState("list")).toEqual(READER_PASSIVE_LAYOUT_FALLBACK_CARD_STATE);

    rerender({ enabled: true });
    act(() => {
      rafCallback?.(0);
    });

    expect(result.current.getCardState("list")).toEqual({ mode: "normal", offsetPx: 250 });
  });

  it("survives a StrictMode-style setup->cleanup->setup: no leaked observer, no throw from the stale frame", () => {
    const { resizeObservers } = mockLayoutObservers();
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ visiblePanes }: { visiblePanes: readonly ("list" | "content")[] }) =>
        useReaderPassiveLayout({ enabled: true, visiblePanes }),
      { initialProps: { visiblePanes: ["list"] } },
    );

    const body = document.createElement("div");
    setBounds(body, 0, 1000);
    const card = document.createElement("div");
    setBounds(card, 0, 100);

    act(() => {
      result.current.registerBody("list", body);
      result.current.registerCard("list", "identity-a", card);
    });

    const preCleanupCallback = rafCallbacks[rafCallbacks.length - 1];
    const observerBeforeResetup = resizeObservers[0];

    // Changing visiblePanes re-runs the mount effect: cleanup (disconnects observers, bumps the
    // owner generation) then setup again (re-observes the still-registered body/card and
    // re-measures under a new generation) -- the same shape as a StrictMode double effect run.
    rerender({ visiblePanes: ["list", "content"] });

    expect(observerBeforeResetup?.disconnect).toHaveBeenCalled();
    // A fresh observer replaced the disconnected one for the same body element.
    expect(resizeObservers.some((observer) => observer !== observerBeforeResetup && !observer.isDisconnected())).toBe(
      true,
    );

    // The frame scheduled by the *previous* setup must not throw or corrupt state once a new
    // setup has taken over.
    expect(() => {
      act(() => {
        preCleanupCallback?.(0);
      });
    }).not.toThrow();

    // The post-re-setup frame (from the new effect's own scheduleMeasure) still resolves normally.
    const postSetupCallback = rafCallbacks[rafCallbacks.length - 1];
    act(() => {
      postSetupCallback?.(0);
    });

    expect(result.current.getCardState("list")).toEqual({ mode: "normal", offsetPx: 250 });
  });
});
