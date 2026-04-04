import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useDevIntent } from "@/hooks/use-dev-intent";
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

  it("does not enter the legacy overlay hydration path for other dev intents", async () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "open-add-feed-dialog");
    const listAccountsSpy = vi.spyOn(tauriCommands, "listAccounts");

    renderHook(() => useDevIntent(), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => {
      expect(listAccountsSpy).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    teardownTauriMocks();
  });
});
