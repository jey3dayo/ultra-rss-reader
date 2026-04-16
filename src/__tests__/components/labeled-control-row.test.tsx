import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";

describe("LabeledControlRow", () => {
  it("uses softened label tone and keeps the row divider contract", () => {
    render(
      <LabeledControlRow label="Open links">
        <button type="button">Control</button>
      </LabeledControlRow>,
    );

    expect(screen.getByText("Open links")).toHaveClass("text-[color:var(--form-row-label)]");
    expect(screen.getByText("Open links").closest("div")).toHaveClass("border-b", "border-border/70");
  });
});
