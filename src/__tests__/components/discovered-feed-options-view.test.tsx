import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiscoveredFeedOptionsView } from "@/components/reader/discovered-feed-options-view";

describe("DiscoveredFeedOptionsView", () => {
  it("renders radio options from display props and reports selection changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <DiscoveredFeedOptionsView
        summary="Found 2 feeds"
        name="discovered-feed"
        value="https://example.com/feed.xml"
        options={[
          { value: "https://example.com/feed.xml", label: "Tech Blog" },
          { value: "https://example.com/atom.xml", label: "News Feed" },
        ]}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByText("Found 2 feeds")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tech Blog" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "News Feed" })).toBeInTheDocument();

    await user.click(screen.getByText("News Feed"));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("https://example.com/atom.xml");
  });
});
