import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, copyValueToClipboard, resolveClipboardErrorCategory } from "@/lib/runtime/clipboard";

const { copyToClipboardMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  copyToClipboard: copyToClipboardMock,
}));

describe("clipboard", () => {
  beforeEach(() => {
    copyToClipboardMock.mockReset();
  });

  it.each(["", "   ", "\n\t"])("does nothing for blank clipboard values: %j", async (value) => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await copyValueToClipboard(value, { onSuccess, onError });

    expect(copyToClipboardMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls the success callback after copying", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    copyToClipboardMock.mockResolvedValue(Result.succeed(null));

    await copyValueToClipboard("copy me", { onSuccess, onError });

    expect(copyToClipboardMock).toHaveBeenCalledWith("copy me");
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("copies nonblank readonly-field values without trimming the payload", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    copyToClipboardMock.mockResolvedValue(Result.succeed(null));

    await copyValueToClipboard("  https://example.com/feed.xml  ", { onSuccess, onError });

    expect(copyToClipboardMock).toHaveBeenCalledWith("  https://example.com/feed.xml  ");
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("passes copy errors to the error callback", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const error = { type: "UserVisible", message: "copy failed" };
    copyToClipboardMock.mockResolvedValue(Result.fail(error));

    await copyValueToClipboard("copy me", { onSuccess, onError });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("copy failed", {
      ...error,
      category: "unknown",
    });
  });

  it("classifies clipboard runtime unavailable and permission errors", async () => {
    expect(resolveClipboardErrorCategory("Clipboard unavailable")).toBe("runtime_unavailable");
    expect(resolveClipboardErrorCategory("clipboard plugin not available")).toBe("runtime_unavailable");
    expect(resolveClipboardErrorCategory("Clipboard permission denied")).toBe("permission_denied");
    expect(resolveClipboardErrorCategory("Clipboard write not allowed")).toBe("permission_denied");
  });

  it.each([
    "Invalid clipboard text",
    "Clipboard text validation failed",
    "clipboard text is empty",
  ])("classifies known invalid text clipboard errors: %j", (message) => {
    expect(resolveClipboardErrorCategory(message)).toBe("invalid_text");
  });

  it.each([
    "clipboard context failed",
    "clipboard pretext failed",
    "clipboard textual content failed",
  ])("does not classify incidental text substrings as invalid text: %j", (message) => {
    expect(resolveClipboardErrorCategory(message)).toBe("unknown");
  });

  it.each([
    "",
    "   ",
    "\n\t",
  ])("returns invalid text without calling the Tauri clipboard command for blank direct values: %j", async (value) => {
    const result = await copyTextToClipboard(value);

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toMatchObject({
      message: "Invalid clipboard text",
      category: "invalid_text",
    });
    expect(copyToClipboardMock).not.toHaveBeenCalled();
  });

  it("adds a category to native clipboard failures", async () => {
    const error = {
      type: "UserVisible",
      message: "Clipboard permission denied",
    };
    copyToClipboardMock.mockResolvedValue(Result.fail(error));

    const result = await copyTextToClipboard("copy me");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      ...error,
      category: "permission_denied",
    });
  });

  it("passes runtime unavailable clipboard failures to callbacks with a category", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const error = {
      type: "UserVisible",
      message: "clipboard plugin not available",
    };
    copyToClipboardMock.mockResolvedValue(Result.fail(error));

    await copyValueToClipboard("copy me", { onSuccess, onError });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("clipboard plugin not available", {
      ...error,
      category: "runtime_unavailable",
    });
  });
});
