import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBrowserOverlayShortcuts } from "@/components/reader/hooks/browser/use-browser-overlay-shortcuts";
import { useKeyboard } from "@/hooks/use-keyboard";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

describe("useBrowserOverlayShortcuts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("owns only an unhandled Escape while the browser overlay has a URL", () => {
    const handleCloseOverlay = vi.fn();
    const laterWindowShortcut = vi.fn();
    renderHook(() =>
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      }),
    );
    window.addEventListener("keydown", laterWindowShortcut);

    try {
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      window.dispatchEvent(escapeEvent);

      expect(handleCloseOverlay).toHaveBeenCalledTimes(1);
      expect(laterWindowShortcut).not.toHaveBeenCalled();
      expect(escapeEvent.defaultPrevented).toBe(true);
    } finally {
      window.removeEventListener("keydown", laterWindowShortcut);
    }
  });

  it("does not claim article shortcuts or already-handled Escape events", () => {
    const handleCloseOverlay = vi.fn();
    renderHook(() =>
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      }),
    );

    const articleShortcut = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true });
    window.dispatchEvent(articleShortcut);

    const handledEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handledEscape.preventDefault();
    window.dispatchEvent(handledEscape);

    expect(handleCloseOverlay).not.toHaveBeenCalled();
    expect(articleShortcut.defaultPrevented).toBe(false);
  });

  it("leaves browser toolbar and global action shortcuts available while the overlay is open", () => {
    const handleCloseOverlay = vi.fn();
    const laterWindowShortcut = vi.fn();
    renderHook(() =>
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      }),
    );
    window.addEventListener("keydown", laterWindowShortcut);

    try {
      const reloadShortcut = new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true });
      const openExternalShortcut = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true });

      window.dispatchEvent(reloadShortcut);
      window.dispatchEvent(openExternalShortcut);

      expect(handleCloseOverlay).not.toHaveBeenCalled();
      expect(laterWindowShortcut).toHaveBeenCalledTimes(2);
      expect(reloadShortcut.defaultPrevented).toBe(false);
      expect(openExternalShortcut.defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener("keydown", laterWindowShortcut);
    }
  });

  it("does not bind shortcut ownership without a browser URL", () => {
    const handleCloseOverlay = vi.fn();
    renderHook(() =>
      useBrowserOverlayShortcuts({
        browserUrl: null,
        handleCloseOverlay,
      }),
    );

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(escapeEvent);

    expect(handleCloseOverlay).not.toHaveBeenCalled();
    expect(escapeEvent.defaultPrevented).toBe(false);
  });

  it("owns Escape before the global browser close shortcut can emit a duplicate close", () => {
    const handleCloseOverlay = vi.fn();
    const closeBrowserShortcut = vi.fn();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    window.addEventListener(keyboardEvents.closeBrowserOverlay, closeBrowserShortcut);

    renderHook(() => {
      useKeyboard();
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      });
    });

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(escapeEvent);

    expect(handleCloseOverlay).toHaveBeenCalledTimes(1);
    expect(closeBrowserShortcut).not.toHaveBeenCalled();
    expect(escapeEvent.defaultPrevented).toBe(true);

    window.removeEventListener(keyboardEvents.closeBrowserOverlay, closeBrowserShortcut);
  });

  it("lets an open dialog top layer own Escape over the browser overlay", () => {
    const handleCloseOverlay = vi.fn();
    const laterWindowShortcut = vi.fn();
    const dialogTopLayer = document.createElement("div");
    dialogTopLayer.setAttribute("data-slot", "dialog-content");
    dialogTopLayer.setAttribute("data-open", "");
    document.body.appendChild(dialogTopLayer);
    renderHook(() =>
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      }),
    );
    window.addEventListener("keydown", laterWindowShortcut);

    try {
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      window.dispatchEvent(escapeEvent);

      expect(handleCloseOverlay).not.toHaveBeenCalled();
      expect(laterWindowShortcut).toHaveBeenCalledTimes(1);
      expect(escapeEvent.defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener("keydown", laterWindowShortcut);
      dialogTopLayer.remove();
    }
  });

  it("binds Escape ownership with the same capture-phase ordering as the global keyboard handler", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const handleCloseOverlay = vi.fn();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    renderHook(() => {
      useKeyboard();
      useBrowserOverlayShortcuts({
        browserUrl: "https://example.com/article",
        handleCloseOverlay,
      });
    });

    const keydownRegistrations = addEventListenerSpy.mock.calls.filter(([type]) => type === "keydown");

    expect(keydownRegistrations).toHaveLength(2);
    expect(keydownRegistrations.map(([, , options]) => options)).toEqual([true, true]);
  });

  it("keeps already-handled Escape events out of the global keyboard handler", () => {
    const closeBrowserShortcut = vi.fn();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    window.addEventListener(keyboardEvents.closeBrowserOverlay, closeBrowserShortcut);

    renderHook(() => {
      useKeyboard();
    });

    const handledEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handledEscape.preventDefault();
    window.dispatchEvent(handledEscape);

    expect(closeBrowserShortcut).not.toHaveBeenCalled();

    window.removeEventListener(keyboardEvents.closeBrowserOverlay, closeBrowserShortcut);
  });
});
