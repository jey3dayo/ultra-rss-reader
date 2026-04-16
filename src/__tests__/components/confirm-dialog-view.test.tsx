import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";

describe("ConfirmDialogView", () => {
  it("renders accessible dialog copy and invokes confirm and cancel handlers", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialogView
        open={true}
        title="Mark all as read"
        message="Mark all selected articles as read?"
        actionLabel="Mark all read"
        cancelLabel="Cancel"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Mark all as read" })).toHaveAccessibleDescription(
      "Mark all selected articles as read?",
    );
    expect(screen.getByRole("button", { name: "Mark all read" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
