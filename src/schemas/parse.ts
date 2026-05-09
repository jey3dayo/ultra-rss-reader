import type { z } from "zod";

type NullableParseResult<TSchema extends z.ZodType> = z.output<TSchema> | null;

/**
 * Throwing schema boundary. Invalid values surface as the schema library error.
 */
export function parseWithSchema<TSchema extends z.ZodType>(schema: TSchema, value: unknown): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Throwing JSON + schema boundary. Malformed JSON throws SyntaxError; invalid data throws ZodError.
 */
export function parseJsonWithSchema<TSchema extends z.ZodType>(contents: string, schema: TSchema): z.output<TSchema> {
  return parseWithSchema(schema, JSON.parse(contents));
}

/**
 * Nullable JSON + schema boundary. Malformed JSON and invalid data both return null for caller-owned fallback.
 */
export function parseJsonWithSchemaOrNull<TSchema extends z.ZodType>(
  contents: string,
  schema: TSchema,
): NullableParseResult<TSchema> {
  try {
    const parsed = JSON.parse(contents) as unknown;
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Safe-named alias for callers that prefer a nullable parse helper name.
 */
export function safeParseJsonWithSchema<TSchema extends z.ZodType>(
  contents: string,
  schema: TSchema,
): NullableParseResult<TSchema> {
  return parseJsonWithSchemaOrNull(contents, schema);
}
