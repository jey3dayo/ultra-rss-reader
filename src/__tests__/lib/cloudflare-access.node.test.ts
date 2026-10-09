import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  type CloudflareAccessDraftStateInput,
  deriveCloudflareAccessDraftState,
  getHttpsOrigin,
  resolveCloudflareAccessUpdate,
} from "@/lib/account/cloudflare-access";

describe("Cloudflare Access account updates", () => {
  it("requires a nonblank ID, Secret, and HTTPS server URL for replacement", () => {
    const base = {
      savedClientId: null,
      savedOrigin: null,
      draft: { enabled: true, clientId: "", clientSecret: "" },
    };

    expect(resolveCloudflareAccessUpdate({ ...base, serverUrl: "https://reader.example.com" })).toEqual(
      Result.fail("client_id_required"),
    );
    expect(
      resolveCloudflareAccessUpdate({
        ...base,
        draft: { ...base.draft, clientId: "client-id" },
        serverUrl: "http://reader.example.com",
      }),
    ).toEqual(Result.fail("https_required"));
    expect(
      resolveCloudflareAccessUpdate({
        ...base,
        draft: { ...base.draft, clientId: "client-id" },
        serverUrl: "https://reader.example.com",
      }),
    ).toEqual(Result.fail("client_secret_required"));
  });

  it("keeps a saved Secret blank when ID and HTTPS origin are unchanged", () => {
    expect(
      resolveCloudflareAccessUpdate({
        draft: { enabled: true, clientId: " saved-id ", clientSecret: "" },
        serverUrl: "https://reader.example.com/api/greader.php",
        savedClientId: "saved-id",
        savedOrigin: "https://reader.example.com",
      }),
    ).toEqual(Result.succeed({ action: "keep" }));
  });

  it.each([
    { clientId: "new-id", serverUrl: "https://reader.example.com", savedClientId: "old-id" },
    { clientId: "saved-id", serverUrl: "https://new.example.com", savedClientId: "saved-id" },
  ])("requires a Secret when the ID or HTTPS origin changes", ({ clientId, serverUrl, savedClientId }) => {
    expect(
      resolveCloudflareAccessUpdate({
        draft: { enabled: true, clientId, clientSecret: "" },
        serverUrl,
        savedClientId,
        savedOrigin: "https://reader.example.com",
      }),
    ).toEqual(Result.fail("client_secret_required"));
  });

  it("sends a Secret only in a replacement and removes configured Access only when disabled", () => {
    const replacement = resolveCloudflareAccessUpdate({
      draft: { enabled: true, clientId: "saved-id", clientSecret: "one-time-secret" },
      serverUrl: "https://reader.example.com",
      savedClientId: "saved-id",
      savedOrigin: "https://reader.example.com",
    });
    expect(replacement).toEqual(
      Result.succeed({ action: "replace", clientId: "saved-id", clientSecret: "one-time-secret" }),
    );
    expect(
      resolveCloudflareAccessUpdate({
        draft: { enabled: false, clientId: "saved-id", clientSecret: "" },
        serverUrl: "https://reader.example.com",
        savedClientId: "saved-id",
        savedOrigin: "https://reader.example.com",
      }),
    ).toEqual(Result.succeed({ action: "remove" }));
    expect(getHttpsOrigin("https://reader.example.com/path")).toBe("https://reader.example.com");
    expect(getHttpsOrigin("https://user:password@reader.example.com")).toBeNull();
  });
});

describe("deriveCloudflareAccessDraftState", () => {
  const base: CloudflareAccessDraftStateInput = {
    status: "ready",
    enabled: true,
    removalRequested: false,
    recoveryAction: null,
    clientId: "client-id",
    clientSecret: "",
    savedClientId: "client-id",
    savedOrigin: "https://reader.example.com",
    serverUrl: "https://reader.example.com",
  };

  it("keeps an unchanged saved configuration clean", () => {
    expect(deriveCloudflareAccessDraftState(base)).toEqual({
      validationError: null,
      update: { action: "keep" },
      dirty: false,
    });
  });

  it("reports a validation error and dirty when a new secret is missing", () => {
    expect(deriveCloudflareAccessDraftState({ ...base, clientId: "other-id" })).toEqual({
      validationError: "client_secret_required",
      update: undefined,
      dirty: true,
    });
  });

  it("treats a disabled draft without removal request as keep and clean", () => {
    expect(deriveCloudflareAccessDraftState({ ...base, enabled: false })).toEqual({
      validationError: null,
      update: { action: "keep" },
      dirty: false,
    });
  });

  it("removes saved credentials when disabled with a removal request", () => {
    expect(deriveCloudflareAccessDraftState({ ...base, enabled: false, removalRequested: true })).toEqual({
      validationError: null,
      update: { action: "remove" },
      dirty: true,
    });
  });

  it("replaces credentials during recovery without referencing saved values", () => {
    expect(
      deriveCloudflareAccessDraftState({
        ...base,
        status: "error",
        recoveryAction: "replace",
        clientSecret: "secret",
      }),
    ).toEqual({
      validationError: null,
      update: { action: "replace", clientId: "client-id", clientSecret: "secret" },
      dirty: true,
    });
  });

  it("removes credentials when recovery chooses removal", () => {
    expect(deriveCloudflareAccessDraftState({ ...base, status: "error", recoveryAction: "remove" })).toEqual({
      validationError: null,
      update: { action: "remove" },
      dirty: true,
    });
  });

  it.each(["loading", "unavailable"] as const)("has no update while %s", (status) => {
    expect(deriveCloudflareAccessDraftState({ ...base, status })).toEqual({
      validationError: null,
      update: undefined,
      dirty: false,
    });
  });
});
