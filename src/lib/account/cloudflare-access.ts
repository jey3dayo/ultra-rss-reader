import { Result } from "@praha/byethrow";
import type { CloudflareAccessUpdate } from "@/api/schemas";

export type CloudflareAccessDraft = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
};

export type CloudflareAccessDraftError = "client_id_required" | "client_secret_required" | "https_required";

export function getHttpsOrigin(serverUrl: string): string | null {
  try {
    const url = new URL(serverUrl.trim());
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveCloudflareAccessUpdate({
  draft,
  serverUrl,
  savedClientId,
  savedOrigin,
}: {
  draft: CloudflareAccessDraft;
  serverUrl: string;
  savedClientId: string | null;
  savedOrigin: string | null;
}): Result.Result<CloudflareAccessUpdate, CloudflareAccessDraftError> {
  if (!draft.enabled) {
    return Result.succeed(savedClientId === null ? { action: "keep" } : { action: "remove" });
  }

  const clientId = draft.clientId.trim();
  if (!clientId) {
    return Result.fail("client_id_required");
  }

  const currentOrigin = getHttpsOrigin(serverUrl);
  if (currentOrigin === null) {
    return Result.fail("https_required");
  }

  const identityChanged = clientId !== savedClientId || currentOrigin !== savedOrigin;
  if (identityChanged && !draft.clientSecret.trim()) {
    return Result.fail("client_secret_required");
  }

  if (!draft.clientSecret.trim()) {
    return Result.succeed({ action: "keep" });
  }

  return Result.succeed({
    action: "replace",
    clientId,
    clientSecret: draft.clientSecret,
  });
}

export function matchCloudflareAccessUpdate<T>(
  input: Parameters<typeof resolveCloudflareAccessUpdate>[0],
  handlers: {
    success: (update: CloudflareAccessUpdate) => T;
    failure: (error: CloudflareAccessDraftError) => T;
  },
): T {
  const updateResult = resolveCloudflareAccessUpdate(input);
  return Result.isSuccess(updateResult)
    ? handlers.success(Result.unwrap(updateResult))
    : handlers.failure(Result.unwrapError(updateResult));
}
