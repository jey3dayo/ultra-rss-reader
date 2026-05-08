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

    const dialog = screen.getByRole("dialog", { name: "Mark all as read" });
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(dialog).toHaveAccessibleDescription("Mark all selected articles as read?");
    expect(dialog).toHaveClass("motion-popup-dialog");
    expect(overlay).toHaveClass("motion-popup-overlay");
    expect(screen.getByTestId("confirm-dialog-icon")).toHaveClass("bg-surface-1/72");
    expect(screen.getByRole("button", { name: "Mark all read" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
      "min-h-11",
      "border-border/45",
      "bg-surface-1/72",
      "text-foreground-soft",
    );

    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("uses variant fallback icons and action button variants when no icon is specified", () => {
    const variants = [
      {
        variant: undefined,
        iconClassName: "text-primary",
        actionClassName: "bg-surface-3",
      },
      {
        variant: "warning" as const,
        iconClassName: "text-state-warning-foreground",
        actionClassName: "border-state-warning-border",
      },
      {
        variant: "destructive" as const,
        iconClassName: "text-state-danger-foreground",
        actionClassName: "bg-state-danger-surface",
      },
    ];

    variants.forEach(({ variant, iconClassName, actionClassName }) => {
      const { unmount } = render(
        <ConfirmDialogView
          open={true}
          title="Confirm action"
          message="Run this action?"
          actionLabel="Run"
          cancelLabel="Cancel"
          variant={variant}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId("confirm-dialog-icon-svg")).toHaveClass(iconClassName);
      expect(screen.getByRole("button", { name: "Run" })).toHaveClass(actionClassName);

      unmount();
    });
  });
});
