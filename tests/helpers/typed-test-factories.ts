import type { KeyboardEvent } from "react";
import { vi } from "vitest";

export type {
  MutationObserverMockInstance,
  ResizeObserverMockInstance,
} from "@tests/helpers/observer-mocks";
export { mockObserverConstructors } from "@tests/helpers/observer-mocks";

type KeyboardEventFactoryOptions = {
  key: string;
  preventDefault?: () => void;
};

export function createInputKeyboardEvent({
  key,
  preventDefault = vi.fn(),
}: KeyboardEventFactoryOptions): KeyboardEvent<HTMLInputElement> {
  return {
    key,
    preventDefault,
  } as KeyboardEvent<HTMLInputElement>;
}

export type PartialHookDataResult<TResult extends { data: unknown }> = Pick<TResult, "data"> &
  Partial<Omit<TResult, "data">>;

export function createHookDataResult<TResult extends { data: unknown }>(
  data: TResult["data"],
  result?: Partial<Omit<TResult, "data">>,
): TResult {
  return {
    data,
    ...result,
  } as TResult;
}
