import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runRuntimeDevScenarioMock, getDevRuntimeOptionsMock } = vi.hoisted(() => ({
  runRuntimeDevScenarioMock: vi.fn(),
  getDevRuntimeOptionsMock: vi.fn(),
}));

vi.mock("@/lib/dev-scenario-runtime", () => ({
  runRuntimeDevScenario: runRuntimeDevScenarioMock,
}));

vi.mock("@/api/tauri-commands", () => ({
  getDevRuntimeOptions: getDevRuntimeOptionsMock,
}));

vi.mock("@/lib/window-chrome", () => ({
  hasTauriRuntime: () => true,
}));

import { useDevIntent } from "@/hooks/use-dev-intent";
import { resetDevRuntimeOptionsCacheForTests } from "@/lib/dev-intent";
import { useUiStore } from "@/stores/ui-store";

describe("useDevIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", true);
    resetDevRuntimeOptionsCacheForTests();
    runRuntimeDevScenarioMock.mockReset().mockResolvedValue(undefined);
    getDevRuntimeOptionsMock.mockReset().mockResolvedValue(
      Result.succeed({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      }),
    );
    useUiStore.setState({ ...useUiStore.getInitialState(), toastMessage: null });
  });

  afterEach(() => {
    resetDevRuntimeOptionsCacheForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("defers startup scenario execution until after the effect commits", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup");
  });

  it("runs the subscriptions-index startup scenario when requested", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-subscriptions-index");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-subscriptions-index");
  });

  it("runs the settings-accounts-add startup scenario when requested", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-settings-accounts-add");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-settings-accounts-add");
  });

  it("runs the command-palette startup scenario when requested", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-command-palette");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-command-palette");
  });

  it("runs the shortcuts-help startup scenario when requested", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-shortcuts-help");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-shortcuts-help");
  });

  it("runs the startup scenario only once under StrictMode", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup");
  });

  it("allows a fresh remount to retry startup execution in the same session", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup");

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
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
  });

  it("shows a toast when startup scenario execution fails", async () => {
    vi.useRealTimers();
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup");
    runRuntimeDevScenarioMock.mockRejectedValueOnce(new Error("boom"));

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-feed-cleanup");
      expect(useUiStore.getState().toastMessage).toEqual({
        message: 'Failed to run dev scenario "open-feed-cleanup": boom',
      });
    });
  });

  it("ignores the removed legacy env name", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
  });

  it("falls back to runtime dev options when Vite env is unavailable", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-web-preview-url",
        dev_web_url: "https://example.com",
        dev_window_width: 640,
        dev_window_height: 820,
      }),
    );

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await vi.runAllTimersAsync();

    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(1);
    expect(runRuntimeDevScenarioMock).toHaveBeenCalledWith("open-web-preview-url");
  });
});
