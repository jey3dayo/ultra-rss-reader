import { fireEvent, render, screen } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListItem } from "@/components/reader/article-list-item";
import { resolveArticleListItemPresentation as resolvePresentation } from "@/lib/articles/article-list-item-presentation";
import { useUiStore } from "@/stores/ui-store";

describe("ArticleListItem", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      focusedPane: "list",
    });
  });

  it("resolves article row presentation without duplicating title, feed, or recently read state", () => {
    expect(
      resolvePresentation({
        title: "Episode 150",
        summary: "<p>Episode 150</p>",
        thumbnail: "https://example.com/image.jpg",
        feedName: "Episode 150",
        viewedAtLabel: "Read 10:30",
        isRead: false,
        isStarred: true,
        isRecentlyRead: true,
        textPreview: "true",
        imagePreviews: "medium",
        unreadSuffix: "(unread)",
        starredSuffix: "(starred)",
      }),
    ).toEqual({
      ariaLabel: "Episode 150 (starred)",
      isRead: true,
      isUnread: false,
      metaLabel: "Read 10:30",
      normalizedFeedName: "Episode 150",
      normalizedSummary: "Episode 150",
      normalizedThumbnail: "https://example.com/image.jpg",
      normalizedTitle: "Episode 150",
      showFeedName: false,
      showSecondaryRow: true,
      showSummary: false,
      showThumbnail: true,
    });
  });

  it("resolves article row meta, summary, and thumbnail presentation from independent row fields", () => {
    expect(
      resolvePresentation({
        title: "First Article",
        summary: "<p>A hello world article</p>",
        thumbnail: null,
        feedName: "Tech Blog",
        viewedAtLabel: "Read yesterday",
        isRead: false,
        isStarred: false,
        isRecentlyRead: false,
        textPreview: "true",
        imagePreviews: "large",
        unreadSuffix: "(unread)",
        starredSuffix: "(starred)",
      }),
    ).toEqual({
      ariaLabel: "First Article (unread)",
      isRead: false,
      isUnread: true,
      metaLabel: "Tech Blog · Read yesterday",
      normalizedFeedName: "Tech Blog",
      normalizedSummary: "A hello world article",
      normalizedThumbnail: "",
      normalizedTitle: "First Article",
      showFeedName: true,
      showSecondaryRow: true,
      showSummary: true,
      showThumbnail: false,
    });
  });

  it("treats whitespace-only thumbnails as absent", () => {
    expect(
      resolvePresentation({
        title: "First Article",
        summary: "A hello world article",
        thumbnail: "   ",
        feedName: "Tech Blog",
        viewedAtLabel: null,
        isRead: false,
        isStarred: false,
        isRecentlyRead: false,
        textPreview: "true",
        imagePreviews: "medium",
        unreadSuffix: "(unread)",
        starredSuffix: "(starred)",
      }),
    ).toMatchObject({
      normalizedThumbnail: "",
      showSecondaryRow: true,
      showSummary: true,
      showThumbnail: false,
    });
  });

  it("rejects non-https and credentialed thumbnails at the row presentation boundary", () => {
    for (const thumbnail of [
      "http://example.com/image.jpg",
      "data:image/svg+xml,<svg></svg>",
      "https://user:pass@example.com/image.jpg",
      "not a url",
    ]) {
      expect(
        resolvePresentation({
          title: "First Article",
          summary: "A hello world article",
          thumbnail,
          feedName: "Tech Blog",
          viewedAtLabel: null,
          isRead: false,
          isStarred: false,
          isRecentlyRead: false,
          textPreview: "true",
          imagePreviews: "medium",
          unreadSuffix: "(unread)",
          starredSuffix: "(starred)",
        }),
      ).toMatchObject({
        normalizedThumbnail: "",
        showThumbnail: false,
      });
    }
  });

  it("renders accepted thumbnails without sending a referrer", () => {
    const { container } = render(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          thumbnail: " https://example.com/thumb.jpg ",
          is_read: false,
          is_starred: false,
        }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="medium"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/thumb.jpg");
    expect(container.querySelector("img")).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("keeps high-frequency row selection and hover out of shared transform motion", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const row = screen.getByRole("option", { name: /First Article/ });
    expect(row).toHaveClass("transition-[background-color,border-color,box-shadow,color,opacity]");
    expect(row).not.toHaveClass(
      "motion-static-hover-surface",
      "motion-contextual-surface",
      "motion-interactive-surface",
      "motion-content-swap",
      "motion-article-slide",
    );
  });

  it("normalizes title whitespace for row labels and display", () => {
    expect(
      resolvePresentation({
        title: "  First\n\tArticle  ",
        summary: "A hello world article",
        thumbnail: null,
        feedName: "Tech Blog",
        viewedAtLabel: null,
        isRead: false,
        isStarred: false,
        isRecentlyRead: false,
        textPreview: "true",
        imagePreviews: "off",
        unreadSuffix: "(unread)",
        starredSuffix: "(starred)",
      }),
    ).toMatchObject({
      ariaLabel: "First Article (unread)",
      normalizedTitle: "First Article",
      showSummary: true,
    });

    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], title: "  First\n\tArticle  ", is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("option", { name: "First Article (unread)" })).toHaveAttribute(
      "aria-label",
      "First Article (unread)",
    );
    expect(screen.getByRole("heading", { name: "First Article" })).toBeInTheDocument();
  });

  it("renders no thumbnail frame for whitespace-only thumbnails", () => {
    const { container } = render(
      <ArticleListItem
        article={{ ...sampleArticles[0], thumbnail: "\n\t  ", is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="medium"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("uses the title fallback for empty row labels and display", () => {
    expect(
      resolvePresentation({
        title: "   ",
        summary: null,
        thumbnail: null,
        feedName: undefined,
        viewedAtLabel: null,
        isRead: false,
        isStarred: false,
        isRecentlyRead: false,
        textPreview: "true",
        imagePreviews: "off",
        unreadSuffix: "(unread)",
        starredSuffix: "(starred)",
      }),
    ).toMatchObject({
      ariaLabel: "Untitled article (unread)",
      normalizedTitle: "Untitled article",
      showSummary: false,
    });

    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], title: "   ", is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("option", { name: "Untitled article (unread)" })).toHaveAttribute(
      "aria-label",
      "Untitled article (unread)",
    );
    expect(screen.getByRole("heading", { name: "Untitled article" })).toBeInTheDocument();
  });

  it("treats recently read retained articles as read in accessibility labels", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("option", { name: "First Article" })).toHaveAttribute("aria-label", "First Article");
  });

  it("renders article rows as focusable listbox options instead of buttons", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(option.tagName).toBe("DIV");
    expect(option).toHaveAttribute("tabindex", "0");
  });

  it("prevents accidental text selection while interacting with article rows", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("option", { name: "First Article (unread)" })).toHaveClass("select-none");
  });

  it("shows a star indicator on starred article rows", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: true, is_starred: true }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("article-star-indicator")).toHaveClass("size-3");
  });

  it("reserves the star slot even when the article is not starred", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: true, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("article-star-indicator")).toBeNull();
    expect(screen.getByTestId("article-star-slot")).toHaveClass("size-3", "shrink-0");
  });

  it("activates article rows with Enter and Space", () => {
    const onSelect = vi.fn();

    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={onSelect}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyDown(option, { key: " " });

    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("hides the summary when it exactly duplicates the feed name", () => {
    render(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          title: "Episode 150",
          summary: "紛争でしたら八田まで",
          is_read: false,
          is_starred: false,
        }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="紛争でしたら八田まで"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("紛争でしたら八田まで")).toBeInTheDocument();
    expect(screen.getAllByText("紛争でしたら八田まで")).toHaveLength(1);
  });

  it("hides duplicated secondary text when the feed name and summary both match the title", () => {
    render(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          title: "Episode 150",
          summary: "Episode 150",
          is_read: false,
          is_starred: false,
        }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Episode 150"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getAllByText("Episode 150")).toHaveLength(1);
  });

  it("uses the shared selected surface token for modern rows and softer hover for unselected rows", () => {
    const { rerender } = render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const selectedOption = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(selectedOption).toHaveClass("bg-surface-2/45");
    expect(selectedOption).not.toHaveClass("ring-1");
    expect(selectedOption).not.toHaveClass("ring-border-strong");
    expect(selectedOption).toHaveClass("after:bg-border-strong");
    expect(selectedOption).not.toHaveClass("shadow-[var(--sidebar-selection-shadow)]");

    rerender(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("option", { name: "First Article (unread)" })).toHaveClass("hover:bg-surface-1/72");
  });

  it("distinguishes active and inactive selected rows", () => {
    const { rerender } = render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isActivePane={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const inactiveOption = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(inactiveOption).toHaveAttribute("data-active-pane", "false");
    expect(inactiveOption).toHaveClass("bg-surface-2/28");
    expect(inactiveOption).toHaveClass("after:bg-border-strong/70");
    expect(inactiveOption).not.toHaveClass("shadow-[var(--sidebar-selection-shadow)]");

    rerender(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isActivePane
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
    );

    const activeOption = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(activeOption).toHaveAttribute("data-active-pane", "true");
    expect(activeOption).toHaveClass("bg-surface-2/45");
    expect(activeOption).toHaveClass("after:bg-border-strong");
  });

  it("keeps classic selection highlighted without using a loud primary wash", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="classic"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(option).toHaveClass("border-l-2", "border-primary", "bg-[image:var(--sidebar-selection-gradient)]");
  });

  it("keeps selected modern rows free from extra keyboard focus outlines", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(option).not.toHaveClass("focus-visible:ring-2");
    expect(option).not.toHaveClass("focus-visible:ring-ring/45");
    expect(option).not.toHaveClass("ring-1");
    expect(option).not.toHaveClass("hover:bg-surface-1/72");
    expect(option).not.toHaveClass("focus-visible:bg-surface-1/72");
    expect(option).not.toHaveClass("focus-visible:shadow-[inset_0_0_0_1px_var(--color-border-strong)]");
    expect(option).not.toHaveClass("shadow-[var(--sidebar-selection-shadow)]");
  });

  it("shows a quiet keyboard focus gradient on unselected modern rows", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName={undefined}
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(option).toHaveClass("focus-visible:bg-[image:var(--sidebar-focus-gradient)]");
    expect(option).not.toHaveClass("focus-visible:ring-2");
    expect(option).not.toHaveClass("focus-visible:outline-[var(--color-ring)]");
  });

  it("removes inline timestamps from article rows to keep the title column dominant", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: false, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const option = screen.getByRole("option", {
      name: "First Article (unread)",
    });
    expect(option.querySelector(".shrink-0.pt-0\\.5.text-xs")).toBeNull();
  });

  it("uses softened supporting copy for timestamps and secondary text", () => {
    render(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          summary: "A hello world article",
          is_read: false,
          is_starred: false,
        }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Tech Blog")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("A hello world article")).toHaveClass("text-foreground-soft");
  });

  it("keeps read titles stronger than supporting copy without falling back to muted-foreground", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], is_read: true, is_starred: false }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const title = screen.getByText("First Article");

    expect(title).not.toHaveClass("text-muted-foreground");
    expect(title).toHaveClass("text-foreground/78");
  });

  it("makes selected rows read stronger than unread rows through tone and typography", () => {
    const { rerender } = render(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          summary: "A hello world article",
          is_read: false,
          is_starred: false,
        }}
        isSelected
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("First Article")).toHaveClass("font-semibold", "text-foreground");
    expect(screen.getByRole("option", { name: "First Article (unread)" })).not.toHaveClass(
      "motion-static-hover-surface",
    );
    expect(screen.getByText("Tech Blog")).toHaveClass("text-foreground/72");
    expect(screen.getByText("A hello world article")).toHaveClass("text-foreground/68");

    rerender(
      <ArticleListItem
        article={{
          ...sampleArticles[0],
          summary: "A hello world article",
          is_read: false,
          is_starred: false,
        }}
        isSelected={false}
        isRecentlyRead={false}
        dimArchived="true"
        textPreview="true"
        imagePreviews="off"
        selectionStyle="modern"
        feedName="Tech Blog"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("First Article")).toHaveClass("font-medium", "text-foreground/92");
    expect(screen.getByText("Tech Blog")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("A hello world article")).toHaveClass("text-foreground-soft");
  });
});
