import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FocusDebugHudView } from "@/components/debug/focus-debug-hud-view";

describe("FocusDebugHudView", () => {
  it("keeps the collapsed HUD visually subdued until it is focused", () => {
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

    expect(hud).toHaveClass("bg-black/56");
    expect(hud).toHaveClass("opacity-80");
    expect(hud).toHaveClass("hover:opacity-35");
    expect(hud).toHaveClass("focus-within:opacity-100");
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

  it("uses the shared compact action button family for HUD controls", async () => {
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

    expect(screen.getByRole("button", { name: "More" })).toHaveClass(
      "motion-interactive-surface",
      "rounded-md",
      "h-10",
      "px-4",
      "text-sm",
      "font-medium",
    );
    expect(screen.getByRole("button", { name: "More" })).not.toHaveClass("rounded-lg", "border-white/12", "min-w-11", "gap-1.5");
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).toHaveClass(
      "motion-interactive-surface",
      "rounded-md",
      "h-10",
      "px-4",
      "gap-2",
      "text-sm",
      "font-medium",
    );
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).not.toHaveClass("rounded-lg", "border-white/14", "min-w-11");

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("button", { name: "Show" })).toHaveClass(
      "motion-interactive-surface",
      "rounded-md",
      "h-10",
      "px-4",
      "text-sm",
      "font-medium",
    );
    expect(screen.getByRole("button", { name: "Show" })).not.toHaveClass("rounded-lg", "min-w-11", "gap-1.5");
  });
});
