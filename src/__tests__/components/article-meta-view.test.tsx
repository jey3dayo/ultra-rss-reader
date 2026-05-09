import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleMetaView } from "@/components/reader/article-meta-view";
import { ReaderInlineActionButton } from "@/components/reader/reader-inline-action-button";

describe("ArticleMetaView", () => {
  it("renders metadata and exposes title and feed actions", async () => {
    const user = userEvent.setup();
    const onTitleClick = vi.fn();
    const onTitleAuxClick = vi.fn();
    const onFeedClick = vi.fn();

    render(
      <ArticleMetaView
        title="First Article"
        author="Alice"
        feedName="Tech Blog"
        publishedLabel="2026年3月25日 10:00"
        onTitleClick={onTitleClick}
        onTitleAuxClick={onTitleAuxClick}
        onFeedClick={onFeedClick}
      />,
    );

    expect(screen.getByText("2026年3月25日 10:00")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("text-[0.8rem]");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("font-sans");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("tracking-[0.08em]");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).toHaveClass("tabular-nums");
    expect(screen.getByText("2026年3月25日 10:00").parentElement).not.toHaveClass("uppercase");
    expect(screen.getByText("Alice").parentElement).toHaveClass("text-[0.95rem]");
    expect(screen.getByText("Alice").parentElement).toHaveClass("font-serif");
    expect(screen.getByText("Alice").parentElement).toHaveClass("text-foreground-soft");

    const titleButton = screen.getByRole("button", { name: "First Article" });
    const feedButton = screen.getByRole("button", { name: "Tech Blog" });
    expect(titleButton.parentElement).toHaveClass("font-sans");
    expect(titleButton).toHaveClass("motion-static-hover-surface");
    expect(titleButton).toHaveClass("hover:bg-surface-1/72");
    expect(feedButton).toHaveClass("text-[0.95rem]");
    expect(feedButton).toHaveClass("text-foreground-soft");
    expect(feedButton).toHaveClass("motion-static-hover-surface");
    expect(feedButton).toHaveClass("hover:bg-surface-1/72");
    expect(feedButton).not.toHaveClass("rounded-full");
    expect(feedButton).not.toHaveClass("border");

    await user.click(titleButton);
    fireEvent(titleButton, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    await user.click(feedButton);

    expect(onTitleClick).toHaveBeenCalledTimes(1);
    expect(onTitleAuxClick).toHaveBeenCalledTimes(1);
    expect(onFeedClick).toHaveBeenCalledTimes(1);
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
    expect(screen.queryByRole("button", { name: "Tech Blog" })).not.toBeInTheDocument();
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
