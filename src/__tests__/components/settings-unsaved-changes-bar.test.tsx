import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsUnsavedChangesBar } from "@/components/settings/settings-unsaved-changes-bar";

describe("SettingsUnsavedChangesBar", () => {
  it("renders the unsaved changes message", () => {
    render(
      <SettingsUnsavedChangesBar
        message="You have unsaved changes"
        discardLabel="Discard"
        saveLabel="Save & Test Connection"
        savingLabel="Saving…"
        saving={false}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-unsaved-changes-bar")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You have unsaved changes");
    expect(screen.getByRole("region", { name: "You have unsaved changes" })).toBeInTheDocument();
  });

  it("calls onDiscard when the discard button is clicked", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(
      <SettingsUnsavedChangesBar
        message="You have unsaved changes"
        discardLabel="Discard"
        saveLabel="Save & Test Connection"
        savingLabel="Saving…"
        saving={false}
        onDiscard={onDiscard}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("calls onSave when the save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <SettingsUnsavedChangesBar
        message="You have unsaved changes"
        discardLabel="Discard"
        saveLabel="Save & Test Connection"
        savingLabel="Saving…"
        saving={false}
        onDiscard={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save & Test Connection" }));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows the saving label and disables both buttons while saving", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    const onSave = vi.fn();
    render(
      <SettingsUnsavedChangesBar
        message="You have unsaved changes"
        discardLabel="Discard"
        saveLabel="Save & Test Connection"
        savingLabel="Saving…"
        saving={true}
        onDiscard={onDiscard}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Saving…" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
