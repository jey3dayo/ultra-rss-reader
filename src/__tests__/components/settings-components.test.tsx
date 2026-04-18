import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow } from "@/components/settings/settings-components";

describe("SettingsRow", () => {
  it("left-aligns read-only text values with the same inset as input controls", () => {
    render(<SettingsRow label="Type" type="text" value="FreshRSS" />);

    const value = screen.getByText("FreshRSS");
    expect(value.parentElement).toHaveClass("w-full");
    expect(value.parentElement).toHaveClass("text-left");
    expect(value.parentElement).toHaveClass("min-h-10");
    expect(value.parentElement).toHaveClass("px-3");
    expect(value.parentElement).toHaveClass("text-foreground-soft");
  });

  it("renders read-only select values without a literal triangle glyph", () => {
    render(<SettingsRow label="Theme" type="select" value="Dark" />);

    expect(screen.getByText(/Dark/)).toBeInTheDocument();
    expect(screen.getByText("Dark").parentElement).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Dark").parentElement).toHaveClass("px-3");
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });
});
