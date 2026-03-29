import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListScreenView } from "@/components/reader/article-list-screen-view";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
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
      />,
      { wrapper: createWrapper() },
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
      />,
      { wrapper: createWrapper() },
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
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /First Article/i })).toBeInTheDocument();
  });
});
