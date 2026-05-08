import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isWindowFullscreen, setWindowAlwaysOnTop, setWindowFullscreen, setWindowIcon } from "@/lib/window/windows";

const { getCurrentWindowMock, isFullscreenMock, setAlwaysOnTopMock, setFullscreenMock, setIconMock } = vi.hoisted(
  () => ({
    getCurrentWindowMock: vi.fn(),
    isFullscreenMock: vi.fn(),
    setAlwaysOnTopMock: vi.fn(),
    setFullscreenMock: vi.fn(),
    setIconMock: vi.fn(),
  }),
);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: getCurrentWindowMock,
}));

describe("windows", () => {
  beforeEach(() => {
    getCurrentWindowMock.mockReturnValue({
      isFullscreen: isFullscreenMock,
      setAlwaysOnTop: setAlwaysOnTopMock,
      setFullscreen: setFullscreenMock,
      setIcon: setIconMock,
    });
    isFullscreenMock.mockReset();
    setAlwaysOnTopMock.mockReset();
    setFullscreenMock.mockReset();
    setIconMock.mockReset();
  });

  it("reads fullscreen state from the current Tauri window", async () => {
    isFullscreenMock.mockResolvedValue(true);

    const result = await isWindowFullscreen();

    expect(Result.unwrap(result)).toBe(true);
    expect(getCurrentWindowMock).toHaveBeenCalledOnce();
    expect(isFullscreenMock).toHaveBeenCalledOnce();
  });

  it("sets fullscreen state on the current Tauri window", async () => {
    setFullscreenMock.mockResolvedValue(undefined);

    const result = await setWindowFullscreen(false);

    expect(Result.unwrap(result)).toBeUndefined();
    expect(setFullscreenMock).toHaveBeenCalledWith(false);
  });

  it("sets always-on-top state on the current Tauri window", async () => {
    setAlwaysOnTopMock.mockResolvedValue(undefined);

    const result = await setWindowAlwaysOnTop(true);

    expect(Result.unwrap(result)).toBeUndefined();
    expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
  });

  it("sets the current Tauri window icon", async () => {
    setIconMock.mockResolvedValue(undefined);

    const result = await setWindowIcon("icons/icon.png");

    expect(Result.unwrap(result)).toBeUndefined();
    expect(setIconMock).toHaveBeenCalledWith("icons/icon.png");
  });

  it("wraps non-error Tauri failures as Error values", async () => {
    isFullscreenMock.mockRejectedValue("boom");

    const result = await isWindowFullscreen();

    expect(Result.unwrapError(result)).toEqual(new Error("boom"));
  });
});
