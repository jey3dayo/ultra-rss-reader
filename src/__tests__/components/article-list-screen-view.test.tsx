import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListScreenView } from "@/components/reader/article-list-screen-view";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

describe("ArticleListScreenView", () => {
  it("renders the loading state inside the article list body", () => {
    render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading
        emptyMessage="No articles"
        loadingMessage="Loading articles"
        groups={[]}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        renderRow={({ content }) => content}
      />,
    );

    expect(screen.getByText("Loading articles")).toBeInTheDocument();
  });

  it("renders empty and populated article bodies", () => {
    const { rerender } = render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading={false}
        emptyMessage="No articles"
        loadingMessage="Loading articles"
        groups={[]}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        renderRow={({ content }) => content}
      />,
    );

    expect(screen.getByText("No articles")).toBeInTheDocument();

    rerender(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading={false}
        emptyMessage="No articles"
        loadingMessage="Loading articles"
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
        onSelectArticle={vi.fn()}
        renderRow={({ articleId, content }) => <div data-testid={`screen-row-${articleId}`}>{content}</div>}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /First Article/i })).toBeInTheDocument();
    expect(screen.getByTestId(`screen-row-${sampleArticles[0].id}`)).toBeInTheDocument();
  });

  it("renders empty-state actions outside the article listbox", () => {
    render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading={false}
        emptyMessage='No matches for "Nope"'
        emptyDescription="Try a different keyword or clear the current search."
        emptyActionLabel="Clear search"
        onEmptyAction={vi.fn()}
        loadingMessage="Loading articles"
        groups={[]}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        renderRow={({ content }) => content}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Article list" })).not.toBeInTheDocument();
  });
});
