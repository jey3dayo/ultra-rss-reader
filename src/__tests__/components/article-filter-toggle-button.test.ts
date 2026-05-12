import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ArticleFilterToggleButton } from "@/components/shared/article-filter-toggle-button";

describe("ArticleFilterToggleButton DOM contracts", () => {
  it("keeps unread icon behavior while using the size shorthand", () => {
    render(
      createElement(
        ArticleFilterToggleButton,
        {
          mode: "unread",
          pressed: true,
          value: "unread",
          "aria-label": "Unread",
        },
        "Unread",
      ),
    );

    const button = screen.getByRole("button", { name: "Unread" });
    const icon = button.querySelector('span[aria-hidden="true"]');

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("size-2.5");
    expect(icon).not.toHaveClass("h-2.5", "w-2.5");
  });
});
