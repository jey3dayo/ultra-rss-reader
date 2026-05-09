import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/account/add-account-form";
import enSettings from "@/locales/en/settings.json";
import jaSettings from "@/locales/ja/settings.json";

describe("add-account-form utils", () => {
  it("returns local form config", () => {
    expect(getAddAccountFormConfig("Local")).toEqual({
      sectionHeading: "Account",
      showServerUrl: false,
      credentialLabel: null,
      credentialName: null,
      requiresCredentials: false,
    });
  });

  it("returns FreshRSS form config", () => {
    expect(getAddAccountFormConfig("FreshRss")).toEqual({
      sectionHeading: "Server",
      showServerUrl: true,
      credentialLabel: "Username",
      credentialName: "username",
      requiresCredentials: true,
    });
  });

  it("builds a local payload and falls back to provider name", () => {
    const result = buildAddAccountPayload({
      kind: "Local",
      name: "   ",
      serverUrl: "",
      username: "",
      password: "",
    });

    expect(Result.unwrap(result)).toEqual({
      kind: "Local",
      name: "Local",
      serverUrl: undefined,
      username: undefined,
      password: undefined,
    });
  });

  it("trims and builds a FreshRSS payload", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "  Work RSS  ",
      serverUrl: "  https://example.com/  ",
      username: "  alice  ",
      password: "  secret  ",
    });

    expect(Result.unwrap(result)).toEqual({
      kind: "FreshRss",
      name: "Work RSS",
      serverUrl: "https://example.com",
      username: "alice",
      password: "  secret  ",
    });
  });

  it("allows loopback HTTP FreshRSS server URLs", () => {
    for (const serverUrl of ["http://localhost:8080/", "http://127.0.0.1:8080", "http://[::1]:8080/"]) {
      const result = buildAddAccountPayload({
        kind: "FreshRss",
        name: "",
        serverUrl,
        username: "alice",
        password: "secret",
      });

      expect(Result.isSuccess(result)).toBe(true);
    }
  });

  it("rejects public HTTP FreshRSS server URLs before credentials are submitted", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "http://example.com",
      username: "alice",
      password: "secret",
    });

    expect(Result.unwrapError(result)).toBe("insecure_server_url");
  });

  it("rejects FreshRSS server URLs with embedded credentials", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "https://alice:secret@example.com",
      username: "alice",
      password: "secret",
    });

    expect(Result.unwrapError(result)).toBe("server_url_credentials");
  });

  it("fails when FreshRSS server URL is missing", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "   ",
      username: "alice",
      password: "secret",
    });

    expect(Result.unwrapError(result)).toBe("missing_server_url");
  });

  it("fails when FreshRSS server URL is not a URL", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "not a url",
      username: "alice",
      password: "secret",
    });

    expect(Result.unwrapError(result)).toBe("invalid_server_url");
  });

  it("fails when credentials are missing", () => {
    const missingUsername = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "https://example.com",
      username: " ",
      password: "secret",
    });
    const missingPassword = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "https://example.com",
      username: "alice",
      password: " ",
    });

    expect(Result.unwrapError(missingUsername)).toBe("missing_username");
    expect(Result.unwrapError(missingPassword)).toBe("missing_password");
  });
  it("formats validation errors for toasts", () => {
    expect(formatAddAccountValidationError("FreshRss", "missing_server_url")).toBe("account.error_server_url_required");
    expect(formatAddAccountValidationError("FreshRss", "invalid_server_url")).toBe("account.error_server_url_invalid");
    expect(formatAddAccountValidationError("FreshRss", "insecure_server_url")).toBe("account.error_server_url_invalid");
    expect(formatAddAccountValidationError("FreshRss", "server_url_credentials")).toBe(
      "account.error_server_url_invalid",
    );
    expect(formatAddAccountValidationError("FreshRss", "missing_username")).toBe("account.error_username_required");
    expect(formatAddAccountValidationError("FreshRss", "missing_password")).toBe("account.error_password_required");
  });

  it("keeps validation error keys in settings locales", () => {
    const keys = [
      "error_server_url_required",
      "error_server_url_invalid",
      "error_username_required",
      "error_password_required",
    ] as const;

    for (const key of keys) {
      expect(enSettings.account[key]).toBeTruthy();
      expect(jaSettings.account[key]).toBeTruthy();
    }
  });
});
