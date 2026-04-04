import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as devScenarios from "@/dev/scenarios";
import { useDevIntent } from "@/hooks/use-dev-intent";

describe("useDevIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("defers startup scenario execution until after the effect commits", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    const runDevScenarioSpy = vi.spyOn(devScenarios, "runDevScenario").mockResolvedValue(undefined);

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    expect(runDevScenarioSpy).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(runDevScenarioSpy).toHaveBeenCalledTimes(1);
    expect(runDevScenarioSpy).toHaveBeenCalledWith("image-viewer-overlay");
  });

  it("runs the startup scenario only once under StrictMode", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    const runDevScenarioSpy = vi.spyOn(devScenarios, "runDevScenario").mockResolvedValue(undefined);

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    await vi.runAllTimersAsync();

    expect(runDevScenarioSpy).toHaveBeenCalledTimes(1);
    expect(runDevScenarioSpy).toHaveBeenCalledWith("image-viewer-overlay");
  });

  it("allows a fresh remount to retry startup execution in the same session", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    const runDevScenarioSpy = vi.spyOn(devScenarios, "runDevScenario").mockResolvedValue(undefined);

    const first = renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();
    expect(runDevScenarioSpy).toHaveBeenCalledTimes(1);

    first.unmount();

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runDevScenarioSpy).toHaveBeenCalledTimes(2);
  });

  it("does not run anything when no dev intent is configured", async () => {
    const runDevScenarioSpy = vi.spyOn(devScenarios, "runDevScenario").mockResolvedValue(undefined);

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runDevScenarioSpy).not.toHaveBeenCalled();
  });
});
