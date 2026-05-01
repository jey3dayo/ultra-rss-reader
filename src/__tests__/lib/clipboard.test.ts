import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyValueToClipboard } from "@/lib/clipboard";

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

  it("does nothing for empty clipboard values", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await copyValueToClipboard("", { onSuccess, onError });

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

  it("passes copy errors to the error callback", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const error = { type: "UserVisible", message: "copy failed" };
    copyToClipboardMock.mockResolvedValue(Result.fail(error));

    await copyValueToClipboard("copy me", { onSuccess, onError });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("copy failed", error);
  });
});
