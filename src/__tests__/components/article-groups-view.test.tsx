import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sampleArticles } from "@tests/helpers/fixtures";
import { describe, expect, it, vi } from "vitest";
import { ArticleGroupsView } from "@/components/reader/article-groups-view";
import * as articleListItemPresentation from "@/lib/articles/article-list-item-presentation";

describe("ArticleGroupsView", () => {
  it("does not rerender non-selected rows when the active pane changes", () => {
    const renderCounter = vi.spyOn(articleListItemPresentation, "resolveArticleListItemPresentation");
    const onSelectArticle = vi.fn();
    const groups = [
      {
        id: "article-list",
        label: "Articles",
        showLabel: false,
        items: [
          {
            article: sampleArticles[0],
            feedName: "Tech Blog",
            isSelected: true,
            isRecentlyRead: false,
          },
          {
            article: sampleArticles[1],
            feedName: "Tech Blog",
            isSelected: false,
            isRecentlyRead: false,
          },
          {
            article: sampleArticles[2],
            feedName: "News",
            isSelected: false,
            isRecentlyRead: false,
          },
        ],
      },
    ];
    const countRenders = (title: string) => renderCounter.mock.calls.filter(([input]) => input.title === title).length;

    try {
      const { rerender } = render(
        <ArticleGroupsView
          groups={groups}
          isActivePane
          dimArchived="true"
          textPreview="true"
          imagePreviews="off"
          selectionStyle="modern"
          onSelectArticle={onSelectArticle}
        />,
      );

      expect(countRenders("First Article")).toBe(1);
      expect(countRenders("Second Article")).toBe(1);
      expect(countRenders("Foldered FreshRSS Article")).toBe(1);

      rerender(
        <ArticleGroupsView
          groups={groups}
          isActivePane={false}
          dimArchived="true"
          textPreview="true"
          imagePreviews="off"
          selectionStyle="modern"
          onSelectArticle={onSelectArticle}
        />,
      );

      expect(countRenders("First Article")).toBe(2);
      expect(countRenders("Second Article")).toBe(1);
      expect(countRenders("Foldered FreshRSS Article")).toBe(1);
    } finally {
      renderCounter.mockRestore();
    }
  });

  it("renders group headers and article items, preserving selection state", async () => {
    const user = userEvent.setup();
    const onSelectArticle = vi.fn();

    render(
      <ArticleGroupsView
        groups={[
          {
            id: "tech-blog",
            label: "Tech Blog",
            showLabel: true,
            items: [
              {
                article: sampleArticles[0],
                feedName: "Tech Blog",
                isSelected: false,
                isRecentlyRead: false,
              },
              {
                article: sampleArticles[1],
                feedName: "Tech Blog",
                isSelected: true,
                isRecentlyRead: true,
              },
            ],
          },
        ]}
        isActivePane
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={onSelectArticle}
        renderRow={({ articleId, content }) => <div data-testid={`row-${articleId}`}>{content}</div>}
      />,
    );

    const headings = screen.getAllByText("Tech Blog");
    expect(headings.length).toBeGreaterThan(0);
    expect(headings[0]).toHaveClass("text-[11px]", "tracking-[0.12em]", "text-foreground-soft");
    expect(headings[0].parentElement).toHaveClass("sticky", "top-0", "z-10", "h-7");
    expect(headings[0].parentElement).not.toHaveClass(
      "bg-[color-mix(in_srgb,var(--background)_64%,var(--surface-2)_36%)]",
    );
    expect(headings[0].parentElement).not.toHaveClass("border-b");
    expect(headings[0]).not.toHaveClass("rounded-sm");
    expect(headings[0]).not.toHaveClass("bg-[color-mix(in_srgb,var(--background)_70%,var(--surface-2)_30%)]");
    expect(screen.getByRole("option", { name: /Second Article/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId(`row-${sampleArticles[0].id}`)).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /First Article/i }));

    expect(onSelectArticle).toHaveBeenCalledWith(sampleArticles[0].id);
  });

  it("omits the group heading when the group is configured without one", () => {
    render(
      <ArticleGroupsView
        groups={[
          {
            id: "ungrouped",
            label: "Unused",
            showLabel: false,
            items: [
              {
                article: sampleArticles[0],
                feedName: undefined,
                isSelected: false,
                isRecentlyRead: false,
              },
            ],
          },
        ]}
        isActivePane
        dimArchived="true"
        textPreview="false"
        imagePreviews="off"
        selectionStyle="classic"
        onSelectArticle={vi.fn()}
        renderRow={({ content }) => content}
      />,
    );

    expect(screen.queryByText("Unused")).not.toBeInTheDocument();
  });
});
