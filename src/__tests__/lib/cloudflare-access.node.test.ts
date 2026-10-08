import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import { getHttpsOrigin, resolveCloudflareAccessUpdate } from "@/lib/account/cloudflare-access";

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
