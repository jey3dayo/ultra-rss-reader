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

  it("uses softer surface selection for modern rows and softer hover for unselected rows", () => {
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
    expect(selectedOption).toHaveClass("bg-surface-1/72");

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
});
