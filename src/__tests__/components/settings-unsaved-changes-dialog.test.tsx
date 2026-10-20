import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsUnsavedChangesDialog } from "@/components/settings/settings-unsaved-changes-dialog";

type DialogLabels = {
  title: string;
  message: string;
  saveLabel: string;
  savingLabel: string;
  discardLabel: string;
  cancelLabel: string;
};

const labels: DialogLabels = {
  title: "Save your changes?",
  message: "If you leave without saving, your edits will be lost.",
  saveLabel: "Save",
  savingLabel: "Testing connection…",
  discardLabel: "Discard",
  cancelLabel: "Cancel",
};

const baseProps = {
  open: true,
  saving: false,
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  onCancel: vi.fn(),
  ...labels,
};

function renderDialog(overrides: Partial<typeof baseProps> = {}) {
  return render(<SettingsUnsavedChangesDialog {...baseProps} {...overrides} />);
}

describe("SettingsUnsavedChangesDialog", () => {
  it("renders title, message, and the warning icon badge", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: labels.title });
    expect(within(dialog).getByRole("heading", { name: labels.title })).toBeVisible();
    expect(within(dialog).getByText(labels.message)).toBeVisible();
    expect(dialog).toHaveAccessibleDescription(labels.message);
    expect(screen.getByTestId("settings-unsaved-changes-dialog-icon")).toHaveClass(
      "bg-state-warning-surface",
      "size-8",
      "rounded-md",
    );
    expect(screen.getByTestId("settings-unsaved-changes-dialog-icon-svg")).toHaveClass(
      "text-state-warning-foreground",
      "size-4",
    );
  });

  it("orders the buttons as Cancel, Discard, Save and calls each callback once", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ onSave, onDiscard, onCancel });

    const dialog = screen.getByRole("dialog", { name: labels.title });
    const buttons = within(dialog).getAllByRole("button");

    expect(buttons.map((button) => button.textContent)).toEqual([
      labels.cancelLabel,
      labels.discardLabel,
      labels.saveLabel,
    ]);

    await user.click(within(dialog).getByRole("button", { name: labels.cancelLabel }));
    await user.click(within(dialog).getByRole("button", { name: labels.discardLabel }));
    await user.click(within(dialog).getByRole("button", { name: labels.saveLabel }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("focuses the Save action initially and treats Escape like cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onDiscard = vi.fn();
    const onSave = vi.fn();
    renderDialog({ onCancel, onDiscard, onSave });

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: labels.saveLabel })).toHaveFocus();
    });

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("disables every action and shows the saving label while saving, and Escape does not cancel", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ saving: true, onSave, onDiscard, onCancel });

    const dialog = screen.getByRole("dialog", { name: labels.title });
    const buttons = within(dialog).getAllByRole("button");

    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(within(dialog).getByText(labels.savingLabel)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: new RegExp(labels.savingLabel) })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
