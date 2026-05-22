import { z } from "zod";

type CommandArgsSchema = z.ZodType<Record<string, unknown>>;

export function commandArgsSchemaKeys(schema: CommandArgsSchema): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape).toSorted();
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    return [
      ...new Set(
        schema.options.flatMap((option) => {
          if (!(option instanceof z.ZodObject)) {
            throw new Error(`Unsupported discriminated union option schema: ${option.constructor.name}`);
          }
          return Object.keys(option.shape);
        }),
      ),
    ].toSorted();
  }

  throw new Error(`Unsupported command args schema: ${schema.constructor.name}`);
}
