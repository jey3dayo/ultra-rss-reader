import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleMetaView } from "@/components/reader/article-meta-view";
import { ReaderInlineActionButton } from "@/components/reader/reader-inline-action-button";

describe("ArticleMetaView", () => {
  it("renders metadata and exposes title and show-feed actions", async () => {
    const user = userEvent.setup();
    const onTitleClick = vi.fn();
    const onTitleAuxClick = vi.fn();
    const onShowFeed = vi.fn();

    render(
      <ArticleMetaView
        title="First Article"
        author="Alice"
        feedName="Tech Blog"
        publishedLabel="2026年3月25日 10:00"
        onTitleClick={onTitleClick}
        onTitleAuxClick={onTitleAuxClick}
        onShowFeed={onShowFeed}
      />,
    );

    expect(screen.getByText("2026年3月25日 10:00")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("text-[0.8rem]");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("tabular-nums");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).not.toHaveClass("uppercase");
    expect(screen.getByText("Alice").parentElement?.parentElement).toHaveClass("text-[0.95rem]");

    const titleButton = screen.getByRole("button", { name: "First Article" });
    const showFeedButton = screen.getByRole("button", { name: /^Show feed/ });
    expect(titleButton).toHaveClass("motion-static-hover-surface");
    expect(showFeedButton).toHaveClass("motion-static-hover-surface");

    await user.click(titleButton);
    fireEvent(titleButton, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    await user.click(showFeedButton);

    expect(onTitleClick).toHaveBeenCalledTimes(1);
    expect(onTitleAuxClick).toHaveBeenCalledTimes(1);
    expect(onShowFeed).toHaveBeenCalledTimes(1);
  });

  describe("feed name and domain roles", () => {
    const siteLink = (onOpen: () => void) => ({
      href: "https://example.com/",
      label: "example.com",
      title: "Open in external browser (example.com)",
      onOpen,
    });

    it("opens the site from the feed name, and external with a modifier or middle click", () => {
      const onOpen = vi.fn();
      render(
        <ArticleMetaView
          title="Article"
          feedName="Tech Blog"
          publishedLabel="2026年3月25日 10:00"
          siteLink={siteLink(onOpen)}
          onShowFeed={vi.fn()}
        />,
      );

      const link = screen.getByRole("link", { name: "Tech Blog" });
      expect(link).toHaveAttribute("title", "Tech Blog");
      expect(link.querySelector("svg")).toBeNull();
      expect(fireEvent.click(link)).toBe(false);
      expect(onOpen).toHaveBeenLastCalledWith("https://example.com/", { external: false });
      fireEvent.click(link, { metaKey: true });
      expect(onOpen).toHaveBeenLastCalledWith("https://example.com/", { external: true });
      fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
      expect(onOpen).toHaveBeenLastCalledWith("https://example.com/", { external: true });
    });

    it("shows the feed from a domain button that never opens the site", async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      const onShowFeed = vi.fn();
      render(
        <ArticleMetaView
          title="Article"
          feedName="Tech Blog"
          publishedLabel="2026年3月25日 10:00"
          siteLink={siteLink(onOpen)}
          onShowFeed={onShowFeed}
        />,
      );

      const button = screen.getByRole("button", { name: "example.com · Show feed" });
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(button).toHaveAttribute("title", expect.stringContaining("Tech Blog"));

      await user.click(button);
      expect(onShowFeed).toHaveBeenCalledTimes(1);

      fireEvent.click(button, { metaKey: true });
      fireEvent(button, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("keeps show-feed available without a site link and renders the feed name as plain text", async () => {
      const user = userEvent.setup();
      const onShowFeed = vi.fn();
      render(
        <ArticleMetaView
          title="Article"
          feedName="Tech Blog"
          publishedLabel="2026年3月25日 10:00"
          onShowFeed={onShowFeed}
        />,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("Tech Blog")).toHaveAttribute("title", "Tech Blog");
      await user.click(screen.getByRole("button", { name: "Show feed" }));
      expect(onShowFeed).toHaveBeenCalledTimes(1);
    });

    it("keeps the domain as a site link without a feed name or without onShowFeed", () => {
      const { rerender } = render(
        <ArticleMetaView
          title="Article"
          publishedLabel="2026年3月25日 10:00"
          siteLink={siteLink(vi.fn())}
          onShowFeed={vi.fn()}
        />,
      );
      expect(screen.getByRole("link", { name: /example\.com/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Show feed/ })).not.toBeInTheDocument();

      rerender(
        <ArticleMetaView
          title="Article"
          feedName="Tech Blog"
          publishedLabel="2026年3月25日 10:00"
          siteLink={siteLink(vi.fn())}
        />,
      );
      expect(screen.getByRole("link", { name: /example\.com/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Tech Blog" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Show feed/ })).not.toBeInTheDocument();
    });
  });

  it("renders a static title when no title callback is provided", () => {
    render(<ArticleMetaView title="Offline Article" publishedLabel="2026年3月25日 10:00" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Offline Article" });

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-sans");
    expect(heading).toHaveClass("text-[1.66rem]");
    expect(heading).toHaveClass("sm:text-[2.06rem]");
    expect(heading).toHaveClass("leading-[1.07]");
    expect(screen.queryByRole("button", { name: "Offline Article" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show feed/ })).not.toBeInTheDocument();
  });

  it("uses the shared untitled fallback for blank article titles", () => {
    render(<ArticleMetaView title="" publishedLabel="Friday, October 30, 2026 at 10:00 AM" />);

    expect(screen.getByRole("heading", { level: 1, name: "Untitled article" })).toBeInTheDocument();
  });

  it("exposes full feed and author names when the meta row truncates", () => {
    render(
      <ArticleMetaView
        title="Article"
        author="Aleksandra Wiśniewska-Kowalczyk"
        feedName="Global technology and science reporting"
        publishedLabel="2026年3月25日 10:00"
        siteLink={{ href: "https://example.com/", label: "example.com", title: "Open", onOpen: vi.fn() }}
      />,
    );

    expect(screen.getByRole("link", { name: "Global technology and science reporting" })).toHaveAttribute(
      "title",
      "Global technology and science reporting",
    );
    expect(screen.getByTitle("Global technology and science reporting")).toBeInTheDocument();
    expect(screen.getByTitle("Aleksandra Wiśniewska-Kowalczyk")).toBeInTheDocument();
  });

  it("keeps reader inline actions as native non-submit buttons with forwarded disabled semantics", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const titleButtonRef = createRef<HTMLButtonElement>();

    render(
      <form>
        <ReaderInlineActionButton
          ref={titleButtonRef}
          variant="title"
          aria-label="Open original article"
          onClick={onClick}
        >
          First Article
        </ReaderInlineActionButton>
        <ReaderInlineActionButton variant="feed" disabled onClick={onClick}>
          Tech Blog
        </ReaderInlineActionButton>
      </form>,
    );

    const titleButton = screen.getByRole("button", { name: "Open original article" });
    const feedButton = screen.getByRole("button", { name: "Tech Blog" });

    expect(titleButton.tagName).toBe("BUTTON");
    expect(titleButtonRef.current).toBe(titleButton);
    expect(titleButton).toHaveAttribute("type", "button");
    expect(titleButton).toHaveAttribute("aria-label", "Open original article");
    expect(feedButton).toHaveAttribute("type", "button");
    expect(feedButton).toBeDisabled();
    expect(feedButton).not.toHaveAttribute("aria-disabled");

    await user.click(titleButton);
    await user.click(feedButton);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
