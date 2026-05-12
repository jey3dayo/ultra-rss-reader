import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it, vi } from "vitest";

setupBrowserTestDom();

const ENV_KEY = "ULTRA_RSS_TEST_SETUP_ISOLATION_SENTINEL";

describe("shared test setup isolation", () => {
  it("allows a test to mutate process env, storage, and fake timers", () => {
    process.env[ENV_KEY] = "dirty";
    localStorage.setItem("local-dirty", "1");
    sessionStorage.setItem("session-dirty", "1");
    vi.useFakeTimers();

    expect(process.env[ENV_KEY]).toBe("dirty");
    expect(localStorage.getItem("local-dirty")).toBe("1");
    expect(sessionStorage.getItem("session-dirty")).toBe("1");
    expect(() => vi.getTimerCount()).not.toThrow();
  });

  it("restores process env, storage, and real timers before the next test", () => {
    expect(process.env[ENV_KEY]).toBeUndefined();
    expect(localStorage.getItem("local-dirty")).toBeNull();
    expect(sessionStorage.getItem("session-dirty")).toBeNull();
    expect(() => vi.getTimerCount()).toThrow();
  });
});
