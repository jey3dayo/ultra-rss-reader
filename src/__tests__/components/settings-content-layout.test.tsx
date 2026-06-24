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
    expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
    expect(screen.getByTestId("settings-content-header")).toHaveClass("min-h-[5rem]", "py-0", "items-center");
    expect(screen.getByRole("heading", { name: "General" })).toHaveClass("text-[22px]", "sm:text-[24px]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[color:var(--settings-shell-section-label)]");
    expect(screen.getByText("Tune reading behavior.")).toHaveClass("text-[13px]");
  });

  it("keeps the trailing overflow fade decorative and token-driven", () => {
    render(
      <SettingsContentLayout title="General" scrollBehavior="always">
        <div>Body</div>
      </SettingsContentLayout>,
    );

    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
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

    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-content-fade-bottom")).toBeInTheDocument();
  });

  it("keeps local scroll behavior props ahead of shared settings context defaults", () => {
    render(
      <SettingsContentScrollBehaviorProvider value="always">
        <SettingsContentLayout title="General" scrollBehavior="never">
          <div>Body</div>
        </SettingsContentLayout>
      </SettingsContentScrollBehaviorProvider>,
    );

    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-bottom")).not.toBeInTheDocument();
  });
});
