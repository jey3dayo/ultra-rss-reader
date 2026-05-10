import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logRuntimeDiagnostic,
  redactRuntimeDiagnosticText,
  resetRuntimeDiagnosticOnceSuppressionForTests,
} from "@/lib/runtime/diagnostics";

describe("runtime diagnostics redaction", () => {
  afterEach(() => {
    resetRuntimeDiagnosticOnceSuppressionForTests();
    vi.restoreAllMocks();
  });

  it("redacts structured object details, nested arrays, Error causes, and secret URL path segments", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("Bearer raw-token https://user:pass@example.com/secret-token/feed?api_key=raw");

    logRuntimeDiagnostic("app-icon-theme", "Failed TOKEN=raw", {
      message: "Basic raw-basic https://user:pass@example.com/feed.xml?token=raw#frag",
      nested: {
        apiToken: "raw-token",
        items: ["PASSWORD=raw", new Error("https://example.com/password-reset/path?secret=raw")],
      },
      cause: new Error("wrapper", { cause }),
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(consoleError.mock.calls);
    const detail = consoleError.mock.calls[0]?.[1] as {
      nested: { items: [string, Error] };
      cause: Error;
    };
    expect(serialized).toContain("TOKEN=<redacted>");
    expect(serialized).toContain("Basic <redacted>");
    expect(serialized).toContain("https://example.com/feed.xml?redacted#redacted");
    expect(detail.nested.items[1].message).toContain("https://example.com/redacted?redacted");
    expect(detail.cause.cause).toBeInstanceOf(Error);
    expect((detail.cause.cause as Error).message).toContain("https://example.com/redacted?redacted");
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("raw-basic");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("api_key=raw");
    expect(serialized).not.toContain("secret-token/feed");
  });

  it("uses redacted structured details for once suppression keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRuntimeDiagnostic("app-icon-theme", "Failed to apply icon", {
      message: "TOKEN=first",
      nested: { password: "first" },
    });
    logRuntimeDiagnostic("app-icon-theme", "Failed to apply icon", {
      message: "TOKEN=second",
      nested: { password: "second" },
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("redacts URL path segments only when they look credential-like", () => {
    expect(redactRuntimeDiagnosticText("https://example.com/feed.xml?token=raw")).toBe(
      "https://example.com/feed.xml?redacted",
    );
    expect(redactRuntimeDiagnosticText("https://example.com/token-secret/feed.xml?token=raw")).toBe(
      "https://example.com/redacted?redacted",
    );
  });
});
