import { describe, expect, it, vi } from "vitest";
import { getErrorMessage, projectUiErrorToast } from "@/lib/ui/errors";
import {
  classifyAppRecoveryCategory,
  classifyQueryTransientFailureUx,
  classifyRuntimeActionErrorCategory,
  classifySchemaParseErrorSurface,
  createSchemaParseAppError,
  getAppRecoveryActionsForCategory,
  USER_FACING_ERROR_DIAGNOSTICS_POLICY,
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

  it("keeps support code and diagnostics id out of user-facing error copy", () => {
    expect(USER_FACING_ERROR_DIAGNOSTICS_POLICY).toEqual({
      supportCode: "none",
      diagnosticsId: "runtime-diagnostics-only",
      copyPolicy: "Do not append support codes or diagnostics ids to user-facing AppError messages.",
      correlationPolicy: "Correlate failures through redacted runtime diagnostics instead of user-visible identifiers.",
    });
    expect(createSchemaParseAppError("response", "name: Required").message).toBe(
      "Response validation failed. See diagnostics for details.",
    );
    expect(createSchemaParseAppError("response", "name: Required").message).not.toMatch(
      /\b(?:support|diagnostics?)\s*[-_ ]?(?:code|id)\b/i,
    );
  });

  it("classifies transient query failures separately from permanent user errors", () => {
    expect(
      classifyQueryTransientFailureUx({
        type: "Retryable",
        message: "network timeout",
      }),
    ).toBe("manual-retry");
    expect(
      classifyQueryTransientFailureUx({
        type: "UserVisible",
        message: "Database is busy. Wait for the current operation to finish and try again.",
      }),
    ).toBe("manual-retry");
    expect(
      classifyQueryTransientFailureUx({
        type: "Diagnostics",
        message: "schema mismatch",
      }),
    ).toBe("diagnostics");
    expect(
      classifyQueryTransientFailureUx({
        type: "UserVisible",
        message: "Feed not found",
      }),
    ).toBe("none");
  });

  it("classifies runtime action errors shared by clipboard and article actions", () => {
    expect(classifyRuntimeActionErrorCategory("unknown command copy_to_clipboard")).toBe("runtime_unavailable");
    expect(classifyRuntimeActionErrorCategory("clipboard plugin not available")).toBe("runtime_unavailable");
    expect(classifyRuntimeActionErrorCategory("Browser permission denied")).toBe("permission_denied");
    expect(classifyRuntimeActionErrorCategory("Only http:// and https:// URLs are supported")).toBe("invalid_url");
    expect(classifyRuntimeActionErrorCategory("Clipboard text validation failed")).toBe("invalid_text");
    expect(
      classifyRuntimeActionErrorCategory("URL validation failed", {
        validationCategory: "invalid_url",
      }),
    ).toBe("invalid_url");
    expect(classifyRuntimeActionErrorCategory("Unexpected failure")).toBe("unknown");
  });

  it("maps app errors to recovery categories instead of treating everything as retryable", () => {
    expect(
      classifyAppRecoveryCategory({
        type: "Retryable",
        message: "network timeout",
      }),
    ).toBe("network");
    expect(
      classifyAppRecoveryCategory({
        type: "UserVisible",
        message: "Authentication failed",
      }),
    ).toBe("auth");
    expect(
      classifyAppRecoveryCategory({
        type: "UserVisible",
        message: "permission denied",
      }),
    ).toBe("permission");
    expect(
      classifyAppRecoveryCategory({
        type: "Diagnostics",
        message: "Response validation failed",
      }),
    ).toBe("schema");
    expect(
      classifyAppRecoveryCategory({
        type: "UserVisible",
        message: "database disk image is malformed",
      }),
    ).toBe("storage");
    expect(
      classifyAppRecoveryCategory({
        type: "UserVisible",
        message: "unexpected failure",
      }),
    ).toBe("unknown");
  });

  it("keeps app-level recovery actions category-specific", () => {
    expect(getAppRecoveryActionsForCategory("network")).toEqual(["retry", "open-settings"]);
    expect(getAppRecoveryActionsForCategory("auth")).toEqual(["open-settings"]);
    expect(getAppRecoveryActionsForCategory("permission")).toEqual(["open-settings", "open-log-dir"]);
    expect(getAppRecoveryActionsForCategory("schema")).toEqual(["open-log-dir", "contact-support"]);
    expect(getAppRecoveryActionsForCategory("storage")).toEqual(["open-log-dir", "restore-backup"]);
    expect(getAppRecoveryActionsForCategory("unknown")).toEqual(["retry", "open-log-dir", "contact-support"]);
  });

  it("keeps reset local state in the typed app recovery action contract for explicit callers", () => {
    const action = "reset-local-state" satisfies ReturnType<typeof getAppRecoveryActionsForCategory>[number];

    expect(action).toBe("reset-local-state");
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
