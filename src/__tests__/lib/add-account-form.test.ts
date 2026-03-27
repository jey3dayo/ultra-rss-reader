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

  it("returns Inoreader form config", () => {
    expect(getAddAccountFormConfig("Inoreader")).toEqual({
      sectionHeading: "Credentials",
      showServerUrl: false,
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
      username: " ",
      password: "secret",
    });
    const missingPassword = buildAddAccountPayload({
      kind: "Inoreader",
      name: "",
      serverUrl: "",
      username: "alice@example.com",
      password: " ",
    });

    expect(Result.unwrapError(missingUsername)).toBe("missing_username");
    expect(Result.unwrapError(missingPassword)).toBe("missing_password");
  });

  it("formats validation errors for toasts", () => {
    expect(formatAddAccountValidationError("FreshRss", "missing_server_url")).toBe("Server URL is required");
    expect(formatAddAccountValidationError("FreshRss", "missing_username")).toBe("Username is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_username")).toBe("Email is required");
    expect(formatAddAccountValidationError("Inoreader", "missing_password")).toBe("Password is required");
  });
});
