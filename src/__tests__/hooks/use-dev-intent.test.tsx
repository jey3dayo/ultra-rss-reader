import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useDevIntent } from "@/hooks/use-dev-intent";
import { resetLegacyOverlayDevIntentDedup } from "@/lib/dev-intent";
import { setupTauriMocks, teardownTauriMocks } from "../../../tests/helpers/tauri-mocks";

const showToast = vi.fn();

vi.mock("@/lib/query-client", () => ({
  queryClient: {
    setQueryData: vi.fn(),
  },
}));

vi.mock("@/stores/ui-store", () => ({
  useUiStore: {
    getState: () => ({
      showToast,
      selectAccount: vi.fn(),
      selectFeed: vi.fn(),
      setViewMode: vi.fn(),
      selectArticle: vi.fn(),
      openBrowser: vi.fn(),
    }),
  },
}));

describe("useDevIntent", () => {
  beforeEach(() => {
    showToast.mockReset();
    vi.stubEnv("DEV", true);
    resetLegacyOverlayDevIntentDedup();
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [];
      }

      return undefined;
    });
  });

  it("enters the legacy overlay hydration path for the overlay intent", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    const listAccountsSpy = vi.spyOn(tauriCommands, "listAccounts");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(listAccountsSpy).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith("Dev intent could not find any accounts.");
    });
  });

  it("shows a visible signal for supported but not yet implemented dev intents", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "open-add-feed-dialog");
    const listAccountsSpy = vi.spyOn(tauriCommands, "listAccounts");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(listAccountsSpy).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Dev scenario "open-add-feed-dialog" is not implemented yet.');
    });
  });

  it("runs the legacy overlay hydration path only once across remounts", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");
    const listAccountsSpy = vi.spyOn(tauriCommands, "listAccounts");

    const first = renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(listAccountsSpy).toHaveBeenCalledTimes(1);
    });

    first.unmount();

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(listAccountsSpy).toHaveBeenCalledTimes(1);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetLegacyOverlayDevIntentDedup();
    teardownTauriMocks();
  });
});
