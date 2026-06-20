import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { NavRowButton } from "@/design-system";

describe("NavRowButton", () => {
  it("renders title, description, leading, trailing, and selected state", () => {
    render(
      <NavRowButton
        tone="sidebar"
        selected
        title="Primary row"
        description={<div>Secondary text</div>}
        leading={<span aria-hidden="true">L</span>}
        trailing="3"
      />,
    );

    const button = screen.getByRole("button", { name: /Primary row/i });

    expect(button).toHaveClass("bg-sidebar-accent");
    expect(button).toHaveClass("select-none");
    expect(button).toHaveClass("shadow-[var(--sidebar-selection-inset-shadow)]");
    expect(button).toHaveAttribute("aria-current", "page");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(screen.getByText("Secondary text")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("3")).toHaveClass("motion-content-swap");
  });

  it("lets callers override selected aria state", () => {
    render(<NavRowButton selected title="Primary row" aria-current="step" aria-pressed="true" />);

    const button = screen.getByRole("button", { name: "Primary row" });

    expect(button).toHaveAttribute("aria-current", "step");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("does not expose selection aria state when unselected", () => {
    render(<NavRowButton title="Primary row" />);

    const button = screen.getByRole("button", { name: "Primary row" });

    expect(button).not.toHaveAttribute("aria-current");
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  it("animates primitive trailing values as content swaps", () => {
    render(<NavRowButton title="Primary row" trailing={7} />);

    expect(screen.getByText("7")).toHaveClass("motion-content-swap", "tabular-nums");
    expect(screen.getByText("7")).toHaveAttribute("data-motion-phase", "entering");
  });

  it("defaults to button type", () => {
    render(<NavRowButton title="Primary row" />);

    expect(screen.getByRole("button", { name: "Primary row" })).toHaveAttribute("type", "button");
  });

  it("passes explicit ref props to the underlying button", () => {
    const buttonRef = createRef<HTMLButtonElement>();

    render(<NavRowButton ref={buttonRef} title="Primary row" />);

    expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Primary row" }));
  });

  it("keeps custom trailing nodes under caller control", () => {
    render(<NavRowButton title="Primary row" trailing={<span aria-hidden="true">Manual</span>} />);

    expect(screen.getByText("Manual")).not.toHaveClass("motion-content-swap");
  });

  it("keeps sidebar rows borderless", () => {
    render(<NavRowButton tone="sidebar" title="Sidebar row" />);

    const button = screen.getByRole("button", { name: "Sidebar row" });

    expect(button).not.toHaveClass("border");
    expect(button).toHaveClass("select-none");
    expect(button).toHaveClass("hover:bg-[var(--sidebar-hover-surface)]");
  });

  it("forwards click and disabled state", () => {
    const onClick = vi.fn();

    render(<NavRowButton title="Disabled row" disabled onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Disabled row" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
