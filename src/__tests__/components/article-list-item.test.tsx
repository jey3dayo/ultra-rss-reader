import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListItem } from "@/components/reader/article-list-item";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

describe("ArticleListItem", () => {
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

  it("uses a distinct selected surface for modern rows and softer hover for unselected rows", () => {
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
    expect(selectedOption).toHaveClass("bg-surface-1");
    expect(selectedOption).not.toHaveClass("ring-1");
    expect(selectedOption).not.toHaveClass("ring-border-strong");
    expect(selectedOption).toHaveClass("after:bg-border-strong");

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
    expect(option).toHaveClass("border-l-2", "border-primary", "bg-surface-1/72");
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
    expect(option).toHaveClass("shadow-[0_18px_34px_-30px_rgba(38,37,30,0.48)]");
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
});
