import { vi } from "vitest";

export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

export async function flushMacrotask(): Promise<void> {
  if (isUsingFakeTimers()) {
    await vi.advanceTimersByTimeAsync(0);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function flushRaf(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    throw new Error("requestAnimationFrame is unavailable in this test environment");
  }

  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

export async function flushMicrotasksAndRealTimer(): Promise<void> {
  await flushMicrotasks();
  await flushMacrotask();
}

function isUsingFakeTimers(): boolean {
  try {
    vi.getTimerCount();
    return true;
  } catch {
    return false;
  }
}
