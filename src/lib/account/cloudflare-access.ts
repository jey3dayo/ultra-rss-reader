import { Result } from "@praha/byethrow";
import type { CloudflareAccessUpdate } from "@/api/schemas";

export type CloudflareAccessDraft = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
};

export type CloudflareAccessStatus = "loading" | "ready" | "error" | "unavailable" | "authorization_required";

export function isCloudflareAccessRecoveryStatus(
  status: CloudflareAccessStatus,
): status is "error" | "authorization_required" {
  return status === "error" || status === "authorization_required";
}

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

export type CloudflareAccessDraftStateInput = {
  status: CloudflareAccessStatus;
  enabled: boolean;
  removalRequested: boolean;
  recoveryAction: "replace" | "remove" | null;
  clientId: string;
  clientSecret: string;
  savedClientId: string | null;
  savedOrigin: string | null;
  serverUrl: string;
};

export type CloudflareAccessDraftState = {
  validationError: CloudflareAccessDraftError | null;
  update: CloudflareAccessUpdate | undefined;
  dirty: boolean;
};

type CloudflareAccessResolution = Result.Result<CloudflareAccessUpdate, CloudflareAccessDraftError>;

function resolveReadyCloudflareAccess(input: CloudflareAccessDraftStateInput): CloudflareAccessResolution {
  if (!input.enabled && !input.removalRequested) {
    return Result.succeed({ action: "keep" });
  }
  return resolveCloudflareAccessUpdate({
    draft: { enabled: input.enabled, clientId: input.clientId, clientSecret: input.clientSecret },
    serverUrl: input.serverUrl,
    savedClientId: input.savedClientId,
    savedOrigin: input.savedOrigin,
  });
}

function resolveRecoveryCloudflareAccess(input: CloudflareAccessDraftStateInput): CloudflareAccessResolution {
  return resolveCloudflareAccessUpdate({
    draft: { enabled: true, clientId: input.clientId, clientSecret: input.clientSecret },
    serverUrl: input.serverUrl,
    savedClientId: null,
    savedOrigin: null,
  });
}

function resolveCloudflareAccessDraft(input: CloudflareAccessDraftStateInput): CloudflareAccessResolution | null {
  if (input.status === "ready") {
    return resolveReadyCloudflareAccess(input);
  }
  if (isCloudflareAccessRecoveryStatus(input.status) && input.recoveryAction === "replace") {
    return resolveRecoveryCloudflareAccess(input);
  }
  return null;
}

function isReadyCloudflareAccessDirty(input: CloudflareAccessDraftStateInput): boolean {
  if (!input.enabled) {
    return input.removalRequested && input.savedClientId !== null;
  }
  return (
    input.savedClientId === null ||
    input.clientId.trim() !== input.savedClientId ||
    input.clientSecret.trim().length > 0
  );
}

function isCloudflareAccessDraftDirty(input: CloudflareAccessDraftStateInput): boolean {
  if (isCloudflareAccessRecoveryStatus(input.status)) {
    return input.recoveryAction !== null;
  }
  return input.status === "ready" && isReadyCloudflareAccessDirty(input);
}

export function deriveCloudflareAccessDraftState(input: CloudflareAccessDraftStateInput): CloudflareAccessDraftState {
  const dirty = isCloudflareAccessDraftDirty(input);
  if (isCloudflareAccessRecoveryStatus(input.status) && input.recoveryAction === "remove") {
    return { validationError: null, update: { action: "remove" }, dirty };
  }
  const resolution = resolveCloudflareAccessDraft(input);
  if (resolution === null) {
    return { validationError: null, update: undefined, dirty };
  }
  return Result.isSuccess(resolution)
    ? { validationError: null, update: Result.unwrap(resolution), dirty }
    : { validationError: Result.unwrapError(resolution), update: undefined, dirty };
}
