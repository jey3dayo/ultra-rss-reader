type SchemaMetadata = {
  type: string;
};

type ObjectSchemaMetadata = SchemaMetadata & {
  type: "object" | "strict_object" | "loose_object";
  entries: object;
};

type VariantSchemaMetadata = SchemaMetadata & {
  type: "variant";
  options: readonly SchemaMetadata[];
};

type PipeSchemaMetadata = SchemaMetadata & {
  pipe: readonly SchemaMetadata[];
};

function isSchemaMetadata(value: unknown): value is SchemaMetadata {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

function isObjectSchemaMetadata(value: unknown): value is ObjectSchemaMetadata {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    (value.type !== "object" && value.type !== "strict_object" && value.type !== "loose_object")
  ) {
    return false;
  }

  return "entries" in value && typeof value.entries === "object" && value.entries !== null;
}

function isVariantSchemaMetadata(value: unknown): value is VariantSchemaMetadata {
  if (typeof value !== "object" || value === null || !("type" in value) || value.type !== "variant") {
    return false;
  }

  return "options" in value && Array.isArray(value.options);
}

function isPipeSchemaMetadata(value: unknown): value is PipeSchemaMetadata {
  return isSchemaMetadata(value) && "pipe" in value && Array.isArray(value.pipe) && value.pipe.every(isSchemaMetadata);
}

function findObjectSchemaMetadata(schema: SchemaMetadata): ObjectSchemaMetadata | undefined {
  if (isObjectSchemaMetadata(schema)) {
    return schema;
  }

  if (isPipeSchemaMetadata(schema)) {
    for (const item of schema.pipe) {
      const objectSchema = findObjectSchemaMetadata(item);
      if (objectSchema !== undefined) {
        return objectSchema;
      }
    }
  }

  return undefined;
}

function findVariantSchemaMetadata(schema: SchemaMetadata): VariantSchemaMetadata | undefined {
  if (isVariantSchemaMetadata(schema)) {
    return schema;
  }

  if (isPipeSchemaMetadata(schema)) {
    for (const item of schema.pipe) {
      const variantSchema = findVariantSchemaMetadata(item);
      if (variantSchema !== undefined) {
        return variantSchema;
      }
    }
  }

  return undefined;
}

export function commandArgsSchemaKeys(schema: SchemaMetadata): string[] {
  const objectSchema = findObjectSchemaMetadata(schema);
  if (objectSchema !== undefined) {
    return Object.keys(objectSchema.entries).toSorted();
  }

  const variantSchema = findVariantSchemaMetadata(schema);
  if (variantSchema !== undefined) {
    return [
      ...new Set(
        variantSchema.options.flatMap((option) => {
          const objectOption = findObjectSchemaMetadata(option);
          if (objectOption === undefined) {
            throw new Error("Unsupported variant option schema");
          }
          return Object.keys(objectOption.entries);
        }),
      ),
    ].toSorted();
  }

  throw new Error("Unsupported command args schema");
}
