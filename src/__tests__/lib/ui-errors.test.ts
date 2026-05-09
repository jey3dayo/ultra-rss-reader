import { describe, expect, it, vi } from "vitest";
import { getErrorMessage, projectUiErrorToast } from "@/lib/ui/errors";
import {
  classifyQueryTransientFailureUx,
  classifySchemaParseErrorSurface,
  createSchemaParseAppError,
} from "@/lib/ui-errors";

describe("ui error projection", () => {
  it("classifies command schema parse errors by user-facing surface", () => {
    expect(classifySchemaParseErrorSurface("args")).toBe("user-facing");
    expect(classifySchemaParseErrorSurface("response")).toBe("diagnostics");
    expect(createSchemaParseAppError("args", "accountId: Command id must not be blank")).toEqual({
      type: "UserVisible",
      message: "Command validation failed: accountId: Command id must not be blank",
    });
    expect(createSchemaParseAppError("response", "name: Required")).toEqual({
      type: "Diagnostics",
      message: "Response validation failed. See diagnostics for details.",
    });
  });

  it("classifies transient query failures separately from permanent user errors", () => {
    expect(classifyQueryTransientFailureUx({ type: "Retryable", message: "network timeout" })).toBe("manual-retry");
    expect(
      classifyQueryTransientFailureUx({
        type: "UserVisible",
        message: "Database is busy. Wait for the current operation to finish and try again.",
      }),
    ).toBe("manual-retry");
    expect(classifyQueryTransientFailureUx({ type: "Diagnostics", message: "schema mismatch" })).toBe("diagnostics");
    expect(classifyQueryTransientFailureUx({ type: "UserVisible", message: "Feed not found" })).toBe("none");
  });

  it("normalizes unknown error messages for caller fallbacks", () => {
    expect(getErrorMessage(new Error("network down"))).toBe("network down");
    expect(getErrorMessage({ message: "permission denied" })).toBe("permission denied");
    expect(getErrorMessage("failed")).toBe("Unknown error");
  });

  it("falls back for blank error messages", () => {
    expect(getErrorMessage(new Error(""))).toBe("Unknown error");
    expect(getErrorMessage(new Error("   "))).toBe("Unknown error");
    expect(getErrorMessage({ message: "\n\t " })).toBe("Unknown error");
  });

  it("falls back when error message access is unsafe or non-string", () => {
    const errorWithThrowingMessage = {};
    Object.defineProperty(errorWithThrowingMessage, "message", {
      get() {
        throw new Error("message unavailable");
      },
    });

    expect(getErrorMessage(errorWithThrowingMessage)).toBe("Unknown error");
    expect(getErrorMessage({ message: Symbol("symbol message") })).toBe("Unknown error");
    expect(getErrorMessage({ message: 123 })).toBe("Unknown error");
    expect(getErrorMessage({ message: { text: "network down" } })).toBe("Unknown error");
  });

  it("falls back when fallback stringification would be unsafe", () => {
    const errorWithThrowingToString = {
      toString() {
        throw new Error("toString unavailable");
      },
    };

    expect(getErrorMessage(errorWithThrowingToString)).toBe("Unknown error");
  });

  it("keeps retry and dismiss actions explicit in the toast payload", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    const toast = projectUiErrorToast({
      message: "同期に失敗しました",
      retryLabel: "再試行",
      onRetry,
      dismissLabel: "閉じる",
      onDismiss,
    });

    expect(toast).toMatchObject({
      message: "同期に失敗しました",
      severity: "error",
    });
    expect(toast.actions?.map((action) => action.label)).toEqual(["再試行", "閉じる"]);

    toast.actions?.[0]?.onClick();
    toast.actions?.[1]?.onClick();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("falls back when toast messages are blank", () => {
    expect(
      projectUiErrorToast({
        message: "   ",
      }),
    ).toEqual({
      message: "Unknown error",
      severity: "error",
    });
  });

  it("does not project inert action labels without handlers", () => {
    expect(
      projectUiErrorToast({
        message: "クリップボードを利用できません",
        retryLabel: "再試行",
        dismissLabel: "閉じる",
      }),
    ).toEqual({
      message: "クリップボードを利用できません",
      severity: "error",
    });
  });

  it("does not project action handlers without non-blank labels", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    expect(
      projectUiErrorToast({
        message: "クリップボードを利用できません",
        onRetry,
        onDismiss,
      }),
    ).toEqual({
      message: "クリップボードを利用できません",
      severity: "error",
    });

    expect(onRetry).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not project action labels that are blank after trimming", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    expect(
      projectUiErrorToast({
        message: "クリップボードを利用できません",
        retryLabel: "   ",
        onRetry,
        dismissLabel: "\n\t",
        onDismiss,
      }),
    ).toEqual({
      message: "クリップボードを利用できません",
      severity: "error",
    });

    expect(onRetry).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("trims projected action labels", () => {
    const onRetry = vi.fn();

    expect(
      projectUiErrorToast({
        message: "クリップボードを利用できません",
        retryLabel: "  再試行  ",
        onRetry,
      }).actions?.[0]?.label,
    ).toBe("再試行");
  });
});
