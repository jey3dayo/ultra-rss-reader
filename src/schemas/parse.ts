import type { z } from "zod";

export function parseJsonWithSchema<TSchema extends z.ZodType>(contents: string, schema: TSchema): z.output<TSchema> {
  const result = schema.safeParse(JSON.parse(contents));
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
