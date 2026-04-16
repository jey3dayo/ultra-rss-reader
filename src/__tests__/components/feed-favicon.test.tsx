import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedFavicon } from "@/components/shared/feed-favicon";

describe("FeedFavicon", () => {
  it("uses softened fallback tones when the host cannot be resolved", () => {
    render(<FeedFavicon title="Alpha" url="" siteUrl="" />);

    const fallback = screen.getByText("A");

    expect(fallback).toHaveClass("bg-surface-1/72", "text-foreground-soft");
  });
});
