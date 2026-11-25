import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSubscriptionsIndexEscape } from "@/components/subscriptions-index/hooks/use-subscriptions-index-escape";

function pressEscape(target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init }));
}

describe("useSubscriptionsIndexEscape", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("closes the workspace on Escape when no bulk selection is active", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, { active: false, end }));

    pressEscape();

    expect(close).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
  });

  it("closes the workspace on Escape when the bulk argument is omitted", () => {
    const close = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close));

    pressEscape();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("ends the bulk selection instead of closing the workspace while it is active", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, { active: true, end }));

    pressEscape();

    expect(end).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while a text field owns Escape, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, { active: true, end }));
    const input = document.createElement("input");
    document.body.append(input);

    pressEscape(input);

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  describe("search query", () => {
    function appendSearchInput() {
      const input = document.createElement("input");
      input.type = "search";
      document.body.append(input);
      return input;
    }

    it("clears the query before ending bulk selection or closing the workspace", () => {
      const close = vi.fn();
      const end = vi.fn();
      const clear = vi.fn();
      renderHook(() => useSubscriptionsIndexEscape(false, close, { active: true, end }, { active: true, clear }));
      const input = appendSearchInput();

      pressEscape(input);

      expect(clear).toHaveBeenCalledTimes(1);
      expect(end).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });

    it("clears the query on Escape outside the search input", () => {
      const close = vi.fn();
      const clear = vi.fn();
      renderHook(() => useSubscriptionsIndexEscape(false, close, undefined, { active: true, clear }));

      pressEscape();

      expect(clear).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
    });

    it("takes over Escape from the search input so the browser does not clear it a second time", () => {
      renderHook(() => useSubscriptionsIndexEscape(false, vi.fn(), undefined, { active: true, clear: vi.fn() }));
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });

      appendSearchInput().dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("falls through to bulk selection and then the workspace once the query is empty", () => {
      const close = vi.fn();
      const end = vi.fn();
      const clear = vi.fn();
      const { rerender } = renderHook(
        ({ bulkActive }) =>
          useSubscriptionsIndexEscape(false, close, { active: bulkActive, end }, { active: false, clear }),
        { initialProps: { bulkActive: true } },
      );
      const input = appendSearchInput();

      pressEscape(input);
      expect(end).toHaveBeenCalledTimes(1);

      rerender({ bulkActive: false });
      pressEscape(input);
      expect(close).toHaveBeenCalledTimes(1);
      expect(clear).not.toHaveBeenCalled();
    });

    it("still leaves Escape to other text fields while a query is active", () => {
      const close = vi.fn();
      const clear = vi.fn();
      renderHook(() => useSubscriptionsIndexEscape(false, close, undefined, { active: true, clear }));
      const input = document.createElement("input");
      document.body.append(input);

      pressEscape(input);

      expect(clear).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });

    it("leaves Escape to an open select popup even with a query active", () => {
      const clear = vi.fn();
      renderHook(() => useSubscriptionsIndexEscape(false, vi.fn(), undefined, { active: true, clear }));
      const popup = document.createElement("div");
      popup.dataset.slot = "select-popup";
      popup.dataset.open = "";
      document.body.append(popup);

      pressEscape(appendSearchInput());

      expect(clear).not.toHaveBeenCalled();
    });
  });

  it("does nothing while a dialog is open, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, { active: true, end }));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    pressEscape();

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while a feed dialog owns Escape, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(true, close, { active: true, end }));

    pressEscape();

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("ignores an Escape that commits an IME candidate during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, { active: true, end }));

    pressEscape(document.body, { isComposing: true });

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
