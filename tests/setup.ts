import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

export class MemoryStorage implements Storage {
  #data = new Map<string, string>();

  get length(): number {
    return this.#data.size;
  }

  clear(): void {
    this.#data.clear();
  }

  getItem(key: string): string | null {
    return this.#data.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.#data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.#data.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.#data.set(String(key), String(value));
  }
}

function readWorkingWindowStorage(key: "localStorage" | "sessionStorage"): Storage | null {
  try {
    const storage = window[key];
    return typeof storage?.clear === "function" ? storage : null;
  } catch {
    return null;
  }
}

export function ensureWorkingStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const localStorage = readWorkingWindowStorage("localStorage");
  const sessionStorage = readWorkingWindowStorage("sessionStorage");

  if (localStorage && sessionStorage) {
    return;
  }

  const nextLocalStorage = localStorage ?? new MemoryStorage();
  const nextSessionStorage = sessionStorage ?? new MemoryStorage();

  Object.defineProperty(globalThis, "Storage", {
    configurable: true,
    writable: true,
    value: MemoryStorage,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: nextLocalStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: nextLocalStorage,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    writable: true,
    value: nextSessionStorage,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: nextSessionStorage,
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
import { resetTauriRuntimeFlags } from "./helpers/tauri-runtime";

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
  teardownTauriMocks();
  resetTauriRuntimeFlags();
});
