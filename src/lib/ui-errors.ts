import type { AppError } from "@/api/schemas/error";

export type SchemaParseErrorSurface = "user-facing" | "diagnostics";

export const RESPONSE_VALIDATION_MESSAGE = "Response validation failed. See diagnostics for details.";
export const USER_FACING_ERROR_DIAGNOSTICS_POLICY = {
  supportCode: "none",
  diagnosticsId: "runtime-diagnostics-only",
  copyPolicy: "Do not append support codes or diagnostics ids to user-facing AppError messages.",
  correlationPolicy: "Correlate failures through redacted runtime diagnostics instead of user-visible identifiers.",
} as const;

export function classifySchemaParseErrorSurface(boundary: "args" | "response"): SchemaParseErrorSurface {
  return boundary === "args" ? "user-facing" : "diagnostics";
}

export function createSchemaParseAppError(
  boundary: "args" | "response",
  detail: string,
): Extract<AppError, { type: "UserVisible" | "Diagnostics" }> {
  const surface = classifySchemaParseErrorSurface(boundary);

  if (surface === "diagnostics") {
    return {
      type: "Diagnostics",
      message: RESPONSE_VALIDATION_MESSAGE,
    };
  }

  return {
    type: "UserVisible",
    message: `Command validation failed: ${detail}`,
  };
}

export class AppErrorClassificationError extends Error {
  readonly type: AppError["type"];

  constructor(error: AppError) {
    super(error.message);
    this.name = "AppErrorClassificationError";
    this.type = error.type;
  }
}

export type QueryTransientFailureUx = "manual-retry" | "diagnostics" | "none";
export type AppRecoveryCategory = "auth" | "network" | "permission" | "schema" | "storage" | "unknown";
export type AppErrorRecoveryAction =
  | "contact-support"
  | "open-log-dir"
  | "open-settings"
  | "reset-local-state"
  | "restore-backup"
  | "retry";
export type RuntimeActionErrorCategory =
  | "runtime_unavailable"
  | "permission_denied"
  | "invalid_text"
  | "invalid_url"
  | "unknown";

type RuntimeActionErrorClassifierOptions = {
  validationCategory?: Extract<RuntimeActionErrorCategory, "invalid_text" | "invalid_url">;
};

const TRANSIENT_USER_VISIBLE_PATTERNS = [
  /\bdatabase (?:is )?busy\b/i,
  /\bdatabase (?:is )?locked\b/i,
  /\bruntime unavailable\b/i,
  /\btemporar(?:y|ily)\b/i,
];

const APP_ERROR_RECOVERY_ACTIONS = {
  auth: ["open-settings"],
  network: ["retry", "open-settings"],
  permission: ["open-settings", "open-log-dir"],
  schema: ["open-log-dir", "contact-support"],
  storage: ["open-log-dir", "restore-backup"],
  unknown: ["retry", "open-log-dir", "contact-support"],
} as const satisfies Record<AppRecoveryCategory, readonly AppErrorRecoveryAction[]>;

export function classifyQueryTransientFailureUx(error: AppError): QueryTransientFailureUx {
  if (error.type === "Retryable") {
    return "manual-retry";
  }
  if (error.type === "Diagnostics") {
    return "diagnostics";
  }
  if (TRANSIENT_USER_VISIBLE_PATTERNS.some((pattern) => pattern.test(error.message))) {
    return "manual-retry";
  }
  return "none";
}

export function classifyAppRecoveryCategory(error: AppError): AppRecoveryCategory {
  if (error.type === "Diagnostics") {
    return "schema";
  }
  if (error.type === "Retryable") {
    return "network";
  }

  const normalized = error.message.toLowerCase();
  if (
    normalized.includes("permission denied") ||
    normalized.includes("access denied") ||
    normalized.includes("not allowed") ||
    normalized.includes("read-only database") ||
    normalized.includes("readonly database")
  ) {
    return "permission";
  }
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("authentication") ||
    normalized.includes("auth failed")
  ) {
    return "auth";
  }
  if (
    normalized.includes("network") ||
    normalized.includes("offline") ||
    normalized.includes("timeout") ||
    normalized.includes("dns") ||
    normalized.includes("connection refused")
  ) {
    return "network";
  }
  if (
    normalized.includes("corrupt") ||
    normalized.includes("malformed") ||
    normalized.includes("not a database") ||
    normalized.includes("database disk image is malformed") ||
    normalized.includes("dev store exceeds maximum size")
  ) {
    return "storage";
  }

  return "unknown";
}

export function isDevCredentialStoreRecoveryError(error: AppError): boolean {
  return error.type !== "Diagnostics" && error.message.toLowerCase().includes("dev store exceeds maximum size");
}

export function getAppRecoveryActionsForCategory(category: AppRecoveryCategory): readonly AppErrorRecoveryAction[] {
  return APP_ERROR_RECOVERY_ACTIONS[category];
}

export function classifyAppErrorRecoveryCategory(error: AppError): AppRecoveryCategory {
  return classifyAppRecoveryCategory(error);
}

export function getAppErrorRecoveryActions(error: AppError): readonly AppErrorRecoveryAction[] {
  return getAppRecoveryActionsForCategory(classifyAppRecoveryCategory(error));
}

function hasRuntimeActionErrorToken(message: string, token: string): boolean {
  return message.split(/[^a-z0-9]+/).includes(token);
}

export function classifyRuntimeActionErrorCategory(
  message: string,
  { validationCategory = "invalid_text" }: RuntimeActionErrorClassifierOptions = {},
): RuntimeActionErrorCategory {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission") ||
    normalized.includes("denied") ||
    normalized.includes("not allowed") ||
    normalized.includes("insecure context") ||
    normalized.includes("secure context")
  ) {
    return "permission_denied";
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("not available") ||
    normalized.includes("plugin") ||
    normalized.includes("unknown command")
  ) {
    return "runtime_unavailable";
  }
  if (
    normalized.includes("invalid url") ||
    normalized.includes("invalid uri") ||
    normalized.includes("only http:// and https:// urls")
  ) {
    return "invalid_url";
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("validation") ||
    hasRuntimeActionErrorToken(normalized, "text")
  ) {
    return validationCategory;
  }

  return "unknown";
}
