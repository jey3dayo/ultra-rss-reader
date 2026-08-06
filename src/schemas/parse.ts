import type { BaseIssue, BaseSchema, InferOutput, ValiError } from "valibot";
import { isValiError, parse, safeParse } from "valibot";

export type RuntimeSchema<TOutput = unknown> = BaseSchema<unknown, TOutput, BaseIssue<unknown>>;
export type SchemaOutput<TSchema extends RuntimeSchema> = InferOutput<TSchema>;
export type SchemaParseError = ValiError<RuntimeSchema>;

type NullableParseResult<TSchema extends RuntimeSchema> = SchemaOutput<TSchema> | null;

export const PARSE_JSON_WITH_SCHEMA_OR_NULL_CALLER_OWNERS = [
  {
    owner: "safeParseJsonWithSchema",
    fallbackBoundary: "named nullable alias",
    callsite: "src/schemas/parse.ts",
    callCount: 1,
    fallbackBehavior: "Delegates fallback ownership to the direct safeParseJsonWithSchema caller.",
  },
  {
    owner: "sidebar startup folder expansion",
    fallbackBoundary: "localStorage UI cache recovery",
    callsite: "src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts",
    callCount: 3,
    fallbackBehavior: "Drops malformed or schema-invalid expansion cache and rebuilds from visible accounts.",
  },
] as const;

export const JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS = {
  commandHistory: {
    owner: "command history localStorage",
    fallbackBoundary: "explicit cleanup",
    nullableParseHelper: false,
    fallbackBehavior: "Malformed JSON and schema-invalid history are removed before returning an empty history.",
  },
  preferencesLoad: {
    owner: "preferences store load",
    fallbackBoundary: "backend load failure",
    nullableParseHelper: false,
    fallbackBehavior: "Backend load errors keep optimistic state or apply bootstrapped defaults.",
  },
  diagnostics: {
    owner: "diagnostics and command DTOs",
    fallbackBoundary: "throwing/schema error surface",
    nullableParseHelper: false,
    fallbackBehavior: "Malformed JSON and invalid payloads remain distinguishable for user-visible errors.",
  },
  storageCleanup: {
    owner: "storage cleanup policy",
    fallbackBoundary: "schema contract",
    nullableParseHelper: false,
    fallbackBehavior: "Cleanup policy drift fails schema validation instead of silently dropping keys.",
  },
} as const;

/**
 * Throwing schema boundary. Invalid values surface as the schema library error.
 * Use only where the callsite immediately converts the throw into Result/reject or intentionally fails a test.
 */
export function isSchemaParseError(error: unknown): error is SchemaParseError {
  return isValiError(error);
}

export function parseWithSchema<TSchema extends RuntimeSchema>(schema: TSchema, value: unknown): SchemaOutput<TSchema> {
  return parse(schema, value);
}

/**
 * Throwing JSON + schema boundary. Malformed JSON throws SyntaxError; invalid data throws a ValiError.
 */
export function parseJsonWithSchema<TSchema extends RuntimeSchema>(
  contents: string,
  schema: TSchema,
): SchemaOutput<TSchema> {
  return parseWithSchema(schema, JSON.parse(contents));
}

/**
 * Nullable JSON + schema boundary. Malformed JSON and invalid data both return null for caller-owned fallback.
 * Use for local persisted/config recovery paths where the caller owns a safe default.
 */
export function parseJsonWithSchemaOrNull<TSchema extends RuntimeSchema>(
  contents: string,
  schema: TSchema,
): NullableParseResult<TSchema> {
  try {
    const parsed = JSON.parse(contents) as unknown;
    const result = safeParse(schema, parsed);
    return result.success ? result.output : null;
  } catch {
    return null;
  }
}

/**
 * Safe-named alias for callers that prefer a nullable parse helper name.
 */
export function safeParseJsonWithSchema<TSchema extends RuntimeSchema>(
  contents: string,
  schema: TSchema,
): NullableParseResult<TSchema> {
  return parseJsonWithSchemaOrNull(contents, schema);
}
