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
  onSelectArticle = vi.fn(),
  onMarkAllRead = vi.fn(),
}: {
  emptyStateVariant?: "default" | "setup" | "hidden";
  emptyMessage?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  isLoading?: boolean;
  groups?: ComponentProps<typeof ArticleListBody>["groups"];
  onSelectArticle?: (articleId: string) => void;
  onMarkAllRead?: () => void;
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
      dimArchived="true"
      textPreview="true"
      imagePreviews="off"
      selectionStyle="modern"
      onSelectArticle={onSelectArticle}
      markAllReadLabel="Mark all as read"
      onMarkAllRead={onMarkAllRead}
    />,
    { wrapper: createWrapper() },
  );

  return { onSelectArticle, onMarkAllRead };
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

    fireEvent.contextMenu(row);
    expect(await screen.findByRole("menuitem", { name: "Mark as Read" })).toBeInTheDocument();
    expect(onSelectArticle).not.toHaveBeenCalled();

    await user.click(row);
    expect(onSelectArticle).toHaveBeenCalledWith(sampleArticles[0].id);
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
    expect(onSelectArticle).not.toHaveBeenCalled();

    fireEvent.click(markAllReadItem);

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSelectArticle).not.toHaveBeenCalled();
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
