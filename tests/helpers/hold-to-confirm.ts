import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MOTION_HOLD_CONFIRM_DURATION_MS } from "@/constants";

/**
 * Drives the destructive confirm dialog's press-and-hold gate.
 * Requires fake timers (`vi.useFakeTimers({ shouldAdvanceTime: true })`).
 */
export function holdToConfirm(button: HTMLElement) {
  fireEvent.pointerDown(button);
  act(() => {
    vi.advanceTimersByTime(MOTION_HOLD_CONFIRM_DURATION_MS);
  });
  fireEvent.pointerUp(button);
}

/**
 * Real-timer variant for suites that cannot switch to fake timers.
 * Slower, but keeps existing async assertions intact.
 */
export async function holdToConfirmRealTime(button: HTMLElement) {
  fireEvent.pointerDown(button);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MOTION_HOLD_CONFIRM_DURATION_MS + 50));
  });
  fireEvent.pointerUp(button);
}

/** Presses and releases before the hold completes, then lets any stale timer run. */
export function releaseHoldEarly(button: HTMLElement, elapsedMs = MOTION_HOLD_CONFIRM_DURATION_MS / 2) {
  fireEvent.pointerDown(button);
  act(() => {
    vi.advanceTimersByTime(elapsedMs);
  });
  fireEvent.pointerUp(button);
  act(() => {
    vi.advanceTimersByTime(MOTION_HOLD_CONFIRM_DURATION_MS);
  });
}
