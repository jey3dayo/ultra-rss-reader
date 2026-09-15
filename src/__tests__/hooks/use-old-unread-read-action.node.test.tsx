import { Result } from "@praha/byethrow";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countOldUnreadArticles } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

const DATABASE_MAINTENANCE_BUSY_MESSAGE =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";

type MarkOldUnreadReadVariables = {
  scopeKind: "account" | "folder" | "feed";
  targetId: string;
  olderThanDays: 7 | 30 | 90;
};

type MarkOldUnreadReadOptions = {
  onError?: (error: Error) => void;
};

const { markOldUnreadReadMutate } = vi.hoisted(() => ({
  markOldUnreadReadMutate: vi.fn(),
}));

vi.mock("@/api/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/tauri-commands")>();
  return {
    ...actual,
    countOldUnreadArticles: vi.fn(),
  };
});

vi.mock("@/hooks/use-articles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-articles")>();
  return {
    ...actual,
    useMarkOldUnreadRead: () => ({
      mutate: markOldUnreadReadMutate,
    }),
  };
});

const countOldUnreadArticlesMock = vi.mocked(countOldUnreadArticles);

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

vi.mock("react-i18next", () => ({
  // localize-app-error-message pulls in @/lib/i18n transitively, which registers this plugin.
  initReactI18next: {
    type: "3rdParty",
    init: () => undefined,
  },
  useTranslation: (namespace: string) => ({
    t: (key: string, options?: { count?: number }) => {
      if (namespace === "reader" && key === "no_old_unread_to_mark") {
        return "No old unread articles";
      }
      if (namespace === "reader" && key === "confirm_mark_old_unread_read") {
        return `confirm_mark_old_unread_read:${options?.count ?? ""}`;
      }
      if (namespace === "common" && key === "mark_as_read_action") {
        return "Mark as Read";
      }
      return key;
    },
  }),
}));

describe("useOldUnreadReadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markOldUnreadReadMutate.mockReset();
    countOldUnreadArticlesMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows a toast and does not mutate when old unread count rejects", async () => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock.mockRejectedValue(new Error("Failed to count old unread"));
    useUiStore.setState({
      showConfirm: vi.fn(),
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("feed", "feed-1"));

    await act(async () => {
      await result.current(30);
    });

    expect(showToast).toHaveBeenCalledWith("Failed to count old unread");
    expect(markOldUnreadReadMutate).not.toHaveBeenCalled();
  });

  it("shows a toast when markOldUnreadRead fails after count succeeds", async () => {
    const showToast = vi.fn();
    markOldUnreadReadMutate.mockImplementation(
      (_variables: MarkOldUnreadReadVariables, options?: MarkOldUnreadReadOptions) => {
        options?.onError?.(new Error("Failed to mark old unread"));
      },
    );
    countOldUnreadArticlesMock.mockResolvedValue(Result.succeed(3));
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("feed", "feed-1"));

    await act(async () => {
      await result.current(30);
    });

    expect(markOldUnreadReadMutate).toHaveBeenCalledWith(
      { scopeKind: "feed", targetId: "feed-1", olderThanDays: 30 },
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    );
    expect(showToast).toHaveBeenCalledWith("Failed to mark old unread");
  });

  it("rechecks old unread count after confirm and skips a stale zero-count mutation", async () => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock.mockResolvedValueOnce(Result.succeed(3)).mockResolvedValueOnce(Result.succeed(0));
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("feed", "feed-1"));

    await act(async () => {
      await result.current(30);
    });

    await waitFor(() => {
      expect(countOldUnreadArticlesMock).toHaveBeenCalledTimes(2);
    });
    expect(markOldUnreadReadMutate).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("No old unread articles");
  });

  it("rechecks the same scope target and period immediately before the confirmed mutation", async () => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock.mockResolvedValue(Result.succeed(2));
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("folder", "folder-1"));

    await act(async () => {
      await result.current(90);
    });

    await waitFor(() => {
      expect(countOldUnreadArticlesMock).toHaveBeenCalledTimes(2);
    });
    expect(countOldUnreadArticlesMock).toHaveBeenNthCalledWith(1, "folder", "folder-1", 90);
    expect(countOldUnreadArticlesMock).toHaveBeenNthCalledWith(2, "folder", "folder-1", 90);
    expect(markOldUnreadReadMutate).toHaveBeenCalledWith(
      { scopeKind: "folder", targetId: "folder-1", olderThanDays: 90 },
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not mutate when the post-confirm old unread recheck fails", async () => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock
      .mockResolvedValueOnce(Result.succeed(3))
      .mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "Folder no longer exists" }));
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("folder", "folder-1"));

    await act(async () => {
      await result.current(30);
    });

    await waitFor(() => {
      expect(countOldUnreadArticlesMock).toHaveBeenCalledTimes(2);
    });
    expect(markOldUnreadReadMutate).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Folder no longer exists");
  });

  it("shows a toast and does not mutate when old unread count returns Result.fail", async () => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock.mockResolvedValue(Result.fail({ type: "UserVisible", message: "Count failed" }));
    useUiStore.setState({
      showConfirm: vi.fn(),
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction("folder", "folder-1"));

    await act(async () => {
      await result.current(7);
    });

    expect(showToast).toHaveBeenCalledWith("Count failed");
    expect(markOldUnreadReadMutate).not.toHaveBeenCalled();
  });

  it.each([
    { scopeKind: "account" as const, targetId: "acc-1" },
    { scopeKind: "folder" as const, targetId: "folder-1" },
    { scopeKind: "feed" as const, targetId: "feed-1" },
  ])("passes $scopeKind scope to the confirmed old unread mutation", async ({ scopeKind, targetId }) => {
    const showToast = vi.fn();
    countOldUnreadArticlesMock.mockResolvedValue(Result.succeed(2));
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
      showToast,
    });

    const { result } = renderHook(() => useOldUnreadReadAction(scopeKind, targetId));

    await act(async () => {
      await result.current(90);
    });

    expect(markOldUnreadReadMutate).toHaveBeenCalledWith(
      { scopeKind, targetId, olderThanDays: 90 },
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  describe("database-maintenance-busy localization", () => {
    afterEach(async () => {
      await i18n.changeLanguage("en");
    });

    it("localizes a backend database-maintenance-busy failure from the old unread count", async () => {
      await i18n.changeLanguage("ja");
      const showToast = vi.fn();
      countOldUnreadArticlesMock.mockResolvedValue(
        Result.fail({ type: "UserVisible", message: DATABASE_MAINTENANCE_BUSY_MESSAGE }),
      );
      useUiStore.setState({
        showConfirm: vi.fn(),
        showToast,
      });

      const { result } = renderHook(() => useOldUnreadReadAction("feed", "feed-1"));

      await act(async () => {
        await result.current(30);
      });

      expect(showToast).toHaveBeenCalledWith(i18n.t("errors.database_maintenance_busy", { ns: "common" }));
      expect(showToast).not.toHaveBeenCalledWith(DATABASE_MAINTENANCE_BUSY_MESSAGE);
    });

    it("localizes a backend database-maintenance-busy failure from markOldUnreadRead", async () => {
      await i18n.changeLanguage("ja");
      const showToast = vi.fn();
      markOldUnreadReadMutate.mockImplementation(
        (_variables: MarkOldUnreadReadVariables, options?: MarkOldUnreadReadOptions) => {
          options?.onError?.({ message: DATABASE_MAINTENANCE_BUSY_MESSAGE } as Error);
        },
      );
      countOldUnreadArticlesMock.mockResolvedValue(Result.succeed(3));
      useUiStore.setState({
        showConfirm: (_message, onConfirm) => {
          onConfirm();
        },
        showToast,
      });

      const { result } = renderHook(() => useOldUnreadReadAction("feed", "feed-1"));

      await act(async () => {
        await result.current(30);
      });

      expect(showToast).toHaveBeenCalledWith(i18n.t("errors.database_maintenance_busy", { ns: "common" }));
      expect(showToast).not.toHaveBeenCalledWith(DATABASE_MAINTENANCE_BUSY_MESSAGE);
    });
  });
});
