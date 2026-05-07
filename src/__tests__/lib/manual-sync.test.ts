import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getManualSyncCooldownUntil,
  isManualSyncCoolingDown,
  resetManualSyncCooldownForTests,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
  triggerManualSyncWithCooldownResult,
} from "@/lib/manual-sync";

const { triggerSyncMock } = vi.hoisted(() => ({
  triggerSyncMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  triggerSync: triggerSyncMock,
}));

const syncResult = {
  synced: true,
  total: 1,
  succeeded: 1,
  failed: [],
  warnings: [],
};

describe("manual-sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00.000Z"));
    triggerSyncMock.mockReset();
    triggerSyncMock.mockResolvedValue(Result.succeed(syncResult));
    resetManualSyncCooldownForTests();
  });

  afterEach(() => {
    resetManualSyncCooldownForTests();
    vi.useRealTimers();
  });

  it("notifies subscribers when manual sync cooldown starts and ends", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeManualSyncCooldown(listener);

    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(isManualSyncCoolingDown()).toBe(true);
    expect(getManualSyncCooldownUntil()).toBe(Date.now() + 15_000);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15_000);

    expect(isManualSyncCoolingDown()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("skips triggerSync while manual sync is cooling down", async () => {
    const onCooldown = vi.fn();
    const onRequestStart = vi.fn();

    await triggerManualSyncWithCooldown({
      onCooldown,
      onRequestStart,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });
    await triggerManualSyncWithCooldown({
      onCooldown,
      onRequestStart,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(triggerSyncMock).toHaveBeenCalledTimes(1);
    expect(onRequestStart).toHaveBeenCalledTimes(1);
    expect(onCooldown).toHaveBeenCalledTimes(1);
  });

  it("returns a typed cooldown error from the Result API", async () => {
    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    const result = await triggerManualSyncWithCooldownResult();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "cooling_down" });
    expect(triggerSyncMock).toHaveBeenCalledTimes(1);
  });

  it("returns AppError from the Result API and preserves wrapper error callback", async () => {
    const appError = { type: "UserVisible", message: "sync failed" };
    const onError = vi.fn();
    triggerSyncMock.mockResolvedValue(Result.fail(appError));

    const result = await triggerManualSyncWithCooldownResult();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(appError);

    resetManualSyncCooldownForTests();
    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(appError);
  });

  it("stops notifying an unsubscribed cooldown listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeManualSyncCooldown(listener);

    unsubscribe();
    resetManualSyncCooldownForTests();

    expect(listener).not.toHaveBeenCalled();
  });
});
