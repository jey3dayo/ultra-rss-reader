import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelPendingUpdate,
  resetPendingUpdateForTests,
  startPendingUpdate,
} from "@/hooks/updater/updater-pending-coordinator";
import { useUpdaterPendingStore } from "@/hooks/updater/updater-pending-store";
import { useUiStore } from "@/stores/ui-store";

describe("pending updater coordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({ syncProgress: { ...useUiStore.getState().syncProgress, active: true } });
  });
  afterEach(() => {
    resetPendingUpdateForTests();
    vi.useRealTimers();
  });
  it("preserves cancellation across toast changes and ignores later triggers", async () => {
    const run = vi.fn().mockResolvedValue({ type: "busy" });
    const onCancel = vi.fn();
    startPendingUpdate({ kind: "restart", version: "1", run, onCancel });
    await vi.advanceTimersByTimeAsync(0);
    useUiStore.getState().showToast("another notification");
    useUiStore.getState().clearToast();
    expect(useUpdaterPendingStore.getState().pending.status).toBe("waiting");
    cancelPendingUpdate();
    useUiStore.setState({ syncProgress: { ...useUiStore.getState().syncProgress, active: false } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("does not retry while sync is active and retries once on completion", async () => {
    const run = vi.fn().mockResolvedValueOnce({ type: "busy" }).mockResolvedValue({ type: "done" });
    startPendingUpdate({ kind: "restart", version: "1", run });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(1);
    useUiStore.setState({ syncProgress: { ...useUiStore.getState().syncProgress, active: false } });
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(useUpdaterPendingStore.getState().pending.status).toBe("idle");
  });
  it("ignores results after reset and locks cancellation while issuing a command", async () => {
    let finish: ((value: { type: "busy" }) => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<{ type: "busy" }>((resolve) => {
          finish = resolve;
        }),
    );
    const onCancel = vi.fn();
    startPendingUpdate({ kind: "restart", version: "1", run, onCancel });
    cancelPendingUpdate();
    expect(useUpdaterPendingStore.getState().pending.status).toBe("attempting");
    expect(onCancel).not.toHaveBeenCalled();
    resetPendingUpdateForTests();
    finish?.({ type: "busy" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(useUpdaterPendingStore.getState().pending.status).toBe("idle");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
