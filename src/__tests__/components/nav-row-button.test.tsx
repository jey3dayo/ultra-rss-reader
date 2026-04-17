import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavRowButton } from "@/components/shared/nav-row-button";

describe("NavRowButton", () => {
  it("renders title, description, leading, trailing, and selected state", () => {
    render(
      <NavRowButton
        tone="sidebar"
        selected
        title="Primary row"
        description={<div>Secondary text</div>}
        leading={<span aria-hidden="true">L</span>}
        trailing={<span aria-hidden="true">3</span>}
      />,
    );

    const button = screen.getByRole("button", { name: /Primary row/i });

    expect(button).toHaveClass("bg-sidebar-accent");
    expect(button).toHaveClass("select-none");
    expect(button).toHaveClass("shadow-[var(--sidebar-selection-inset-shadow)]");
    expect(screen.getByText("Secondary text")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("3").parentElement).toHaveClass("motion-content-swap");
  });

  it("animates primitive trailing values as content swaps", () => {
    render(<NavRowButton title="Primary row" trailing={7} />);

    expect(screen.getByText("7")).toHaveClass("motion-content-swap", "tabular-nums");
    expect(screen.getByText("7")).toHaveAttribute("data-motion-phase", "entering");
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
