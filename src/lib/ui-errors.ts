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

export type QueryTransientFailureUx = "manual-retry" | "diagnostics" | "none";

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
