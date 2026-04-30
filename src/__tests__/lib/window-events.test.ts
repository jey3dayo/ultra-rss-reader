import { describe, expect, it, vi } from "vitest";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  createKeyboardEventListener,
  createMouseEventListener,
  createPointerEventListener,
} from "@/lib/window-events";

describe("window-events", () => {
  it("forwards keyboard, mouse, and pointer events only to matching listeners", () => {
    const onKey = vi.fn();
    const onMouse = vi.fn();
    const onPointer = vi.fn();

    const keyListener = createKeyboardEventListener(onKey);
    const mouseListener = createMouseEventListener(onMouse);
    const pointerListener = createPointerEventListener(onPointer);
    const keyEvent = new KeyboardEvent("keydown", { key: "Enter" });
    const mouseEvent = new MouseEvent("click");
    const pointerEvent = new PointerEvent("pointerdown");

    keyListener(keyEvent);
    keyListener(mouseEvent);
    mouseListener(mouseEvent);
    mouseListener(keyEvent);
    pointerListener(pointerEvent);
    pointerListener(mouseEvent);

    expect(onKey).toHaveBeenCalledOnce();
    expect(onKey).toHaveBeenCalledWith(keyEvent);
    expect(onMouse).toHaveBeenCalledOnce();
    expect(onMouse).toHaveBeenCalledWith(mouseEvent);
    expect(onPointer).toHaveBeenCalledOnce();
    expect(onPointer).toHaveBeenCalledWith(pointerEvent);
  });

  it("forwards custom event details when the detail guard accepts them", () => {
    const onDetail = vi.fn();
    const listener = createCustomEventDetailListener(
      (detail): detail is { direction: 1 | -1 } =>
        typeof detail === "object" &&
        detail !== null &&
        "direction" in detail &&
        (detail.direction === 1 || detail.direction === -1),
      onDetail,
    );

    listener(new CustomEvent("navigate", { detail: { direction: 1 } }));
    listener(new CustomEvent("navigate", { detail: { direction: 0 } }));
    listener(new Event("navigate"));

    expect(onDetail).toHaveBeenCalledOnce();
    expect(onDetail).toHaveBeenCalledWith({ direction: 1 });
  });

  it("unbinds registered window events", () => {
    const onPing = vi.fn();
    const cleanup = bindWindowEvents([{ type: "test-window-events-ping", listener: onPing }]);

    window.dispatchEvent(new Event("test-window-events-ping"));
    cleanup();
    window.dispatchEvent(new Event("test-window-events-ping"));

    expect(onPing).toHaveBeenCalledOnce();
  });

  it("removes registered window events with the original listener options", () => {
    const onPing = vi.fn();
    const options = { capture: true, passive: true };
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const cleanup = bindWindowEvents([{ type: "test-window-events-ping", listener: onPing, options }]);

    cleanup();

    expect(removeSpy).toHaveBeenCalledWith("test-window-events-ping", onPing, options);
  });
});
