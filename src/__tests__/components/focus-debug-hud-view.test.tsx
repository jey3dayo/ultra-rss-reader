import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FocusDebugHudView } from "@/components/debug/focus-debug-hud-view";

describe("FocusDebugHudView", () => {
  it("keeps the collapsed HUD as a quiet transparent shell", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    const hud = screen.getByRole("button", { name: "More" }).closest("section");

    expect(hud).toHaveClass("rounded-[22px]");
    expect(hud).toHaveClass("border-white/8");
    expect(hud).toHaveClass("backdrop-blur-xl");
    expect(hud).not.toHaveClass("rounded-2xl");
    expect(hud).not.toHaveClass("backdrop-blur-md");
    expect(hud).not.toHaveClass("hover:opacity-35");
  });

  it("uses product-aligned inner cards without dropping monospace surfaces", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    const summaryCard = screen.getByText("Copy debug HUD").parentElement;
    const recentEventsCard = screen.getByText("Recent events").parentElement;

    expect(summaryCard).toHaveClass("debug-hud-inner-card", "rounded-lg", "border-white/8");
    expect(summaryCard).not.toHaveClass("rounded-xl");
    expect(recentEventsCard).toHaveClass("debug-hud-inner-card", "rounded-lg", "border-white/8");
    expect(recentEventsCard).not.toHaveClass("rounded-xl");
  });

  it("anchors the HUD to the bottom-right corner", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    const hud = screen.getByRole("button", { name: "More" }).closest("section");
    const container = hud?.parentElement;

    expect(container).toHaveClass("right-4");
    expect(container).not.toHaveClass("left-4");
  });

  it("exposes expanded state on the trace toggle", async () => {
    const user = userEvent.setup();

    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    const toggleButton = screen.getByRole("button", { name: "More" });

    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    expect(screen.getByRole("button", { name: "Less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("adopts the shared button family while keeping HUD actions touch-safe", async () => {
    const user = userEvent.setup();

    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[{ label: "viewport", value: "390 x 844" }]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "More" })).toHaveClass("motion-interactive-surface", "rounded-md", "min-h-11");
    expect(screen.getByRole("button", { name: "More" })).not.toHaveClass("rounded-lg", "border-white/12");
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).toHaveClass(
      "motion-interactive-surface",
      "rounded-md",
      "min-h-11",
      "gap-2",
    );
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).not.toHaveClass("rounded-lg", "border-white/14");

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("button", { name: "Show" })).toHaveClass("motion-interactive-surface", "rounded-md", "min-h-11");
    expect(screen.getByRole("button", { name: "Show" })).toHaveClass("border-transparent", "bg-transparent");
    expect(screen.getByRole("button", { name: "Show" })).not.toHaveClass("rounded-lg");
  });
});
