import "@testing-library/jest-dom/vitest";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusAndSelectInput, focusFirstInput, scheduleInputFocus } from "@/lib/dom/input-focus";

setupBrowserTestDom();

describe("input focus DOM helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("focuses and selects an input", () => {
    const input = document.createElement("input");
    input.value = "FreshRSS";
    document.body.append(input);

    expect(focusAndSelectInput(input)).toBe(true);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("returns false for a missing input", () => {
    expect(focusAndSelectInput(null)).toBe(false);
  });

  it("focuses the first available input ref", () => {
    const input = document.createElement("input");
    input.value = "Account";
    document.body.append(input);

    expect(focusFirstInput([{ current: null }, { current: input }])).toBe(true);
    expect(input).toHaveFocus();
  });

  it("schedules focus on an animation frame and can cancel it", () => {
    const input = document.createElement("input");
    document.body.append(input);
    let scheduledFrame: FrameRequestCallback = () => undefined;
    const requestAnimationFrameSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledFrame = callback;
      return 1;
    });
    const cancelAnimationFrameSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

    const cancelFocus = scheduleInputFocus({ current: input });
    cancelFocus();
    scheduledFrame(0);

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
    expect(input).not.toHaveFocus();
  });

  it("falls back to a timer when animation frames are unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const input = document.createElement("input");
    document.body.append(input);

    scheduleInputFocus({ current: input });
    vi.runOnlyPendingTimers();

    expect(input).toHaveFocus();
  });
});
