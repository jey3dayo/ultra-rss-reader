import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleToolbarView } from "@/components/reader/article-toolbar-view";

describe("ArticleToolbarView", () => {
  it("renders visible actions and calls their handlers", async () => {
    const user = userEvent.setup();
    const onShowSidebar = vi.fn();
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onCopyLink = vi.fn();
    const onOpenInBrowser = vi.fn();
    const onOpenInExternalBrowser = vi.fn();

    render(
      <ArticleToolbarView
        showSidebarButton
        canToggleRead
        canToggleStar
        isRead
        isStarred={false}
        showCopyLinkButton
        canCopyLink
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton
        canOpenInExternalBrowser
        labels={{
          showSidebar: "Show sidebar",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          viewInBrowser: "View in browser",
          openInExternalBrowser: "Open in external browser",
        }}
        onShowSidebar={onShowSidebar}
        onToggleRead={onToggleRead}
        onToggleStar={onToggleStar}
        onCopyLink={onCopyLink}
        onOpenInBrowser={onOpenInBrowser}
        onOpenInExternalBrowser={onOpenInExternalBrowser}
      />,
    );

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Show sidebar" }));
    await user.click(readButton);
    await user.click(starButton);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await user.click(screen.getByRole("button", { name: "View in browser" }));
    await user.click(screen.getByRole("button", { name: "Open in external browser" }));

    expect(onShowSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleRead).toHaveBeenCalledWith(false);
    expect(onToggleStar).toHaveBeenCalledWith(true);
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    expect(onOpenInExternalBrowser).toHaveBeenCalledTimes(1);
  });

  it("hides optional actions and disables unavailable ones", () => {
    render(
      <ArticleToolbarView
        showSidebarButton={false}
        canToggleRead={false}
        canToggleStar={false}
        isRead={false}
        isStarred
        showCopyLinkButton={false}
        canCopyLink={false}
        showOpenInBrowserButton={false}
        canOpenInBrowser={false}
        showOpenInExternalBrowserButton={false}
        canOpenInExternalBrowser={false}
        labels={{
          showSidebar: "Show sidebar",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          viewInBrowser: "View in browser",
          openInExternalBrowser: "Open in external browser",
        }}
        onShowSidebar={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Show sidebar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle read" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Toggle star" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View in browser" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in external browser" })).not.toBeInTheDocument();
  });
});
