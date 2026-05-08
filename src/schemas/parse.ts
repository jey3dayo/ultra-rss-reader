import type { z } from "zod";

export function parseWithSchema<TSchema extends z.ZodType>(schema: TSchema, value: unknown): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function parseJsonWithSchema<TSchema extends z.ZodType>(contents: string, schema: TSchema): z.output<TSchema> {
  return parseWithSchema(schema, JSON.parse(contents));
}
