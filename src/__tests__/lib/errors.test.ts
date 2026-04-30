import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("errors", () => {
  it("returns Error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns object message fields as strings", () => {
    expect(getErrorMessage({ message: "plain message" })).toBe("plain message");
    expect(getErrorMessage({ message: 123 })).toBe("123");
  });

  it("falls back for values without a message", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage("boom")).toBe("Unknown error");
    expect(getErrorMessage({ code: "E_UNKNOWN" })).toBe("Unknown error");
  });
});
