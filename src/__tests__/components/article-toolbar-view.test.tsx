import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleToolbarView } from "@/components/reader/article-toolbar-view";

describe("ArticleToolbarView", () => {
  it("renders visible actions and calls their handlers", async () => {
    const user = userEvent.setup();
    const onCloseView = vi.fn();
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onCopyLink = vi.fn();
    const onOpenInBrowser = vi.fn();
    const onOpenInExternalBrowser = vi.fn();

    const { container } = render(
      <ArticleToolbarView
        showCloseButton
        canToggleRead
        canToggleStar
        isRead
        isStarred={false}
        isBrowserOpen={false}
        showCopyLinkButton
        canCopyLink
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton
        canOpenInExternalBrowser
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
        onCloseView={onCloseView}
        onToggleRead={onToggleRead}
        onToggleStar={onToggleStar}
        onCopyLink={onCopyLink}
        onOpenInBrowser={onOpenInBrowser}
        onOpenInExternalBrowser={onOpenInExternalBrowser}
      />,
    );

    expect(container.firstElementChild).not.toHaveAttribute("data-tauri-drag-region");
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Close article" }));
    await user.click(readButton);
    await user.click(starButton);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await user.click(screen.getByRole("button", { name: "Open Web Preview" }));
    await user.click(screen.getByRole("button", { name: "Open in External Browser" }));

    expect(onCloseView).toHaveBeenCalledTimes(1);
    expect(onToggleRead).toHaveBeenCalledWith(false);
    expect(onToggleStar).toHaveBeenCalledWith(true);
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    expect(onOpenInExternalBrowser).toHaveBeenCalledTimes(1);
  });

  it("hides optional actions and disables unavailable ones", () => {
    render(
      <ArticleToolbarView
        showCloseButton={false}
        canToggleRead={false}
        canToggleStar={false}
        isRead={false}
        isStarred
        isBrowserOpen={false}
        showCopyLinkButton={false}
        canCopyLink={false}
        showOpenInBrowserButton={false}
        canOpenInBrowser={false}
        showOpenInExternalBrowserButton={false}
        canOpenInExternalBrowser={false}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          viewInBrowser: "Open Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Close article" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle read" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Toggle star" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Web Preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in external browser" })).not.toBeInTheDocument();
  });

  it("limits the drag region to the center spacer so action buttons stay clickable on overlay title bars", () => {
    const { container } = render(
      <ArticleToolbarView
        showCloseButton
        canToggleRead
        canToggleStar
        isRead={false}
        isStarred={false}
        isBrowserOpen={false}
        showCopyLinkButton
        canCopyLink
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton
        canOpenInExternalBrowser
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    expect(dragRegions).toHaveLength(1);
    expect(dragRegions[0]).not.toContain(screen.getByRole("button", { name: "Open Web Preview" }));
    expect(dragRegions[0]).not.toContain(screen.getByRole("button", { name: "Open in External Browser" }));
  });

  it("renders a single preview toggle without the legacy display-mode group", () => {
    render(
      <ArticleToolbarView
        showCloseButton
        canToggleRead
        canToggleStar
        isRead={false}
        isStarred={false}
        isBrowserOpen
        showCopyLinkButton
        canCopyLink
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton
        canOpenInExternalBrowser
        displayModeControl={<div>S</div>}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Open Web Preview" })).toBeInTheDocument();
    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();
  });

  it("keeps browser before copy in the toolbar action order", () => {
    render(
      <ArticleToolbarView
        showCloseButton
        canToggleRead
        canToggleStar
        isRead={false}
        isStarred={false}
        isBrowserOpen={false}
        showCopyLinkButton
        canCopyLink
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton
        canOpenInExternalBrowser
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    const toolbarButtons = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label): label is string => label !== null);

    expect(toolbarButtons).toEqual([
      "Close article",
      "Toggle read",
      "Toggle star",
      "Open Web Preview",
      "Copy link",
      "Open in External Browser",
    ]);
  });
});
