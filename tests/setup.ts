import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

class MemoryStorage implements Storage {
  #data = new Map<string, string>();

  get length(): number {
    return this.#data.size;
  }

  clear(): void {
    this.#data.clear();
  }

  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.#data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.#data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }
}

function ensureWorkingStorage() {
  if (typeof window === "undefined" || typeof window.localStorage?.clear === "function") {
    return;
  }

  const LocalStorageCtor = MemoryStorage as unknown as typeof Storage;
  const localStorage = new LocalStorageCtor();
  const sessionStorage = new LocalStorageCtor();

  Object.defineProperty(globalThis, "Storage", {
    configurable: true,
    writable: true,
    value: LocalStorageCtor,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: localStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: localStorage,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    writable: true,
    value: sessionStorage,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: sessionStorage,
  });
}

ensureWorkingStorage();

function ensureGetAnimations() {
  if (typeof Element === "undefined" || typeof Element.prototype.getAnimations === "function") {
    return;
  }

  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    writable: true,
    value: () => [],
  });
}

ensureGetAnimations();
import "./helpers/i18n-setup";
import { teardownTauriMocks } from "./helpers/tauri-mocks";

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
  teardownTauriMocks();
});
