import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { resetCommandHistoryStorageFailureWarnings } from "@/components/reader/hooks/command-palette/use-command-history";
import { resetStartupSyncStorageFailureWarnings } from "@/lib/sync/startup-sync-storage";
import {
  flushMutationObservers as flushTestMutationObservers,
  flushResizeObservers as flushTestResizeObservers,
  getMutationObserverMocks as getTestMutationObservers,
  getResizeObserverMocks as getTestResizeObservers,
  installTestObserverMocks,
  resetTestObserverMocks,
} from "./helpers/observer-mocks";

export {
  flushTestMutationObservers,
  flushTestResizeObservers,
  getTestMutationObservers,
  getTestResizeObservers,
  installTestObserverMocks,
  resetTestObserverMocks,
};

const originalWindowLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalWindowSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
const originalGlobalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalGlobalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalGlobalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Storage");

export const MEMORY_STORAGE_BROWSER_SPEC_DIFFERENCES = [
  "MemoryStorage is a Vitest fallback for blocked or unavailable browser storage, not a full Storage host object.",
  "MemoryStorage exposes named item properties through accessors but does not implement Storage named property deletion semantics for direct assignment.",
  "MemoryStorage preserves existing Storage API members when item keys collide with methods or length.",
] as const;

export class MemoryStorage implements Storage {
  #data = new Map<string, string>();
  #definedPropertyKeys = new Set<string>();

  get length(): number {
    return this.#data.size;
  }

  clear(): void {
    this.#data.clear();
    for (const key of this.#definedPropertyKeys) {
      Reflect.deleteProperty(this, key);
    }
    this.#definedPropertyKeys.clear();
  }

  getItem(key: string): string | null {
    return this.#data.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.#data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    const storageKey = String(key);
    this.#data.delete(storageKey);
    if (this.#definedPropertyKeys.delete(storageKey)) {
      Reflect.deleteProperty(this, storageKey);
    }
  }

  setItem(key: string, value: string): void {
    const storageKey = String(key);
    this.#data.set(storageKey, String(value));
    this.#ensureNamedProperty(storageKey);
  }

  #ensureNamedProperty(key: string): void {
    if (this.#definedPropertyKeys.has(key) || key in this) {
      return;
    }

    Object.defineProperty(this, key, {
      configurable: true,
      enumerable: true,
      get: () => this.getItem(key) ?? undefined,
    });
    this.#definedPropertyKeys.add(key);
  }
}

function restoreDescriptor(target: object, key: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

export function restoreStorageDescriptors(): void {
  restoreDescriptor(window, "localStorage", originalWindowLocalStorageDescriptor);
  restoreDescriptor(window, "sessionStorage", originalWindowSessionStorageDescriptor);
  restoreDescriptor(globalThis, "localStorage", originalGlobalLocalStorageDescriptor);
  restoreDescriptor(globalThis, "sessionStorage", originalGlobalSessionStorageDescriptor);
  restoreDescriptor(globalThis, "Storage", originalGlobalStorageDescriptor);
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
installTestObserverMocks();

beforeEach(() => {
  installTestObserverMocks();
});

afterEach(() => {
  cleanup();
  teardownTauriMocks();
  resetTauriRuntimeFlags();
  resetCommandHistoryStorageFailureWarnings();
  resetStartupSyncStorageFailureWarnings();
  resetTestObserverMocks();
  restoreStorageDescriptors();
  ensureWorkingStorage();
  installTestObserverMocks();
});
