import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/ui/errors";

describe("errors", () => {
  it("returns Error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns object message fields as strings", () => {
    expect(getErrorMessage({ message: "plain message" })).toBe("plain message");
    expect(getErrorMessage({ message: 123 })).toBe("123");
    expect(getErrorMessage({ message: Symbol("symbol message") })).toBe("Symbol(symbol message)");
  });

  it("falls back when object message getter throws", () => {
    const error = {
      get message(): string {
        throw new Error("getter failed");
      },
    };

    expect(getErrorMessage(error)).toBe("Unknown error");
  });

  it("falls back for values without a message", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage("boom")).toBe("Unknown error");
    expect(getErrorMessage({ code: "E_UNKNOWN" })).toBe("Unknown error");
  });
});
