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

export type ReadonlyFixtureSeed<T> = readonly DeepReadonly<T>[];
export type MutableTestFixture<T> = DeepMutable<T>[];

export function cloneFixtureSeed<T>(fixture: ReadonlyFixtureSeed<T>): MutableTestFixture<T> {
  return structuredClone(fixture) as MutableTestFixture<T>;
}
