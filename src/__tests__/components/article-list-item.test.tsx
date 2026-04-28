import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListItem } from "@/components/reader/article-list-item";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

describe("ArticleListItem", () => {
  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState(), focusedPane: "list" });
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });
    expect(option.tagName).toBe("DIV");
    expect(option).toHaveAttribute("tabindex", "0");
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

    expect(screen.getByTestId("article-star-indicator")).toHaveClass("h-3", "w-3");
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
    expect(screen.getByTestId("article-star-slot")).toHaveClass("h-3", "w-3", "shrink-0");
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });

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

    const selectedOption = screen.getByRole("option", { name: "First Article (unread)" });
    expect(selectedOption).toHaveClass(
      "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]",
    );
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

    const inactiveOption = screen.getByRole("option", { name: "First Article (unread)" });
    expect(inactiveOption).toHaveAttribute("data-active-pane", "false");
    expect(inactiveOption).toHaveClass(
      "bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)]",
    );
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

    const activeOption = screen.getByRole("option", { name: "First Article (unread)" });
    expect(activeOption).toHaveAttribute("data-active-pane", "true");
    expect(activeOption).toHaveClass(
      "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]",
    );
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });
    expect(option).toHaveClass(
      "border-l-2",
      "border-primary",
      "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]",
    );
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });
    expect(option).toHaveClass(
      "focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_58%,transparent)_100%)]",
    );
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

    const option = screen.getByRole("option", { name: "First Article (unread)" });
    expect(option.querySelector(".shrink-0.pt-0\\.5.text-xs")).toBeNull();
  });

  it("uses softened supporting copy for timestamps and secondary text", () => {
    render(
      <ArticleListItem
        article={{ ...sampleArticles[0], summary: "A hello world article", is_read: false, is_starred: false }}
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
        article={{ ...sampleArticles[0], summary: "A hello world article", is_read: false, is_starred: false }}
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
    expect(screen.getByText("Tech Blog")).toHaveClass("text-foreground/72");
    expect(screen.getByText("A hello world article")).toHaveClass("text-foreground/68");

    rerender(
      <ArticleListItem
        article={{ ...sampleArticles[0], summary: "A hello world article", is_read: false, is_starred: false }}
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
