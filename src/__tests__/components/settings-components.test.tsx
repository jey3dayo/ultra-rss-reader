import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow } from "@/components/settings/settings-components";

describe("SettingsRow", () => {
  it("left-aligns read-only text values within the content column", () => {
    render(<SettingsRow label="Type" type="text" value="FreshRSS" />);

    const value = screen.getByText("FreshRSS");
    expect(value).toHaveClass("w-full");
    expect(value).toHaveClass("text-left");
    expect(value).toHaveClass("sm:flex-1");
  });
});
