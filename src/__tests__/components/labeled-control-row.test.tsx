import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabeledControlRow } from "@/design-system";

describe("LabeledControlRow", () => {
  it("uses softened label tone and keeps the row divider contract", () => {
    render(
      <LabeledControlRow label="Open links">
        <button type="button">Control</button>
      </LabeledControlRow>,
    );

    expect(screen.getByText("Open links")).toHaveClass("text-[color:var(--form-row-label)]");
    expect(screen.getByText("Open links")).toHaveClass("select-none");
    expect(screen.getByText("Open links").closest("div")).toHaveClass(
      "motion-contextual-surface",
      "border-b",
      "border-border/60",
    );
  });

  it("exposes a stable description id to row-owned controls", () => {
    render(
      <LabeledControlRow label="Open links" description="Choose how article links open.">
        {({ descriptionId }) => (
          <button type="button" aria-describedby={descriptionId}>
            Control
          </button>
        )}
      </LabeledControlRow>,
    );

    const description = screen.getByText("Choose how article links open.");
    const control = screen.getByRole("button", { name: "Control" });

    expect(description).toHaveAttribute("id");
    expect(control).toHaveAttribute("aria-describedby", description.id);
  });
});
