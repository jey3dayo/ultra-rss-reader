import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagColorPicker } from "@/components/shared/tag-color-picker";

describe("TagColorPicker", () => {
  it("uses softened supporting text for labels and the no-color control", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagColorPicker
        label="Tag color"
        color={null}
        colorOptions={["#6f8eb8", "#cf7868"]}
        noColorLabel="No color"
        optionAriaLabel={(color) => `Select ${color}`}
        onChange={onChange}
      />,
    );

    const label = screen.getByText("Tag color");
    const noColorButton = screen.getByRole("button", { name: "No color" });

    expect(label).toHaveClass("text-foreground-soft");
    expect(noColorButton).toHaveClass("text-muted-foreground");

    await user.click(screen.getByRole("button", { name: "Select #6f8eb8" }));

    expect(onChange).toHaveBeenCalledWith("#6f8eb8");
  });
});
