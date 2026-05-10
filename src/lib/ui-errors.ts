import type { AppError } from "@/api/schemas/error";

export type SchemaParseErrorSurface = "user-facing" | "diagnostics";

export const RESPONSE_VALIDATION_MESSAGE = "Response validation failed. See diagnostics for details.";

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
