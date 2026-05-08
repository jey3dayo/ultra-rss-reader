import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMouseNavigation } from "@/hooks/use-mouse-navigation";

const { emitDebugInputTraceMock, executeActionMock } = vi.hoisted(() => ({
  emitDebugInputTraceMock: vi.fn(),
  executeActionMock: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({
  executeAction: executeActionMock,
}));

vi.mock("@/lib/debug/debug-input-trace", () => ({
  emitDebugInputTrace: emitDebugInputTraceMock,
}));

function MouseNavigationHarness() {
  useMouseNavigation();

  return (
    <div>
      <button type="button">Ready</button>
      <input aria-label="Editable input" />
      <textarea aria-label="Editable textarea" />
      <select aria-label="Editable select">
        <option>One</option>
      </select>
      <div contentEditable data-testid="editable-contenteditable">
        Editable content
      </div>
      <div data-disable-global-shortcuts="true">
        <button type="button">
          <span>Disabled region</span>
        </button>
      </div>
    </div>
  );
}

describe("useMouseNavigation", () => {
  beforeEach(() => {
    executeActionMock.mockReset();
    emitDebugInputTraceMock.mockReset();
  });

  it("dispatches mouse-back for button 3", () => {
    render(<MouseNavigationHarness />);

    fireEvent.mouseDown(window, { button: 3 });
    fireEvent.mouseUp(window, { button: 3 });

    expect(executeActionMock).toHaveBeenCalledWith("mouse-back");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("window-mouse 3 -> mouse-back");
  });

  it("dispatches mouse-forward for button 4", () => {
    render(<MouseNavigationHarness />);

    fireEvent.mouseDown(window, { button: 4 });
    fireEvent.mouseUp(window, { button: 4 });

    expect(executeActionMock).toHaveBeenCalledWith("mouse-forward");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("window-mouse 4 -> mouse-forward");
  });

  it("captures mouse side-button down events without dispatching actions", () => {
    render(<MouseNavigationHarness />);
    const event = new MouseEvent("mousedown", {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(stopPropagationSpy).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it("captures mouse side-button up events before dispatching navigation", () => {
    render(<MouseNavigationHarness />);
    const event = new MouseEvent("mouseup", {
      button: 4,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(stopPropagationSpy).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(executeActionMock).toHaveBeenCalledWith("mouse-forward");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("window-mouse 4 -> mouse-forward");
  });

  it("captures side-button mousedown, prevents browser handling, and dispatches no action", () => {
    render(<MouseNavigationHarness />);
    const readyButton = screen.getByRole("button", { name: "Ready" });
    const bubbleListener = vi.fn();
    readyButton.addEventListener("mousedown", bubbleListener);
    const event = new MouseEvent("mousedown", {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, "stopPropagation");

    readyButton.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalled();
    expect(bubbleListener).not.toHaveBeenCalled();
    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it("captures side-button mouseup, prevents browser handling, and dispatches navigation", () => {
    render(<MouseNavigationHarness />);
    const readyButton = screen.getByRole("button", { name: "Ready" });
    const bubbleListener = vi.fn();
    readyButton.addEventListener("mouseup", bubbleListener);
    const event = new MouseEvent("mouseup", {
      button: 4,
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, "stopPropagation");

    readyButton.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalled();
    expect(bubbleListener).not.toHaveBeenCalled();
    expect(executeActionMock).toHaveBeenCalledWith("mouse-forward");
    expect(emitDebugInputTraceMock).toHaveBeenCalledWith("window-mouse 4 -> mouse-forward");
  });

  it("ignores side buttons on editable inputs", () => {
    render(<MouseNavigationHarness />);
    const input = screen.getByLabelText("Editable input");

    fireEvent.mouseDown(input, { button: 3 });
    fireEvent.mouseUp(input, { button: 3 });

    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it.each([
    ["input", "Editable input"],
    ["textarea", "Editable textarea"],
    ["select", "Editable select"],
  ])("ignores side buttons on %s targets", (_, label) => {
    render(<MouseNavigationHarness />);
    const target = screen.getByLabelText(label);

    fireEvent.mouseDown(target, { button: 3 });
    fireEvent.mouseUp(target, { button: 3 });
    fireEvent.mouseDown(target, { button: 4 });
    fireEvent.mouseUp(target, { button: 4 });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it("ignores side buttons on contenteditable targets", () => {
    render(<MouseNavigationHarness />);
    const target = screen.getByTestId("editable-contenteditable");

    fireEvent.mouseDown(target, { button: 3 });
    fireEvent.mouseUp(target, { button: 3 });
    fireEvent.mouseDown(target, { button: 4 });
    fireEvent.mouseUp(target, { button: 4 });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it.each(["textbox", "searchbox"] as const)("ignores side buttons on %s role descendants", (role) => {
    render(<MouseNavigationHarness />);
    const target = document.createElement("span");
    const wrapper = document.createElement("div");
    wrapper.setAttribute("role", role);
    wrapper.append(target);
    document.body.append(wrapper);

    fireEvent.mouseDown(target, { button: 3 });
    fireEvent.mouseUp(target, { button: 3 });
    fireEvent.mouseDown(target, { button: 4 });
    fireEvent.mouseUp(target, { button: 4 });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();

    wrapper.remove();
  });

  it("ignores side buttons from data-disabled shortcut descendants", () => {
    render(<MouseNavigationHarness />);
    const disabledRegionText = screen.getByText("Disabled region");

    fireEvent.mouseDown(disabledRegionText, { button: 3 });
    fireEvent.mouseUp(disabledRegionText, { button: 3 });
    fireEvent.mouseDown(disabledRegionText, { button: 4 });
    fireEvent.mouseUp(disabledRegionText, { button: 4 });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it("ignores primary mouse buttons and already handled side buttons", () => {
    render(<MouseNavigationHarness />);

    fireEvent.mouseDown(window, { button: 0 });
    fireEvent.mouseUp(window, { button: 0 });

    const handledEvent = new MouseEvent("mouseup", {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    handledEvent.preventDefault();
    window.dispatchEvent(handledEvent);

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });

  it("removes global mouse navigation listeners on unmount", () => {
    const { unmount } = render(<MouseNavigationHarness />);
    unmount();

    fireEvent.mouseDown(window, { button: 3 });
    fireEvent.mouseUp(window, { button: 3 });

    expect(executeActionMock).not.toHaveBeenCalled();
    expect(emitDebugInputTraceMock).not.toHaveBeenCalled();
  });
});
