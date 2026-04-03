import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { FeedItemView } from "@/components/reader/feed-item";

const baseFeed: FeedDto = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: "folder-1",
  title: "AUTOMATON",
  url: "https://automaton-media.com/feed/",
  site_url: "https://automaton-media.com",
  unread_count: 42,
  reader_mode: "on",
  web_preview_mode: "off",
};

describe("FeedItemView", () => {
  it("renders selection, unread count, and context-menu affordance while delegating clicks", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FeedItemView feed={baseFeed} isSelected={true} onSelect={onSelect} displayFavicons={false} />);

    const button = screen.getByRole("button", { name: /AUTOMATON/i });

    expect(button).toHaveClass("bg-sidebar-accent");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(screen.getByText("42")).toBeInTheDocument();

    await user.click(button);

    expect(onSelect).toHaveBeenCalledWith("feed-1");
  });

  it("omits the unread badge at zero and still renders favicon fallback content", () => {
    render(
      <FeedItemView
        feed={{
          ...baseFeed,
          title: "alpha news",
          unread_count: 0,
          site_url: "",
          url: "",
        }}
        isSelected={false}
        onSelect={vi.fn()}
        displayFavicons={true}
      />,
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
