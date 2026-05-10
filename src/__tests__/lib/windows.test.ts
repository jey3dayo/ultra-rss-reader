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

  it("returns a failure result when always-on-top is unavailable", async () => {
    setAlwaysOnTopMock.mockRejectedValue(new Error("permission denied"));

    const result = await setWindowAlwaysOnTop(true);

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(new Error("permission denied"));
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

  it("preserves structured non-error Tauri failure messages", async () => {
    const detail = { message: "denied", code: "permission_denied" };
    setFullscreenMock.mockRejectedValue(detail);

    const result = await setWindowFullscreen(true);

    const error = Result.unwrapError(result);
    expect(error.message).toBe("denied");
    expect(error.cause).toBe(detail);
  });

  it("wraps non-error object Tauri failures with a stable fallback message", async () => {
    const detail = { code: "permission_denied" };
    setFullscreenMock.mockRejectedValue(detail);

    const result = await setWindowFullscreen(true);

    const error = Result.unwrapError(result);
    expect(error.message).toBe("Unknown window error");
    expect(error.cause).toBe(detail);
  });

  it("wraps symbol Tauri failures as readable Error values", async () => {
    setFullscreenMock.mockRejectedValue(Symbol("window denied"));

    const result = await setWindowFullscreen(true);

    expect(Result.unwrapError(result)).toEqual(new Error("Symbol(window denied)"));
  });

  it("wraps object Tauri failures with throwing stringifiers as stable Error values", async () => {
    const error = Object.create(null, {
      toString: {
        value: () => {
          throw new Error("stringify failed");
        },
      },
    });
    setFullscreenMock.mockRejectedValue(error);

    const result = await setWindowFullscreen(true);

    const wrappedError = Result.unwrapError(result);
    expect(wrappedError.message).toBe("Unknown window error");
    expect(wrappedError.cause).toBe(error);
  });

  it("wraps Tauri failures with throwing message getters as readable Error values", async () => {
    const errorLike = Object.create(null, {
      message: {
        get: () => {
          throw new Error("message getter failed");
        },
      },
    });
    setFullscreenMock.mockRejectedValue(errorLike);

    const result = await setWindowFullscreen(true);

    const error = Result.unwrapError(result);
    expect(error.message).toBe("Unknown window error");
    expect(error.cause).toBe(errorLike);
  });

  it("wraps non-error dynamic import failures as Error values", async () => {
    vi.resetModules();
    vi.doMock("@tauri-apps/api/window", () => {
      throw "import unavailable";
    });
    const { isWindowFullscreen: importFailingIsWindowFullscreen } = await import("@/lib/window/windows");

    const result = await importFailingIsWindowFullscreen();

    const error = Result.unwrapError(result);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("There was an error when mocking a module");
    vi.doUnmock("@tauri-apps/api/window");
    vi.resetModules();
  });
});
