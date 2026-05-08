import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedFavicon } from "@/components/shared/feed-favicon";

describe("FeedFavicon", () => {
  it("uses softened fallback tones when the host cannot be resolved", () => {
    render(<FeedFavicon title="Alpha" url="" siteUrl="" />);

    const fallback = screen.getByText("A");

    expect(fallback).toHaveClass("bg-surface-1/72", "text-foreground-soft");
  });

  it("uses a stable fallback glyph when the title is empty", () => {
    render(<FeedFavicon title=" " url="" siteUrl="" />);

    expect(screen.getByText("?")).toHaveClass("bg-surface-1/72", "text-foreground-soft");
  });

  it("uses the title initial when favicon host resolution fails", () => {
    render(<FeedFavicon title="Beta" url="not-a-url" siteUrl="" />);

    expect(screen.getByText("B")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the fallback question mark when title and favicon host are both blank", () => {
    render(<FeedFavicon title="   " url="" siteUrl="" />);

    expect(screen.getByText("?")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps image and fallback glyphs out of accessible names", () => {
    render(
      <>
        <button type="button">
          <FeedFavicon title="Alpha" url="" siteUrl="" />
          Alpha feed
        </button>
        <button type="button">
          <FeedFavicon title="Beta" url="https://example.com/feed.xml" siteUrl="https://example.com" />
          Beta feed
        </button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Alpha feed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta feed" })).toBeInTheDocument();
    expect(screen.getByText("A")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Beta feed" }).querySelector("img")).toHaveAttribute("alt", "");
  });
});
