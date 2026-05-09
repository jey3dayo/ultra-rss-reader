import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  resolveSidebarVisibilityFallback,
  useSidebarVisibilityFallback,
} from "@/components/reader/hooks/sidebar/use-sidebar-visibility-fallback";
import type { SidebarVisibilityFallbackParams } from "@/components/reader/sidebar-feed-section.types";

const tag = { id: "tag-1", name: "Important", color: "#ff0000" };

function createParams(overrides: Partial<SidebarVisibilityFallbackParams> = {}): SidebarVisibilityFallbackParams {
  return {
    firstFeedId: "feed-1",
    selection: { type: "all" },
    tags: [tag],
    viewMode: "all",
    showSidebarUnread: true,
    showSidebarStarred: true,
    showSidebarRecentArticles: true,
    showSidebarTags: true,
    selectFeed: vi.fn(),
    selectAll: vi.fn(),
    selectSmartView: vi.fn(),
    setViewMode: vi.fn(),
    ...overrides,
  };
}

describe("useSidebarVisibilityFallback", () => {
  it.each([
    {
      name: "empty all selection",
      params: { firstFeedId: null, selection: { type: "all" } as const },
      expected: { type: "none" },
    },
    {
      name: "single hidden unread smart view with a feed",
      params: {
        firstFeedId: "feed-1",
        selection: { type: "smart", kind: "unread" } as const,
        showSidebarUnread: false,
      },
      expected: { type: "select-feed", feedId: "feed-1" },
    },
    {
      name: "hidden starred smart view with unread visible",
      params: {
        firstFeedId: "feed-1",
        selection: { type: "smart", kind: "starred" } as const,
        showSidebarStarred: false,
      },
      expected: { type: "select-smart-view", kind: "unread" },
    },
    {
      name: "hidden recent smart view without feeds",
      params: {
        firstFeedId: null,
        selection: { type: "smart", kind: "recent" } as const,
        showSidebarRecentArticles: false,
        showSidebarUnread: false,
      },
      expected: { type: "select-all" },
    },
    {
      name: "missing selected tag",
      params: {
        firstFeedId: "feed-1",
        selection: { type: "tag", tagId: "missing-tag" } as const,
        tags: [tag],
      },
      expected: { type: "select-smart-view", kind: "unread" },
    },
    {
      name: "hidden unread filter-only mode",
      params: {
        selection: { type: "feed", feedId: "feed-1" } as const,
        viewMode: "unread" as const,
        showSidebarUnread: false,
      },
      expected: { type: "set-view-mode", mode: "all" },
    },
  ])("resolves pure fallback decision for $name", ({ params, expected }) => {
    expect(resolveSidebarVisibilityFallback(createParams(params))).toEqual(expected);
  });

  it.each([
    {
      name: "starred",
      selection: { type: "smart", kind: "starred" } as const,
      visibility: { showSidebarStarred: false },
    },
    {
      name: "recent",
      selection: { type: "smart", kind: "recent" } as const,
      visibility: { showSidebarRecentArticles: false },
    },
    {
      name: "hidden tag section",
      selection: { type: "tag", tagId: "tag-1" } as const,
      visibility: { showSidebarTags: false },
    },
    {
      name: "missing selected tag",
      selection: { type: "tag", tagId: "missing-tag" } as const,
      visibility: {},
      tags: [tag],
    },
  ])("falls back from $name to unread before feed or all", ({ selection, visibility, tags }) => {
    const params = createParams({
      selection,
      tags,
      ...visibility,
    });

    renderHook(() => useSidebarVisibilityFallback(params));

    expect(params.selectSmartView).toHaveBeenCalledWith("unread");
    expect(params.selectFeed).not.toHaveBeenCalled();
    expect(params.selectAll).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "hidden starred",
      selection: { type: "smart", kind: "starred" } as const,
      visibility: { showSidebarStarred: false },
    },
    {
      name: "hidden recent",
      selection: { type: "smart", kind: "recent" } as const,
      visibility: { showSidebarRecentArticles: false },
    },
    {
      name: "hidden tag section",
      selection: { type: "tag", tagId: "tag-1" } as const,
      visibility: { showSidebarTags: false },
    },
    {
      name: "missing selected tag",
      selection: { type: "tag", tagId: "missing-tag" } as const,
      visibility: {},
      tags: [tag],
    },
  ])("falls back from $name to the first visible feed when unread is hidden", ({ selection, visibility, tags }) => {
    const params = createParams({
      selection,
      tags,
      showSidebarUnread: false,
      ...visibility,
    });

    renderHook(() => useSidebarVisibilityFallback(params));

    expect(params.selectFeed).toHaveBeenCalledWith("feed-1");
    expect(params.selectSmartView).not.toHaveBeenCalled();
    expect(params.selectAll).not.toHaveBeenCalled();
  });

  it("falls back to all when unread is hidden and no feed is available", () => {
    const params = createParams({
      firstFeedId: null,
      selection: { type: "smart", kind: "unread" },
      showSidebarUnread: false,
    });

    renderHook(() => useSidebarVisibilityFallback(params));

    expect(params.selectAll).toHaveBeenCalledTimes(1);
    expect(params.selectFeed).not.toHaveBeenCalled();
    expect(params.selectSmartView).not.toHaveBeenCalled();
  });

  it.each([
    { viewMode: "starred" as const, visibility: { showSidebarStarred: false } },
    { viewMode: "unread" as const, visibility: { showSidebarUnread: false } },
  ])("resets hidden $viewMode filter-only state to all", ({ viewMode, visibility }) => {
    const params = createParams({
      selection: { type: "feed", feedId: "feed-1" },
      viewMode,
      ...visibility,
    });

    renderHook(() => useSidebarVisibilityFallback(params));

    expect(params.setViewMode).toHaveBeenCalledWith("all");
    expect(params.selectFeed).not.toHaveBeenCalled();
    expect(params.selectSmartView).not.toHaveBeenCalled();
    expect(params.selectAll).not.toHaveBeenCalled();
  });
});
