import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/ui/errors";

describe("errors", () => {
  it("returns Error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string object message fields", () => {
    expect(getErrorMessage({ message: "plain message" })).toBe("plain message");
    expect(getErrorMessage({ message: 123 })).toBe("Unknown error");
    expect(getErrorMessage({ message: Symbol("symbol message") })).toBe("Unknown error");
  });

  it("falls back when object message getter throws", () => {
    const error = {
      get message(): string {
        throw new Error("getter failed");
      },
    };

    expect(getErrorMessage(error)).toBe("Unknown error");
  });

  it("falls back when Error message getter throws", () => {
    const error = new Error("boom");
    Object.defineProperty(error, "message", {
      get() {
        throw new Error("getter failed");
      },
    });

    expect(getErrorMessage(error)).toBe("Unknown error");
  });

  it("falls back without calling unsafe string conversion", () => {
    expect(
      getErrorMessage({
        toString() {
          throw new Error("toString failed");
        },
      }),
    ).toBe("Unknown error");
  });

  it("falls back for values without a message", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage("boom")).toBe("Unknown error");
    expect(getErrorMessage({ code: "E_UNKNOWN" })).toBe("Unknown error");
  });
});
