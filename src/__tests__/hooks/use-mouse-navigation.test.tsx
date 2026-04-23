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

vi.mock("@/lib/debug-input-trace", () => ({
  emitDebugInputTrace: emitDebugInputTraceMock,
}));

function MouseNavigationHarness() {
  useMouseNavigation();

  return (
    <div>
      <button type="button">Ready</button>
      <input aria-label="Editable input" />
      <div data-disable-global-shortcuts="true">
        <button type="button">Disabled region</button>
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

  it("ignores side buttons on editable inputs", () => {
    render(<MouseNavigationHarness />);
    const input = screen.getByLabelText("Editable input");

    fireEvent.mouseDown(input, { button: 3 });
    fireEvent.mouseUp(input, { button: 3 });

    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it("ignores side buttons in disabled shortcut regions", () => {
    render(<MouseNavigationHarness />);
    const disabledRegionButton = screen.getByRole("button", { name: "Disabled region" });

    fireEvent.mouseDown(disabledRegionButton, { button: 4 });
    fireEvent.mouseUp(disabledRegionButton, { button: 4 });

    expect(executeActionMock).not.toHaveBeenCalled();
  });
});
