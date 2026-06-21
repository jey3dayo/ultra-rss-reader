import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleContextMenuView } from "@/components/reader/article-context-menu-view";
import { ContextMenu } from "@/design-system";

describe("ArticleContextMenuView", () => {
  it("renders article actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onOpenInBrowser = vi.fn();
    const onCopyArticleLink = vi.fn();

    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          openInBrowserLabel="Open in Browser"
          copyArticleLinkLabel="Copy link"
          onToggleRead={onToggleRead}
          onToggleStar={onToggleStar}
          onOpenInBrowser={onOpenInBrowser}
          onCopyArticleLink={onCopyArticleLink}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark as Read" }));
    await user.click(screen.getByRole("menuitem", { name: "Star" }));
    await user.click(screen.getByRole("menuitem", { name: "Open in Browser" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy link" }));

    expect(screen.getByRole("menuitem", { name: "Mark as Read" })).toHaveAttribute(
      "data-action-id",
      "article-toggle-read",
    );
    expect(screen.getByRole("menuitem", { name: "Star" })).toHaveAttribute("data-action-id", "article-toggle-star");
    expect(screen.getByRole("menuitem", { name: "Open in Browser" })).toHaveAttribute(
      "data-action-id",
      "article-open-browser",
    );
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toHaveAttribute("data-action-id", "article-copy-link");
    expect(screen.getByRole("menu").parentElement).toHaveClass("z-50");
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    expect(onCopyArticleLink).toHaveBeenCalledTimes(1);
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

  it("omits copy link when no article URL action is available", () => {
    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          copyArticleLinkLabel="Copy link"
          onToggleRead={vi.fn()}
          onToggleStar={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Copy link" })).toBeNull();
  });
});
