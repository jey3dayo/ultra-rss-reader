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
        onExport={onExport}
        onRequestDelete={onRequestDelete}
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
});
