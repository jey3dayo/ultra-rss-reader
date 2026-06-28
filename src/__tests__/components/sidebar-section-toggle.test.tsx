import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarSectionToggle } from "@/design-system";

describe("SidebarSectionToggle", () => {
  it("uses the softened sidebar hover surface and toggles on click", () => {
    const onToggle = vi.fn();

    render(<SidebarSectionToggle label="Feeds" isOpen={true} onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Feeds" });

    expect(button).toHaveClass("motion-disclosure-trigger", "rounded-lg", "select-none", "hover:bg-surface-1/72");
    expect(button).toHaveClass("focus-visible:bg-[var(--sidebar-hover-surface)]", "focus-visible:ring-0");
    expect(button).not.toHaveClass("focus-visible:ring-ring/45");
    expect(button.querySelector("svg")).toHaveClass("text-sidebar-foreground/54");
    expect(button.querySelector("svg")).toHaveClass("motion-disclosure-icon");
    expect(screen.getByText("Feeds")).toHaveClass(
      "text-[0.72rem]",
      "font-semibold",
      "tracking-[0.12em]",
      "text-sidebar-foreground/56",
      "uppercase",
    );

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
