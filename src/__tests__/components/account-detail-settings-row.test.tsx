import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountDetailSettingsRow } from "@/components/settings/account-detail/settings-row";

describe("AccountDetailSettingsRow", () => {
  it("names disabled switches with their visible row label", () => {
    render(<AccountDetailSettingsRow label="Open links in background" type="switch" checked />);

    const control = screen.getByRole("switch", { name: "Open links in background" });
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("aria-checked", "true");
  });

  it("left-aligns read-only text values with the same inset as input controls", () => {
    render(<AccountDetailSettingsRow label="Type" type="text" value="FreshRSS" />);

    const value = screen.getByText("FreshRSS");
    expect(value.parentElement).toHaveClass("w-full");
    expect(value.parentElement).toHaveClass("text-left");
    expect(value.parentElement).toHaveClass("min-h-11");
    expect(value.parentElement).toHaveClass("px-3");
    expect(value.parentElement).toHaveClass("text-foreground-soft");
  });

  it("renders read-only select values without a literal triangle glyph", () => {
    render(<AccountDetailSettingsRow label="Theme" type="select" value="Dark" />);

    expect(screen.getByText(/Dark/)).toBeInTheDocument();
    expect(screen.getByText("Dark").parentElement).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Dark").parentElement).toHaveClass("px-3");
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });
});
