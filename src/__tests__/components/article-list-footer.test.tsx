import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleListFooter } from "@/components/reader/article-list-footer";

describe("ArticleListFooter", () => {
  it("keeps the footer height stable and uses the shared unread tone", async () => {
    const user = userEvent.setup();
    const onSetViewMode = vi.fn();

    const { container } = render(
      <ArticleListFooter viewMode="unread" onSetViewMode={onSetViewMode} modes={["unread", "all", "starred"]} />,
    );

    const footer = container.firstElementChild;
    expect(footer).toHaveClass("flex", "h-10", "items-center");

    const unreadButton = screen.getByRole("button", { name: /unread/i });
    const unreadIcon = unreadButton.querySelector("span");

    expect(unreadIcon).not.toBeNull();
    expect(unreadIcon).toHaveClass("bg-[var(--tone-unread)]");
    expect(unreadIcon).toHaveClass("shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone-unread)_32%,transparent)]");

    await user.click(screen.getByRole("button", { name: /starred/i }));

    expect(onSetViewMode).toHaveBeenCalledWith("starred");
  });
});
