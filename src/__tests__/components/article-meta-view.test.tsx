import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticleMetaView } from "@/components/reader/article-meta-view";

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
        publishedLabel="Mar 25, 2026"
        onTitleClick={onTitleClick}
        onTitleAuxClick={onTitleAuxClick}
        onFeedClick={onFeedClick}
      />,
    );

    expect(screen.getByText("Mar 25, 2026")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Mar 25, 2026").parentElement).toHaveClass("text-[0.8rem]");
    expect(screen.getByText("Mar 25, 2026").parentElement).toHaveClass("font-sans");
    expect(screen.getByText("Mar 25, 2026").parentElement).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Alice").parentElement).toHaveClass("text-[0.95rem]");
    expect(screen.getByText("Alice").parentElement).toHaveClass("font-serif");
    expect(screen.getByText("Alice").parentElement).toHaveClass("text-foreground-soft");

    const titleButton = screen.getByRole("button", { name: "First Article" });
    const feedButton = screen.getByRole("button", { name: "Tech Blog" });
    expect(titleButton.parentElement).toHaveClass("font-sans");
    expect(titleButton).toHaveClass("hover:bg-surface-1/72");
    expect(feedButton).toHaveClass("text-[0.95rem]");
    expect(feedButton).toHaveClass("text-foreground-soft");
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
    render(<ArticleMetaView title="Offline Article" publishedLabel="Mar 25, 2026" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Offline Article" });

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-sans");
    expect(heading).toHaveClass("text-[1.66rem]");
    expect(heading).toHaveClass("sm:text-[2.06rem]");
    expect(heading).toHaveClass("leading-[1.07]");
    expect(screen.queryByRole("button", { name: "Offline Article" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tech Blog" })).not.toBeInTheDocument();
  });
});
