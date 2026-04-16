import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserSurfaceStateCard } from "@/components/reader/browser-surface-state-card";

describe("BrowserSurfaceStateCard", () => {
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
    const openButton = screen.getByRole("button", { name: "Open in External Browser" });

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
});
