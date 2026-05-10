import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countOldUnreadArticles } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { useUiStore } from "@/stores/ui-store";

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
});
