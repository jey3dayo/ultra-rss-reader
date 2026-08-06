import * as v from "valibot";

const isNonArrayObject = (input: unknown): boolean =>
  typeof input === "object" && input !== null && !Array.isArray(input);

type ObjectInput<TEntries extends v.ObjectEntries> = v.InferInput<v.ObjectSchema<TEntries, undefined>>;

type GuardedObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.ObjectSchema<TEntries, undefined>]
>;

type GuardedStrictObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.StrictObjectSchema<TEntries, undefined>]
>;

type GuardedLooseObjectSchema<TEntries extends v.ObjectEntries> = v.SchemaWithPipe<
  readonly [v.CustomSchema<ObjectInput<TEntries>, undefined>, v.LooseObjectSchema<TEntries, undefined>]
>;

type RecordKeySchema = v.BaseSchema<string, string | number | symbol, v.BaseIssue<unknown>>;
type RecordValueSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
type RecordInput<TKey extends RecordKeySchema, TValue extends RecordValueSchema> = Record<
  Extract<v.InferInput<TKey>, string | number | symbol>,
  v.InferInput<TValue>
>;

type GuardedRecordSchema<TKey extends RecordKeySchema, TValue extends RecordValueSchema> = v.SchemaWithPipe<
  readonly [v.CustomSchema<RecordInput<TKey, TValue>, undefined>, v.RecordSchema<TKey, TValue, undefined>]
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
): GuardedRecordSchema<TKey, TValue> {
  return v.pipe(v.custom<RecordInput<TKey, TValue>>(isNonArrayObject), v.record(key, value));
}
