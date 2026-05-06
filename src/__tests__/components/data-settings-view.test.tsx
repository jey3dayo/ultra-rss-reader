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
    expect(screen.getByText("1.50 MB")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Optimize the database.")).toHaveClass("font-serif", "text-foreground-soft");
    expect(screen.getByText("Open the log directory.")).toHaveClass("font-serif", "text-foreground-soft");

    const optimizeButton = screen.getByRole("button", { name: "Optimize now" });
    const openLogDirectoryButton = screen.getByRole("button", { name: "Open log directory" });
    expectStandardSettingsActionButton(optimizeButton);
    expectStandardSettingsActionButton(openLogDirectoryButton);

    await user.click(optimizeButton);
    await user.click(openLogDirectoryButton);

    expect(onVacuum).toHaveBeenCalledTimes(1);
    expect(onOpenLogDir).toHaveBeenCalledTimes(1);
  });

  it("shows the loading label while vacuuming and keeps the action disabled", async () => {
    const user = userEvent.setup();
    const onVacuum = vi.fn();

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
        onVacuum={onVacuum}
        onOpenLogDir={vi.fn()}
      />,
    );

    const vacuumButton = screen.getByRole("button", { name: "Optimizing..." });
    expect(vacuumButton).toBeDisabled();

    await user.click(vacuumButton);

    expect(onVacuum).not.toHaveBeenCalled();
  });
});
