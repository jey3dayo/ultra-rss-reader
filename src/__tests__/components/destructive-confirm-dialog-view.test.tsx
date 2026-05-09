import { fireEvent, render, screen } from "@testing-library/react";
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
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Delete item" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
});
