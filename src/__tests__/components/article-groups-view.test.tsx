import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleGroupsView } from "@/components/reader/article-groups-view";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

describe("ArticleGroupsView", () => {
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
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        onSelectArticle={onSelectArticle}
        renderRow={({ articleId, content }) => <div data-testid={`row-${articleId}`}>{content}</div>}
      />,
    );

    expect(screen.getAllByText("Tech Blog").length).toBeGreaterThan(0);
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
