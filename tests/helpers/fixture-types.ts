import type { Result } from "@praha/byethrow";

export type CommandSuccess<TCommand> = TCommand extends (
  ...args: infer _Args
) => Result.ResultAsync<infer Output, unknown>
  ? Output
  : never;
export type CommandListItem<TCommand> = CommandSuccess<TCommand> extends readonly (infer Item)[] ? Item : never;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

type DeepMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
      : T;

type JsonLikePrimitive = string | number | boolean | null;

type JsonLikeFixture<T> = T extends JsonLikePrimitive
  ? T
  : T extends undefined
    ? never
    : T extends (...args: never[]) => unknown
      ? never
      : T extends Date
        ? never
        : T extends Map<unknown, unknown> | Set<unknown> | WeakMap<object, unknown> | WeakSet<object>
          ? never
          : T extends readonly (infer Item)[]
            ? readonly JsonLikeFixture<Item>[]
            : T extends object
              ? { readonly [Key in keyof T]: JsonLikeFixture<T[Key]> }
              : never;

export type ReadonlyFixtureSeed<T> = readonly DeepReadonly<JsonLikeFixture<T>>[];
export type MutableTestFixture<T> = DeepMutable<T>[];

function getFixtureSeedValueKind(value: unknown): string {
  if (value instanceof Date) {
    return "Date";
  }
  if (value instanceof Map) {
    return "Map";
  }
  if (value instanceof Set) {
    return "Set";
  }
  return typeof value;
}

function assertJsonLikeFixtureSeed(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonLikeFixtureSeed(item, `${path}[${index}]`);
    });
    return;
  }

  if (typeof value !== "object" || value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new Error(
      `Fixture seed must contain JSON-like values only. Unsupported ${getFixtureSeedValueKind(value)} at ${path}`,
    );
  }

  for (const [key, item] of Object.entries(value)) {
    assertJsonLikeFixtureSeed(item, `${path}.${key}`);
  }
}

export function cloneFixtureSeed<T>(fixture: ReadonlyFixtureSeed<T>): MutableTestFixture<T> {
  assertJsonLikeFixtureSeed(fixture, "$");
  return structuredClone(fixture) as MutableTestFixture<T>;
}
