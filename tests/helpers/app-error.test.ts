import { describe, expect, it } from "vitest";

import { testUserVisibleAppError } from "./app-error";

describe("testUserVisibleAppError", () => {
  it("creates UserVisible app errors for nonblank messages", () => {
    expect(testUserVisibleAppError("sync failed")).toEqual({
      type: "UserVisible",
      message: "sync failed",
    });
  });

  it("rejects blank or whitespace-only messages", () => {
    expect(() => testUserVisibleAppError("")).toThrow("AppError message must not be empty");
    expect(() => testUserVisibleAppError("   ")).toThrow("AppError message must not be empty");
  });
});
