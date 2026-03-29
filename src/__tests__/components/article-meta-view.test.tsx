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

    const titleButton = screen.getByRole("button", { name: "First Article" });
    const feedButton = screen.getByRole("button", { name: "Tech Blog" });

    await user.click(titleButton);
    fireEvent(titleButton, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    await user.click(feedButton);

    expect(onTitleClick).toHaveBeenCalledTimes(1);
    expect(onTitleAuxClick).toHaveBeenCalledTimes(1);
    expect(onFeedClick).toHaveBeenCalledTimes(1);
  });

  it("renders a static title when no title callback is provided", () => {
    render(<ArticleMetaView title="Offline Article" publishedLabel="Mar 25, 2026" />);

    expect(screen.getByRole("heading", { level: 1, name: "Offline Article" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offline Article" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tech Blog" })).not.toBeInTheDocument();
  });
});
