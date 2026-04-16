import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";

describe("SettingsContentLayout", () => {
  it("uses softened subtitle tone in stacked-left mode", () => {
    render(
      <SettingsContentLayout title="General" subtitle="Tune reading behavior." titleLayout="stacked-left">
        <div>Body</div>
      </SettingsContentLayout>,
    );

    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-foreground-soft");
  });
});
