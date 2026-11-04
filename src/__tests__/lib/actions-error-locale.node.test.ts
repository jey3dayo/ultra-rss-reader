import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeAction } from "@/lib/actions";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

const { isWindowFullscreenMock, setWindowFullscreenMock } = vi.hoisted(() => ({
  isWindowFullscreenMock: vi.fn(),
  setWindowFullscreenMock: vi.fn(),
}));

vi.mock("@/lib/window/tauri-window", () => ({
  isWindowFullscreen: isWindowFullscreenMock,
  setWindowFullscreen: setWindowFullscreenMock,
}));

describe("global action boundary error locale", () => {
  beforeEach(async () => {
    useUiStore.setState(useUiStore.getInitialState());
    isWindowFullscreenMock.mockReset();
    setWindowFullscreenMock.mockReset();
    setWindowFullscreenMock.mockResolvedValue(Result.succeed(undefined));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await i18n.changeLanguage("ja");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the Japanese message when a global action fails with invalid clipboard text", async () => {
    isWindowFullscreenMock.mockRejectedValueOnce(new Error("Invalid clipboard text"));

    executeAction("toggle-fullscreen");

    await vi.waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "コピーできないテキストです",
        severity: "error",
      });
    });
  });
});
