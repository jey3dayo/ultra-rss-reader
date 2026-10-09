import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSettingsView } from "@/components/settings/data-settings-view";

function expectStandardSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("h-9", "min-h-9", "px-3");
  expect(button).toHaveClass("text-[13px]", "font-medium");
  expect(button).not.toHaveClass("h-11", "px-4");
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
    expect(screen.queryByRole("heading", { name: "Optimization" })).not.toBeInTheDocument();
    expect(screen.getByText("1.50 MB")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("heading", { name: "Backup and Restore" })).toBeInTheDocument();
    expect(
      screen.getByText("Restore outside the app: quit it first and confirm the account and item count."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Use OPML export.")).not.toBeInTheDocument();
    expect(screen.queryByText("Recovery action criteria")).not.toBeInTheDocument();
    expect(screen.getByText("Reclaims unused space.")).toHaveClass("font-sans", "text-foreground-soft");
    expect(screen.getByText("Open the log directory.")).toHaveClass("font-sans", "text-foreground-soft");

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const openLogDirectoryButton = screen.getByRole("button", {
      name: "Open log directory",
    });
    expect(optimizeButton.closest("section")).toBe(
      screen.getByRole("heading", { name: "Database" }).closest("section"),
    );
    expectStandardSettingsActionButton(optimizeButton);
    expectStandardSettingsActionButton(openLogDirectoryButton);

    await user.click(optimizeButton);
    await user.click(openLogDirectoryButton);

    expect(onVacuum).toHaveBeenCalledTimes(1);
    expect(onOpenLogDir).toHaveBeenCalledTimes(1);
  });

  it("keeps backup guidance concise and opens full details without running data actions", async () => {
    const user = userEvent.setup();
    const onBackupDatabase = vi.fn();
    const onVacuum = vi.fn();
    const safetyDescription = "Keep a rollback path before changing user data.";
    const checklist = [
      "Use OPML export for subscription moves.",
      "Quit the app before restoring a database backup.",
      "Check the target account and item count before deleting or restoring data.",
    ];
    const backupDescription = "Back up the current database to guard against corruption outside a migration.";

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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription={safetyDescription}
        safetyChecklist={checklist}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription={backupDescription}
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={onBackupDatabase}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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

    expect(
      screen.getByText("Restore outside the app: quit it first and confirm the account and item count."),
    ).toBeInTheDocument();
    expect(screen.getByText("Save a current database copy while the app is running.")).toBeInTheDocument();
    expect(screen.queryByText(safetyDescription)).not.toBeInTheDocument();
    expect(screen.queryByText(backupDescription)).not.toBeInTheDocument();
    for (const item of checklist) {
      expect(screen.queryByText(item)).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Show backup and restore steps" }));

    expect(screen.getByText(safetyDescription)).toBeInTheDocument();
    for (const item of checklist) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Show backup details" }));
    expect(screen.getByText(backupDescription)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show optimization details" }));

    expect(screen.getByText("Reclaim unused space by optimizing the database.")).toBeInTheDocument();
    expect(onBackupDatabase).not.toHaveBeenCalled();
    expect(onVacuum).not.toHaveBeenCalled();
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
    const fallbackReason = screen.getByText("Reclaims unused space. Database size unavailable");

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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences, account skeletons, tags, and mute keywords. Server URLs and usernames are included; passwords and article data are excluded, so this file restores neither your library nor your sign-ins."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
    expect(screen.getByText("Contains server URLs and usernames. Keep the file private.")).toBeInTheDocument();
    expect(
      screen.getByText("Restore outside the app: quit it first and confirm the account and item count."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Export preferences, account skeletons, tags, and mute keywords. Server URLs and usernames are included; passwords and article data are excluded, so this file restores neither your library nor your sign-ins.",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show settings profile details" }));
    expect(
      screen.getByText(
        "Export preferences, account skeletons, tags, and mute keywords. Server URLs and usernames are included; passwords and article data are excluded, so this file restores neither your library nor your sign-ins.",
      ),
    ).toBeInTheDocument();
    expect(onExportSettingsProfile).not.toHaveBeenCalled();
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileImportActionLabel="Importing..."
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={true}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileExportActionLabel="Exporting..."
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={true}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={vi.fn()}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
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
    const fallbackReason = screen.getByText("Reclaims unused space. Loading database size");

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
      safetySummary: "Restore outside the app: quit it first and confirm the account and item count.",
      safetyDescription: "Confirm rollback before changing user data.",
      safetyChecklist: [
        "Use OPML export.",
        "Quit before restoring backups.",
        "Confirm the target account and item count.",
      ],
      safetyInfoAriaLabel: "Show backup and restore steps",
      backupLabel: "Back up",
      backupSummary: "Save a current database copy while the app is running.",
      backupDescription: "Back up the database now to guard against corruption outside a migration.",
      backupInfoAriaLabel: "Show backup details",
      backingUp: false,
      onBackupDatabase: vi.fn(),
      settingsProfileHeading: "Settings Profile",
      settingsProfileDescription: "Export preferences and tags.",
      settingsProfilePrivacyWarning: "Contains server URLs and usernames. Keep the file private.",
      settingsProfileInfoAriaLabel: "Show settings profile details",
      settingsProfileImportLabel: "Import profile",
      settingsProfileExportLabel: "Export profile",
      settingsProfileFileInputLabel: "Choose settings profile JSON",
      importingSettingsProfile: false,
      exportingSettingsProfile: false,
      optimizationHeading: "Optimization",
      vacuumSummary: "Reclaims unused space.",
      vacuumDescription: "Reclaim unused space by optimizing the database.",
      vacuumInfoAriaLabel: "Show optimization details",
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

  it("delegates the manual backup action from the backup and restore section", async () => {
    const user = userEvent.setup();
    const onBackupDatabase = vi.fn();

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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backingUp={false}
        onBackupDatabase={onBackupDatabase}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const backupButton = screen.getByRole("button", { name: "Back up" });
    expect(backupButton.closest("section")).toBe(
      screen.getByRole("heading", { name: "Backup and Restore" }).closest("section"),
    );

    await user.click(backupButton);

    expect(onBackupDatabase).toHaveBeenCalledTimes(1);
  });

  it("shows busy feedback and keeps the backup action disabled while backing up", async () => {
    const user = userEvent.setup();
    const onBackupDatabase = vi.fn();

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
        safetySummary="Restore outside the app: quit it first and confirm the account and item count."
        safetyDescription="Confirm rollback before changing user data."
        safetyChecklist={[
          "Use OPML export.",
          "Quit before restoring backups.",
          "Confirm the target account and item count.",
        ]}
        safetyInfoAriaLabel="Show backup and restore steps"
        backupLabel="Back up"
        backupSummary="Save a current database copy while the app is running."
        backupDescription="Back up the database now to guard against corruption outside a migration."
        backupInfoAriaLabel="Show backup details"
        backupActionLabel="Backing up..."
        backingUp={true}
        onBackupDatabase={onBackupDatabase}
        settingsProfileHeading="Settings Profile"
        settingsProfileDescription="Export preferences and tags."
        settingsProfilePrivacyWarning="Contains server URLs and usernames. Keep the file private."
        settingsProfileInfoAriaLabel="Show settings profile details"
        settingsProfileImportLabel="Import profile"
        settingsProfileExportLabel="Export profile"
        settingsProfileFileInputLabel="Choose settings profile JSON"
        importingSettingsProfile={false}
        exportingSettingsProfile={false}
        optimizationHeading="Optimization"
        vacuumSummary="Reclaims unused space."
        vacuumDescription="Reclaim unused space by optimizing the database."
        vacuumInfoAriaLabel="Show optimization details"
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        openingLogDir={false}
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
        onImportSettingsProfile={vi.fn()}
        onExportSettingsProfile={vi.fn()}
      />,
    );

    const backupButton = screen.getByRole("button", { name: "Backing up..." });
    expect(backupButton).toBeDisabled();
    expect(backupButton).toHaveAttribute("aria-busy", "true");

    await user.click(backupButton);

    expect(onBackupDatabase).not.toHaveBeenCalled();
  });
});
