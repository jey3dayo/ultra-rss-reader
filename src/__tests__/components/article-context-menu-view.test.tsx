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

    render(
      <ContextMenu.Root open>
        <ArticleContextMenuView
          toggleReadLabel="Mark as Read"
          toggleStarLabel="Star"
          openInBrowserLabel="Open in Browser"
          onToggleRead={onToggleRead}
          onToggleStar={onToggleStar}
          onOpenInBrowser={onOpenInBrowser}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark as Read" }));
    await user.click(screen.getByRole("menuitem", { name: "Star" }));
    await user.click(screen.getByRole("menuitem", { name: "Open in Browser" }));

    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
  });
});
