import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderStory } from "@tests/helpers/render-story";
import { describe, expect, it, vi } from "vitest";
import { BrowserSurfaceStateCard } from "@/components/reader/browser-surface-state-card";
import browserSurfaceStateCardMeta, {
  RetryableIssue,
  RuntimeUnavailableIssue,
} from "@/components/reader/browser-surface-state-card.stories";

describe("BrowserSurfaceStateCard", () => {
  it("renders the retryable issue story", () => {
    renderStory(browserSurfaceStateCardMeta, RetryableIssue);

    expect(screen.getByText("Web Preview could not load.")).toBeInTheDocument();
    expect(screen.getByText("Navigation timed out while creating the embedded browser surface.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Web Preview" })).toBeInTheDocument();
  });

  it("renders the runtime unavailable issue story without retry", () => {
    renderStory(browserSurfaceStateCardMeta, RuntimeUnavailableIssue);

    expect(screen.getByText("Embedded Web Preview is unavailable in this runtime.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry Web Preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
  });

  it("keeps the info surface contract and local sizing", () => {
    render(
      <BrowserSurfaceStateCard
        issue={{
          kind: "unsupported",
          title: "browser mode では埋め込み Webプレビューを表示できません。",
          description:
            "ネイティブの埋め込み表示はデスクトップアプリで確認し、ここでは外部ブラウザ導線を使ってください。",
          detail: null,
          canRetry: false,
        }}
        showTechnicalDetail={false}
        onRetry={vi.fn()}
        onOpenExternal={vi.fn()}
        labels={{
          technicalDetail: "Technical detail",
          retryWebPreview: "Retry Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
      />,
    );

    const card = screen.getByTestId("browser-surface-state");
    const title = screen.getByText("browser mode では埋め込み Webプレビューを表示できません。");
    const openButton = screen.getByRole("button", {
      name: "Open in External Browser",
    });

    expect(card).toHaveAttribute("data-surface-card", "info");
    expect(card).toHaveClass("w-full");
    expect(card).toHaveClass("max-w-[min(42rem,calc(100vw-2rem))]");
    expect(title).toHaveClass("text-balance");
    expect(title).toHaveClass("leading-tight");
    expect(
      screen.getByText(
        "ネイティブの埋め込み表示はデスクトップアプリで確認し、ここでは外部ブラウザ導線を使ってください。",
      ),
    ).toHaveClass("text-foreground-soft");
    expect(screen.queryByText("Technical detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry Web Preview" })).not.toBeInTheDocument();
    expect(openButton).toBeEnabled();
  });

  it("keeps external recovery available when retry is unavailable", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onOpenExternal = vi.fn();

    render(
      <BrowserSurfaceStateCard
        issue={{
          kind: "unsupported",
          title: "Embedded Web Preview is unavailable in this runtime.",
          description: "Open this page externally.",
          detail: null,
          canRetry: false,
        }}
        showTechnicalDetail={false}
        onRetry={onRetry}
        onOpenExternal={onOpenExternal}
        labels={{
          technicalDetail: "Technical detail",
          retryWebPreview: "Retry Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry Web Preview" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open in External Browser" }));

    expect(onRetry).not.toHaveBeenCalled();
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
  });

  it("uses a semantic detail surface for technical browser errors", () => {
    render(
      <BrowserSurfaceStateCard
        issue={{
          kind: "unsupported",
          title: "browser mode では埋め込み Webプレビューを表示できません。",
          description:
            "ネイティブの埋め込み表示はデスクトップアプリで確認し、ここでは外部ブラウザ導線を使ってください。",
          detail: "The embedded browser could not be created for this feed.",
          canRetry: true,
        }}
        showTechnicalDetail
        onRetry={vi.fn()}
        onOpenExternal={vi.fn()}
        labels={{
          technicalDetail: "Technical detail",
          retryWebPreview: "Retry Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
      />,
    );

    const detail = screen.getByText("The embedded browser could not be created for this feed.");
    const retryButton = screen.getByRole("button", {
      name: "Retry Web Preview",
    });
    const externalButton = screen.getByRole("button", {
      name: "Open in External Browser",
    });

    expect(detail).toHaveClass("rounded-md");
    expect(detail).toHaveClass("border-browser-overlay-state-detail-border");
    expect(detail).toHaveClass("bg-browser-overlay-state-detail-surface");
    expect(detail).toHaveClass("break-words");
    expect(detail).toHaveClass("[overflow-wrap:anywhere]");
    expect(retryButton).not.toHaveAccessibleName(/Technical detail/);
    expect(externalButton).not.toHaveAccessibleName(/The embedded browser/);
  });

  it("routes retry and external recovery actions from retryable issues", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onOpenExternal = vi.fn();

    render(
      <BrowserSurfaceStateCard
        issue={{
          kind: "failed",
          title: "Web Preview could not load.",
          description: "Try again or open this page externally.",
          detail: "Navigation timed out.",
          canRetry: true,
        }}
        showTechnicalDetail
        onRetry={onRetry}
        onOpenExternal={onOpenExternal}
        labels={{
          technicalDetail: "Technical detail",
          retryWebPreview: "Retry Web Preview",
          openInExternalBrowser: "Open in External Browser",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retry Web Preview" }));
    await user.click(screen.getByRole("button", { name: "Open in External Browser" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
  });
});
