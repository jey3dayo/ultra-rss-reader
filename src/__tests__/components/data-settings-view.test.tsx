import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSettingsView } from "@/components/settings/data-settings-view";

function expectStandardSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("w-full");
  expect(button).toHaveClass("sm:w-auto");
  expect(button).toHaveClass("h-10", "px-4");
  expect([...button.classList].filter((className) => className.includes("min-w"))).toEqual([]);
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
        recoveryCriteriaHeading="Recovery action criteria"
        recoveryCriteriaTargetUnknownLabel="Disabled until the target is known."
        destructiveRecoveryCriteria={[
          {
            action: "Clean up orphaned data",
            requirement: "Show dry-run counts before cleanup.",
            disabledWhenTargetUnknown: true,
          },
          {
            action: "Open logs",
            requirement: "No destructive confirmation required.",
            disabledWhenTargetUnknown: false,
          },
        ]}
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
      />,
    );

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByText("1.50 MB")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("heading", { name: "Backup and Restore" })).toBeInTheDocument();
    expect(screen.getByText("Use OPML export.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recovery action criteria" })).toBeInTheDocument();
    expect(screen.getByText(/Clean up orphaned data/)).toHaveClass("font-medium");
    expect(screen.getByText(/Show dry-run counts before cleanup/)).toBeInTheDocument();
    expect(screen.getByText(/Disabled until the target is known/)).toBeInTheDocument();
    expect(
      screen.queryByText(/No destructive confirmation required.*Disabled until the target is known/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Optimize the database.")).toHaveClass("font-serif", "text-foreground-soft");
    expect(screen.getByText("Open the log directory.")).toHaveClass("font-serif", "text-foreground-soft");

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
      />,
    );

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const fallbackReason = screen.getByText("Optimize the database. Database size unavailable");

    expect(optimizeButton).toBeDisabled();
    expect(optimizeButton).toHaveAttribute("aria-describedby", fallbackReason.id);

    await user.click(optimizeButton);

    expect(onVacuum).not.toHaveBeenCalled();
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
      />,
    );

    const vacuumButton = screen.getByRole("button", { name: "Optimizing..." });
    expect(vacuumButton).toBeDisabled();

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
      />,
    );

    const openLogDirectoryButton = screen.getByRole("button", {
      name: "Opening...",
    });
    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });

    expect(openLogDirectoryButton).toBeDisabled();
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
    };

    const { rerender } = render(<DataSettingsView {...props} databaseSizeStatus="loading" />);

    expect(screen.getByText("Loading database size")).toHaveAttribute("data-database-size-status", "loading");
    expect(screen.queryByText("1.50 MB")).not.toBeInTheDocument();

    rerender(<DataSettingsView {...props} databaseSizeStatus="ready" />);

    expect(screen.getByText("1.50 MB")).toHaveAttribute("data-database-size-status", "ready");

    rerender(<DataSettingsView {...props} databaseSizeStatus="error" />);

    expect(screen.getByText("Database size unavailable")).toHaveAttribute("data-database-size-status", "error");
    expect(screen.queryByText("Loading database size")).not.toBeInTheDocument();
  });
});
