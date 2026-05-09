import { describe, expect, it } from "vitest";

import { testRetryableAppError, testUserVisibleAppError } from "./app-error";

describe("app-error test fixtures", () => {
  it("creates UserVisible app errors for nonblank messages", () => {
    expect(testUserVisibleAppError("sync failed")).toEqual({
      type: "UserVisible",
      message: "sync failed",
    });
  });

  it("creates Retryable app errors for nonblank messages", () => {
    expect(testRetryableAppError("network timeout")).toEqual({
      type: "Retryable",
      message: "network timeout",
    });
  });

  it("rejects blank or whitespace-only messages", () => {
    expect(() => testUserVisibleAppError("")).toThrow("AppError message must not be empty");
    expect(() => testUserVisibleAppError("   ")).toThrow("AppError message must not be empty");
    expect(() => testRetryableAppError("")).toThrow("AppError message must not be empty");
    expect(() => testRetryableAppError("   ")).toThrow("AppError message must not be empty");
  });
});
