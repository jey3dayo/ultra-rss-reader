import { JSDOM } from "jsdom";
import { afterEach, beforeEach, vi } from "vitest";

type BrowserTestDomHandle = {
  window: Window;
  document: Document;
  cleanup: () => void;
};

type BrowserTestDomOptions = {
  html?: string;
  url?: string;
};

const TEST_DOM_GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "Node",
  "Element",
  "EventTarget",
  "FocusEvent",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLIFrameElement",
  "HTMLTextAreaElement",
  "ShadowRoot",
  "Document",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "DOMException",
  "DOMRect",
  "DOMParser",
  "Storage",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
] as const;

const originalProcessEnv = { ...process.env };

let originalWindowLocalStorageDescriptor: PropertyDescriptor | undefined;
let originalWindowSessionStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalLocalStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalSessionStorageDescriptor: PropertyDescriptor | undefined;
let originalGlobalStorageDescriptor: PropertyDescriptor | undefined;

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

function readWindowDescriptor(key: "localStorage" | "sessionStorage"): PropertyDescriptor | undefined {
  return typeof window === "undefined" ? undefined : Object.getOwnPropertyDescriptor(window, key);
}

export function captureBrowserTestStorageDescriptors(): void {
  originalWindowLocalStorageDescriptor = readWindowDescriptor("localStorage");
  originalWindowSessionStorageDescriptor = readWindowDescriptor("sessionStorage");
  originalGlobalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  originalGlobalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  originalGlobalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Storage");
}

function restoreDescriptor(target: object | undefined, key: string, descriptor: PropertyDescriptor | undefined): void {
  if (!target) {
    return;
  }

  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

export function restoreStorageDescriptors(): void {
  restoreDescriptor(
    typeof window === "undefined" ? undefined : window,
    "localStorage",
    originalWindowLocalStorageDescriptor,
  );
  restoreDescriptor(
    typeof window === "undefined" ? undefined : window,
    "sessionStorage",
    originalWindowSessionStorageDescriptor,
  );
  restoreDescriptor(globalThis, "localStorage", originalGlobalLocalStorageDescriptor);
  restoreDescriptor(globalThis, "sessionStorage", originalGlobalSessionStorageDescriptor);
  restoreDescriptor(globalThis, "Storage", originalGlobalStorageDescriptor);
}

export function clearWorkingStorage(storage: Storage | null): void {
  try {
    storage?.clear();
  } catch {
    // Broken storage descriptors are restored by the shared teardown.
  }
}

export function restoreProcessEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalProcessEnv)) {
      Reflect.deleteProperty(process.env, key);
    }
  }

  Object.assign(process.env, originalProcessEnv);
}

export function readWorkingWindowStorage(key: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storage = window[key];
    return typeof storage?.clear === "function" ? storage : null;
  } catch {
    return null;
  }
}

export function ensureWorkingStorage(): void {
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

export function ensureGetAnimations(): void {
  if (typeof Element === "undefined" || typeof Element.prototype.getAnimations === "function") {
    return;
  }

  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    writable: true,
    value: () => [],
  });
}

function defineGlobalProperty(key: (typeof TEST_DOM_GLOBAL_KEYS)[number], value: unknown): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

export function installTestDom(options: BrowserTestDomOptions = {}): BrowserTestDomHandle {
  const dom = new JSDOM(options.html ?? "<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: options.url ?? "http://localhost/",
  });
  const previousDescriptors = new Map<(typeof TEST_DOM_GLOBAL_KEYS)[number], PropertyDescriptor | undefined>();

  for (const key of TEST_DOM_GLOBAL_KEYS) {
    previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }

  defineGlobalProperty("window", dom.window);
  defineGlobalProperty("document", dom.window.document);
  for (const key of TEST_DOM_GLOBAL_KEYS) {
    if (key === "window" || key === "document") {
      continue;
    }
    defineGlobalProperty(key, Reflect.get(dom.window, key));
  }

  captureBrowserTestStorageDescriptors();
  ensureWorkingStorage();
  ensureGetAnimations();

  let cleanedUp = false;
  return {
    window: dom.window,
    document: dom.window.document,
    cleanup: () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      dom.window.close();
      for (const [key, descriptor] of previousDescriptors) {
        restoreDescriptor(globalThis, key, descriptor);
      }
      captureBrowserTestStorageDescriptors();
    },
  };
}

export function setupBrowserTestDom(options: BrowserTestDomOptions = {}): void {
  let dom: BrowserTestDomHandle | null = null;

  beforeEach(() => {
    dom = installTestDom(options);
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreProcessEnv();
    clearWorkingStorage(readWorkingWindowStorage("localStorage"));
    clearWorkingStorage(readWorkingWindowStorage("sessionStorage"));
    restoreStorageDescriptors();
    dom?.cleanup();
    dom = null;
  });
}

export async function withTestDom<T>(
  callback: (dom: BrowserTestDomHandle) => T | Promise<T>,
  options: BrowserTestDomOptions = {},
): Promise<T> {
  const dom = installTestDom(options);
  try {
    return await callback(dom);
  } finally {
    dom.cleanup();
  }
}

captureBrowserTestStorageDescriptors();
