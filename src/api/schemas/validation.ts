import * as v from "valibot";

const isNonArrayObject = (input: unknown): boolean =>
  typeof input === "object" && input !== null && !Array.isArray(input);

type ObjectInput<TEntries extends v.ObjectEntries> = v.InferInput<v.ObjectSchema<TEntries, undefined>>;

export type GuardedObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.ObjectSchema<TEntries, undefined>]
>;

export type GuardedStrictObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.StrictObjectSchema<TEntries, undefined>]
>;

export type GuardedLooseObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.LooseObjectSchema<TEntries, undefined>]
>;

type RecordKeySchema = v.BaseSchema<string, string | number | symbol, v.BaseIssue<unknown>>;
type RecordValueSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
type RecordInput<TKey extends RecordKeySchema, TValue extends RecordValueSchema> = Record<
  Extract<v.InferInput<TKey>, string | number | symbol>,
  v.InferInput<TValue>
>;

type GuardedRecordSchema<TKey extends RecordKeySchema, TValue extends RecordValueSchema> = v.SchemaWithPipe<
  readonly [
    v.CustomSchema<RecordInput<TKey, TValue>, v.ErrorMessage<v.CustomIssue> | undefined>,
    v.RecordSchema<TKey, TValue, undefined>,
  ]
>;

export function object<const TEntries extends v.ObjectEntries>(entries: TEntries): GuardedObjectSchema<TEntries> {
  return v.pipe(v.custom<ObjectInput<TEntries>>(isNonArrayObject), v.object(entries));
}

export function strictObject<const TEntries extends v.ObjectEntries>(
  entries: TEntries,
): GuardedStrictObjectSchema<TEntries> {
  return v.pipe(v.custom<ObjectInput<TEntries>>(isNonArrayObject), v.strictObject(entries));
}

export function looseObject<const TEntries extends v.ObjectEntries>(
  entries: TEntries,
): GuardedLooseObjectSchema<TEntries> {
  return v.pipe(v.custom<ObjectInput<TEntries>>(isNonArrayObject), v.looseObject(entries));
}

export function record<const TKey extends RecordKeySchema, const TValue extends RecordValueSchema>(
  key: TKey,
  value: TValue,
  message?: string,
): GuardedRecordSchema<TKey, TValue> {
  return v.pipe(v.custom<RecordInput<TKey, TValue>>(isNonArrayObject, message), v.record(key, value));
}

export function unwrapObjectSchema<TEntries extends v.ObjectEntries>(
  schema: GuardedObjectSchema<TEntries>,
): v.ObjectSchema<TEntries, undefined> {
  return schema.pipe[1];
}

export function unwrapStrictObjectSchema<TEntries extends v.ObjectEntries>(
  schema: GuardedStrictObjectSchema<TEntries>,
): v.StrictObjectSchema<TEntries, undefined> {
  return schema.pipe[1];
}

type ObjectSchemaWithEntries<TEntries extends v.ObjectEntries> =
  | GuardedObjectSchema<TEntries>
  | GuardedStrictObjectSchema<TEntries>
  | GuardedLooseObjectSchema<TEntries>
  | v.ObjectSchema<TEntries, undefined>
  | v.StrictObjectSchema<TEntries, undefined>
  | v.LooseObjectSchema<TEntries, undefined>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasObjectEntries<TEntries extends v.ObjectEntries>(value: unknown): value is { readonly entries: TEntries } {
  return isObjectRecord(value) && "entries" in value && isObjectRecord(value.entries);
}

function hasSchemaPipe(value: unknown): value is { readonly pipe: readonly unknown[] } {
  return isObjectRecord(value) && "pipe" in value && Array.isArray(value.pipe);
}

function findObjectEntries<TEntries extends v.ObjectEntries>(value: unknown): TEntries | undefined {
  if (hasObjectEntries<TEntries>(value)) {
    return value.entries;
  }

  if (hasSchemaPipe(value)) {
    for (const item of value.pipe) {
      const entries = findObjectEntries<TEntries>(item);
      if (entries !== undefined) {
        return entries;
      }
    }
  }

  return undefined;
}

export function objectEntries<TEntries extends v.ObjectEntries>(schema: ObjectSchemaWithEntries<TEntries>): TEntries;
export function objectEntries(schema: unknown): v.ObjectEntries;
export function objectEntries<TEntries extends v.ObjectEntries>(schema: unknown): TEntries | v.ObjectEntries {
  const entries = findObjectEntries<TEntries>(schema);
  if (entries === undefined) {
    throw new Error("Expected an object schema with entries");
  }

  return entries;
}
