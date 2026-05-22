import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";

describe("SettingsLoadingActionButton", () => {
  it("marks the action busy and disables it while loading by default", () => {
    render(
      <SettingsLoadingActionButton loading={true} loadingLabel="Saving">
        Save
      </SettingsLoadingActionButton>,
    );

    const button = screen.getByRole("button", { name: "Saving" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("renders the default spinner slot and loading label while loading", () => {
    render(
      <SettingsLoadingActionButton loading={true} loadingLabel="Checking">
        Check
      </SettingsLoadingActionButton>,
    );

    const button = screen.getByRole("button", { name: "Checking" });
    const spinner = button.querySelector("[data-slot='loading-spinner']");

    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText("Check")).not.toBeInTheDocument();
  });

  it("keeps the default label when no loading label is provided", () => {
    const { rerender } = render(<SettingsLoadingActionButton loading={false}>Save</SettingsLoadingActionButton>);

    const idleButton = screen.getByRole("button", { name: "Save" });
    expect(idleButton).not.toHaveAttribute("aria-busy");
    expect(idleButton).not.toBeDisabled();

    rerender(<SettingsLoadingActionButton loading={true}>Save</SettingsLoadingActionButton>);

    const loadingButton = screen.getByRole("button", { name: "Save" });
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(loadingButton).toBeDisabled();
    expect(loadingButton.querySelector("[data-slot='loading-spinner']")).not.toBeNull();
  });

  it("keeps the loading action enabled when disabledWhenLoading is false", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <SettingsLoadingActionButton
        loading={true}
        loadingLabel="Refreshing"
        disabledWhenLoading={false}
        onClick={onClick}
      >
        Refresh
      </SettingsLoadingActionButton>,
    );

    const button = screen.getByRole("button", { name: "Refreshing" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses a custom loading spinner when provided", () => {
    render(
      <SettingsLoadingActionButton
        loading={true}
        loadingLabel="Publishing"
        spinner={<span data-testid="custom-spinner" aria-hidden="true" />}
      >
        Publish
      </SettingsLoadingActionButton>,
    );

    const button = screen.getByRole("button", { name: "Publishing" });

    expect(button.querySelector("[data-slot='loading-spinner']")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-spinner")).toBeInTheDocument();
  });
});
