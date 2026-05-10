import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/constants/storage";
import {
  getLastStartupSyncTriggeredAt,
  markStartupSyncTriggered,
  resetStartupSyncStorageFailureWarnings,
  shouldThrottleStartupSync,
} from "@/lib/sync/startup-sync-storage";

describe("startup sync storage", () => {
  const key = STORAGE_KEYS.startupSyncLastTriggeredAt;
  const legacyKey = LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt;

  beforeEach(() => {
    resetStartupSyncStorageFailureWarnings();
    localStorage.clear();
  });

  afterEach(() => {
    resetStartupSyncStorageFailureWarnings();
    vi.restoreAllMocks();
  });

  it("reads valid timestamps and throttles inside the startup sync window", () => {
    localStorage.setItem(key, "1000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000);
    expect(shouldThrottleStartupSync(localStorage, 91_000)).toBe(false);
    expect(shouldThrottleStartupSync(localStorage, 90_999)).toBe(true);
  });

  it("migrates valid legacy startup sync timestamps to the prefixed key", () => {
    localStorage.setItem(legacyKey, "1000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000);
    expect(localStorage.getItem(key)).toBe("1000");
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 90_999)).toBe(true);
  });

  it("removes invalid legacy startup sync timestamps without writing the prefixed key", () => {
    localStorage.setItem(legacyKey, "not-a-number");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it("falls back to a valid legacy timestamp when the prefixed timestamp is invalid", () => {
    localStorage.setItem(key, "not-a-number");
    localStorage.setItem(legacyKey, "1000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000);
    expect(localStorage.getItem(key)).toBe("1000");
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it("treats a missing timestamp as not throttled", () => {
    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000)).toBe(false);
  });

  it("removes invalid number timestamps before allowing startup sync", () => {
    localStorage.setItem(key, "not-a-number");
    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000)).toBe(false);
  });

  it("removes negative startup sync timestamps before allowing startup sync", () => {
    localStorage.setItem(key, "-1");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000)).toBe(false);
  });

  it("removes negative infinity startup sync timestamps before allowing startup sync", () => {
    localStorage.setItem(key, "-Infinity");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000)).toBe(false);
  });

  it("accepts fractional startup sync timestamps inside the startup sync window", () => {
    localStorage.setItem(key, "1000.5");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000.5);
    expect(localStorage.getItem(key)).toBe("1000.5");
    expect(shouldThrottleStartupSync(localStorage, 90_999)).toBe(true);
  });

  it("removes future timestamps before allowing startup sync", () => {
    localStorage.setItem(key, "3000");
    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000)).toBe(false);
  });

  it("stores the current timestamp without reading global time in tests", () => {
    markStartupSyncTriggered(localStorage, 12_345);

    expect(localStorage.getItem(key)).toBe("12345");
  });

  it("stores and reads startup sync timestamps per account when account scope is provided", () => {
    markStartupSyncTriggered(localStorage, 12_345, "acc-1");

    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(`${key}:acc-1`)).toBe("12345");
    expect(shouldThrottleStartupSync(localStorage, 13_000, "acc-1")).toBe(true);
    expect(shouldThrottleStartupSync(localStorage, 13_000, "acc-2")).toBe(false);
  });

  it("removes tampered account-scoped timestamps before allowing startup sync", () => {
    localStorage.setItem(`${key}:acc-1`, "Infinity");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000, "acc-1")).toBeNull();
    expect(localStorage.getItem(`${key}:acc-1`)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000, "acc-1")).toBe(false);
  });

  it("removes future account-scoped timestamps before allowing startup sync after clock skew", () => {
    localStorage.setItem(`${key}:acc-1`, "3000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000, "acc-1")).toBeNull();
    expect(localStorage.getItem(`${key}:acc-1`)).toBeNull();
    expect(shouldThrottleStartupSync(localStorage, 2_000, "acc-1")).toBe(false);
  });

  it("treats storage get failures as missing timestamps", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => {
        throw new Error("get failed");
      },
      removeItem: () => {
        throw new Error("remove should not run");
      },
      setItem: () => {
        throw new Error("set should not run");
      },
    };

    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBeNull();
    expect(shouldThrottleStartupSync(throwingStorage, 2_000)).toBe(false);
    expect(warn).toHaveBeenCalledWith("Failed to read startup sync metadata from localStorage.", expect.any(Error));
  });

  it("warns once while repeated startup sync storage reads fail", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => {
        throw new Error("get failed");
      },
      removeItem: () => {
        throw new Error("remove should not run");
      },
      setItem: () => {
        throw new Error("set should not run");
      },
    };

    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBeNull();
    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBeNull();
    expect(warn).toHaveBeenCalledWith("Failed to read startup sync metadata from localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("treats storage remove failures during cleanup as a startup sync no-op", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => "not-a-number",
      removeItem: () => {
        throw new Error("remove failed");
      },
      setItem: () => {
        throw new Error("set should not run");
      },
    };

    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBeNull();
    expect(shouldThrottleStartupSync(throwingStorage, 2_000)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "Failed to remove invalid startup sync metadata from localStorage.",
      expect.any(Error),
    );
  });

  it("uses a valid legacy timestamp for throttling when migration write fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: (storageKey: string) => (storageKey === legacyKey ? "1000" : null),
      removeItem: vi.fn(),
      setItem: () => {
        throw new Error("set failed");
      },
    };

    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBe(1_000);
    expect(shouldThrottleStartupSync(throwingStorage, 90_999)).toBe(true);
    expect(throwingStorage.removeItem).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Failed to migrate startup sync metadata to localStorage.", expect.any(Error));
  });

  it("uses a valid legacy timestamp for throttling when migration cleanup fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setItem = vi.fn();
    const throwingStorage = {
      getItem: (storageKey: string) => (storageKey === legacyKey ? "1000" : null),
      removeItem: () => {
        throw new Error("remove failed");
      },
      setItem,
    };

    expect(getLastStartupSyncTriggeredAt(throwingStorage, 2_000)).toBe(1_000);
    expect(shouldThrottleStartupSync(throwingStorage, 90_999)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(key, "1000");
    expect(warn).toHaveBeenCalledWith(
      "Failed to remove legacy startup sync metadata from localStorage.",
      expect.any(Error),
    );
  });

  it("ignores storage set failures when marking startup sync", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => null,
      removeItem: () => {
        throw new Error("remove should not run");
      },
      setItem: () => {
        throw new Error("set failed");
      },
    };

    expect(() => markStartupSyncTriggered(throwingStorage, 12_345)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Failed to write startup sync metadata to localStorage.", expect.any(Error));
  });

  it("warns once while repeated startup sync storage writes fail", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => null,
      removeItem: () => {
        throw new Error("remove should not run");
      },
      setItem: () => {
        throw new Error("set failed");
      },
    };

    expect(() => markStartupSyncTriggered(throwingStorage, 12_345)).not.toThrow();
    expect(() => markStartupSyncTriggered(throwingStorage, 12_346)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Failed to write startup sync metadata to localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("can reset startup sync warning once cache between recovery checks", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingStorage = {
      getItem: () => null,
      removeItem: () => {
        throw new Error("remove should not run");
      },
      setItem: () => {
        throw new Error("set failed");
      },
    };

    markStartupSyncTriggered(throwingStorage, 12_345);
    markStartupSyncTriggered(throwingStorage, 12_346);
    resetStartupSyncStorageFailureWarnings();
    markStartupSyncTriggered(throwingStorage, 12_347);

    expect(warn).toHaveBeenCalledWith("Failed to write startup sync metadata to localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("treats localStorage getter failures as missing startup sync storage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("localStorage blocked", "SecurityError");
    });

    expect(getLastStartupSyncTriggeredAt(undefined, 2_000)).toBeNull();
    expect(shouldThrottleStartupSync(undefined, 2_000)).toBe(false);
    expect(() => markStartupSyncTriggered(undefined, 12_345)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Startup sync localStorage is unavailable.", expect.any(DOMException));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
