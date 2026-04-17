import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleListFooter } from "@/components/reader/article-list-footer";

describe("ArticleListFooter", () => {
  it("keeps the footer height stable and applies semantic tones only to the selected mode", async () => {
    const user = userEvent.setup();
    const onSetViewMode = vi.fn();

    const { container } = render(
      <ArticleListFooter viewMode="unread" onSetViewMode={onSetViewMode} modes={["unread", "all", "starred"]} />,
    );

    const footer = container.firstElementChild;
    expect(footer).toHaveClass("flex", "h-10", "items-center", "justify-center");
    expect(screen.getByRole("group")).toHaveClass("flex", "items-center", "gap-1");

    const unreadButton = screen.getByRole("button", { name: /unread/i });
    const unreadIcon = unreadButton.querySelector("span");
    const starredButton = screen.getByRole("button", { name: /starred/i });
    const starredIcon = starredButton.querySelector("svg");
    const allButton = screen.getByRole("button", { name: /all/i });

    expect(unreadButton).toHaveClass("text-foreground-soft");
    expect(unreadButton).toHaveClass("hover:text-[var(--semantic-tone-unread-content-foreground)]");
    expect(starredButton).toHaveClass("text-foreground-soft");
    expect(starredButton).toHaveClass("hover:text-[var(--semantic-tone-starred-content-foreground)]");
    expect(allButton).toHaveClass("data-[pressed]:bg-surface-4");
    expect(allButton).toHaveClass("data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]");
    expect(unreadIcon).not.toBeNull();
    expect(unreadIcon).toHaveClass("bg-[var(--tone-unread)]");
    expect(unreadIcon).toHaveClass("text-[var(--tone-unread)]");
    expect(unreadIcon).toHaveClass("border-[var(--tone-unread-border)]");

    expect(starredIcon).not.toBeNull();
    expect(starredIcon).not.toHaveClass("text-[var(--tone-starred)]");
    expect(starredIcon).not.toHaveClass("fill-[var(--tone-starred)]");

    await user.click(screen.getByRole("button", { name: /starred/i }));

    expect(onSetViewMode).toHaveBeenCalledWith("starred");
  });
});
