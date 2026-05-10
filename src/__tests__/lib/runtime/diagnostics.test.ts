import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logRuntimeDiagnostic,
  RUNTIME_DIAGNOSTIC_POLICIES,
  redactProviderRuntimeDiagnosticText,
  redactRuntimeDiagnosticSupportCopy,
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
    expect(serialized).not.toContain("/Users/demo/Library/Application Support/Ultra RSS/private.sqlite");
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

  it("keeps window runtime object error causes as structured diagnostics detail", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cause = {
      code: "permission_denied",
      apiToken: "raw-token",
      nested: {
        url: "https://user:pass@example.com/secret-token/window?token=raw",
      },
    };
    const error = new Error("Window update failed TOKEN=raw", { cause });

    logRuntimeDiagnostic("window-runtime-error", "Window runtime failed", error);

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    const detail = consoleWarn.mock.calls[0]?.[1] as Error;
    expect(detail).toBeInstanceOf(Error);
    expect(detail.message).toBe("Window update failed TOKEN=<redacted>");
    expect(detail.cause).toEqual({
      code: "permission_denied",
      apiToken: "<redacted>",
      nested: {
        url: "https://example.com/redacted?redacted",
      },
    });
  });

  it("redacts structured support details that identify server paths, account names, and raw payloads", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRuntimeDiagnostic("article-action", "Support diagnostics failed", {
      serverPath: "/Users/demo/Library/Application Support/Ultra RSS/accounts/private.sqlite",
      accountName: "Personal FreshRSS",
      rawPayload: {
        status: "failed",
        body: "https://reader.example.com/api/greader.php/accounts/Personal%20FreshRSS?token=raw",
      },
      urlToken: "https://reader.example.com/feed.xml?token=raw",
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toEqual({
      serverPath: "<redacted>",
      accountName: "<redacted>",
      rawPayload: "<redacted>",
      urlToken: "<redacted>",
    });
  });

  it("builds redacted support copy for string messages and structured payloads", () => {
    const supportCopy = redactRuntimeDiagnosticSupportCopy({
      message:
        "Failed TOKEN=raw at https://user:pass@example.com/secret-token/feed?token=raw#frag in /Users/demo/Library/Application Support/Ultra RSS/private.sqlite",
      path: "/Users/demo/Library/Application Support/Ultra RSS/private.sqlite",
      nested: {
        error: new Error("Bearer raw-token https://example.com/feed.xml?api_key=raw"),
        rawPayload: { body: "raw response body" },
      },
    });

    expect(supportCopy).toContain("TOKEN=<redacted>");
    expect(supportCopy).toContain("https://example.com/redacted?redacted#redacted");
    expect(supportCopy).toContain("<redacted-path>");
    expect(supportCopy).toContain('"path": "<redacted>"');
    expect(supportCopy).toContain('"rawPayload": "<redacted>"');
    expect(supportCopy).not.toContain("raw-token");
    expect(supportCopy).not.toContain("user:pass");
    expect(supportCopy).not.toContain("token=raw");
    expect(supportCopy).not.toContain("api_key=raw");
    expect(supportCopy).not.toContain("raw response body");
    expect(supportCopy).not.toContain("/Users/demo/Library/Application Support/Ultra RSS/private.sqlite");
  });

  it("keeps support copy safe for unknown payload shapes", () => {
    expect(redactRuntimeDiagnosticSupportCopy(Symbol("TOKEN=raw"))).toBe("[Unsupported diagnostics payload]");
    expect(redactRuntimeDiagnosticSupportCopy(undefined)).toBe("[Unsupported diagnostics payload]");
  });

  it("does not build once suppression keys for repeatable diagnostics", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const toJSON = vi.fn(() => ({ message: "serialized" }));

    logRuntimeDiagnostic("window-runtime-error", "Window runtime failed", {
      message: "repeatable detail",
      toJSON,
    });

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(toJSON).not.toHaveBeenCalled();
  });

  it("suppresses repeated sidebar storage quota diagnostics after the first warning", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logRuntimeDiagnostic("sidebar-expanded-folders-storage", "Sidebar expanded folders storage failed", {
      operation: "write",
      storageKey: "ultra-rss:sidebar-expanded-folders",
      error: new DOMException("quota exceeded", "QuotaExceededError"),
    });
    logRuntimeDiagnostic("sidebar-expanded-folders-storage", "Sidebar expanded folders storage failed", {
      operation: "write",
      storageKey: "ultra-rss:sidebar-expanded-folders",
      error: new DOMException("quota exceeded", "QuotaExceededError"),
    });

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith("Sidebar expanded folders storage failed", {
      operation: "write",
      storageKey: "ultra-rss:sidebar-expanded-folders",
      error: {},
    });
  });

  it("redacts URL path segments only when they look credential-like", () => {
    expect(redactRuntimeDiagnosticText("https://example.com/feed.xml?token=raw")).toBe(
      "https://example.com/feed.xml?redacted",
    );
    expect(redactRuntimeDiagnosticText("https://example.com/token-secret/feed.xml?token=raw")).toBe(
      "https://example.com/redacted?redacted",
    );
    expect(redactRuntimeDiagnosticText("log=/Users/demo/Library/Application Support/Ultra RSS/private.sqlite")).toBe(
      "log=<redacted-path>",
    );
  });

  it("redacts sanitizer discovery OPML export and log fixture corpus", () => {
    const supportCopy = redactRuntimeDiagnosticSupportCopy({
      sanitizer: "dropped https://alice:secret@example.com/private-token/feed.xml?api_key=raw",
      feedDiscovery: "redirect https://example.com/start -> http://127.0.0.1/feed.xml?token=raw",
      opmlImport: '<!DOCTYPE opml SYSTEM "file:///Users/alice/private.opml">',
      opmlExport: {
        suggestedFilename: "../Private Folder.opml",
        sourceUrl: "https://example.com/articles/download?filename=remote-title.opml&token=raw",
      },
      logPath: "/Users/alice/Library/Application Support/Ultra RSS/app.log",
    });

    expect(supportCopy).toContain("https://example.com/redacted?redacted");
    expect(supportCopy).toContain("http://127.0.0.1/feed.xml?redacted");
    expect(supportCopy).toContain("<redacted-path>");
    expect(supportCopy).toContain('"opmlExport": {');
    expect(supportCopy).toContain('"suggestedFilename": "<redacted>"');
    expect(supportCopy).not.toContain("alice:secret");
    expect(supportCopy).not.toContain("api_key=raw");
    expect(supportCopy).not.toContain("token=raw");
    expect(supportCopy).not.toContain("../Private Folder.opml");
    expect(supportCopy).not.toContain("file:///Users/alice/private.opml");
    expect(supportCopy).not.toContain("/Users/alice/Library/Application Support/Ultra RSS/app.log");
  });

  it("redacts provider adapter auth, cookie, server URL, username, and account identifiers", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rawServerUrl = "https://reader.example.com/api/greader.php";
    const rawUsername = "secret-user@example.com";
    const rawAccountId = "acc-provider-secret";
    const rawToken = "provider-auth-token";
    const rawCookie = "provider_session=raw-cookie";

    logRuntimeDiagnostic("startup-sync", "Provider sync failed", {
      serverUrl: rawServerUrl,
      username: rawUsername,
      accountId: rawAccountId,
      headers: {
        Authorization: `GoogleLogin auth=${rawToken}`,
        Cookie: rawCookie,
      },
      message: `GET ${rawServerUrl}?token=${rawToken} Cookie: ${rawCookie}`,
    });

    const serialized = JSON.stringify(consoleWarn.mock.calls);
    expect(serialized).toContain("<redacted>");
    expect(serialized).toContain("GoogleLogin auth=<redacted>");
    expect(serialized).toContain("Cookie: <redacted>");
    expect(serialized).not.toContain(rawServerUrl);
    expect(serialized).not.toContain(rawUsername);
    expect(serialized).not.toContain(rawAccountId);
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain(rawCookie);
  });

  it("redacts provider server URLs and identifiers for toast adapter text", () => {
    const rawServerUrl = "https://reader.example.com/api/greader.php";
    const redacted = redactProviderRuntimeDiagnosticText(
      `Connection failed server_url=${rawServerUrl} username=secret-user@example.com account_id=acc-provider-secret GoogleLogin auth=provider-auth-token Cookie: provider_session=raw-cookie`,
    );

    expect(redacted).toContain("server_url=<redacted>");
    expect(redacted).toContain("username=<redacted>");
    expect(redacted).toContain("account_id=<redacted>");
    expect(redacted).toContain("GoogleLogin auth=<redacted>");
    expect(redacted).toContain("Cookie: <redacted>");
    expect(redacted).not.toContain(rawServerUrl);
    expect(redacted).not.toContain("secret-user@example.com");
    expect(redacted).not.toContain("acc-provider-secret");
    expect(redacted).not.toContain("provider-auth-token");
    expect(redacted).not.toContain("provider_session=raw-cookie");
  });

  it("keeps runtime diagnostics as diagnostics-only logging with redaction enabled", () => {
    expect(Object.values(RUNTIME_DIAGNOSTIC_POLICIES)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toast: "never",
          redactSecrets: true,
        }),
      ]),
    );
    expect(Object.values(RUNTIME_DIAGNOSTIC_POLICIES).every((policy) => policy.toast === "never")).toBe(true);
    expect(Object.values(RUNTIME_DIAGNOSTIC_POLICIES).every((policy) => policy.redactSecrets)).toBe(true);
  });
});
