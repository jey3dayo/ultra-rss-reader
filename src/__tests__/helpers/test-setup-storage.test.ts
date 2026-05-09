import { afterEach, describe, expect, it } from "vitest";
import { ensureWorkingStorage, MemoryStorage } from "../../../tests/setup";

const originalWindowLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalWindowSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
const originalGlobalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalGlobalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalGlobalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Storage");

function restoreDescriptor(target: object, key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
}

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

describe("test setup storage fallback", () => {
  afterEach(() => {
    restoreDescriptor(window, "localStorage", originalWindowLocalStorageDescriptor);
    restoreDescriptor(window, "sessionStorage", originalWindowSessionStorageDescriptor);
    restoreDescriptor(globalThis, "localStorage", originalGlobalLocalStorageDescriptor);
    restoreDescriptor(globalThis, "sessionStorage", originalGlobalSessionStorageDescriptor);
    restoreDescriptor(globalThis, "Storage", originalGlobalStorageDescriptor);
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
});
