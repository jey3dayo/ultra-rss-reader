import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SettingsContentLayout,
  SettingsContentScrollBehaviorProvider,
} from "@/components/settings/shared/settings-content-layout";

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
    expect(screen.getByTestId("settings-content-header")).toHaveClass("min-h-[4.5rem]", "py-0", "items-center");
    expect(screen.getByRole("heading", { name: "General" })).toHaveClass("text-[22px]", "sm:text-[24px]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[color:var(--settings-shell-section-label)]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[13px]");
  });

  it("keeps overflow fades decorative and token-driven", () => {
    render(
      <SettingsContentLayout title="General" scrollBehavior="always">
        <div>Body</div>
      </SettingsContentLayout>,
    );

    expect(screen.getByTestId("settings-content-fade-top")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("settings-content-fade-top")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("settings-content-fade-top")).toHaveStyle({
      backgroundImage: "var(--settings-shell-content-fade)",
    });
    expect(screen.getByTestId("settings-content-fade-bottom")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("settings-content-fade-bottom")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("settings-content-fade-bottom")).toHaveStyle({
      backgroundImage: "var(--settings-shell-content-fade-reverse)",
    });
  });

  it("inherits scroll behavior through the shared settings context", () => {
    render(
      <SettingsContentScrollBehaviorProvider value="always">
        <SettingsContentLayout title="General">
          <div>Body</div>
        </SettingsContentLayout>
      </SettingsContentScrollBehaviorProvider>,
    );

    expect(screen.getByTestId("settings-content-fade-top")).toBeInTheDocument();
    expect(screen.getByTestId("settings-content-fade-bottom")).toBeInTheDocument();
  });
});
