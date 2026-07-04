import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountDangerZoneView } from "@/components/settings/account-detail/danger-zone-view";

function expectStandardSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("h-9", "min-h-9", "px-3");
  expect(button).toHaveClass("text-[13px]", "font-medium");
  expect(button).not.toHaveClass("h-11", "px-4");
}

describe("AccountDangerZoneView", () => {
  it("renders import, export, and delete actions before confirmation", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onExport = vi.fn();
    const onRequestDelete = vi.fn();

    const { container } = render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        onImport={onImport}
        onExport={onExport}
        onRequestDelete={onRequestDelete}
      />,
    );

    await user.upload(screen.getByTestId("opml-import-input"), new File(["<opml />"], "feeds.opml"));
    await user.click(screen.getByRole("button", { name: "Export OPML" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("heading", { level: 3, name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Danger Zone" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Danger Zone" })).toHaveClass(
      "text-state-danger-foreground/72",
    );
    expectStandardSettingsActionButton(screen.getByRole("button", { name: "Import OPML" }));
    expectStandardSettingsActionButton(screen.getByRole("button", { name: "Export OPML" }));
    expect(screen.getByRole("button", { name: "Delete account" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Delete account" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Import OPML" }).parentElement?.parentElement).toHaveClass("pt-1");
    expect(screen.getByRole("button", { name: "Export OPML" }).parentElement?.parentElement).toHaveClass("pt-1");
    expect(screen.getByRole("button", { name: "Delete account" }).parentElement).toHaveClass("pt-1");
    expect(container.querySelectorAll('[data-surface-card="section"]')).toHaveLength(0);
    for (const section of container.querySelectorAll("section")) {
      expect(section).not.toHaveClass("border-t");
    }
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ name: "feeds.opml" }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("This action cannot be undone.")).not.toBeInTheDocument();
  });

  it("keeps destructive actions visible but disabled when fallback state cannot identify the target", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onExport = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        disabled={true}
        disabledReason="Account details failed to load. Delete is disabled until the account can be identified."
        onImport={onImport}
        onExport={onExport}
        onRequestDelete={onRequestDelete}
      />,
    );

    const importButton = screen.getByRole("button", { name: "Import OPML" });
    const exportButton = screen.getByRole("button", { name: "Export OPML" });
    const deleteButton = screen.getByRole("button", { name: "Delete account" });
    const disabledReason = screen.getByText(
      "Account details failed to load. Delete is disabled until the account can be identified.",
    );

    expect(importButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
    expect(deleteButton).toBeVisible();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-describedby", disabledReason.id);

    await user.click(importButton);
    await user.click(exportButton);
    await user.click(deleteButton);

    expect(onImport).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
    expect(onRequestDelete).not.toHaveBeenCalled();
  });

  it.each([
    { state: "disabled", props: { disabled: true } },
    { state: "importing", props: { importing: true } },
    { state: "exporting", props: { exporting: true } },
  ])("blocks hidden OPML upload while actions are $state", async ({ props }) => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        onImport={onImport}
        onExport={vi.fn()}
        onRequestDelete={vi.fn()}
        {...props}
      />,
    );

    const input = screen.getByTestId("opml-import-input");

    expect(input).toBeDisabled();

    await user.upload(input, new File(["<opml />"], "feeds.opml"));

    expect(onImport).not.toHaveBeenCalled();
  });

  it("shows busy feedback and blocks OPML actions while import is running", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onExport = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        importingLabel="Importing OPML..."
        exportLabel="Export OPML"
        exportingLabel="Exporting OPML..."
        deleteLabel="Delete account"
        importing
        onImport={onImport}
        onExport={onExport}
        onRequestDelete={vi.fn()}
      />,
    );

    const importingButton = screen.getByRole("button", { name: "Importing OPML..." });
    const exportButton = screen.getByRole("button", { name: "Export OPML" });

    expect(importingButton).toBeDisabled();
    expect(importingButton).toHaveAttribute("aria-busy", "true");
    expect(exportButton).toBeDisabled();

    await user.click(importingButton);
    await user.click(exportButton);

    expect(onImport).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("shows busy feedback and blocks OPML actions while export is running", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onExport = vi.fn();

    render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        importingLabel="Importing OPML..."
        exportLabel="Export OPML"
        exportingLabel="Exporting OPML..."
        deleteLabel="Delete account"
        exporting
        onImport={onImport}
        onExport={onExport}
        onRequestDelete={vi.fn()}
      />,
    );

    const importButton = screen.getByRole("button", { name: "Import OPML" });
    const exportingButton = screen.getByRole("button", { name: "Exporting OPML..." });

    expect(importButton).toBeDisabled();
    expect(exportingButton).toBeDisabled();
    expect(exportingButton).toHaveAttribute("aria-busy", "true");

    await user.click(importButton);
    await user.click(exportingButton);

    expect(onImport).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
  });

  const localSyncBlockProps = {
    localSyncHeading: "Local sync folder",
    localSyncFolderLabel: "Folder path",
    localSyncFolderValue: "/tmp/UltraRSSReader",
    onLocalSyncFolderChange: vi.fn(),
    saveLocalSyncFolderLabel: "Save Folder",
    exportLocalSyncLabel: "Write Operations",
    importLocalSyncLabel: "Read Operations",
    onSaveLocalSyncFolder: vi.fn(),
    onExportLocalSync: vi.fn(),
    onImportLocalSync: vi.fn(),
  };

  it("renders the local sync enabled toggle only when a label is provided and reports changes", async () => {
    const user = userEvent.setup();
    const onLocalSyncEnabledChange = vi.fn();

    const { rerender } = render(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        onImport={vi.fn()}
        onExport={vi.fn()}
        onRequestDelete={vi.fn()}
        {...localSyncBlockProps}
      />,
    );

    expect(screen.queryByTestId("local-sync-enabled-toggle")).not.toBeInTheDocument();

    rerender(
      <AccountDangerZoneView
        dataHeading="Data"
        dangerHeading="Danger Zone"
        importLabel="Import OPML"
        exportLabel="Export OPML"
        deleteLabel="Delete account"
        localSyncEnabledLabel="Sync automatically"
        localSyncEnabledDescription="Import and export run automatically."
        localSyncEnabledChecked={true}
        onLocalSyncEnabledChange={onLocalSyncEnabledChange}
        onImport={vi.fn()}
        onExport={vi.fn()}
        onRequestDelete={vi.fn()}
        {...localSyncBlockProps}
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Sync automatically" });
    expect(screen.getByTestId("local-sync-enabled-toggle")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Import and export run automatically.")).toBeInTheDocument();

    await user.click(toggle);

    expect(onLocalSyncEnabledChange).toHaveBeenCalledWith(false);
  });
});
