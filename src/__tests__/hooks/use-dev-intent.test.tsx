import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runRuntimeDevScenarioMock } = vi.hoisted(() => ({
  runRuntimeDevScenarioMock: vi.fn(),
}));

vi.mock("@/lib/dev-scenario-runtime", () => ({
  runRuntimeDevScenario: runRuntimeDevScenarioMock,
}));

import { useDevIntent } from "@/hooks/use-dev-intent";
import { useUiStore } from "@/stores/ui-store";

describe("useDevIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", true);
    runRuntimeDevScenarioMock.mockReset().mockResolvedValue(undefined);
    useUiStore.setState({ ...useUiStore.getInitialState(), toastMessage: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("defers startup scenario execution until after the effect commits", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("image-viewer-overlay");
  });

  it("runs the startup scenario only once under StrictMode", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("image-viewer-overlay");
  });

  it("allows a fresh remount to retry startup execution in the same session", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    const first = renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);

    first.unmount();

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(2);
  });

  it("does not run anything when no dev intent is configured", async () => {
    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
  });

  it("does not load the dev scenario runtime outside dev builds", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
  });

  it("shows a toast when startup scenario execution fails", async () => {
    vi.useRealTimers();
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    runRuntimeDevScenarioMock.mockRejectedValueOnce(new Error("boom"));

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("image-viewer-overlay");
      expect(useUiStore.getState().toastMessage).toEqual({
        message: 'Failed to run dev scenario "image-viewer-overlay": boom',
      });
    });
  });
});
