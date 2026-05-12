import {
  ensureWorkingStorage,
  MEMORY_STORAGE_BROWSER_SPEC_DIFFERENCES,
  MemoryStorage,
  restoreStorageDescriptors,
  setupBrowserTestDom,
} from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

setupBrowserTestDom();

let originalWindowLocalStorageDescriptor: PropertyDescriptor | undefined;
let originalWindowSessionStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalLocalStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalSessionStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalStorageDescriptor: PropertyDescriptor | undefined;

function callStorageMethod(method: Storage["setItem"], storage: Storage, key: unknown, value: unknown) {
  Reflect.apply(method, storage, [key, value]);
}

function callStorageKey(storage: Storage, index: unknown): string | null {
  return Reflect.apply(storage.key, storage, [index]);
}

function callStorageGetItem(storage: Storage, key: unknown): string | null {
  return Reflect.apply(storage.getItem, storage, [key]);
}

function callStorageRemoveItem(storage: Storage, key: unknown) {
  Reflect.apply(storage.removeItem, storage, [key]);
}

function readStorageProperty(storage: Storage, key: PropertyKey): unknown {
  return Reflect.get(storage, key);
}

describe("test setup storage fallback", () => {
  beforeEach(() => {
    originalWindowLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    originalWindowSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    originalGlobalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    originalGlobalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    originalGlobalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Storage");
  });

  afterEach(() => {
    restoreStorageDescriptors();
  });

  it("injects memory storage when localStorage and sessionStorage getters throw", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("localStorage blocked", "SecurityError");
      },
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("sessionStorage blocked", "SecurityError");
      },
    });

    expect(() => ensureWorkingStorage()).not.toThrow();

    expect(window.localStorage).toBeInstanceOf(MemoryStorage);
    expect(window.sessionStorage).toBeInstanceOf(MemoryStorage);
    window.localStorage.setItem("local-key", "local-value");
    window.sessionStorage.setItem("session-key", "session-value");
    expect(globalThis.localStorage.getItem("local-key")).toBe("local-value");
    expect(globalThis.sessionStorage.getItem("session-key")).toBe("session-value");
  });

  it("keeps a working localStorage while replacing a broken sessionStorage getter", () => {
    const workingLocalStorage = new MemoryStorage();
    workingLocalStorage.setItem("existing-key", "existing-value");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: workingLocalStorage,
      writable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("sessionStorage blocked", "SecurityError");
      },
    });

    expect(() => ensureWorkingStorage()).not.toThrow();

    expect(window.localStorage).toBe(workingLocalStorage);
    expect(window.localStorage.getItem("existing-key")).toBe("existing-value");
    expect(window.sessionStorage).toBeInstanceOf(MemoryStorage);
  });

  it("restores storage descriptors after local test shims mutate them", () => {
    const localStorageShim = new MemoryStorage();
    const sessionStorageShim = new MemoryStorage();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageShim,
      writable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: sessionStorageShim,
      writable: true,
    });
    Object.defineProperty(globalThis, "Storage", {
      configurable: true,
      value: MemoryStorage,
      writable: true,
    });

    restoreStorageDescriptors();

    expect(Object.getOwnPropertyDescriptor(window, "localStorage")).toEqual(originalWindowLocalStorageDescriptor);
    expect(Object.getOwnPropertyDescriptor(window, "sessionStorage")).toEqual(originalWindowSessionStorageDescriptor);
    expect(Object.getOwnPropertyDescriptor(globalThis, "localStorage")).toEqual(originalGlobalLocalStorageDescriptor);
    expect(Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")).toEqual(
      originalGlobalSessionStorageDescriptor,
    );
    expect(Object.getOwnPropertyDescriptor(globalThis, "Storage")).toEqual(originalGlobalStorageDescriptor);
  });

  it("keeps MemoryStorage key order, length, remove, and clear behavior aligned with DOM Storage", () => {
    const storage = new MemoryStorage();

    storage.setItem("first", "1");
    storage.setItem("second", "2");
    storage.setItem("first", "updated");
    storage.setItem("third", "3");

    expect(storage.length).toBe(3);
    expect(storage.key(0)).toBe("first");
    expect(storage.key(1)).toBe("second");
    expect(storage.key(2)).toBe("third");
    expect(storage.key(3)).toBeNull();
    expect(storage.getItem("first")).toBe("updated");

    storage.removeItem("second");

    expect(storage.length).toBe(2);
    expect(storage.key(0)).toBe("first");
    expect(storage.key(1)).toBe("third");
    expect(storage.getItem("second")).toBeNull();

    storage.setItem("second", "restored");

    expect(storage.key(0)).toBe("first");
    expect(storage.key(1)).toBe("third");
    expect(storage.key(2)).toBe("second");
    expect(storage.getItem("second")).toBe("restored");

    storage.clear();

    expect(storage.length).toBe(0);
    expect(storage.key(0)).toBeNull();
  });

  it("coerces MemoryStorage keys and values like DOM Storage", () => {
    const storage = new MemoryStorage();

    callStorageMethod(storage.setItem, storage, 42, false);
    callStorageMethod(storage.setItem, storage, null, undefined);

    expect(storage.key(0)).toBe("42");
    expect(storage.key(1)).toBe("null");
    expect(storage.getItem("42")).toBe("false");
    expect(storage.getItem("null")).toBe("undefined");
    expect(callStorageKey(storage, "1")).toBe("null");
    expect(callStorageGetItem(storage, 42)).toBe("false");
    expect(callStorageGetItem(storage, null)).toBe("undefined");

    callStorageRemoveItem(storage, 42);
    callStorageRemoveItem(storage, null);

    expect(storage.length).toBe(0);
  });

  it("exposes MemoryStorage item values through DOM Storage named getters", () => {
    const storage = new MemoryStorage();

    storage.setItem("article-id", "article-1");
    callStorageMethod(storage.setItem, storage, 42, false);
    storage.setItem("article-id", "article-2");

    expect(readStorageProperty(storage, "article-id")).toBe("article-2");
    expect(readStorageProperty(storage, "42")).toBe("false");

    storage.removeItem("article-id");

    expect(readStorageProperty(storage, "article-id")).toBeUndefined();

    storage.setItem("article-id", "article-3");

    expect(readStorageProperty(storage, "article-id")).toBe("article-3");

    storage.clear();

    expect(readStorageProperty(storage, "article-id")).toBeUndefined();
    expect(readStorageProperty(storage, "42")).toBeUndefined();
  });

  it("keeps MemoryStorage API getters available when item keys collide with Storage members", () => {
    const storage = new MemoryStorage();

    storage.setItem("length", "5");
    storage.setItem("getItem", "value");

    expect(storage.length).toBe(2);
    expect(readStorageProperty(storage, "length")).toBe(2);
    expect(readStorageProperty(storage, "getItem")).toBe(storage.getItem);
    expect(storage.getItem("length")).toBe("5");
    expect(storage.getItem("getItem")).toBe("value");
  });

  it("documents the intentional MemoryStorage browser Storage spec differences", () => {
    expect(MEMORY_STORAGE_BROWSER_SPEC_DIFFERENCES).toEqual([
      "MemoryStorage is a Vitest fallback for blocked or unavailable browser storage, not a full Storage host object.",
      "MemoryStorage exposes named item properties through accessors but does not implement Storage named property deletion semantics for direct assignment.",
      "MemoryStorage preserves existing Storage API members when item keys collide with methods or length.",
    ]);
  });
});
