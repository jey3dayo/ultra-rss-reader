import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";

describe("SettingsContentLayout", () => {
  it("uses shell content and field-label tones in stacked-left mode", () => {
    render(
      <SettingsContentLayout title="General" subtitle="Tune reading behavior." titleLayout="stacked-left">
        <div>Body</div>
      </SettingsContentLayout>,
    );

    expect(screen.getByRole("heading", { name: "General" })).toHaveClass(
      "text-[color:var(--settings-shell-content-title)]",
    );
    expect(screen.getByRole("heading", { name: "General" })).toHaveClass("text-[22px]", "sm:text-[24px]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[color:var(--settings-shell-section-label)]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[13px]");
  });
});
