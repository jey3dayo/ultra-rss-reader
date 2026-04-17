import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagColorPicker } from "@/components/shared/tag-color-picker";

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
    const noColorButton = screen.getByRole("button", { name: "No color" });
    const selectedColorButton = screen.getByRole("button", { name: "Select #6f8eb8" });

    expect(label).toHaveClass("text-foreground-soft");
    expect(noColorButton).toHaveClass("motion-interactive-surface");
    expect(selectedColorButton).toHaveClass("motion-interactive-surface");
    expect(noColorButton).not.toHaveClass("bg-surface-2", "border-border-strong", "text-foreground");
    expect(selectedColorButton).toHaveClass(
      "scale-110",
      "border-white/85",
      "shadow-[var(--tag-color-selected-shadow)]",
    );
    expect(selectedColorButton.querySelector("svg")).toHaveClass("drop-shadow-[var(--tag-color-check-shadow)]");

    await user.click(screen.getByRole("button", { name: "Select #6f8eb8" }));

    expect(onChange).toHaveBeenCalledWith("#6f8eb8");
  });
});
