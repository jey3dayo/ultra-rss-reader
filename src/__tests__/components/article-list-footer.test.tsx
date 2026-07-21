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
    expect(footer).toHaveClass("flex", "min-h-11", "items-center", "justify-center");
    expect(screen.getByRole("group")).toHaveClass("flex", "items-center", "gap-1");

    const unreadButton = screen.getByRole("button", { name: /unread/i });
    const unreadContent = unreadButton.querySelector('[data-filter-toggle-content="true"]');
    const unreadIcon = unreadContent?.querySelector("span");
    const starredButton = screen.getByRole("button", { name: /starred/i });
    const starredIcon = starredButton.querySelector("svg");
    const allButton = screen.getByRole("button", { name: /all/i });

    expect(unreadButton).toHaveClass("text-foreground-soft");
    expect(unreadButton).toHaveClass("hover:text-[var(--semantic-tone-unread-content-foreground)]");
    expect(unreadButton).toHaveClass("data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]");
    expect(unreadButton).toHaveClass("h-11", "rounded-md", "font-medium");
    expect(unreadButton).not.toHaveClass("sm:h-7");
    expect(unreadButton).toHaveClass("focus-visible:bg-transparent", "focus-visible:ring-2");
    expect(unreadButton).toHaveClass("focus-visible:ring-ring/45");
    expect(unreadContent).not.toBeNull();
    expect(unreadButton).toHaveClass(
      "[&_[data-filter-toggle-content]]:rounded-md",
      "[&_[data-filter-toggle-content]]:px-3.5",
      "[&_[data-filter-toggle-content]]:py-2",
    );
    expect(starredButton).toHaveClass("text-foreground-soft");
    expect(starredButton).toHaveClass("hover:text-[var(--semantic-tone-starred-content-foreground)]");
    expect(starredButton).toHaveClass("data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]");
    expect(starredButton).toHaveClass("h-11", "rounded-md", "font-medium");
    expect(allButton).toHaveClass("data-[pressed]:bg-transparent");
    expect(allButton).toHaveClass("bg-transparent", "shadow-none");
    expect(allButton).toHaveClass("data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-2/72");
    expect(allButton).toHaveClass("dark:data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-3/72");
    expect(allButton).toHaveClass("data-[pressed]:[&_[data-filter-toggle-content]]:shadow-active-inset-highlight");
    expect(allButton).not.toHaveClass("data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]");
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

  it("hides the footer controls when requested", () => {
    const onSetViewMode = vi.fn();

    const { container } = render(
      <ArticleListFooter
        viewMode="unread"
        hidden={true}
        onSetViewMode={onSetViewMode}
        modes={["unread", "all", "starred"]}
      />,
    );

    expect(container.firstElementChild).toBeNull();
    expect(screen.queryByRole("button", { name: /unread/i })).not.toBeInTheDocument();
  });
});
