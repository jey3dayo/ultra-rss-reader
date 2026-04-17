import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarSectionToggle } from "@/components/shared/sidebar-section-toggle";

describe("SidebarSectionToggle", () => {
  it("uses the softened sidebar hover surface and toggles on click", () => {
    const onToggle = vi.fn();

    render(<SidebarSectionToggle label="Feeds" isOpen={true} onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Feeds" });

    expect(button).toHaveClass("rounded-md", "hover:bg-surface-1/72");
    expect(button.querySelector("svg")).toHaveClass("text-foreground-soft");
    expect(button).toHaveClass("transition-[background-color,border-color,color,box-shadow,transform]");
    expect(button.querySelector("svg")).toHaveClass("transition-transform", "duration-200");

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
