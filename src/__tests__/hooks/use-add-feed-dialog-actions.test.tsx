import { Result } from "@praha/byethrow";
import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalFeed } from "@/api/tauri-commands";
import { useAddFeedDialogActions } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions";
import i18n from "@/lib/i18n";

vi.mock("@/api/tauri-commands", () => ({
  addLocalFeed: vi.fn(),
  createFolder: vi.fn(),
  discoverFeeds: vi.fn(),
  updateFeedFolder: vi.fn(),
}));

const t = i18n.getFixedT("en", "reader");

describe("useAddFeedDialogActions", () => {
  beforeEach(() => {
    vi.mocked(addLocalFeed).mockReset();
  });

  it("clears loading and keeps the submit error when adding a feed fails", async () => {
    vi.mocked(addLocalFeed).mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "network down",
      }),
    );

    const dispatch = vi.fn();
    const showToast = vi.fn();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient();

    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url: "https://example.com/feed.xml",
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveredFeeds: [],
          selectedFeedUrl: null,
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: true,
          urlHint: null,
          urlHintTone: "muted",
          isSubmitDisabled: false,
          isDiscoverDisabled: false,
          discoveredFeedOptions: [],
        },
        trimmedUrl: "https://example.com/feed.xml",
        folderSelection: {
          selectedFolderId: null,
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient,
        onOpenChange,
        showToast,
        t,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "set-loading", loading: true });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-submit-error",
      error: t("failed_to_add_feed", { message: "network down" }),
    });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "set-loading", loading: false });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
