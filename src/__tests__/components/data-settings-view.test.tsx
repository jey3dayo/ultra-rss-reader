import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSettingsView } from "@/components/settings/data-settings-view";

function expectStandardSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("w-full");
  expect(button).toHaveClass("sm:w-auto");
  expect(button).toHaveClass("h-10", "px-4");
  expect(button).toHaveClass("min-h-11", "min-w-11");
}

describe("DataSettingsView", () => {
  it("renders the current database size and delegates actions", async () => {
    const user = userEvent.setup();
    const onVacuum = vi.fn();
    const onOpenLogDir = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={onVacuum}
        onOpenLogDir={onOpenLogDir}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByText("1.50 MB")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("heading", { name: "Backup and Restore" })).toBeInTheDocument();
    expect(screen.getByText("Use OPML export.")).toBeInTheDocument();
    expect(screen.queryByText("Recovery action criteria")).not.toBeInTheDocument();
    expect(screen.getByText("Optimize the database.")).toHaveClass("font-sans", "text-foreground-soft");
    expect(screen.getByText("Open the log directory.")).toHaveClass("font-sans", "text-foreground-soft");

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const openLogDirectoryButton = screen.getByRole("button", {
      name: "Open log directory",
    });
    expectStandardSettingsActionButton(optimizeButton);
    expectStandardSettingsActionButton(openLogDirectoryButton);

    await user.click(optimizeButton);
    await user.click(openLogDirectoryButton);

    expect(onVacuum).toHaveBeenCalledTimes(1);
    expect(onOpenLogDir).toHaveBeenCalledTimes(1);
  });

  it("disables vacuum with a visible fallback reason when database size fails to load", async () => {
    const user = userEvent.setup();
    const onVacuum = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="error"
        databaseSizeValue=""
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Database size unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={onVacuum}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const fallbackReason = screen.getByText("Optimize the database. Database size unavailable");

    expect(optimizeButton).toBeDisabled();
    expect(optimizeButton).toHaveAttribute("aria-describedby", fallbackReason.id);

    await user.click(optimizeButton);

    expect(onVacuum).not.toHaveBeenCalled();
  });

  it("keeps open-log recovery reachable from the keyboard", async () => {
    const user = userEvent.setup();
    const onOpenLogDir = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={onOpenLogDir}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "Open log directory" }).focus();
    await user.keyboard("{Enter}");

    expect(onOpenLogDir).toHaveBeenCalledTimes(1);
  });

  it("exports and imports settings profiles through accessible controls", async () => {
    const user = userEvent.setup();
    const onExportSettingsProfile = vi.fn();
    const onImportSettingsProfile = vi.fn();
    const profileFile = new File(["{}"], "profile.json", {
      type: "application/json",
    });

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={onImportSettingsProfile}
        onExportSettingsProfile={onExportSettingsProfile}
      />,
    );

    expect(screen.getByRole("heading", { name: "Settings Profile" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export profile" }));
    await user.upload(screen.getByLabelText("Choose settings profile JSON"), profileFile);

    expect(onExportSettingsProfile).toHaveBeenCalledTimes(1);
    expect(onImportSettingsProfile).toHaveBeenCalledWith(profileFile);
  });

  it("disables settings profile actions while a profile import is pending", async () => {
    const user = userEvent.setup();
    const onExportSettingsProfile = vi.fn();
    const onImportSettingsProfile = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileImportActionLabel="Importing..."
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={true}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={onImportSettingsProfile}
        onExportSettingsProfile={onExportSettingsProfile}
      />,
    );

    const importingButton = screen.getByRole("button", { name: "Importing..." });
    const exportButton = screen.getByRole("button", { name: "Export profile" });
    const fileInput = screen.getByLabelText("Choose settings profile JSON");

    expect(importingButton).toBeDisabled();
    expect(importingButton).toHaveAttribute("aria-busy", "true");
    expect(exportButton).toBeDisabled();
    expect(fileInput).toBeDisabled();

    await user.click(exportButton);
    await user.upload(fileInput, new File(["{}"], "profile.json", { type: "application/json" }));

    expect(onExportSettingsProfile).not.toHaveBeenCalled();
    expect(onImportSettingsProfile).not.toHaveBeenCalled();
  });

  it("shows busy feedback and blocks settings profile actions while export is pending", async () => {
    const user = userEvent.setup();
    const onExportSettingsProfile = vi.fn();
    const onImportSettingsProfile = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileExportActionLabel="Exporting..."
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={true}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={onImportSettingsProfile}
        onExportSettingsProfile={onExportSettingsProfile}
      />,
    );

    const exportingButton = screen.getByRole("button", { name: "Exporting..." });
    const importButton = screen.getByRole("button", { name: "Import profile" });
    const fileInput = screen.getByLabelText("Choose settings profile JSON");

    expect(exportingButton).toBeDisabled();
    expect(exportingButton).toHaveAttribute("aria-busy", "true");
    expect(importButton).toBeDisabled();
    expect(fileInput).toBeDisabled();

    await user.click(exportingButton);
    await user.click(importButton);
    await user.upload(fileInput, new File(["{}"], "profile.json", { type: "application/json" }));

    expect(onExportSettingsProfile).not.toHaveBeenCalled();
    expect(onImportSettingsProfile).not.toHaveBeenCalled();
  });

  it("shows the loading label while vacuuming and keeps the action disabled", async () => {
    const user = userEvent.setup();
    const onVacuum = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="loading"
        databaseSizeValue="..."
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimizing..."
        vacuuming={true}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={onVacuum}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const vacuumButton = screen.getByRole("button", { name: "Optimizing..." });
    expect(vacuumButton).toBeDisabled();
    expect(vacuumButton).toHaveAttribute("aria-busy", "true");

    await user.click(vacuumButton);

    expect(onVacuum).not.toHaveBeenCalled();
  });

  it("shows pending state for log directory opening and disables shared data actions", async () => {
    const user = userEvent.setup();
    const onOpenLogDir = vi.fn();
    const onVacuum = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="ready"
        databaseSizeValue="1.50 MB"
        databaseSizeLoadingLabel="Loading..."
        databaseSizeErrorLabel="Unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Opening..."
        openingLogDir={true}
        onVacuum={onVacuum}
        onOpenLogDir={onOpenLogDir}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const openLogDirectoryButton = screen.getByRole("button", {
      name: "Opening...",
    });
    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });

    expect(openLogDirectoryButton).toBeDisabled();
    expect(openLogDirectoryButton).toHaveAttribute("aria-busy", "true");
    expect(optimizeButton).toBeDisabled();

    await user.click(openLogDirectoryButton);
    await user.click(optimizeButton);

    expect(onOpenLogDir).not.toHaveBeenCalled();
    expect(onVacuum).not.toHaveBeenCalled();
  });

  it("disables vacuum with a visible reason until database size is ready", async () => {
    const user = userEvent.setup();
    const onVacuum = vi.fn();

    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeStatus="loading"
        databaseSizeValue=""
        databaseSizeLoadingLabel="Loading database size"
        databaseSizeErrorLabel="Database size unavailable"
        safetyHeading="Backup and Restore"
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={["Use OPML export.", "Quit before restoring backups."]}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={onVacuum}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const fallbackReason = screen.getByText("Optimize the database. Loading database size");

    expect(optimizeButton).toBeDisabled();
    expect(optimizeButton).toHaveAttribute("aria-describedby", fallbackReason.id);

    await user.click(optimizeButton);

    expect(onVacuum).not.toHaveBeenCalled();
  });

  it("renders distinct database size labels for loading, ready, and error states", () => {
    const props = {
      title: "Data",
      databaseHeading: "Database",
      databaseSizeLabel: "Database size",
      databaseSizeValue: "1.50 MB",
      databaseSizeLoadingLabel: "Loading database size",
      databaseSizeErrorLabel: "Database size unavailable",
      safetyHeading: "Backup and Restore",
      safetyDescription: "Confirm rollback before changing user data.",
      safetyChecklist: ["Use OPML export.", "Quit before restoring backups."],
      settingsProfileHeading: "Settings Profile",
      settingsProfileDescription: "Export preferences and tags.",
      settingsProfileImportLabel: "Import profile",
      settingsProfileExportLabel: "Export profile",
      settingsProfileFileInputLabel: "Choose settings profile JSON",
      importingSettingsProfile: false,
      exportingSettingsProfile: false,
      optimizationHeading: "Optimization",
      vacuumDescription: "Optimize the database.",
      vacuumLabel: "Optimize now",
      vacuuming: false,
      logsHeading: "Logs",
      openLogDirDescription: "Open the log directory.",
      openLogDirLabel: "Open log directory",
      openingLogDir: false,
      onVacuum: vi.fn(),
      onOpenLogDir: vi.fn(),
      onImportSettingsProfile: vi.fn(),
      onExportSettingsProfile: vi.fn(),
    };

    const { rerender } = render(<DataSettingsView {...props} databaseSizeStatus="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading database size");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("data-database-size-status", "loading");
    expect(screen.queryByText("1.50 MB")).not.toBeInTheDocument();

    rerender(<DataSettingsView {...props} databaseSizeStatus="ready" />);

    expect(screen.getByRole("status")).toHaveTextContent("1.50 MB");
    expect(screen.getByRole("status")).toHaveAttribute("data-database-size-status", "ready");

    rerender(<DataSettingsView {...props} databaseSizeStatus="error" />);

    expect(screen.getByRole("status")).toHaveTextContent("Database size unavailable");
    expect(screen.getByRole("status")).toHaveAttribute("data-database-size-status", "error");
    expect(screen.queryByText("Loading database size")).not.toBeInTheDocument();
  });
});
