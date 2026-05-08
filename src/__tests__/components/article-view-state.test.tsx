import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/reader/browser-view", () => ({
  BrowserView: ({ onCloseOverlay }: { onCloseOverlay: () => void }) => (
    <button type="button" onClick={onCloseOverlay}>
      Browser view
    </button>
  ),
}));

import {
  ArticleEmptyStateShell,
  ArticleNotFoundStateView,
  BrowserOverlaySurface,
} from "@/components/reader/article-view-state";

describe("BrowserOverlaySurface", () => {
  it("keeps reader children visible without mounting the browser view when hidden", () => {
    render(
      <BrowserOverlaySurface showBrowserView={false} onCloseOverlay={vi.fn()}>
        <p>Reader body</p>
      </BrowserOverlaySurface>,
    );

    expect(screen.getByText("Reader body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browser view" })).not.toBeInTheDocument();
  });

  it("mounts the browser view by default and passes the close handler", async () => {
    const user = userEvent.setup();
    const onCloseOverlay = vi.fn();

    render(<BrowserOverlaySurface onCloseOverlay={onCloseOverlay} />);

    await user.click(screen.getByRole("button", { name: "Browser view" }));

    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
  });
});

describe("ArticleEmptyStateShell", () => {
  it("renders toolbar and body slots", () => {
    render(<ArticleEmptyStateShell toolbar={<div>Toolbar slot</div>} body={<div>Body slot</div>} />);

    expect(screen.getByText("Toolbar slot")).toBeInTheDocument();
    expect(screen.getByText("Body slot")).toBeInTheDocument();
  });
});

describe("ArticleNotFoundStateView", () => {
  it("renders the provided not-found message", () => {
    render(<ArticleNotFoundStateView message="Article was not found" />);

    expect(screen.getByText("Article was not found")).toBeInTheDocument();
  });
});
