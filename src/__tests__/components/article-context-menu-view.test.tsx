import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleContextMenuView } from "@/components/reader/article-context-menu-view";

describe("ArticleContextMenuView", () => {
  it("renders article actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onOpenInBrowser = vi.fn();
    const onCopyFeedUrl = vi.fn();

    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          openInBrowserLabel="Open in Browser"
          copyFeedUrlLabel="Copy Feed URL"
          onToggleRead={onToggleRead}
          onToggleStar={onToggleStar}
          onOpenInBrowser={onOpenInBrowser}
          onCopyFeedUrl={onCopyFeedUrl}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark as Read" }));
    await user.click(screen.getByRole("menuitem", { name: "Star" }));
    await user.click(screen.getByRole("menuitem", { name: "Open in Browser" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy Feed URL" }));

    expect(screen.getByRole("menuitem", { name: "Mark as Read" })).toHaveAttribute(
      "data-action-id",
      "article-toggle-read",
    );
    expect(screen.getByRole("menuitem", { name: "Star" })).toHaveAttribute("data-action-id", "article-toggle-star");
    expect(screen.getByRole("menuitem", { name: "Open in Browser" })).toHaveAttribute(
      "data-action-id",
      "article-open-browser",
    );
    expect(screen.getByRole("menuitem", { name: "Copy Feed URL" })).toHaveAttribute(
      "data-action-id",
      "article-copy-feed-url",
    );
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    expect(onCopyFeedUrl).toHaveBeenCalledTimes(1);
  });

  it("omits open in browser when no URL action is available", () => {
    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          openInBrowserLabel="Open in Browser"
          onToggleRead={vi.fn()}
          onToggleStar={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Mark as Read" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Star" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Open in Browser" })).toBeNull();
  });

  it("omits copy feed URL when no feed URL action is available", () => {
    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          copyFeedUrlLabel="Copy Feed URL"
          onToggleRead={vi.fn()}
          onToggleStar={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Copy Feed URL" })).toBeNull();
  });
});
