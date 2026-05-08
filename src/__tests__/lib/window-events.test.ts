import { describe, expect, it, vi } from "vitest";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  createKeyboardEventListener,
  createMouseEventListener,
  createPointerEventListener,
} from "@/lib/window/window-events";

describe("window-events", () => {
  it("forwards keyboard events only to keyboard listeners", () => {
    const onKey = vi.fn();
    const onMouse = vi.fn();
    const onPointer = vi.fn();
    const keyEvent = new KeyboardEvent("keydown", { key: "Enter" });

    createKeyboardEventListener(onKey)(keyEvent);
    createMouseEventListener(onMouse)(keyEvent);
    createPointerEventListener(onPointer)(keyEvent);

    expect(onKey).toHaveBeenCalledOnce();
    expect(onKey).toHaveBeenCalledWith(keyEvent);
    expect(onMouse).not.toHaveBeenCalled();
    expect(onPointer).not.toHaveBeenCalled();
  });

  it("forwards mouse events only to mouse listeners", () => {
    const onKey = vi.fn();
    const onMouse = vi.fn();
    const onPointer = vi.fn();
    const mouseEvent = new MouseEvent("click");

    createKeyboardEventListener(onKey)(mouseEvent);
    createMouseEventListener(onMouse)(mouseEvent);
    createPointerEventListener(onPointer)(mouseEvent);

    expect(onKey).not.toHaveBeenCalled();
    expect(onMouse).toHaveBeenCalledOnce();
    expect(onMouse).toHaveBeenCalledWith(mouseEvent);
    expect(onPointer).not.toHaveBeenCalled();
  });

  it("forwards pointer events only to pointer listeners", () => {
    const onKey = vi.fn();
    const onMouse = vi.fn();
    const onPointer = vi.fn();
    const pointerEvent = new PointerEvent("pointerdown");

    createKeyboardEventListener(onKey)(pointerEvent);
    createMouseEventListener(onMouse)(pointerEvent);
    createPointerEventListener(onPointer)(pointerEvent);

    expect(onKey).not.toHaveBeenCalled();
    expect(onMouse).not.toHaveBeenCalled();
    expect(onPointer).toHaveBeenCalledOnce();
    expect(onPointer).toHaveBeenCalledWith(pointerEvent);
  });

  it("ignores plain events for typed keyboard, mouse, and pointer listeners", () => {
    const onKey = vi.fn();
    const onMouse = vi.fn();
    const onPointer = vi.fn();
    const plainEvent = new Event("input");

    createKeyboardEventListener(onKey)(plainEvent);
    createMouseEventListener(onMouse)(plainEvent);
    createPointerEventListener(onPointer)(plainEvent);

    expect(onKey).not.toHaveBeenCalled();
    expect(onMouse).not.toHaveBeenCalled();
    expect(onPointer).not.toHaveBeenCalled();
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

  it("adds and removes typed helper listeners with matching target, type, listener, and options", () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const keyboardOptions = { capture: true };
    const pointerOptions = { passive: true };
    const customOptions = false;
    const keyboardListener = createKeyboardEventListener(vi.fn());
    const pointerListener = createPointerEventListener(vi.fn());
    const customListener = createCustomEventDetailListener(
      (detail): detail is { action: string } => typeof detail === "object" && detail !== null && "action" in detail,
      vi.fn(),
    );
    const bindings = [
      { target, type: "keydown", listener: keyboardListener, options: keyboardOptions },
      { target, type: "pointerdown", listener: pointerListener, options: pointerOptions },
      { target, type: "app:event", listener: customListener, options: customOptions },
    ] as const;

    const cleanup = bindWindowEvents(bindings);
    cleanup();

    expect(target.addEventListener).toHaveBeenNthCalledWith(1, "keydown", keyboardListener, keyboardOptions);
    expect(target.addEventListener).toHaveBeenNthCalledWith(2, "pointerdown", pointerListener, pointerOptions);
    expect(target.addEventListener).toHaveBeenNthCalledWith(3, "app:event", customListener, customOptions);
    expect(target.removeEventListener).toHaveBeenNthCalledWith(1, "keydown", keyboardListener, keyboardOptions);
    expect(target.removeEventListener).toHaveBeenNthCalledWith(2, "pointerdown", pointerListener, pointerOptions);
    expect(target.removeEventListener).toHaveBeenNthCalledWith(3, "app:event", customListener, customOptions);
  });
});
