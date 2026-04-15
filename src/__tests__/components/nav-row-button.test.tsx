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
    expect(screen.getByText("Secondary text")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("keeps sidebar rows borderless", () => {
    render(<NavRowButton tone="sidebar" title="Sidebar row" />);

    expect(screen.getByRole("button", { name: "Sidebar row" })).not.toHaveClass("border");
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
