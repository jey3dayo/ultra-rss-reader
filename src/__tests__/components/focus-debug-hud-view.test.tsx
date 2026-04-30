import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { FocusDebugHudView } from "@/components/debug/focus-debug-hud-view";

const baseProps = {
  focusedPane: "list",
  contentMode: "reader",
  selectedArticleId: "article-1",
  browserCloseInFlight: false,
  pendingBrowserCloseAction: null,
  activeElementDescription: "button | label=Copy debug HUD",
  browserGeometryRows: [],
  traces: ["12:00:00.000 raw-key Enter"],
  onCopyClick: vi.fn(),
  onCloseClick: vi.fn(),
  onCopyPointerDown: vi.fn(),
} satisfies ComponentProps<typeof FocusDebugHudView>;

function renderFocusDebugHudView(overrides: Partial<ComponentProps<typeof FocusDebugHudView>> = {}) {
  return render(<FocusDebugHudView {...baseProps} {...overrides} />);
}

describe("FocusDebugHudView", () => {
  it("keeps the collapsed HUD as a quiet transparent shell", () => {
    renderFocusDebugHudView();

    const hud = screen.getByRole("button", { name: "Expand debug HUD" }).closest("section");

    expect(hud).toHaveClass("rounded-[22px]");
    expect(hud).toHaveClass("border-white/8");
    expect(hud).toHaveClass("backdrop-blur-xl");
    expect(hud).not.toHaveClass("rounded-2xl");
    expect(hud).not.toHaveClass("backdrop-blur-md");
    expect(hud).not.toHaveClass("hover:opacity-35");
  });

  it("uses product-aligned inner cards without dropping monospace surfaces", () => {
    renderFocusDebugHudView();

    const summaryCard = screen.getByText("Copy debug HUD").parentElement;
    const recentEventsCard = screen.getByText("Recent events").parentElement;

    expect(summaryCard).toHaveClass("debug-hud-inner-card", "rounded-lg", "border-white/8");
    expect(summaryCard).not.toHaveClass("rounded-xl");
    expect(recentEventsCard).toHaveClass("debug-hud-inner-card", "rounded-lg", "border-white/8");
    expect(recentEventsCard).not.toHaveClass("rounded-xl");
  });

  it("uses compact badges and lighter labels in the collapsed hierarchy", () => {
    renderFocusDebugHudView({
      pendingBrowserCloseAction: "dismiss",
      activeElementDescription: "button | role=button | label=Copy debug HUD",
      traces: ["12:00:00.000 raw-key Enter", "12:00:00.050 focus copy-button"],
    });

    expect(screen.queryByText("pane=list mode=reader")).not.toBeInTheDocument();
    expect(screen.getByText("pane=list")).toHaveClass("rounded-full");
    expect(screen.getByText("mode=reader")).toHaveClass("rounded-full");
    expect(screen.getByText("closing=false")).toHaveClass("rounded-full");
    expect(screen.getByText("pending=dismiss")).toHaveClass("rounded-full");
    expect(screen.getByText("Recent events")).toBeInTheDocument();
    expect(screen.queryByText("Trace")).not.toBeInTheDocument();
  });

  it("anchors the HUD to the bottom-right corner by default", () => {
    renderFocusDebugHudView();

    const hud = screen.getByRole("button", { name: "Expand debug HUD" }).closest("section");
    const container = hud?.parentElement;

    expect(container).toHaveClass("right-4");
    expect(container).not.toHaveClass("left-4");
  });

  it("renders in the top-right fallback without changing the selected bottom-right position", async () => {
    const user = userEvent.setup();
    const { rerender } = renderFocusDebugHudView({ avoidBottomRight: true });

    const moveButton = screen.getByRole("button", { name: "Move debug HUD" });
    const container = moveButton.closest("section")?.parentElement;

    expect(container).toHaveClass("top-4", "right-4");
    expect(container).not.toHaveClass("bottom-4");

    rerender(<FocusDebugHudView {...baseProps} />);

    expect(container).toHaveClass("right-4", "bottom-4");
    expect(container).not.toHaveClass("top-4");

    await user.click(moveButton);

    expect(container).toHaveClass("top-4", "left-4");
    expect(container).not.toHaveClass("right-4");

    rerender(<FocusDebugHudView {...baseProps} avoidBottomRight />);

    expect(container).toHaveClass("top-4", "left-4");
    expect(container).not.toHaveClass("right-4");
  });

  it("cycles the HUD through screen corners", async () => {
    const user = userEvent.setup();

    renderFocusDebugHudView();

    const moveButton = screen.getByRole("button", { name: "Move debug HUD" });
    const container = moveButton.closest("section")?.parentElement;

    expect(container).toHaveClass("right-4", "bottom-4");

    await user.click(moveButton);

    expect(container).toHaveClass("top-4", "left-4");
    expect(container).not.toHaveClass("bottom-4");

    await user.click(moveButton);

    expect(container).toHaveClass("top-4", "right-4");
    expect(container).not.toHaveClass("left-4");

    await user.click(moveButton);

    expect(container).toHaveClass("bottom-4", "left-4");
    expect(container).not.toHaveClass("top-4");
    expect(container).not.toHaveClass("right-4");

    await user.click(moveButton);

    expect(container).toHaveClass("right-4", "bottom-4");
    expect(container).not.toHaveClass("top-4");
    expect(container).not.toHaveClass("left-4");
  });

  it("keeps manual position while temporarily hidden", async () => {
    const user = userEvent.setup();
    const props = baseProps;
    const { rerender } = render(<FocusDebugHudView {...props} />);

    const moveButton = screen.getByRole("button", { name: "Move debug HUD" });
    const container = moveButton.closest("section")?.parentElement;
    await user.click(moveButton);

    expect(container).toHaveClass("top-4", "left-4");

    rerender(<FocusDebugHudView {...props} temporarilyHidden />);

    expect(container).toHaveClass("hidden");
    expect(container).toHaveAttribute("aria-hidden", "true");

    rerender(<FocusDebugHudView {...props} />);

    expect(container).not.toHaveClass("hidden");
    expect(container).not.toHaveAttribute("aria-hidden");
    expect(container).toHaveClass("top-4", "left-4");
  });

  it("exposes expanded state on the trace toggle", async () => {
    const user = userEvent.setup();

    renderFocusDebugHudView();

    const toggleButton = screen.getByRole("button", { name: "Expand debug HUD" });

    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    expect(screen.getByRole("button", { name: "Collapse debug HUD" })).toHaveAttribute("aria-expanded", "true");
  });

  it("uses compact header-style utility actions", async () => {
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
        onCloseClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Expand debug HUD" })).toHaveAttribute("data-debug-hud-action-button");
    expect(screen.getByRole("button", { name: "Expand debug HUD" })).toHaveClass("size-8", "px-0");
    expect(screen.getByRole("button", { name: "Move debug HUD" })).toHaveAttribute("data-debug-hud-action-button");
    expect(screen.getByRole("button", { name: "Move debug HUD" })).toHaveClass("size-8", "px-0");
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).toHaveAttribute("data-debug-hud-action-button");
    expect(screen.getByRole("button", { name: "Copy debug HUD" })).toHaveClass("size-8", "px-0");
    expect(screen.getByRole("button", { name: "Hide debug HUD" })).toHaveAttribute("data-debug-hud-action-button");
    expect(screen.getByRole("button", { name: "Hide debug HUD" })).toHaveClass("size-8", "px-0");
    expect(screen.queryByText(/^More$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Less$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Copy$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand debug HUD" }));

    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("data-debug-hud-action-button");
    expect(screen.getByRole("button", { name: "Show" })).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "Show" })).toHaveClass("border-transparent", "bg-transparent");
  });

  it("uses lighter labels in the expanded hierarchy without dropping raw values", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight
        pendingBrowserCloseAction="dismiss"
        activeElementDescription="button | role=button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCloseClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
        defaultExpanded
      />,
    );

    expect(screen.getByText("pane=list")).toBeInTheDocument();
    expect(screen.getByText("mode=reader")).toBeInTheDocument();
    const focusedElementLabel = screen.getByText("Focused element");
    expect(focusedElementLabel).toBeInTheDocument();
    expect(focusedElementLabel).toHaveClass("whitespace-nowrap");
    expect(screen.getAllByText("Recent events")).toHaveLength(1);
    expect(screen.queryByText("Trace")).not.toBeInTheDocument();
    expect(screen.getByText("closing=true")).toHaveClass("rounded-full");
    expect(screen.getByText("pending=dismiss")).toHaveClass("rounded-full");
    expect(screen.getByText("article=article-1")).toBeInTheDocument();
    expect(screen.getByText("button | role=button | label=Copy debug HUD")).toBeInTheDocument();
    expect(focusedElementLabel.closest("div.grid")).not.toHaveClass("sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(screen.queryByText(/^Collapse debug HUD$/)).not.toBeInTheDocument();
  });
});
