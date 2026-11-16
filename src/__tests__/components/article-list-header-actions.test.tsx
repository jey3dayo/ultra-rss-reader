import { renderHook } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleFeeds } from "@tests/helpers/fixtures";
import "@tests/helpers/i18n-setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ArticleListSelection,
  UseArticleListHeaderActionsParams,
} from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListHeaderActions } from "@/components/reader/hooks/article-list/use-article-list-header-actions";
import { useUiStore } from "@/stores/ui-store";

const { markFeedReadMutate, markFolderReadMutate } = vi.hoisted(() => ({
  markFeedReadMutate: vi.fn(),
  markFolderReadMutate: vi.fn(),
}));

vi.mock("@/hooks/use-articles", () => ({
  useMarkFeedRead: () => ({ mutate: markFeedReadMutate }),
  useMarkFolderRead: () => ({ mutate: markFolderReadMutate }),
}));

function renderHeaderActions(
  selection: ArticleListSelection,
  overrides: Partial<UseArticleListHeaderActionsParams> = {},
) {
  return renderHook(
    () =>
      useArticleListHeaderActions({
        selection,
        feeds: [],
        feedId: null,
        selectedFeed: undefined,
        filteredArticles: [],
        ...overrides,
      }),
    { wrapper: createWrapper() },
  );
}

describe("useArticleListHeaderActions mark all read", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it.each([
    ["all", { type: "all" }],
    ["smart view", { type: "smart", kind: "unread" }],
    ["tag", { type: "tag", tagId: "tag-1" }],
  ] as const satisfies readonly (readonly [string, ArticleListSelection])[])(
    "tells the user mark all read is unavailable in the %s view",
    (_label, selection) => {
      const { result } = renderHeaderActions(selection);

      result.current.handleMarkAllRead();

      expect(useUiStore.getState().toastMessage?.message).toBe(
        "Mark all as read isn't available in this view. Select a feed or folder.",
      );
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      expect(markFeedReadMutate).not.toHaveBeenCalled();
      expect(markFolderReadMutate).not.toHaveBeenCalled();
    },
  );

  it("does not show the unavailable toast for a feed selection", () => {
    const feed = { ...sampleFeeds[0], unread_count: 3 };
    const { result } = renderHeaderActions(
      { type: "feed", feedId: feed.id },
      { feeds: [feed], feedId: feed.id, selectedFeed: feed },
    );

    result.current.handleMarkAllRead();

    expect(useUiStore.getState().toastMessage).toBeNull();
  });
});
