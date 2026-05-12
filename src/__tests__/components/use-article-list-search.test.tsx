import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListHeaderSearch } from "@/components/reader/article-list-header-search";

describe("useArticleListSearch", () => {
  it("exposes literal-search syntax copy on the search input", () => {
    const inputRef = createRef<HTMLInputElement>();

    render(
      <ArticleListHeaderSearch
        searchInputRef={inputRef}
        searchQuery=""
        searchArticlesLabel="Search articles"
        searchArticlesPlaceholder="Search literal words..."
        searchArticlesDescription="Words are searched literally in titles and article text. Quotes, OR, NEAR, and * are not search operators."
        onSearchQueryChange={vi.fn()}
        onCloseSearch={vi.fn()}
        onRestoreSearchToggleFocus={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Search articles" });
    expect(input).toHaveAttribute("placeholder", "Search literal words...");
    expect(input).toHaveAttribute(
      "aria-description",
      "Words are searched literally in titles and article text. Quotes, OR, NEAR, and * are not search operators.",
    );
  });
});
