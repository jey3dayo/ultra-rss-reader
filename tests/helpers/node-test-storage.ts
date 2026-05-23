class NodeTestStorage implements Storage {
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

type InstalledNodeTestStorage = {
  localStorage: NodeTestStorage;
  restore: () => void;
};

function restoreDescriptor(target: object, key: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

export function installNodeTestStorage(): InstalledNodeTestStorage {
  const originalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Storage");
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const localStorage = new NodeTestStorage();
  const windowShim = {};

  Object.defineProperty(globalThis, "Storage", {
    configurable: true,
    writable: true,
    value: NodeTestStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: localStorage,
  });
  Object.defineProperty(windowShim, "localStorage", {
    configurable: true,
    get: () => localStorage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowShim,
  });

  return {
    localStorage,
    restore: () => {
      restoreDescriptor(globalThis, "Storage", originalStorageDescriptor);
      restoreDescriptor(globalThis, "localStorage", originalLocalStorageDescriptor);
      restoreDescriptor(globalThis, "window", originalWindowDescriptor);
    },
  };
}
