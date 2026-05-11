import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DestructiveConfirmDialogView } from "@/components/shared/destructive-confirm-dialog-view";

describe("DestructiveConfirmDialogView", () => {
  it("renders shared confirmation copy and uses the shared delete button", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmAccessibleLabel='Delete "Work". This cannot be undone.'
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Delete item" })).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' })).toHaveAttribute(
      "data-delete-button",
    );
    expect(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("restores focus to the opener after a controlled close", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open destructive dialog";
    document.body.append(opener);
    opener.focus();

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    rerender(
      <DestructiveConfirmDialogView
        open={false}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it("keeps destructive actions disabled while pending", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        pending={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]') ?? document.body);
    await user.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps unavailable destructive targets visible with a disabled reason", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmAccessibleLabel='Delete "Work". This cannot be undone.'
        confirmDisabled={true}
        confirmDisabledReason="The target could not be reloaded."
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' });
    const disabledReason = screen.getByText("The target could not be reloaded.");

    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveAccessibleDescription("The target could not be reloaded.");
    expect(confirmButton).toHaveAttribute("aria-describedby", disabledReason.id);

    await user.click(confirmButton);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ignores duplicate confirms while an async destructive action is pending", async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => undefined;
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn(() => confirmPromise);

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.dblClick(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled());
  });

  it("keeps the dialog open and re-enables actions when the destructive action throws", async () => {
    const user = userEvent.setup();
    const error = new Error("delete failed");
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn(() => {
      throw error;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(
        <DestructiveConfirmDialogView
          open={true}
          title="Delete item"
          description="This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith("Failed to run destructive confirm dialog action.", error);
      await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled());
    } finally {
      consoleError.mockRestore();
    }
  });

  it("leaves successful destructive close control to the feature action", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("delegates dialog close separately from destructive confirm", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DestructiveConfirmDialogView
        open={true}
        title="Delete item"
        description="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
