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
    renderHook(() => useSubscriptionsIndexEscape(false, close, false, { active: false, end }));

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
    renderHook(() => useSubscriptionsIndexEscape(false, close, false, { active: true, end }));

    pressEscape();

    expect(end).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while a text field owns Escape, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, false, { active: true, end }));
    const input = document.createElement("input");
    document.body.append(input);

    pressEscape(input);

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while a dialog is open, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, false, { active: true, end }));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    pressEscape();

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while a feed dialog or select owns Escape, even during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(true, close, false, { active: true, end }));
    renderHook(() => useSubscriptionsIndexEscape(false, close, true, { active: true, end }));

    pressEscape();

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("ignores an Escape that commits an IME candidate during bulk selection", () => {
    const close = vi.fn();
    const end = vi.fn();
    renderHook(() => useSubscriptionsIndexEscape(false, close, false, { active: true, end }));

    pressEscape(document.body, { isComposing: true });

    expect(end).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
