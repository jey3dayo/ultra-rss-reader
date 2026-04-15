import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";

describe("Design-themed shared components", () => {
  it("applies warm editorial styling to section headings", () => {
    render(<SectionHeading>Appearance</SectionHeading>);

    expect(screen.getByRole("heading", { level: 3, name: "Appearance" })).toHaveClass("text-foreground-soft");
  });

  it("uses layered surfaces for navigation rows and chips", () => {
    render(
      <>
        <NavRowButton title="General settings" />
        <ControlChipButton pressed>Unread</ControlChipButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "General settings" })).toHaveClass("hover:bg-surface-2");
    expect(screen.getByRole("button", { name: "Unread" })).toHaveClass("bg-surface-2", "border-border");
  });
});
