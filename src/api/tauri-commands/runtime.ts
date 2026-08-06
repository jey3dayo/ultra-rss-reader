import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import type { IssuePathItem } from "valibot";
import { safeParse } from "valibot";
import { type AppError, AppErrorSchema } from "@/api/schemas";
import { redactRuntimeDiagnosticText } from "@/lib/runtime/diagnostics";
import { createSchemaParseAppError, RESPONSE_VALIDATION_MESSAGE } from "@/lib/ui-errors";
import {
  isSchemaParseError,
  parseWithSchema,
  type RuntimeSchema,
  type SchemaOutput,
  type SchemaParseError,
} from "@/schemas/parse";

export type InvokeArgsRecord = Record<string, unknown>;
type InvokeArgsSchema = RuntimeSchema<InvokeArgsRecord>;

type InvokeArgsOptions = {
  args?: InvokeArgsSchema;
};

type SchemaBackedInvokeOptions<R extends RuntimeSchema> = InvokeArgsOptions & {
  response: R;
};

type GenericInvokeOptions = InvokeArgsOptions;

const VALIDATION_ISSUE_LIMIT = 3;
const VALIDATION_DETAIL_MAX_LENGTH = 240;
const RETRYABLE_RUNTIME_ERROR_PATTERNS = [
  /\bnetwork\b/i,
  /\btimeout\b/i,
  /\btimed out\b/i,
  /\btemporar(?:y|ily)\b/i,
  /\bconnection (?:reset|refused|closed|aborted)\b/i,
];

class ResponseValidationError extends Error {
  readonly cause: SchemaParseError;

  constructor(cause: SchemaParseError) {
    super(RESPONSE_VALIDATION_MESSAGE);
    this.name = "ResponseValidationError";
    this.cause = cause;
  }
}

function runtimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error !== null && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
}

function formatSchemaIssuePath(path: readonly IssuePathItem[] | undefined): string {
  const keys = path?.map((item) => item.key).filter((key): key is PropertyKey => key !== undefined) ?? [];
  return keys.length > 0 ? keys.join(".") : "<root>";
}

function limitValidationDetail(detail: string): string {
  return detail.length <= VALIDATION_DETAIL_MAX_LENGTH ? detail : `${detail.slice(0, VALIDATION_DETAIL_MAX_LENGTH)}...`;
}

function formatSchemaIssues(error: SchemaParseError): string {
  const issues = error.issues.slice(0, VALIDATION_ISSUE_LIMIT).map((issue) => {
    return `${formatSchemaIssuePath(issue.path)}: ${issue.message}`;
  });
  const omittedCount = error.issues.length - issues.length;
  if (omittedCount > 0) {
    issues.push(`${omittedCount} more issue(s) omitted`);
  }
  return limitValidationDetail(redactRuntimeDiagnosticText(issues.join(", ")));
}

function redactAppError(error: AppError): AppError {
  return {
    ...error,
    message: redactRuntimeDiagnosticText(error.message),
  };
}

function isRetryableRuntimeErrorMessage(message: string): boolean {
  return RETRYABLE_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function toAppError(cmd: string, error: unknown): AppError {
  if (error instanceof ResponseValidationError) {
    const detail = formatSchemaIssues(error.cause);
    console.error(`[tauri-commands] ${cmd} response validation failed:`, detail);
    return createSchemaParseAppError("response", detail);
  }

  if (isSchemaParseError(error)) {
    const detail = formatSchemaIssues(error);
    console.error(`[tauri-commands] ${cmd} args validation failed:`, detail);
    return createSchemaParseAppError("args", detail);
  }
  const result = safeParse(AppErrorSchema, error);
  if (result.success) {
    const appError = redactAppError(result.output);
    console.error(`[tauri-commands] ${cmd} failed:`, appError);
    return appError;
  }

  const message = redactRuntimeDiagnosticText(runtimeErrorMessage(error));
  console.error(`[tauri-commands] ${cmd} failed:`, message);
  if (isRetryableRuntimeErrorMessage(message)) {
    return { type: "Retryable", message };
  }
  return { type: "UserVisible", message };
}

function validateInvokeArgs(options: InvokeArgsOptions, args?: InvokeArgsRecord): InvokeArgsRecord | undefined {
  // Missing args intentionally bypass schema parsing for schema-backed no-arg calls.
  // Throwing is contained here because safeInvoke converts schema parse errors into AppError Result.
  return options.args && args ? parseWithSchema(options.args, args) : args;
}

function hasResponseSchema<R extends RuntimeSchema>(
  options: GenericInvokeOptions | SchemaBackedInvokeOptions<R>,
): options is SchemaBackedInvokeOptions<R> {
  return "response" in options;
}

async function invokeWithResponseSchema<R extends RuntimeSchema>(
  cmd: string,
  options: SchemaBackedInvokeOptions<R>,
  args?: InvokeArgsRecord,
): Promise<SchemaOutput<R>> {
  const validatedArgs = validateInvokeArgs(options, args);
  const raw = await invoke<unknown>(cmd, validatedArgs);
  try {
    // Response parse is diagnostics-only once it leaves safeInvoke.
    return parseWithSchema(options.response, raw);
  } catch (error) {
    if (isSchemaParseError(error)) {
      throw new ResponseValidationError(error);
    }
    throw error;
  }
}

async function invokeWithoutResponseSchema<T>(
  cmd: string,
  options: GenericInvokeOptions,
  args?: InvokeArgsRecord,
): Promise<T> {
  const validatedArgs = validateInvokeArgs(options, args);
  return invoke<T>(cmd, validatedArgs);
}

export function safeInvoke<R extends RuntimeSchema>(
  cmd: string,
  options: SchemaBackedInvokeOptions<R>,
  args?: InvokeArgsRecord,
): Result.ResultAsync<SchemaOutput<R>, AppError>;

export function safeInvoke<T = unknown>(
  cmd: string,
  options?: GenericInvokeOptions,
  args?: InvokeArgsRecord,
): Result.ResultAsync<T, AppError>;

export function safeInvoke<R extends RuntimeSchema, T = unknown>(
  cmd: string,
  options: GenericInvokeOptions | SchemaBackedInvokeOptions<R> = {},
  args?: InvokeArgsRecord,
): Result.ResultAsync<unknown, AppError> {
  return Result.try({
    try: async () => {
      return hasResponseSchema(options)
        ? invokeWithResponseSchema(cmd, options, args)
        : invokeWithoutResponseSchema<T>(cmd, options, args);
    },
    catch: (error) => toAppError(cmd, error),
  });
}
