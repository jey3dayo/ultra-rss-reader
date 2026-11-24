import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboard } from "@/hooks/use-keyboard";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const executeActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions", () => ({
  executeAction: executeActionMock,
}));

describe("useKeyboard F11 fullscreen shortcut", () => {
  beforeEach(() => {
    executeActionMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    usePlatformStore.setState(usePlatformStore.getInitialState());
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
  });

  it("dispatches toggle-fullscreen on F11", () => {
    renderHook(() => useKeyboard());

    fireEvent.keyDown(window, { key: "F11" });

    expect(executeActionMock).toHaveBeenCalledTimes(1);
    expect(executeActionMock).toHaveBeenCalledWith("toggle-fullscreen");
  });

  it("ignores F11 key repeats so holding the key does not strobe fullscreen", () => {
    renderHook(() => useKeyboard());

    fireEvent.keyDown(window, { key: "F11", repeat: true });

    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it("ignores F11 combined with modifiers", () => {
    renderHook(() => useKeyboard());

    fireEvent.keyDown(window, { key: "F11", ctrlKey: true });
    fireEvent.keyDown(window, { key: "F11", metaKey: true });
    fireEvent.keyDown(window, { key: "F11", shiftKey: true });

    expect(executeActionMock).not.toHaveBeenCalled();
  });
});
