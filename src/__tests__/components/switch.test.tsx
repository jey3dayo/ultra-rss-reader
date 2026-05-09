import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("uses the default size contract when size is omitted", () => {
    render(<Switch aria-label="Default switch" />);

    const switchControl = screen.getByRole("switch", { name: "Default switch" });
    const thumb = switchControl.querySelector("[data-slot='switch-thumb']");

    expect(switchControl).toHaveAttribute("data-size", "default");
    expect(switchControl).toHaveClass("data-[size=default]:h-[18.4px]", "data-[size=default]:w-[32px]");
    expect(thumb).toHaveClass(
      "group-data-[size=default]/switch:size-4",
      "group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]",
      "group-data-[size=default]/switch:data-unchecked:translate-x-0",
    );
  });

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

  it("uses semantic danger tokens for invalid states", () => {
    render(<Switch aria-label="Invalid switch" aria-invalid={true} />);

    expect(screen.getByRole("switch", { name: "Invalid switch" })).toHaveClass(
      "aria-invalid:border-state-danger-border",
      "aria-invalid:ring-destructive/20",
      "dark:aria-invalid:border-state-danger-border",
      "dark:aria-invalid:ring-destructive/40",
    );
  });

  it("uses semantic success tokens for checked states", () => {
    render(<Switch aria-label="Checked switch" checked={true} onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Checked switch" })).toHaveClass(
      "data-checked:bg-state-success-surface",
      "data-checked:text-state-success-foreground",
    );
  });

  it("uses disabled and unchecked state tokens", () => {
    render(<Switch aria-label="Disabled switch" disabled />);

    expect(screen.getByRole("switch", { name: "Disabled switch" })).toHaveClass(
      "data-unchecked:bg-input",
      "dark:data-unchecked:bg-input/80",
      "data-disabled:cursor-not-allowed",
      "data-disabled:opacity-50",
    );
  });
});
