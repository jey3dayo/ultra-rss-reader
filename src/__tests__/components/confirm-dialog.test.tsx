import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { useUiStore } from "@/stores/ui-store";

describe("AppConfirmDialog", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("exposes an accessible name and description for the dialog", () => {
    useUiStore.getState().showConfirm("Delete this feed?", vi.fn(), { actionLabel: "Delete" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveAccessibleDescription("Delete this feed?");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");
  });

  it("runs the confirm action once and clears dialog state", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm("Apply this action?", onConfirm, { actionLabel: "Apply" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().confirmDialog).toEqual({
      open: false,
      message: "",
      actionLabel: null,
      variant: "default",
      icon: null,
      onConfirm: null,
    });
  });

  it("cancels and closes without running the confirm action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm("Cancel this action?", onConfirm, { actionLabel: "Apply" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
  });

  it("treats dialog close as cancel without running the confirm action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm("Close this action?", onConfirm, { actionLabel: "Apply" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    await user.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
  });

  it("keeps the latest confirm action as the only action result contract", async () => {
    const user = userEvent.setup();
    const staleConfirm = vi.fn();
    const latestConfirm = vi.fn();

    useUiStore.getState().showConfirm("Run stale action?", staleConfirm, { actionLabel: "Stale" });
    useUiStore.getState().showConfirm("Run latest action?", latestConfirm, { actionLabel: "Latest" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Latest" }));

    expect(staleConfirm).not.toHaveBeenCalled();
    expect(latestConfirm).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().confirmDialog).toEqual({
      open: false,
      message: "",
      actionLabel: null,
      variant: "default",
      icon: null,
      onConfirm: null,
    });
  });

  it("switches warning and destructive tones through the shared dialog variant", () => {
    act(() => {
      useUiStore.getState().showConfirm("Mark all selected articles as read?", vi.fn(), {
        actionLabel: "Mark as Read",
        variant: "warning",
      });
    });

    expect(useUiStore.getState().confirmDialog.variant).toBe("warning");

    const { unmount } = render(<AppConfirmDialog />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId("confirm-dialog-icon")).toHaveClass("bg-state-warning-surface");
    expect(screen.getByTestId("confirm-dialog-icon-svg")).toHaveClass("text-state-warning-foreground");
    expect(screen.getByRole("button", { name: "Mark as Read" })).toHaveClass(
      "border-state-warning-border",
      "bg-state-warning-surface",
      "text-state-warning-foreground",
    );

    unmount();

    act(() => {
      useUiStore.getState().showConfirm("Delete this account?", vi.fn(), {
        actionLabel: "Delete",
        variant: "destructive",
      });
    });

    expect(useUiStore.getState().confirmDialog.variant).toBe("destructive");

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    expect(screen.getByTestId("confirm-dialog-icon")).toHaveClass("bg-state-danger-surface");
    expect(screen.getByTestId("confirm-dialog-icon-svg")).toHaveClass("text-state-danger-foreground");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
  });
});
