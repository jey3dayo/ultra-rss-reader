import { vi } from "vitest";

const RESIZE_OBSERVER_MOCK_MARKER = Symbol.for("ultra-rss-reader.test.ResizeObserverMock");
const MUTATION_OBSERVER_MOCK_MARKER = Symbol.for("ultra-rss-reader.test.MutationObserverMock");

type ObserverMock = {
  observe: () => void;
  disconnect: () => void;
};

type ObserverMockConstructor = {
  readonly [RESIZE_OBSERVER_MOCK_MARKER]?: true;
  readonly [MUTATION_OBSERVER_MOCK_MARKER]?: true;
};

export type TestResizeObserverMock = ObserverMock & {
  callback: ResizeObserverCallback;
  unobserve: () => void;
  flush: (entries?: ResizeObserverEntry[]) => void;
  isDisconnected: () => boolean;
};

export type TestMutationObserverMock = ObserverMock & {
  callback: MutationCallback;
  takeRecords: () => MutationRecord[];
  flush: (records?: MutationRecord[]) => void;
  isDisconnected: () => boolean;
};

const resizeObservers: TestResizeObserverMock[] = [];
const mutationObservers: TestMutationObserverMock[] = [];

class TestResizeObserver implements ResizeObserver {
  static readonly [RESIZE_OBSERVER_MOCK_MARKER] = true;

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn(() => {
    this.disconnected = true;
  });
  callback: ResizeObserverCallback;
  #disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.push(this);
  }

  flush(entries: ResizeObserverEntry[] = []) {
    if (!this.#disconnected) {
      this.callback(entries, this);
    }
  }

  isDisconnected(): boolean {
    return this.#disconnected;
  }

  private set disconnected(value: boolean) {
    this.#disconnected = value;
  }
}

class TestMutationObserver implements MutationObserver {
  static readonly [MUTATION_OBSERVER_MOCK_MARKER] = true;

  observe = vi.fn();
  disconnect = vi.fn(() => {
    this.disconnected = true;
  });
  takeRecords = vi.fn((): MutationRecord[] => []);
  callback: MutationCallback;
  #disconnected = false;

  constructor(callback: MutationCallback) {
    this.callback = callback;
    mutationObservers.push(this);
  }

  flush(records: MutationRecord[] = []) {
    if (!this.#disconnected) {
      this.callback(records, this);
    }
  }

  isDisconnected(): boolean {
    return this.#disconnected;
  }

  private set disconnected(value: boolean) {
    this.#disconnected = value;
  }
}

function isTestResizeObserver(value: unknown): value is ObserverMockConstructor {
  return typeof value === "function" && Reflect.get(value, RESIZE_OBSERVER_MOCK_MARKER) === true;
}

function isTestMutationObserver(value: unknown): value is ObserverMockConstructor {
  return typeof value === "function" && Reflect.get(value, MUTATION_OBSERVER_MOCK_MARKER) === true;
}

export function installTestObserverMocks(): {
  resizeObservers: TestResizeObserverMock[];
  mutationObservers: TestMutationObserverMock[];
} {
  resetTestObserverMocks();
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("MutationObserver", TestMutationObserver);

  return {
    resizeObservers,
    mutationObservers,
  };
}

export function resetTestObserverMocks(): void {
  for (const observer of [...resizeObservers]) {
    if (!observer.isDisconnected()) {
      observer.disconnect();
    }
  }
  resizeObservers.splice(0);

  for (const observer of [...mutationObservers]) {
    if (!observer.isDisconnected()) {
      observer.disconnect();
    }
  }
  mutationObservers.splice(0);
}

export function flushResizeObservers(entries?: ResizeObserverEntry[]): void {
  for (const observer of [...resizeObservers]) {
    observer.flush(entries);
  }
}

export function flushMutationObservers(records?: MutationRecord[]): void {
  for (const observer of [...mutationObservers]) {
    observer.flush(records);
  }
}

export function getResizeObserverMocks(): TestResizeObserverMock[] {
  return resizeObservers;
}

export function getMutationObserverMocks(): TestMutationObserverMock[] {
  return mutationObservers;
}

export function mockObserverConstructors() {
  const mocks = installTestObserverMocks();

  return {
    ...mocks,
    cleanupObservers: resetTestObserverMocks,
  };
}

export function hasInstalledTestObserverMocks(): boolean {
  return isTestResizeObserver(globalThis.ResizeObserver) && isTestMutationObserver(globalThis.MutationObserver);
}
