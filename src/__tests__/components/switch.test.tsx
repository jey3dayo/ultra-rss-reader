import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it.each([
    {
      size: "default" as const,
      trackClasses: ["data-[size=default]:h-[18.4px]", "data-[size=default]:w-[32px]"],
      thumbClasses: [
        "group-data-[size=default]/switch:size-4",
        "group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]",
        "group-data-[size=default]/switch:data-unchecked:translate-x-0",
      ],
    },
    {
      size: "sm" as const,
      trackClasses: ["data-[size=sm]:h-[14px]", "data-[size=sm]:w-[24px]"],
      thumbClasses: [
        "group-data-[size=sm]/switch:size-3",
        "group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]",
        "group-data-[size=sm]/switch:data-unchecked:translate-x-0",
      ],
    },
  ])("keeps the $size size contract on the track and thumb", ({ size, trackClasses, thumbClasses }) => {
    render(<Switch aria-label={`${size} switch`} size={size} />);

    const switchControl = screen.getByRole("switch", { name: `${size} switch` });
    const thumb = switchControl.querySelector("[data-slot='switch-thumb']");

    expect(switchControl).toHaveAttribute("data-size", size);
    expect(switchControl).toHaveClass(...trackClasses);
    expect(thumb).toHaveClass(...thumbClasses);
  });

  it("keeps transitions explicit on the track and thumb", () => {
    render(<Switch aria-label="Transition switch" />);

    const switchControl = screen.getByRole("switch", { name: "Transition switch" });
    const thumb = switchControl.querySelector("[data-slot='switch-thumb']");

    expect(switchControl).toHaveClass("transition-[color,background-color,border-color,box-shadow,opacity]");
    expect(switchControl).not.toHaveClass("transition-all");
    expect(thumb).toHaveClass("transition-transform");
  });

  it("uses semantic state tokens for invalid, checked, unchecked, and disabled states", () => {
    render(<Switch aria-label="State switch" aria-invalid={true} checked={true} disabled onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "State switch" })).toHaveClass(
      "aria-invalid:border-state-danger-border",
      "aria-invalid:ring-destructive/20",
      "data-checked:bg-state-success-surface",
      "data-checked:text-state-success-foreground",
      "data-unchecked:bg-input",
      "data-disabled:cursor-not-allowed",
      "data-disabled:opacity-50",
    );
  });
});
