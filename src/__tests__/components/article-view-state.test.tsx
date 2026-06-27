import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const browserViewMock = vi.hoisted(() =>
  vi.fn(
    ({
      labels,
      onCloseOverlay,
      scope,
    }: {
      labels: { closeWebPreview: string };
      onCloseOverlay: () => void;
      scope?: "content-pane" | "main-stage";
    }) => (
      <button type="button" aria-label={labels.closeWebPreview} data-scope={scope} onClick={onCloseOverlay}>
        Web Preview
      </button>
    ),
  ),
);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "close_browser_overlay" ? "Close Web Preview" : key),
  }),
}));

vi.mock("@/components/reader/browser-view", () => ({
  BrowserView: browserViewMock,
}));

import {
  ArticleEmptyStateShell,
  ArticleNotFoundStateView,
  BrowserOnlyStateView,
  BrowserOverlaySurface,
} from "@/components/reader/article-view-state";

describe("BrowserOverlaySurface", () => {
  beforeEach(() => {
    browserViewMock.mockClear();
  });

  it("keeps reader children visible without mounting the browser view when hidden", () => {
    render(
      <BrowserOverlaySurface showBrowserView={false} onCloseOverlay={vi.fn()}>
        <p>Reader body</p>
      </BrowserOverlaySurface>,
    );

    expect(screen.getByText("Reader body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close Web Preview" })).not.toBeInTheDocument();
    expect(browserViewMock).not.toHaveBeenCalled();
  });

  it("mounts Web Preview with the reader close language and passes the close handler", async () => {
    const user = userEvent.setup();
    const onCloseOverlay = vi.fn();

    render(<BrowserOverlaySurface onCloseOverlay={onCloseOverlay} />);

    await user.click(await screen.findByRole("button", { name: "Close Web Preview" }));

    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
  });

  it("mounts the article-pane Web Preview in content-pane scope by default", async () => {
    render(<BrowserOverlaySurface onCloseOverlay={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toHaveAttribute(
      "data-scope",
      "content-pane",
    );
  });
});

describe("BrowserOnlyStateView", () => {
  beforeEach(() => {
    browserViewMock.mockClear();
  });

  it("keeps the browser-only empty state inside the content-pane scope", async () => {
    render(<BrowserOnlyStateView onCloseOverlay={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toHaveAttribute(
      "data-scope",
      "content-pane",
    );
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
