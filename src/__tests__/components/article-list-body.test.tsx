import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListBody } from "@/components/reader/article-list-body";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

function renderArticleListBody({
  emptyStateVariant,
  emptyMessage = "No articles",
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  isLoading = false,
  groups = [
    {
      id: "today",
      label: "Today",
      showLabel: true,
      items: [
        {
          article: sampleArticles[0],
          feedName: "Tech Blog",
          isSelected: false,
          isRecentlyRead: false,
        },
      ],
    },
  ],
  contentMotionKey,
  onSelectArticle = vi.fn(),
  onMarkAllRead = vi.fn(),
  manageSelectedFeedLabel,
  onManageSelectedFeed,
}: {
  emptyStateVariant?: "default" | "setup" | "hidden";
  emptyMessage?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  isLoading?: boolean;
  groups?: ComponentProps<typeof ArticleListBody>["groups"];
  contentMotionKey?: ComponentProps<typeof ArticleListBody>["contentMotionKey"];
  onSelectArticle?: (articleId: string) => void;
  onMarkAllRead?: () => void;
  manageSelectedFeedLabel?: string;
  onManageSelectedFeed?: () => void;
} = {}) {
  render(
    <ArticleListBody
      listAriaLabel="Article list"
      listRef={{ current: null }}
      viewportRef={{ current: null }}
      onListKeyDownCapture={vi.fn()}
      isLoading={isLoading}
      loadingMessage="Loading articles"
      emptyStateVariant={emptyStateVariant}
      emptyMessage={emptyMessage}
      emptyDescription={emptyDescription}
      emptyActionLabel={emptyActionLabel}
      onEmptyAction={onEmptyAction}
      groups={groups}
      contentMotionKey={contentMotionKey}
      dimArchived="true"
      textPreview="true"
      imagePreviews="off"
      selectionStyle="modern"
      onSelectArticle={onSelectArticle}
      markAllReadLabel="Mark all as read"
      onMarkAllRead={onMarkAllRead}
      manageSelectedFeedLabel={manageSelectedFeedLabel}
      onManageSelectedFeed={onManageSelectedFeed}
    />,
    { wrapper: createWrapper() },
  );

  return { onSelectArticle, onMarkAllRead, onManageSelectedFeed };
}

describe("ArticleListBody", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("keeps row context menu ownership outside the listbox option selection click contract", async () => {
    const user = userEvent.setup();
    const { onSelectArticle } = renderArticleListBody();

    const listbox = screen.getByRole("listbox", { name: "Article list" });
    const row = screen.getByRole("option", { name: /First Article/ });

    expect(listbox).toContainElement(row);
    expect(screen.getByTestId("article-list-scroll-content")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("article-list-scroll-content")).toHaveAttribute("data-motion-phase", "entering");

    fireEvent.contextMenu(row);
    expect(await screen.findByRole("menuitem", { name: "Mark as Read" })).toBeInTheDocument();
    expect(onSelectArticle).not.toHaveBeenCalled();

    await user.click(row);
    expect(onSelectArticle).toHaveBeenCalledWith(sampleArticles[0].id);
  });

  it("keeps the list DOM stable for article updates inside the same motion scope", () => {
    const firstGroups = [
      {
        id: "today",
        label: "Today",
        showLabel: true,
        items: [
          {
            article: sampleArticles[0],
            feedName: "Tech Blog",
            isSelected: false,
            isRecentlyRead: false,
          },
        ],
      },
    ];
    const secondGroups = [
      {
        ...firstGroups[0],
        items: [
          {
            article: { ...sampleArticles[0], is_read: true },
            feedName: "Tech Blog",
            isSelected: false,
            isRecentlyRead: true,
          },
        ],
      },
    ];

    const { rerender } = render(
      <ArticleListBody
        listAriaLabel="Article list"
        listRef={{ current: null }}
        viewportRef={{ current: null }}
        onListKeyDownCapture={vi.fn()}
        isLoading={false}
        loadingMessage="Loading articles"
        emptyMessage="No articles"
        groups={firstGroups}
        contentMotionKey="feed:feed-1|unread|browse"
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        markAllReadLabel="Mark all as read"
        onMarkAllRead={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );
    const scrollContent = screen.getByTestId("article-list-scroll-content");

    rerender(
      <ArticleListBody
        listAriaLabel="Article list"
        listRef={{ current: null }}
        viewportRef={{ current: null }}
        onListKeyDownCapture={vi.fn()}
        isLoading={false}
        loadingMessage="Loading articles"
        emptyMessage="No articles"
        groups={secondGroups}
        contentMotionKey="feed:feed-1|unread|browse"
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        markAllReadLabel="Mark all as read"
        onMarkAllRead={vi.fn()}
      />,
    );

    expect(screen.getByTestId("article-list-scroll-content")).toBe(scrollContent);
  });

  it("copies the right-clicked article URL from the row context menu", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    const { onSelectArticle } = renderArticleListBody();

    fireEvent.contextMenu(screen.getByRole("option", { name: /First Article/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Copy link" }));

    expect(calls).toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: sampleArticles[0]?.url },
    });
    expect(onSelectArticle).not.toHaveBeenCalled();
  });

  it("keeps the list background context trigger separate from article row actions", async () => {
    const { onSelectArticle, onMarkAllRead } = renderArticleListBody();

    fireEvent.contextMenu(screen.getByTestId("article-list-scroll-content"));

    const markAllReadItem = await screen.findByRole("menuitem", { name: "Mark all as read" });
    expect(screen.queryByRole("menuitem", { name: "Mark as Read" })).not.toBeInTheDocument();
    expect(markAllReadItem.closest('[role="menu"]')?.parentElement).toHaveClass("z-50");
    expect(onSelectArticle).not.toHaveBeenCalled();

    fireEvent.click(markAllReadItem);

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSelectArticle).not.toHaveBeenCalled();
  });

  it("exposes feed management from the list background only when a selected feed action is available", async () => {
    const onManageSelectedFeed = vi.fn();

    renderArticleListBody({
      manageSelectedFeedLabel: "Edit feed…",
      onManageSelectedFeed,
    });

    fireEvent.contextMenu(screen.getByTestId("article-list-scroll-content"));

    const editFeedItem = await screen.findByRole("menuitem", { name: "Edit feed…" });
    expect(editFeedItem).toHaveAttribute("data-action-id", "article-list-feed-edit");

    fireEvent.click(editFeedItem);

    expect(onManageSelectedFeed).toHaveBeenCalledTimes(1);
  });

  it("does not expose mark all read from an empty list body context menu", () => {
    const { onMarkAllRead } = renderArticleListBody({ groups: [] });

    fireEvent.contextMenu(screen.getByText("No articles"));

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("does not expose mark all read when rendered groups have no article rows", () => {
    const { onMarkAllRead } = renderArticleListBody({
      groups: [{ id: "empty-group", label: "Today", showLabel: true, items: [] }],
    });

    fireEvent.contextMenu(screen.getByTestId("article-list-scroll-content"));

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("does not expose mark all read from a loading list body context menu", () => {
    const { onMarkAllRead } = renderArticleListBody({ isLoading: true, groups: [] });

    fireEvent.contextMenu(screen.getByText("Loading articles"));

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("passes search empty-state semantics through without creating an article listbox", async () => {
    const user = userEvent.setup();
    const onEmptyAction = vi.fn();

    renderArticleListBody({
      groups: [],
      emptyMessage: 'No matches for "rust"',
      emptyDescription: "Try a different keyword or clear the current search.",
      emptyActionLabel: "Clear search",
      onEmptyAction,
    });

    expect(screen.getByText('No matches for "rust"')).toBeInTheDocument();
    expect(screen.getByText("Try a different keyword or clear the current search.")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Article list" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onEmptyAction).toHaveBeenCalledTimes(1);
  });

  it("honors hidden setup empty-state semantics from the body props builder", () => {
    renderArticleListBody({
      groups: [],
      emptyStateVariant: "hidden",
      emptyMessage: "Add an account and your articles will appear here.",
      emptyDescription: "The list stays empty until the initial setup is complete.",
    });

    expect(screen.queryByText("Add an account and your articles will appear here.")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Article list" })).not.toBeInTheDocument();
  });
});
