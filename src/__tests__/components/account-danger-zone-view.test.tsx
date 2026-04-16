import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountDangerZoneView } from "@/components/settings/account-danger-zone-view";

describe("AccountDangerZoneView", () => {
  it("renders export and delete actions before confirmation", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        cancelLabel="Cancel"
        confirmDeleteLabel="This action cannot be undone."
        isConfirmingDelete={false}
        onExport={onExport}
        onRequestDelete={onRequestDelete}
        onConfirmDelete={() => {}}
        onCancelDelete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export OPML" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("heading", { level: 3, name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Danger Zone" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Danger Zone" })).toHaveClass(
      "text-state-danger-foreground/72",
    );
    expect(screen.getByRole("button", { name: "Export OPML" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Delete account" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Delete account" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Export OPML" }).parentElement).toHaveClass("pl-2");
    expect(screen.getByRole("button", { name: "Delete account" }).parentElement).toHaveClass("pl-2");
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("This action cannot be undone.")).not.toBeInTheDocument();
  });

  it("renders confirmation controls when delete confirmation is active", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    const onCancelDelete = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        exportLabel="Export OPML"
        deleteLabel="Delete"
        cancelLabel="Cancel"
        confirmDeleteLabel="This action cannot be undone."
        isConfirmingDelete={true}
        onExport={() => {}}
        onRequestDelete={() => {}}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={onCancelDelete}
      />,
    );

    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toHaveClass("text-state-danger-foreground");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("w-full");
    expect(screen.getByText("This action cannot be undone.").parentElement?.parentElement).toHaveClass("pl-2");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(onCancelDelete).toHaveBeenCalledTimes(1);
  });
});
