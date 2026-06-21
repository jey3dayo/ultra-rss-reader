import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagColorPicker } from "@/design-system";

describe("TagColorPicker", () => {
  it("uses softened supporting text and semantic neutral surfaces", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagColorPicker
        label="Tag color"
        color="#6f8eb8"
        colorOptions={["#6f8eb8", "#cf7868"]}
        noColorLabel="No color"
        optionAriaLabel={(color) => `Select ${color}`}
        onChange={onChange}
      />,
    );

    const label = screen.getByText("Tag color");
    const group = screen.getByRole("radiogroup", { name: "Tag color" });
    const noColorButton = screen.getByRole("radio", { name: "No color" });
    const selectedColorButton = screen.getByRole("radio", {
      name: "Select #6f8eb8",
    });
    const noColorSwatch = noColorButton.nextElementSibling;
    const selectedColorSwatch = selectedColorButton.nextElementSibling;

    expect(label).toHaveClass("text-foreground-soft");
    expect(group).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-orientation", "horizontal");
    expect(noColorButton).toHaveAttribute("tabindex", "-1");
    expect(selectedColorButton).toHaveAttribute("tabindex", "0");
    expect(noColorSwatch).toHaveClass("motion-interactive-surface");
    expect(selectedColorSwatch).toHaveClass("motion-interactive-surface");
    expect(noColorSwatch).not.toHaveClass("bg-surface-2", "border-border-strong", "text-foreground");
    expect(selectedColorSwatch).toHaveClass(
      "scale-110",
      "border-white/85",
      "shadow-[var(--tag-color-selected-shadow)]",
    );
    expect(selectedColorSwatch?.querySelector("svg")).toHaveClass("drop-shadow-[var(--tag-color-check-shadow)]");

    await user.click(screen.getByRole("radio", { name: "Select #cf7868" }));

    expect(onChange).toHaveBeenCalledWith("#cf7868");
  });

  it("deduplicates duplicate color options and preserves null selection state", () => {
    const onChange = vi.fn();

    render(
      <TagColorPicker
        color={null}
        colorOptions={["#6f8eb8", "#6f8eb8", "#cf7868"]}
        noColorLabel="No color"
        optionAriaLabel={(color) => `Select ${color}`}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByRole("radio", { name: "Select #6f8eb8" })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "No color" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Select #6f8eb8" })).not.toBeChecked();
  });

  it("normalizes uppercase colors and keeps palette-outside hex values selectable", () => {
    const onChange = vi.fn();

    render(
      <TagColorPicker
        color="#ABCDEF"
        colorOptions={["#6f8eb8", "#ABCDEF"]}
        noColorLabel="No color"
        optionAriaLabel={(color) => `Select ${color}`}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByRole("radio", { name: "Select #abcdef" })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Select #abcdef" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Select #6f8eb8" })).not.toBeChecked();
  });

  it("shows the current palette-outside color before preset colors", () => {
    const onChange = vi.fn();

    render(
      <TagColorPicker
        color="#123456"
        colorOptions={["#6f8eb8", "#cf7868"]}
        noColorLabel="No color"
        optionAriaLabel={(color) => `Select ${color}`}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("radio", { name: "Select #123456" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Select #6f8eb8" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Select #cf7868" })).not.toBeChecked();
  });

  it("updates radio checked state from keyboard selection", async () => {
    const user = userEvent.setup();

    function ControlledPicker() {
      const [color, setColor] = useState<string | null>(null);
      return (
        <TagColorPicker
          label="Tag color"
          color={color}
          colorOptions={["#6f8eb8", "#cf7868"]}
          noColorLabel="No color"
          optionAriaLabel={(option) => `Select ${option}`}
          onChange={setColor}
        />
      );
    }

    render(<ControlledPicker />);

    const noColor = screen.getByRole("radio", { name: "No color" });
    const blue = screen.getByRole("radio", { name: "Select #6f8eb8" });
    const red = screen.getByRole("radio", { name: "Select #cf7868" });

    noColor.focus();
    await user.keyboard("{ArrowRight}");

    expect(noColor).not.toBeChecked();
    expect(blue).toBeChecked();
    expect(red).not.toBeChecked();
    expect(blue).toHaveFocus();

    await user.keyboard("{End}");

    expect(red).toBeChecked();
    expect(red).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    expect(noColor).toBeChecked();
    expect(noColor).toHaveFocus();
  });
});
