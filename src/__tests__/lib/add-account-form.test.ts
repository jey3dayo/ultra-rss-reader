import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/add-account-form";

describe("add-account-form utils", () => {
  it("returns local form config", () => {
    expect(getAddAccountFormConfig("Local")).toEqual({
      sectionHeading: "Account",
      showServerUrl: false,
      showAppCredentials: false,
      credentialLabel: null,
      credentialName: null,
      requiresCredentials: false,
    });
  });

  it("returns FreshRSS form config", () => {
    expect(getAddAccountFormConfig("FreshRss")).toEqual({
      sectionHeading: "Server",
      showServerUrl: true,
      showAppCredentials: false,
      credentialLabel: "Username",
      credentialName: "username",
      requiresCredentials: true,
    });
  });

  it("returns Inoreader form config", () => {
    expect(getAddAccountFormConfig("Inoreader")).toEqual({
      sectionHeading: "Credentials",
      showServerUrl: false,
      showAppCredentials: true,
      credentialLabel: "Email",
      credentialName: "email",
      requiresCredentials: true,
    });
  });

  it("builds a local payload and falls back to provider name", () => {
    const result = buildAddAccountPayload({
      kind: "Local",
      name: "   ",
      serverUrl: "",
      appId: "",
      appKey: "",
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
      serverUrl: "  https://example.com  ",
      appId: "",
      appKey: "",
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

  it("fails when FreshRSS server URL is missing", () => {
    const result = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "   ",
      appId: "",
      appKey: "",
      username: "alice",
      password: "secret",
    });

    expect(Result.unwrapError(result)).toBe("missing_server_url");
  });

  it("fails when credentials are missing", () => {
    const missingUsername = buildAddAccountPayload({
      kind: "FreshRss",
      name: "",
      serverUrl: "https://example.com",
      appId: "",
      appKey: "",
      username: " ",
      password: "secret",
    });
    const missingPassword = buildAddAccountPayload({
      kind: "Inoreader",
      name: "",
      serverUrl: "",
      appId: "app-id",
      appKey: "app-key",
      username: "alice@example.com",
      password: " ",
    });

    expect(Result.unwrapError(missingUsername)).toBe("missing_username");
    expect(Result.unwrapError(missingPassword)).toBe("missing_password");
  });

  it("requires App ID and App Key for Inoreader", () => {
    const missingAppId = buildAddAccountPayload({
      kind: "Inoreader",
      name: "",
      serverUrl: "",
      appId: " ",
      appKey: "app-key",
      username: "alice@example.com",
      password: "secret",
    });
    const missingAppKey = buildAddAccountPayload({
      kind: "Inoreader",
      name: "",
      serverUrl: "",
      appId: "app-id",
      appKey: " ",
      username: "alice@example.com",
      password: "secret",
    });

    expect(Result.unwrapError(missingAppId)).toBe("missing_app_id");
    expect(Result.unwrapError(missingAppKey)).toBe("missing_app_key");
  });

  it("builds an Inoreader payload with app credentials", () => {
    const result = buildAddAccountPayload({
      kind: "Inoreader",
      name: "  Inoreader  ",
      serverUrl: "",
      appId: "  app-id  ",
      appKey: "  app-key  ",
      username: "  alice@example.com  ",
      password: "  secret  ",
    });

    expect(Result.unwrap(result)).toEqual({
      kind: "Inoreader",
      name: "Inoreader",
      appId: "app-id",
      appKey: "app-key",
      username: "alice@example.com",
      password: "  secret  ",
    });
  });

  it("formats validation errors for toasts", () => {
    expect(formatAddAccountValidationError("FreshRss", "missing_server_url")).toBe("Server URL is required");
    expect(formatAddAccountValidationError("FreshRss", "missing_username")).toBe("Username is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_username")).toBe("Email is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_password")).toBe("Password is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_app_id")).toBe("App ID is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_app_key")).toBe("App Key is required");
  });
});
