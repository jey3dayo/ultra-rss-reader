import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshRssLogoIcon } from "@/components/icons/provider-icons";
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

  it("uses the first grapheme as the fallback label without splitting CJK, emoji, or combining marks", () => {
    const { rerender } = render(<FeedFavicon title="漢字フィード" url="" siteUrl="" />);

    expect(screen.getByText("漢")).toHaveAttribute("aria-hidden", "true");

    rerender(<FeedFavicon title="👨‍👩‍👧‍👦 family feed" url="" siteUrl="" />);
    expect(screen.getByText("👨‍👩‍👧‍👦")).toHaveAttribute("aria-hidden", "true");

    rerender(<FeedFavicon title={"e\u0301clair feed"} url="" siteUrl="" />);
    expect(screen.getByText("É")).toHaveAttribute("aria-hidden", "true");

    rerender(<FeedFavicon title="שלום feed" url="" siteUrl="" />);
    expect(screen.getByText("ש")).toHaveAttribute("aria-hidden", "true");
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

  it("falls back to the feed initial after favicon image load failure", () => {
    const { container } = render(
      <FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image).toHaveAttribute("width", "20");
    expect(image).toHaveAttribute("height", "20");
    expect(image).toHaveClass("h-5", "w-5");

    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("G")).toHaveClass("h-5", "w-5");
  });

  it("does not retry a broken favicon source after repeated image errors", () => {
    const { container } = render(
      <FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />,
    );

    const image = container.querySelector("img");

    fireEvent.error(image as HTMLImageElement);
    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses an https favicon proxy and strips path and query data from feed URLs", () => {
    const { container } = render(
      <FeedFavicon
        title="Private"
        url="http://example.com/feed.xml?token=secret&user=alice"
        siteUrl="http://example.com/private/path?session=secret"
      />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");
    expect(image?.getAttribute("src")).not.toContain("token");
    expect(image?.getAttribute("src")).not.toContain("session");
    expect(image?.getAttribute("src")).not.toContain("private/path");
  });

  it.each([
    ["localhost site", "http://localhost:8080", "http://localhost:8080/feed.xml"],
    ["private IPv4 feed", "", "http://192.168.1.10/feed.xml"],
    ["local mDNS site", "http://reader.local", "http://reader.local/feed.xml"],
  ])("uses the offline fallback instead of sending %s to the external favicon endpoint", (_name, siteUrl, url) => {
    const { container } = render(<FeedFavicon title="Private" url={url} siteUrl={siteUrl} grayscale />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("P")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("P")).not.toHaveClass("grayscale");
  });

  it("keeps the fallback on rerender after the same favicon source fails", () => {
    const { container, rerender } = render(
      <FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");

    fireEvent.error(image as HTMLImageElement);
    rerender(<FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");
  });

  it("retries favicon loading when the resolved favicon source changes after a failure", () => {
    const { container, rerender } = render(
      <FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");

    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");

    rerender(<FeedFavicon title="Gamma" url="https://next.example.com/feed.xml" siteUrl="https://next.example.com" />);

    const retryImage = container.querySelector("img");
    expect(retryImage).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=next.example.com&sz=32");
  });

  it("retries favicon loading when the site URL changes after a failure even if the host is unchanged", () => {
    const { container, rerender } = render(
      <FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com" />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");

    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");

    rerender(<FeedFavicon title="Gamma" url="https://example.com/feed.xml" siteUrl="https://example.com/updated" />);

    const retryImage = container.querySelector("img");
    expect(retryImage).toHaveAttribute("src", "https://www.google.com/s2/favicons?domain=example.com&sz=32");
  });

  it("applies grayscale only to resolved favicon images", () => {
    const { container } = render(
      <FeedFavicon title="Delta" url="https://example.com/feed.xml" siteUrl="https://example.com" grayscale />,
    );

    expect(container.querySelector("img")).toHaveClass("grayscale");
  });

  it("keeps provider brand icons decorative and color-inheriting", () => {
    render(<FreshRssLogoIcon data-testid="provider-icon" className="text-primary" />);

    const icon = screen.getByTestId("provider-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveClass("text-primary");
    expect(icon.querySelectorAll('[stroke="currentColor"]').length).toBeGreaterThan(0);
  });
});
