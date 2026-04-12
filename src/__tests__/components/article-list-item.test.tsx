import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
