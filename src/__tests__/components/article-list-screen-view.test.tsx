import { render, screen } from "@testing-library/react";
import { sampleArticles } from "@tests/helpers/fixtures";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListScreenView } from "@/components/reader/article-list-screen-view";
import { readerPassiveCardPaddingClassName } from "@/components/reader/reader-passive-card";

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
    expect(loadingStatus).toHaveClass("rounded-md", "bg-surface-1/72", "text-foreground-soft");
    expect(loadingStatus).not.toHaveClass("px-2", "py-2", "border", "border-border/70");
  });

  it("keeps modern skeleton rows on the same content rail as loaded rows", () => {
    const viewportRef: RefObject<HTMLDivElement | null> = { current: null };
    const { rerender } = render(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        viewportRef={viewportRef}
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

    const skeleton = screen.getByTestId("article-list-skeleton");
    const skeletonRow = skeleton.querySelector(".space-y-1 > div");

    expect(skeletonRow).toHaveClass("px-4", "py-3");
    expect(skeleton.parentElement).not.toHaveClass("p-2");
    expect(skeleton).not.toHaveClass("px-2", "py-2", "border", "border-border/70");

    rerender(
      <ArticleListScreenView
        listAriaLabel="Article list"
        listRef={{ current: null }}
        viewportRef={viewportRef}
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
        renderRow={({ content }) => content}
      />,
    );

    expect(screen.getByRole("option", { name: /First Article/i })).toHaveClass("px-4", "py-3");
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
    expect(screen.getByText("No articles").closest('[data-testid="article-list-empty-state"]')).toHaveClass(
      "flex",
      "flex-col",
      "items-center",
      "text-center",
      "rounded-md",
      "border",
      "border-border/80",
      "bg-card/38",
      "shadow-none",
    );
    expect(screen.getByText("No articles").closest('[data-testid="article-list-empty-state"]')).toHaveClass(
      ...readerPassiveCardPaddingClassName.split(" "),
    );

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
    render(
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
    expect(screen.getByText("Add an account and your articles will appear here.").closest(".rounded-md")).toHaveClass(
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

    expect(contentLane).toHaveClass("pb-4");
    expect(contentLane).not.toHaveClass("pr-3");
    expect(screen.queryByTestId("article-list-scrollbar-lane")).not.toBeInTheDocument();
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
    // The dot stays mounted with the filled tone; read state hides it via opacity fade.
    expect(rowBefore.querySelector(".bg-\\[var\\(--tone-unread\\)\\]")).toHaveClass("opacity-0");

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
    expect(rowAfter.querySelector(".bg-\\[var\\(--tone-unread\\)\\]")).not.toHaveClass("opacity-0");
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
    expect(screen.queryByText("Queue")).not.toBeInTheDocument();
    expect(screen.getByText('No matches for "Nope"').closest('[data-testid="article-list-empty-state"]')).toHaveClass(
      "-translate-y-[5%]",
      "rounded-md",
      "border",
      "border-border/80",
      "bg-card/38",
      "shadow-none",
    );
    expect(screen.getByText('No matches for "Nope"').closest('[data-testid="article-list-empty-state"]')).toHaveClass(
      ...readerPassiveCardPaddingClassName.split(" "),
    );
    expect(screen.getByText("Try a different keyword or clear the current search.")).toHaveClass(
      "mt-1.5",
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
