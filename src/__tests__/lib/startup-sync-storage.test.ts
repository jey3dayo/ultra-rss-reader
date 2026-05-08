import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";
import {
  getLastStartupSyncTriggeredAt,
  markStartupSyncTriggered,
  shouldThrottleStartupSync,
} from "@/lib/sync/startup-sync-storage";

describe("startup sync storage", () => {
  const key = STORAGE_KEYS.startupSyncLastTriggeredAt;

  beforeEach(() => {
    localStorage.clear();
  });

  it("reads valid timestamps and throttles inside the startup sync window", () => {
    localStorage.setItem(key, "1000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000);
    expect(shouldThrottleStartupSync(localStorage, 91_000)).toBe(false);
    expect(shouldThrottleStartupSync(localStorage, 90_999)).toBe(true);
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

  it("treats storage get failures as missing timestamps", () => {
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
  });

  it("treats storage remove failures during cleanup as a startup sync no-op", () => {
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
  });

  it("ignores storage set failures when marking startup sync", () => {
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
  });
});
