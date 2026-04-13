import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSettingsView } from "@/components/settings/data-settings-view";

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
        databaseSizeValue="1.50 MB"
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimize now"
        vacuuming={false}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        onVacuum={onVacuum}
        onOpenLogDir={onOpenLogDir}
      />,
    );

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByText("1.50 MB")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Optimize now" }));
    await user.click(screen.getByRole("button", { name: "Open log directory" }));

    expect(onVacuum).toHaveBeenCalledTimes(1);
    expect(onOpenLogDir).toHaveBeenCalledTimes(1);
  });

  it("shows the loading label while vacuuming", () => {
    render(
      <DataSettingsView
        title="Data"
        databaseHeading="Database"
        databaseSizeLabel="Database size"
        databaseSizeValue="..."
        optimizationHeading="Optimization"
        vacuumDescription="Optimize the database."
        vacuumLabel="Optimizing..."
        vacuuming={true}
        logsHeading="Logs"
        openLogDirDescription="Open the log directory."
        openLogDirLabel="Open log directory"
        onVacuum={vi.fn()}
        onOpenLogDir={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Optimizing..." })).toBeDisabled();
  });
});
