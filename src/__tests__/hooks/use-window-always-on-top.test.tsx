import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowAlwaysOnTop } from "@/hooks/use-window-always-on-top";
import { usePreferencesStore } from "@/stores/preferences-store";

const { setAlwaysOnTopMock } = vi.hoisted(() => ({
  setAlwaysOnTopMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setAlwaysOnTop: setAlwaysOnTopMock,
  }),
}));

function HookHarness() {
  useWindowAlwaysOnTop();
  return null;
}

describe("useWindowAlwaysOnTop", () => {
  beforeEach(() => {
    setAlwaysOnTopMock.mockReset();
    setAlwaysOnTopMock.mockResolvedValue(undefined);
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("keeps the window normal by default", async () => {
    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(false);
    });
  });

  it("keeps the window above other windows when the preference is enabled", async () => {
    usePreferencesStore.setState({ prefs: { window_always_on_top: "true" }, loaded: true });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    });
  });
});
