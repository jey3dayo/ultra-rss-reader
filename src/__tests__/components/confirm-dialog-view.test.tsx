import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { holdToConfirm, releaseHoldEarly } from "@tests/helpers/hold-to-confirm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTION_HOLD_CONFIRM_DURATION_MS } from "@/constants";
import { ConfirmDialogView } from "@/design-system";

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
          actionAccessibleLabel='Run "Work". This cannot be undone.'
          cancelLabel="Cancel"
          variant={variant}
          confirmDisabled={variant === "destructive"}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId("confirm-dialog-icon-svg")).toHaveClass(iconClassName);
      const actionButton = screen.getByRole("button", { name: 'Run "Work". This cannot be undone.' });
      expect(actionButton).toHaveClass(actionClassName);
      if (variant === "destructive") {
        expect(actionButton).toBeDisabled();
        expect(actionButton).toHaveAttribute("aria-busy", "true");
      }

      unmount();
    });
  });

  it("delegates dialog close separately from cancel and confirm actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialogView
        open={true}
        title="Confirm action"
        message="Run this action?"
        actionLabel="Run"
        cancelLabel="Cancel"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("delegates cancel separately from dialog close and confirm actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialogView
        open={true}
        title="Confirm action"
        message="Run this action?"
        actionLabel="Run"
        cancelLabel="Cancel"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps dialog recovery actions keyboard reachable", async () => {
    const confirmUser = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { unmount } = render(
      <ConfirmDialogView
        open={true}
        title="Recovery action"
        message="Retry setup?"
        actionLabel="Retry"
        cancelLabel="Dismiss"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const retryButton = screen.getByRole("button", { name: "Retry" });
    const dismissButton = screen.getByRole("button", { name: "Dismiss" });

    expect(retryButton).not.toBeDisabled();
    expect(dismissButton).not.toBeDisabled();

    retryButton.focus();
    await confirmUser.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    unmount();

    render(
      <ConfirmDialogView
        open={true}
        title="Recovery action"
        message="Retry setup?"
        actionLabel="Retry"
        cancelLabel="Dismiss"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    screen.getByRole("button", { name: "Dismiss" }).focus();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();
  });
});

describe("ConfirmDialogView destructive hold-to-confirm", () => {
  const renderDestructive = (onConfirm: () => void, open = true) =>
    render(
      <ConfirmDialogView
        open={open}
        title="Delete account"
        message="Delete this account?"
        actionLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        holdHint="Press and hold to confirm"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirms only after the destructive hold completes", () => {
    const onConfirm = vi.fn();
    renderDestructive(onConfirm);

    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(screen.getByTestId("confirm-dialog-hold-fill")).toBeInTheDocument();
    expect(deleteButton).toHaveAttribute("data-motion-hold", "false");
    expect(screen.getByText("Press and hold to confirm")).toHaveAttribute("aria-hidden", "true");

    holdToConfirm(deleteButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(deleteButton).toHaveAttribute("data-motion-hold", "false");
  });

  it("does not confirm when the destructive hold is released early", () => {
    const onConfirm = vi.fn();
    renderDestructive(onConfirm);

    releaseHoldEarly(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels a pending destructive hold when the dialog closes", () => {
    const onConfirm = vi.fn();
    const { rerender } = renderDestructive(onConfirm);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Delete" }));

    rerender(
      <ConfirmDialogView
        open={false}
        title="Delete account"
        message="Delete this account?"
        actionLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(MOTION_HOLD_CONFIRM_DURATION_MS);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps keyboard activation immediate for destructive confirms", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onConfirm = vi.fn();
    renderDestructive(onConfirm);

    screen.getByRole("button", { name: "Delete" }).focus();
    await user.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps non-destructive confirms on plain click without hold affordances", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onConfirm = vi.fn();

    render(
      <ConfirmDialogView
        open={true}
        title="Mark all read"
        message="Mark all as read?"
        actionLabel="Mark all read"
        cancelLabel="Cancel"
        holdHint="Press and hold to confirm"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("confirm-dialog-hold-fill")).not.toBeInTheDocument();
    expect(screen.queryByText("Press and hold to confirm")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
