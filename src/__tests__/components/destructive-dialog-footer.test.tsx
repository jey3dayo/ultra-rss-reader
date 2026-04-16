import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DestructiveDialogFooter } from "@/components/shared/destructive-dialog-footer";

describe("DestructiveDialogFooter", () => {
  it("renders cancel and delete actions and disables both while pending", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <DestructiveDialogFooter cancelLabel="Cancel" confirmLabel="Delete" onCancel={onCancel} onConfirm={onConfirm} />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <DestructiveDialogFooter
        cancelLabel="Cancel"
        confirmLabel="Delete"
        pending={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
