import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleShareMenu } from "@/components/reader/article-share-menu";
import {
  ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT,
  ArticleToolbarView,
  resolveArticleToolbarActions,
} from "@/components/reader/article-toolbar-view";
import {
  MOTION_DATA_ICON_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_ICON_SWAP_CLASS_NAME,
  MOTION_ICON_SWAP_ICON_A,
  MOTION_ICON_SWAP_ICON_B,
  MOTION_ICON_SWAP_STATE_A,
  MOTION_ICON_SWAP_STATE_B,
} from "@/constants";
import { useUiStore } from "@/stores/ui-store";

const motionIconSwapSelector = `.${MOTION_ICON_SWAP_CLASS_NAME}`;
const motionIconSlotASelector = `[${MOTION_DATA_ICON_ATTRIBUTE}="${MOTION_ICON_SWAP_ICON_A}"]`;
const motionIconSlotBSelector = `[${MOTION_DATA_ICON_ATTRIBUTE}="${MOTION_ICON_SWAP_ICON_B}"]`;

describe("ArticleToolbarView", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
  });

  it("resolves action availability from article, URL, preference, overlay, and layout state", () => {
    expect(
      resolveArticleToolbarActions({
        hasArticle: true,
        hasUrl: true,
        showCopyLinkPreference: true,
        hideBrowserOverlayActions: false,
        layoutMode: "wide",
      }),
    ).toEqual({
      canToggleRead: true,
      canToggleStar: true,
      showCopyLinkButton: true,
      canCopyLink: true,
      showOpenInBrowserButton: true,
      canOpenInBrowser: true,
      showOpenInExternalBrowserButton: true,
      canOpenInExternalBrowser: true,
      showExternalBrowserInMoreMenu: false,
    });

    expect(
      resolveArticleToolbarActions({
        hasArticle: false,
        hasUrl: true,
        showCopyLinkPreference: true,
        hideBrowserOverlayActions: true,
        layoutMode: "mobile",
      }),
    ).toEqual({
      canToggleRead: false,
      canToggleStar: false,
      showCopyLinkButton: true,
      canCopyLink: false,
      showOpenInBrowserButton: false,
      canOpenInBrowser: false,
      showOpenInExternalBrowserButton: false,
      canOpenInExternalBrowser: false,
      showExternalBrowserInMoreMenu: false,
    });
  });

  it("keeps resolver outputs aligned with toolbar action options", () => {
    const resolved = resolveArticleToolbarActions({
      hasArticle: true,
      hasUrl: true,
      showCopyLinkPreference: true,
      hideBrowserOverlayActions: false,
      layoutMode: "mobile",
    });
    const contractResultKeys = ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT.flatMap((action) => action.resultKeys).sort();
    const contractActionOptionKeys = ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT.flatMap(
      (action) => action.actionOptionKeys,
    ).sort();

    expect(Object.keys(resolved).sort()).toEqual(contractResultKeys);
    expect(contractActionOptionKeys).toEqual([
      "canCopyLink",
      "canOpenInBrowser",
      "canOpenInExternalBrowser",
      "canToggleRead",
      "canToggleStar",
      "showCopyLinkButton",
      "showExternalBrowserInMoreMenu",
      "showOpenInBrowserButton",
      "showOpenInExternalBrowserButton",
    ]);
    expect(ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT.map((action) => action.actionId)).toEqual([
      "toggle-read",
      "toggle-star",
      "open-in-browser",
      "open-in-external-browser",
      "copy-link",
    ]);
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
        articleState={{
          hasArticle: true,
          isRead: true,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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
    expect(container.firstElementChild).toHaveStyle({
      backgroundColor: "var(--reader-toolbar-surface)",
    });
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });
    const previewButton = screen.getByRole("button", {
      name: "Open Web Preview",
    });
    const readIcon = readButton.querySelector("span");
    const starIcon = starButton.querySelector("svg");
    const previewIconSwap = previewButton.querySelector(motionIconSwapSelector);

    expect(readButton).toHaveClass("text-foreground-soft");
    expect(readButton).toHaveClass("data-[pressed]:bg-transparent");
    expect(readButton).toHaveClass("data-[pressed]:focus-visible:bg-transparent");
    expect(starButton).toHaveClass("text-foreground-soft");
    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");
    expect(starButton).toHaveClass("data-[pressed]:bg-[var(--semantic-tone-starred-surface)]");
    expect(starButton).toHaveClass("data-[pressed]:focus-visible:bg-[var(--semantic-tone-starred-surface)]");
    expect(previewButton).toHaveAttribute("aria-pressed", "false");
    expect(readIcon).not.toBeNull();
    expect(readIcon).not.toHaveClass("text-[var(--tone-unread)]");
    expect(starIcon).not.toBeNull();
    expect(starIcon).not.toHaveClass("text-[var(--tone-starred)]");
    expect(starIcon).not.toHaveClass("fill-[var(--tone-starred)]");
    expect(previewIconSwap).not.toBeNull();
    expect(previewIconSwap).toHaveAttribute(MOTION_DATA_STATE_ATTRIBUTE, MOTION_ICON_SWAP_STATE_A);
    expect(previewIconSwap?.querySelector(`${motionIconSlotASelector} svg`)).not.toBeNull();
    expect(previewIconSwap?.querySelector(`${motionIconSlotBSelector} svg`)).not.toBeNull();

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
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: true,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: false,
          canCopyLink: false,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: false,
          canOpenInExternalBrowser: false,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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
    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });
    const starIcon = starButton.querySelector("svg");

    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(readButton).toHaveClass(
      "bg-[var(--semantic-tone-unread-surface)]",
      "text-[var(--semantic-tone-unread-content-foreground)]",
      "hover:bg-[var(--semantic-tone-unread-surface)]",
      "focus-visible:bg-[var(--semantic-tone-unread-surface)]",
    );
    expect(readIcon).not.toBeNull();
    expect(readIcon).toHaveClass("bg-[var(--tone-unread)]");
    expect(readIcon).toHaveClass("text-[var(--tone-unread)]");

    expect(starButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveClass(
      "data-[pressed]:bg-[var(--semantic-tone-starred-surface)]",
      "data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
      "data-[pressed]:hover:bg-[var(--semantic-tone-starred-surface)]",
      "data-[pressed]:focus-visible:bg-[var(--semantic-tone-starred-surface)]",
    );
    expect(starIcon).not.toBeNull();
    expect(starIcon).toHaveClass("text-[var(--tone-starred)]");
    expect(starIcon).toHaveClass("fill-[var(--tone-starred)]");
  });

  it("hides optional actions and disables unavailable ones", () => {
    render(
      <ArticleToolbarView
        showCloseButton={false}
        articleState={{
          hasArticle: false,
          isRead: false,
          isStarred: true,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: false,
          canToggleStar: false,
          showCopyLinkButton: false,
          canCopyLink: false,
          showOpenInBrowserButton: false,
          canOpenInBrowser: false,
          showOpenInExternalBrowserButton: false,
          canOpenInExternalBrowser: false,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

  it("keeps toolbar actions as labelled native buttons when unavailable", () => {
    render(
      <ArticleToolbarView
        showCloseButton={false}
        articleState={{
          hasArticle: false,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: false,
          canToggleStar: false,
          showCopyLinkButton: true,
          canCopyLink: false,
          showOpenInBrowserButton: true,
          canOpenInBrowser: false,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: false,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    for (const label of ["Toggle read", "Toggle star", "Open Web Preview", "Open in External Browser", "Copy link"]) {
      const button = screen.getByRole("button", { name: label });

      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("aria-label", label);
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute("aria-disabled");
    }
  });

  it("keeps the unread toggle neutral when no article is selected", () => {
    render(
      <ArticleToolbarView
        showCloseButton={false}
        articleState={{
          hasArticle: false,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: false,
          canToggleStar: false,
          showCopyLinkButton: false,
          canCopyLink: false,
          showOpenInBrowserButton: false,
          canOpenInBrowser: false,
          showOpenInExternalBrowserButton: false,
          canOpenInExternalBrowser: false,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const readIcon = readButton.querySelector("span");

    expect(readButton).toBeDisabled();
    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(readIcon).not.toBeNull();
    expect(readIcon).not.toHaveClass("bg-[var(--tone-unread)]");
    expect(readIcon).not.toHaveClass("text-[var(--tone-unread)]");
  });

  it("dims toolbar actions when they are unavailable without an article selection", () => {
    render(
      <ArticleToolbarView
        showCloseButton={false}
        articleState={{
          hasArticle: false,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: false,
          canToggleStar: false,
          showCopyLinkButton: true,
          canCopyLink: false,
          showOpenInBrowserButton: true,
          canOpenInBrowser: false,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: false,
        }}
        shareMenuControl={
          <ArticleShareMenu
            article={null}
            supportsReadingList={false}
            showToast={vi.fn()}
            labels={{
              share: "Share",
              copyLink: "Copy link",
              addToReadingList: "Add to Reading List",
              addedToReadingList: "Added to Reading List",
              shareViaEmail: "Share via Email",
              linkCopied: "Link copied",
            }}
          />
        }
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    for (const label of [
      "Toggle read",
      "Toggle star",
      "Open Web Preview",
      "Open in External Browser",
      "Copy link",
      "Share",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      expect(screen.getByRole("button", { name: label })).toHaveClass("disabled:opacity-35", "disabled:saturate-0");
    }
  });

  it("limits the drag region to the center spacer so action buttons stay clickable on overlay title bars", () => {
    const { container } = render(
      <ArticleToolbarView
        showCloseButton
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: true,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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
    expect(screen.getByRole("button", { name: "Close Web Preview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Close Web Preview" })).toHaveClass(
      "data-[pressed]:bg-primary/12",
      "data-[pressed]:hover:bg-primary/12",
      "data-[pressed]:focus-visible:bg-primary/12",
    );
    expect(
      screen.getByRole("button", { name: "Close Web Preview" }).querySelector(motionIconSwapSelector),
    ).toHaveAttribute(MOTION_DATA_STATE_ATTRIBUTE, MOTION_ICON_SWAP_STATE_B);
    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();
  });

  it("keeps browser before copy in the toolbar action order", () => {
    render(
      <ArticleToolbarView
        showCloseButton
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    const toolbarButtons = screen.getAllByRole("button").reduce<string[]>((labels, button) => {
      const label = button.getAttribute("aria-label");
      if (label !== null) {
        labels.push(label);
      }
      return labels;
    }, []);

    expect(toolbarButtons).toEqual([
      "Close article",
      "Toggle read",
      "Toggle star",
      "Open Web Preview",
      "Open in External Browser",
      "Copy link",
    ]);
  });

  it("uses the layoutMode prop for action rendering even when the UI store differs", () => {
    useUiStore.setState({ layoutMode: "mobile" });

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="wide"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("uses the compact layoutMode prop as a toolbar layout boundary", () => {
    useUiStore.setState({ layoutMode: "mobile" });

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="compact"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("uses the mobile layoutMode prop for action rendering even when the UI store is wide", () => {
    useUiStore.setState({ layoutMode: "wide" });

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="mobile"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in External Browser" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("groups secondary link actions under More actions in mobile layout", async () => {
    useUiStore.setState({ layoutMode: "mobile" });
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const onOpenInExternalBrowser = vi.fn();

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="mobile"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: true,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    expect(screen.getByRole("button", { name: "Toggle read" })).not.toHaveTextContent("Read");
    expect(screen.getByRole("button", { name: "Toggle star" })).not.toHaveTextContent("Star");
    expect(screen.getByRole("button", { name: "Open Web Preview" })).not.toHaveTextContent("Preview");
    expect(screen.getByRole("button", { name: "Toggle read" })).toHaveClass("size-9", "rounded-md");
    expect(screen.getByRole("button", { name: "Toggle star" })).toHaveClass("size-9", "rounded-md");
    expect(screen.getByRole("button", { name: "Open Web Preview" })).toHaveClass("size-9", "rounded-md");
    expect(screen.getByRole("button", { name: "Toggle read" })).toHaveClass(
      "bg-[var(--semantic-tone-unread-surface)]",
      "hover:bg-[var(--semantic-tone-unread-surface)]",
      "focus-visible:bg-[var(--semantic-tone-unread-surface)]",
    );
    for (const label of ["Toggle read", "Toggle star", "Open Web Preview"]) {
      expect(screen.getByRole("button", { name: label })).toHaveClass("inline-flex", "items-center", "justify-center");
    }
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in External Browser" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open in External Browser" }));

    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onOpenInExternalBrowser).toHaveBeenCalledTimes(1);
  });

  it("keeps unavailable mobile secondary actions out of the More actions menu", async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const onOpenInExternalBrowser = vi.fn();

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="mobile"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: false,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: true,
          canCopyLink: false,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: true,
          canOpenInExternalBrowser: true,
          showExternalBrowserInMoreMenu: true,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    await user.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.queryByRole("menuitem", { name: "Copy link" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("menuitem", { name: "Open in External Browser" }));

    expect(onCopyLink).not.toHaveBeenCalled();
    expect(onOpenInExternalBrowser).toHaveBeenCalledTimes(1);
  });

  it("switches the mobile preview label when Web Preview is already open", () => {
    useUiStore.setState({ layoutMode: "mobile" });

    render(
      <ArticleToolbarView
        showCloseButton
        layoutMode="mobile"
        articleState={{
          hasArticle: true,
          isRead: false,
          isStarred: false,
          isBrowserOpen: true,
        }}
        actionOptions={{
          canToggleRead: true,
          canToggleStar: true,
          showCopyLinkButton: false,
          canCopyLink: false,
          showOpenInBrowserButton: true,
          canOpenInBrowser: true,
          showOpenInExternalBrowserButton: false,
          canOpenInExternalBrowser: false,
        }}
        labels={{
          closeView: "Close article",
          toggleRead: "Toggle read",
          toggleReadShort: "Read",
          toggleStar: "Toggle star",
          toggleStarShort: "Star",
          copyLink: "Copy link",
          previewToggleOff: "Open Web Preview",
          previewToggleOffShort: "Preview",
          previewToggleOn: "Close Web Preview",
          previewToggleOnShort: "Close",
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

    expect(screen.getByRole("button", { name: "Close Web Preview" })).not.toHaveTextContent("Close");
    expect(screen.getByRole("button", { name: "Close Web Preview" })).toHaveClass("size-9", "rounded-md");
    expect(screen.getByRole("button", { name: "Close Web Preview" })).toHaveClass(
      "bg-primary/12",
      "hover:bg-primary/12",
      "focus-visible:bg-primary/12",
    );
    expect(
      screen.getByRole("button", { name: "Close Web Preview" }).querySelector(motionIconSwapSelector),
    ).toHaveAttribute(MOTION_DATA_STATE_ATTRIBUTE, MOTION_ICON_SWAP_STATE_B);
  });
});
