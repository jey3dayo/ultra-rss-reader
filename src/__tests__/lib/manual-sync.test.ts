import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";
import {
  getManualSyncCooldownUntil,
  isManualSyncCoolingDown,
  type ManualSyncCooldownListenerErrorReport,
  notifyManualSyncCooldownListeners,
  resetManualSyncCooldownForTests,
  setManualSyncCooldownListenerErrorReporterForDiagnostics,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
  triggerManualSyncWithCooldownResult,
} from "@/lib/sync/manual-sync";

const { syncAccountMock, triggerSyncMock } = vi.hoisted(() => ({
  syncAccountMock: vi.fn(),
  triggerSyncMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  syncAccount: syncAccountMock,
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
    syncAccountMock.mockReset();
    syncAccountMock.mockResolvedValue(Result.succeed(syncResult));
    triggerSyncMock.mockReset();
    triggerSyncMock.mockResolvedValue(Result.succeed(syncResult));
    resetRuntimeDiagnosticOnceSuppressionForTests();
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

  it("continues notifying manual sync cooldown listeners and aggregates listener errors", () => {
    const firstError = new Error("first listener failed");
    const secondError = new Error("second listener failed");
    const firstListener = vi.fn(() => {
      throw firstError;
    });
    const secondListener = vi.fn();
    const thirdListener = vi.fn(() => {
      throw secondError;
    });
    const onListenerErrors = vi.fn();

    notifyManualSyncCooldownListeners([firstListener, secondListener, thirdListener], onListenerErrors);

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(thirdListener).toHaveBeenCalledTimes(1);
    expect(onListenerErrors).toHaveBeenCalledOnce();
    expect(onListenerErrors).toHaveBeenCalledWith([
      {
        subscriberId: "manual-sync-cooldown-listener:ad-hoc-1",
        error: firstError,
      },
      {
        subscriberId: "manual-sync-cooldown-listener:ad-hoc-3",
        error: secondError,
      },
    ] satisfies ManualSyncCooldownListenerErrorReport[]);
  });

  it("keeps timer cleanup and remaining cooldown subscribers isolated from listener failures", async () => {
    const listenerError = new Error("listener failed");
    const throwingListener = vi.fn(() => {
      throw listenerError;
    });
    const remainingListener = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    subscribeManualSyncCooldown(throwingListener);
    subscribeManualSyncCooldown(remainingListener);

    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });
    vi.advanceTimersByTime(15_000);

    expect(throwingListener).toHaveBeenCalledTimes(2);
    expect(remainingListener).toHaveBeenCalledTimes(2);
    expect(isManualSyncCoolingDown()).toBe(false);
    expect(getManualSyncCooldownUntil()).toBe(0);
    expect(consoleWarn).toHaveBeenCalledTimes(2);
    expect(consoleWarn).toHaveBeenCalledWith("Manual sync cooldown listeners failed:", [
      {
        subscriberId: "manual-sync-cooldown-listener:1",
        error: listenerError,
      },
    ]);

    consoleWarn.mockRestore();
  });

  it("routes cooldown listener aggregation through the diagnostics reporter", async () => {
    const listenerError = new Error("listener failed");
    const throwingListener = vi.fn(() => {
      throw listenerError;
    });
    const diagnosticsReporter = vi.fn();

    setManualSyncCooldownListenerErrorReporterForDiagnostics(diagnosticsReporter);
    subscribeManualSyncCooldown(throwingListener);

    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(diagnosticsReporter).toHaveBeenCalledOnce();
    expect(diagnosticsReporter).toHaveBeenCalledWith([
      {
        subscriberId: "manual-sync-cooldown-listener:1",
        error: listenerError,
      },
    ] satisfies ManualSyncCooldownListenerErrorReport[]);
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

  it("stops before triggerSync when request-start callback fails", async () => {
    const requestStartError = new Error("request-start callback failed");
    const onRequestStart = vi.fn(() => {
      throw requestStartError;
    });
    const onCooldown = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await expect(
      triggerManualSyncWithCooldown({
        onCooldown,
        onRequestStart,
        onSuccess,
        onError,
      }),
    ).rejects.toThrow(requestStartError);

    expect(onRequestStart).toHaveBeenCalledOnce();
    expect(triggerSyncMock).not.toHaveBeenCalled();
    expect(onCooldown).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(isManualSyncCoolingDown()).toBe(false);
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

  it("routes partial command results through success callback", async () => {
    const partialResult = {
      synced: true,
      total: 2,
      succeeded: 1,
      failed: [
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "sync failed",
        },
      ],
      warnings: [],
    };
    const onSuccess = vi.fn();
    const onError = vi.fn();
    triggerSyncMock.mockResolvedValue(Result.succeed(partialResult));

    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess,
      onError,
    });

    expect(onSuccess).toHaveBeenCalledWith(partialResult);
    expect(onError).not.toHaveBeenCalled();
  });

  it("uses account sync when a selected account id is provided", async () => {
    const result = await triggerManualSyncWithCooldownResult("acc-1");

    expect(Result.isSuccess(result)).toBe(true);
    expect(syncAccountMock).toHaveBeenCalledWith("acc-1");
    expect(triggerSyncMock).not.toHaveBeenCalled();
  });

  it("routes command errors through error callback only", async () => {
    const appError = { type: "UserVisible", message: "sync failed" };
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onCooldown = vi.fn();
    triggerSyncMock.mockResolvedValue(Result.fail(appError));

    await triggerManualSyncWithCooldown({
      onCooldown,
      onSuccess,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(appError);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onCooldown).not.toHaveBeenCalled();
  });

  it("does not start cooldown after user-visible triggerSync failure", async () => {
    const appError = { type: "UserVisible", message: "sync failed" };
    triggerSyncMock.mockResolvedValue(Result.fail(appError));

    const result = await triggerManualSyncWithCooldownResult();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(appError);
    expect(isManualSyncCoolingDown()).toBe(false);
    expect(getManualSyncCooldownUntil()).toBe(0);
  });

  it("starts cooldown after retryable triggerSync failure", async () => {
    const appError = { type: "Retryable", message: "sync failed" };
    triggerSyncMock.mockResolvedValue(Result.fail(appError));

    const result = await triggerManualSyncWithCooldownResult();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(appError);
    expect(isManualSyncCoolingDown()).toBe(true);
    expect(getManualSyncCooldownUntil()).toBe(Date.now() + 15_000);
  });

  it("does not start cooldown after triggerSync rejects", async () => {
    const syncError = new Error("sync command rejected");
    triggerSyncMock.mockRejectedValue(syncError);

    await expect(triggerManualSyncWithCooldownResult()).rejects.toThrow(syncError);

    expect(isManualSyncCoolingDown()).toBe(false);
    expect(getManualSyncCooldownUntil()).toBe(0);
  });

  it("uses the same cooldown deadline after triggerSync success and retryable failure", async () => {
    const syncStartedAt = Date.now();
    const successResult = await triggerManualSyncWithCooldownResult();

    expect(Result.isSuccess(successResult)).toBe(true);
    expect(getManualSyncCooldownUntil()).toBe(syncStartedAt + 15_000);

    resetManualSyncCooldownForTests();
    const failureStartedAt = syncStartedAt + 30_000;
    vi.setSystemTime(failureStartedAt);
    const appError = { type: "Retryable", message: "sync failed" };
    triggerSyncMock.mockResolvedValue(Result.fail(appError));

    const failureResult = await triggerManualSyncWithCooldownResult();

    expect(Result.isFailure(failureResult)).toBe(true);
    expect(Result.unwrapError(failureResult)).toEqual(appError);
    expect(getManualSyncCooldownUntil()).toBe(failureStartedAt + 15_000);
  });

  it("keeps cooldown duration stable when the system clock moves backward", async () => {
    const onCooldown = vi.fn();

    await triggerManualSyncWithCooldown({
      onCooldown,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    const wallClockCooldownUntil = getManualSyncCooldownUntil();

    vi.advanceTimersByTime(5_000);
    vi.setSystemTime(Date.now() - 60_000);

    expect(isManualSyncCoolingDown()).toBe(true);
    expect(getManualSyncCooldownUntil()).toBe(wallClockCooldownUntil);

    await triggerManualSyncWithCooldown({
      onCooldown,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    vi.advanceTimersByTime(9_999);

    expect(isManualSyncCoolingDown()).toBe(true);
    expect(onCooldown).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);

    expect(isManualSyncCoolingDown()).toBe(false);
    expect(triggerSyncMock).toHaveBeenCalledTimes(1);
  });

  it("keeps cooldown duration stable when the system clock moves forward", async () => {
    const onCooldown = vi.fn();

    await triggerManualSyncWithCooldown({
      onCooldown,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    const wallClockCooldownUntil = getManualSyncCooldownUntil();

    vi.advanceTimersByTime(5_000);
    vi.setSystemTime(Date.now() + 60_000);

    expect(isManualSyncCoolingDown()).toBe(true);
    expect(getManualSyncCooldownUntil()).toBe(wallClockCooldownUntil);

    await triggerManualSyncWithCooldown({
      onCooldown,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    vi.advanceTimersByTime(9_999);

    expect(isManualSyncCoolingDown()).toBe(true);
    expect(onCooldown).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);

    expect(isManualSyncCoolingDown()).toBe(false);
    expect(triggerSyncMock).toHaveBeenCalledTimes(1);
  });

  it("stops notifying an unsubscribed cooldown listener", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeManualSyncCooldown(listener);

    unsubscribe();
    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });
    vi.advanceTimersByTime(15_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it("clears cooldown listeners when resetting test state", async () => {
    const listener = vi.fn();
    subscribeManualSyncCooldown(listener);

    resetManualSyncCooldownForTests();
    await triggerManualSyncWithCooldown({
      onCooldown: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
