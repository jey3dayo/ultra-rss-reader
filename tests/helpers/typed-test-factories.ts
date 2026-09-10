import type { KeyboardEvent } from "react";
import { vi } from "vitest";

export { mockObserverConstructors } from "@tests/helpers/observer-mocks";

type KeyboardEventFactoryOptions = {
  key: string;
  preventDefault?: () => void;
  isComposing?: boolean;
};

export function createInputKeyboardEvent({
  key,
  preventDefault = vi.fn(),
  isComposing = false,
}: KeyboardEventFactoryOptions): KeyboardEvent<HTMLInputElement> {
  // Handlers read composition state from the native event because React's synthetic
  // KeyboardEvent has no isComposing, so the fake must carry a nativeEvent too.
  return {
    key,
    preventDefault,
    nativeEvent: { isComposing },
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
