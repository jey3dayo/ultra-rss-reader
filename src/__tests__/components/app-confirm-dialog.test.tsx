import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { useUiStore } from "@/stores/ui-store";

describe("AppConfirmDialog", () => {
  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("keeps destructive confirms pending, blocks keyboard close, and restores opener focus after success", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    opener.textContent = "Open account delete";
    document.body.append(opener);
    opener.focus();

    const deferred = createDeferred<void>();
    const onConfirm = vi.fn(() => deferred.promise);

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    act(() => {
      useUiStore.getState().showConfirm("Delete this account?", onConfirm, {
        actionLabel: "Delete",
        actionAccessibleLabel: 'Delete "Local". This cannot be undone.',
        variant: "destructive",
      });
    });

    const deleteButton = await screen.findByRole("button", {
      name: 'Delete "Local". This cannot be undone.',
    });

    await user.dblClick(deleteButton);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();

    act(() => deferred.resolve());

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm" })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it("keeps the dialog open and re-enables actions when the confirm callback rejects", async () => {
    const user = userEvent.setup();
    const error = new Error("delete rejected");
    const deferred = createDeferred<void>();
    const onConfirm = vi.fn(() => deferred.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(<AppConfirmDialog />, { wrapper: createWrapper() });

      act(() => {
        useUiStore.getState().showConfirm("Delete this account?", onConfirm, {
          actionLabel: "Delete",
          actionAccessibleLabel: 'Delete "Local". This cannot be undone.',
          variant: "destructive",
        });
      });

      const deleteButton = await screen.findByRole("button", {
        name: 'Delete "Local". This cannot be undone.',
      });

      await user.click(deleteButton);
      expect(deleteButton).toBeDisabled();

      act(() => deferred.reject(error));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Failed to run confirm dialog action.", error);
        expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
        expect(
          screen.getByRole("button", {
            name: 'Delete "Local". This cannot be undone.',
          }),
        ).not.toBeDisabled();
      });
    } finally {
      deferred.cleanup();
      consoleError.mockRestore();
    }
  });

  it("closes after success without refocusing a removed opener", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    opener.textContent = "Open feed delete";
    document.body.append(opener);
    opener.focus();
    const onConfirm = vi.fn();

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    act(() => {
      useUiStore.getState().showConfirm("Delete this feed?", onConfirm, {
        actionLabel: "Delete",
        variant: "destructive",
      });
    });

    opener.remove();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm" })).not.toBeInTheDocument());
    expect(document.body).not.toContainElement(opener);
  });

  it("closes after success when there is no active element to restore", async () => {
    const user = userEvent.setup();
    const activeElementSpy = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
    const onConfirm = vi.fn();

    try {
      render(<AppConfirmDialog />, { wrapper: createWrapper() });

      act(() => {
        useUiStore.getState().showConfirm("Delete this feed?", onConfirm, {
          actionLabel: "Delete",
          variant: "destructive",
        });
      });

      await user.click(await screen.findByRole("button", { name: "Delete" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm" })).not.toBeInTheDocument());
    } finally {
      activeElementSpy.mockRestore();
    }
  });

  it("keeps the dialog open and re-enables actions when the confirm callback throws", async () => {
    const user = userEvent.setup();
    const error = new Error("delete failed");
    const onConfirm = vi.fn(() => {
      throw error;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(<AppConfirmDialog />, { wrapper: createWrapper() });

      act(() => {
        useUiStore.getState().showConfirm("Delete this account?", onConfirm, {
          actionLabel: "Delete",
          actionAccessibleLabel: 'Delete "Local". This cannot be undone.',
          variant: "destructive",
        });
      });

      await user.click(
        await screen.findByRole("button", {
          name: 'Delete "Local". This cannot be undone.',
        }),
      );

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to run confirm dialog action.", error);
      expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.getByRole("button", {
            name: 'Delete "Local". This cannot be undone.',
          }),
        ).not.toBeDisabled(),
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
