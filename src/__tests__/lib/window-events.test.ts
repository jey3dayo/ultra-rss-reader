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

  it("ignores custom event details when the detail guard throws", () => {
    const guardError = new Error("malformed detail");
    const onDetail = vi.fn();
    const listener = createCustomEventDetailListener((_detail: unknown): _detail is never => {
      throw guardError;
    }, onDetail);

    expect(() => listener(new CustomEvent("navigate", { detail: { direction: 1 } }))).not.toThrow();

    expect(onDetail).not.toHaveBeenCalled();
  });

  it("preserves custom event handler exceptions after the detail guard accepts", () => {
    const handlerError = new Error("handler failed");
    const listener = createCustomEventDetailListener(
      (detail): detail is { direction: 1 | -1 } =>
        typeof detail === "object" &&
        detail !== null &&
        "direction" in detail &&
        (detail.direction === 1 || detail.direction === -1),
      () => {
        throw handlerError;
      },
    );

    expect(() => listener(new CustomEvent("navigate", { detail: { direction: 1 } }))).toThrow(handlerError);
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

  it("rolls back registered listeners when a later registration fails", () => {
    const registrationError = new Error("second listener failed");
    const target = {
      addEventListener: vi.fn((type: string) => {
        if (type === "second-event") {
          throw registrationError;
        }
      }),
      removeEventListener: vi.fn(),
    };
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const firstOptions = { capture: true, passive: true };
    const secondOptions = { passive: true };

    expect(() =>
      bindWindowEvents([
        { target, type: "first-event", listener: firstListener, options: firstOptions },
        { target, type: "second-event", listener: secondListener, options: secondOptions },
      ]),
    ).toThrow(registrationError);

    expect(target.addEventListener).toHaveBeenNthCalledWith(1, "first-event", firstListener, firstOptions);
    expect(target.addEventListener).toHaveBeenNthCalledWith(2, "second-event", secondListener, secondOptions);
    expect(target.removeEventListener).toHaveBeenCalledOnce();
    expect(target.removeEventListener).toHaveBeenCalledWith("first-event", firstListener, firstOptions);
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

  it("continues removing later listeners without rethrowing when one cleanup throws", () => {
    const cleanupError = new Error("remove failed");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn((type: string) => {
        if (type === "first-event") {
          throw cleanupError;
        }
      }),
    };
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const cleanup = bindWindowEvents([
      { target, type: "first-event", listener: firstListener },
      { target, type: "second-event", listener: secondListener },
    ]);

    expect(cleanup).not.toThrow();

    expect(target.removeEventListener).toHaveBeenCalledTimes(2);
    expect(target.removeEventListener).toHaveBeenNthCalledWith(1, "first-event", firstListener, undefined);
    expect(target.removeEventListener).toHaveBeenNthCalledWith(2, "second-event", secondListener, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to remove window event listener.", cleanupError);
  });
});
