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
    expect(noColorButton).not.toHaveClass("bg-surface-2", "border-border-strong", "text-foreground");
    expect(selectedColorButton).toHaveClass("scale-110", "border-white/85");
    expect(selectedColorButton.querySelector("svg")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Select #6f8eb8" }));

    expect(onChange).toHaveBeenCalledWith("#6f8eb8");
  });
});
