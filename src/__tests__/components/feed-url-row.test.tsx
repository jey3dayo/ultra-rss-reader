import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Rss } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedUrlRow } from "@/design-system";

afterEach(() => {
  cleanup();
});

describe("FeedUrlRow", () => {
  it("renders the label as plain text and the value below when href is absent", () => {
    render(
      <FeedUrlRow
        label="フィードURL"
        value="https://example.com/feed.xml"
        icon={Rss}
        copyLabel="コピー"
        onCopy={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /フィードURL/ })).toBeNull();
    expect(screen.getByText("フィードURL")).toBeTruthy();
    expect(screen.getByText("https://example.com/feed.xml")).toBeTruthy();
  });

  it("renders the label as an external link when href is present", () => {
    render(
      <FeedUrlRow
        label="サイトURL"
        value="https://example.com/"
        icon={Rss}
        href="https://example.com/"
        copyLabel="コピー"
        onCopy={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /サイトURL/ });
    expect(link.getAttribute("href")).toBe("https://example.com/");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("calls onCopy from the copy button and disables it when the value is empty", () => {
    const onCopy = vi.fn();
    const { rerender } = render(
      <FeedUrlRow
        label="フィードURL"
        value="https://example.com/feed.xml"
        icon={Rss}
        copyLabel="コピー"
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "コピー" }));
    expect(onCopy).toHaveBeenCalledTimes(1);

    rerender(<FeedUrlRow label="フィードURL" value="" icon={Rss} copyLabel="コピー" onCopy={onCopy} />);
    expect((screen.getByRole("button", { name: "コピー" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("https://example.com/feed.xml")).toBeNull();
  });
});
