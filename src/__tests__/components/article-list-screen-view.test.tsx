import { render, screen } from "@testing-library/react";
import { sampleArticles } from "@tests/helpers/fixtures";
import { describe, expect, it, vi } from "vitest";
import { ArticleListScreenView } from "@/components/reader/article-list-screen-view";
import { readerPassiveCardClassName } from "@/components/reader/reader-passive-card";

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

    const loadingStatus = screen.getByRole("status");

    expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    expect(loadingStatus).toHaveTextContent("Loading articles");
    expect(loadingStatus).toHaveClass(
      "rounded-md",
      "border",
      "border-border/70",
      "bg-surface-1/72",
      "text-foreground-soft",
    );
  });

  it("renders empty and populated article bodies", () => {
    const { container, rerender } = render(
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
    expect(container.querySelector(".rounded-3xl")).toHaveClass(...readerPassiveCardClassName.split(" "));

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
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /First Article/i })).toBeInTheDocument();
    expect(screen.getByTestId(`screen-row-${sampleArticles[0].id}`)).toBeInTheDocument();
  });

  it("renders a quieter setup placeholder when the list is waiting for initial setup", () => {
    const { container } = render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading={false}
        emptyStateVariant="setup"
        emptyMessage="Add an account and your articles will appear here."
        emptyDescription="The list stays empty until the initial setup is complete."
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

    expect(screen.getByText("Add an account and your articles will appear here.")).toBeInTheDocument();
    expect(screen.queryByText("Queue")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-2xl")).toHaveClass(
      "border-border/65",
      "bg-surface-1/48",
      "dark:border-border/75",
      "dark:shadow-none",
    );
  });

  it("renders no middle-pane message when onboarding is handled elsewhere", () => {
    render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        isLoading={false}
        emptyStateVariant="hidden"
        emptyMessage="Unused"
        emptyDescription="Unused"
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

    expect(screen.queryByText("Unused")).not.toBeInTheDocument();
    expect(screen.queryByText("Queue")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Article list" })).not.toBeInTheDocument();
  });

  it("keeps article rows inside a dedicated scroll content lane so the scrollbar does not overlap selections", () => {
    render(
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
                isSelected: true,
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
        renderRow={({ content }) => content}
      />,
    );

    const contentLane = screen.getByTestId("article-list-scroll-content").closest('[data-slot="scroll-area-content"]');
    const scrollbarLane = screen.getByTestId("article-list-scrollbar-lane");

    expect(contentLane).toHaveClass("pr-3", "pb-4");
    expect(scrollbarLane).toHaveClass(
      "w-3",
      "border-l",
      "border-[color-mix(in_srgb,var(--color-border)_34%,transparent)]",
      "bg-[color-mix(in_srgb,var(--background)_64%,var(--surface-2)_36%)]",
    );
  });

  it("restores the unread marker when a retained row is no longer recently read", () => {
    const article = {
      ...sampleArticles[0],
      id: "art-retained-unread",
      title: "Retained unread article",
      is_read: false,
      is_starred: true,
    };

    const { rerender } = render(
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
                article,
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
        onSelectArticle={vi.fn()}
        renderRow={({ articleId, content }) => <div data-testid={`screen-row-${articleId}`}>{content}</div>}
      />,
    );

    const rowBefore = screen.getByRole("option", {
      name: "Retained unread article (starred)",
    });
    expect(rowBefore.querySelector(".bg-\\[var\\(--tone-unread\\)\\]")).toBeNull();

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
                article,
                feedName: "Tech Blog",
                isSelected: true,
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

    const rowAfter = screen.getByRole("option", {
      name: "Retained unread article (unread) (starred)",
    });
    expect(rowAfter.querySelector(".bg-\\[var\\(--tone-unread\\)\\]")).not.toBeNull();
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

    expect(screen.getByRole("button", { name: "Clear search" })).toHaveAttribute("data-reader-passive-action", "true");
    expect(screen.getByText("Queue")).toBeInTheDocument();
    expect(screen.getByText('No matches for "Nope"').closest(".rounded-3xl")).toHaveClass("-translate-y-[5%]");
    expect(screen.getByText('No matches for "Nope"')).toHaveClass("min-h-11");
    expect(screen.getByText("Try a different keyword or clear the current search.")).toHaveClass(
      "mt-3",
      "min-h-12",
      "text-sm",
      "leading-6",
      "text-foreground-soft",
    );
    expect(screen.queryByRole("listbox", { name: "Article list" })).not.toBeInTheDocument();
  });

  it("allows long article titles to shrink inside the row text lane", () => {
    render(
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
                article: {
                  ...sampleArticles[0],
                  id: "long-title",
                  title: "https://example.com/very/long/unbroken/article/title/that/should/not/push/the/list/wider",
                  thumbnail: "https://example.com/thumb.jpg",
                  is_starred: true,
                },
                feedName: "Tech Blog",
                isSelected: true,
                isRecentlyRead: false,
              },
            ],
          },
        ]}
        dimArchived="true"
        textPreview="true"
        imagePreviews="large"
        selectionStyle="modern"
        onSelectArticle={vi.fn()}
        renderRow={({ content }) => content}
      />,
    );

    const heading = screen.getByRole("heading", {
      name: "https://example.com/very/long/unbroken/article/title/that/should/not/push/the/list/wider",
    });
    const titleLane = heading.parentElement;
    const rowLane = titleLane?.parentElement;

    expect(titleLane).toHaveClass("min-w-0", "flex-1");
    expect(rowLane).toHaveClass("min-w-0", "flex-1");
    expect(heading).toHaveClass("line-clamp-2", "flex-1");
  });
});
