import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarNavButton } from "@/components/reader/sidebar-nav-button";

describe("SidebarNavButton", () => {
  it("keeps the selected indicator visible by default", () => {
    const { container } = render(<SidebarNavButton selected>Selected feed</SidebarNavButton>);

    const button = screen.getByRole("button", { name: "Selected feed" });
    const content = container.querySelector("button > span");

    expect(button).toHaveClass("motion-contextual-surface");
    expect(button).toHaveClass("select-none");
    expect(button).toHaveClass("before:bg-primary/85");
    expect(button).toHaveClass("shadow-[var(--sidebar-selection-shadow)]");
    expect(button).not.toHaveClass("group-hover/feed-row:before:opacity-0");
    expect(button).not.toHaveClass("group-focus-within/feed-row:before:opacity-0");
    expect(content).toHaveClass("flex-1");
    expect(content).toHaveClass("justify-start");
  });

  it("can hide the selected indicator while the row is hovered or focused", () => {
    render(
      <SidebarNavButton selected selectedIndicatorMode="hide-on-row-hover">
        Selected feed
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected feed" });

    expect(button).toHaveClass("before:bg-primary/85");
    expect(button).toHaveClass("group-hover/feed-row:before:opacity-0");
    expect(button).toHaveClass("group-focus-within/feed-row:before:opacity-0");
  });

  it("can omit the built-in selected indicator when the row renders its own indicator", () => {
    render(
      <SidebarNavButton selected selectedIndicatorMode="hidden">
        Selected feed
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected feed" });

    expect(button).not.toHaveClass("before:bg-primary/85");
    expect(button).not.toHaveClass("group-hover/feed-row:before:opacity-0");
  });

  it("uses the softened hover surface for unselected rows", () => {
    render(<SidebarNavButton>Feed row</SidebarNavButton>);

    expect(screen.getByRole("button", { name: "Feed row" })).toHaveClass(
      "motion-contextual-surface",
      "select-none",
      "hover:bg-[var(--sidebar-hover-surface)]",
    );
  });

  it("uses content-swap treatment for trailing counts", () => {
    render(<SidebarNavButton trailing={12}>Feed row</SidebarNavButton>);

    expect(screen.getByText("12")).toHaveClass("motion-content-swap", "tabular-nums");
    expect(screen.getByText("12")).toHaveAttribute("data-motion-phase", "entering");
  });
});
