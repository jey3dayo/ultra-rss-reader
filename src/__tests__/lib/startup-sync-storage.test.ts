import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";
import {
  getLastStartupSyncTriggeredAt,
  markStartupSyncTriggered,
  shouldThrottleStartupSync,
} from "@/lib/sync/startup-sync-storage";

describe("startup sync storage", () => {
  const key = STORAGE_KEYS.startupSyncLastTriggeredAt;

  it("reads valid timestamps and throttles inside the startup sync window", () => {
    localStorage.setItem(key, "1000");

    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBe(1_000);
    expect(shouldThrottleStartupSync(localStorage, 91_000)).toBe(false);
    expect(shouldThrottleStartupSync(localStorage, 90_999)).toBe(true);
  });

  it("removes invalid and future timestamps before allowing startup sync", () => {
    localStorage.setItem(key, "not-a-number");
    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();

    localStorage.setItem(key, "3000");
    expect(getLastStartupSyncTriggeredAt(localStorage, 2_000)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("stores the current timestamp without reading global time in tests", () => {
    markStartupSyncTriggered(localStorage, 12_345);

    expect(localStorage.getItem(key)).toBe("12345");
  });
});
