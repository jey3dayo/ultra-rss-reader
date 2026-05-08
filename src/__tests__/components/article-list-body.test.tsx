import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListBody } from "@/components/reader/article-list-body";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

function renderArticleListBody({
  onSelectArticle = vi.fn(),
  onMarkAllRead = vi.fn(),
}: {
  onSelectArticle?: (articleId: string) => void;
  onMarkAllRead?: () => void;
} = {}) {
  render(
    <ArticleListBody
      listAriaLabel="Article list"
      listRef={{ current: null }}
      viewportRef={{ current: null }}
      onListKeyDownCapture={vi.fn()}
      isLoading={false}
      loadingMessage="Loading articles"
      emptyMessage="No articles"
      groups={[
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
      ]}
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
});
