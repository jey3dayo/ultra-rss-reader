import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleToolbarView } from "@/components/reader/article-toolbar-view";
import { useUiStore } from "@/stores/ui-store";

describe("ArticleToolbarView", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
  });

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
          moreActions: "More actions",
        }}
        onCloseView={onCloseView}
        onToggleRead={onToggleRead}
        onToggleStar={onToggleStar}
        onCopyLink={onCopyLink}
        onOpenInBrowser={onOpenInBrowser}
        onOpenInExternalBrowser={onOpenInExternalBrowser}
      />,
    );

    expect(container.firstElementChild).toHaveClass("h-12");
    expect(container.firstElementChild).not.toHaveAttribute("data-tauri-drag-region");
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: "var(--reader-toolbar-surface)" });
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });
    const readIcon = readButton.querySelector("span");
    const starIcon = starButton.querySelector("svg");

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");
    expect(readIcon).not.toBeNull();
    expect(readIcon).not.toHaveClass("text-[var(--tone-unread)]");
    expect(starIcon).not.toBeNull();
    expect(starIcon).not.toHaveClass("text-[var(--tone-starred)]");
    expect(starIcon).not.toHaveClass("fill-[var(--tone-starred)]");

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

  it("applies semantic tones only to active article states in toolbar toggles", () => {
    render(
      <ArticleToolbarView
        showCloseButton
        canToggleRead
        canToggleStar
        isRead={false}
        isStarred
        isBrowserOpen={false}
        showCopyLinkButton={false}
        canCopyLink={false}
        showOpenInBrowserButton
        canOpenInBrowser
        showOpenInExternalBrowserButton={false}
        canOpenInExternalBrowser={false}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
          moreActions: "More actions",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    const readIcon = screen.getByRole("button", { name: "Toggle read" }).querySelector("span");
    const starIcon = screen.getByRole("button", { name: "Toggle star" }).querySelector("svg");

    expect(readIcon).not.toBeNull();
    expect(readIcon).toHaveClass("bg-[var(--tone-unread)]");
    expect(readIcon).toHaveClass("text-[var(--tone-unread)]");

    expect(starIcon).not.toBeNull();
    expect(starIcon).toHaveClass("text-[var(--tone-starred)]");
    expect(starIcon).toHaveClass("fill-[var(--tone-starred)]");
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
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
          moreActions: "More actions",
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
          moreActions: "More actions",
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
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleStar: "Toggle star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOn: "Close Web Preview",
          openInExternalBrowser: "Open in External Browser",
          moreActions: "More actions",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
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
          moreActions: "More actions",
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
      "Open in External Browser",
      "Copy link",
    ]);
  });

  it("groups secondary link actions under More actions in mobile layout", async () => {
    useUiStore.setState({ layoutMode: "mobile" });
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const onOpenInExternalBrowser = vi.fn();

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
          moreActions: "More actions",
        }}
        onCloseView={vi.fn()}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onCopyLink={onCopyLink}
        onOpenInBrowser={vi.fn()}
        onOpenInExternalBrowser={onOpenInExternalBrowser}
      />,
    );

    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in External Browser" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open in External Browser" }));

    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onOpenInExternalBrowser).toHaveBeenCalledTimes(1);
  });
});
