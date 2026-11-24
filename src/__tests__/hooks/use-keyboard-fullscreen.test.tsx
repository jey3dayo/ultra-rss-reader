import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformKind } from "@/constants/platform";
import { useKeyboard } from "@/hooks/use-keyboard";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const executeActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions", () => ({
  executeAction: executeActionMock,
}));

function setPlatformKind(kind: PlatformKind) {
  usePlatformStore.setState({
    ...usePlatformStore.getInitialState(),
    platform: {
      ...usePlatformStore.getInitialState().platform,
      kind,
    },
  });
}

describe("useKeyboard F11 fullscreen shortcut", () => {
  beforeEach(() => {
    executeActionMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    setPlatformKind("windows");
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
  });

  it("dispatches toggle-fullscreen on F11 and prevents the default", () => {
    renderHook(() => useKeyboard());

    const notPrevented = fireEvent.keyDown(window, { key: "F11" });

    expect(notPrevented).toBe(false);
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

  it("leaves F11 to the native menu accelerator outside Windows", () => {
    setPlatformKind("linux");
    renderHook(() => useKeyboard());

    fireEvent.keyDown(window, { key: "F11" });

    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it("does not dispatch while a top layer such as a dialog is open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");
    dialog.setAttribute("data-stack-layer", "");
    document.body.appendChild(dialog);

    try {
      renderHook(() => useKeyboard());

      fireEvent.keyDown(window, { key: "F11" });

      expect(executeActionMock).not.toHaveBeenCalled();
    } finally {
      dialog.remove();
    }
  });
});
