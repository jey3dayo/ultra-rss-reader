import type { KeyboardEvent } from "react";
import { vi } from "vitest";

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

type ObserverMock = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

export type ResizeObserverMockInstance = ObserverMock & {
  callback: ResizeObserverCallback;
  unobserve: ReturnType<typeof vi.fn>;
  flush: (entries?: ResizeObserverEntry[]) => void;
};

export type MutationObserverMockInstance = ObserverMock & {
  callback: MutationCallback;
  takeRecords: () => MutationRecord[];
  flush: (records?: MutationRecord[]) => void;
};

export function mockObserverConstructors() {
  const resizeObservers: ResizeObserverMockInstance[] = [];
  const mutationObservers: MutationObserverMockInstance[] = [];

  class ResizeObserverMock implements ResizeObserverMockInstance {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      resizeObservers.push(this);
    }

    flush(entries: ResizeObserverEntry[] = []) {
      this.callback(entries, this as ResizeObserver);
    }
  }

  class MutationObserverMock implements MutationObserverMockInstance {
    observe = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn((): MutationRecord[] => []);
    callback: MutationCallback;

    constructor(callback: MutationCallback) {
      this.callback = callback;
      mutationObservers.push(this);
    }

    flush(records: MutationRecord[] = []) {
      this.callback(records, this as MutationObserver);
    }
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("MutationObserver", MutationObserverMock);

  return { resizeObservers, mutationObservers };
}

export function createHookDataResult<TResult extends { data: unknown }>(data: TResult["data"]): TResult {
  return { data } as TResult;
}
