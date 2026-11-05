import { Result } from "@praha/byethrow";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_PROFILE_IMPORT_MAX_BYTES } from "@/api/schemas/commands/settings-profile";
import { DataSettings } from "@/components/settings/data-settings";
import { useUiStore } from "@/stores/ui-store";

const commands = vi.hoisted(() => ({
  getDatabaseInfo: vi.fn(),
  getCredentialStorage: vi.fn(),
  vacuumDatabase: vi.fn(),
  backupDatabase: vi.fn(),
  openLogDir: vi.fn(),
  exportSettingsProfileToFile: vi.fn(),
  importSettingsProfile: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  getDatabaseInfo: commands.getDatabaseInfo,
  getCredentialStorage: commands.getCredentialStorage,
  setCredentialStorage: vi.fn(),
  vacuumDatabase: commands.vacuumDatabase,
  backupDatabase: commands.backupDatabase,
  openLogDir: commands.openLogDir,
  exportSettingsProfileToFile: commands.exportSettingsProfileToFile,
  importSettingsProfile: commands.importSettingsProfile,
}));

vi.mock("@/lib/platform/save-dialog", () => ({
  showSaveDialog: commands.showSaveDialog,
}));

const databaseInfo = Result.succeed({
  db_size_bytes: 2048,
  wal_size_bytes: 0,
  shm_size_bytes: 0,
  total_size_bytes: 2048,
});

function userVisibleFailure(message: string) {
  return Result.fail({ type: "UserVisible" as const, message });
}

function getSection(heading: string): HTMLElement {
  const section = screen.getByRole("heading", { name: heading }).closest("section");
  if (!section) {
    throw new Error(`expected heading "${heading}" to be inside a section`);
  }

  return section;
}

async function renderDataSettings() {
  const { wrapper } = createQueryWrapper();
  render(<DataSettings />, { wrapper });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Optimize" })).toBeEnabled();
  });
}

describe("DataSettings failures", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useUiStore.setState({ showToast });
    commands.getDatabaseInfo.mockResolvedValue(databaseInfo);
    commands.getCredentialStorage.mockResolvedValue(Result.succeed({ storage: "local_file", configurable: false }));
    commands.vacuumDatabase.mockResolvedValue(databaseInfo);
    commands.backupDatabase.mockResolvedValue(Result.succeed(null));
    commands.openLogDir.mockResolvedValue(Result.succeed(null));
    commands.exportSettingsProfileToFile.mockResolvedValue(Result.succeed(null));
    commands.importSettingsProfile.mockResolvedValue(Result.succeed({}));
    commands.showSaveDialog.mockResolvedValue("/tmp/profile.json");
  });

  it("keeps an optimize failure in the database section, not only in the toast", async () => {
    const user = userEvent.setup();
    commands.vacuumDatabase.mockResolvedValueOnce(userVisibleFailure("database is locked"));
    await renderDataSettings();

    await user.click(screen.getByRole("button", { name: "Optimize" }));

    expect(await within(getSection("Database")).findByRole("alert")).toHaveTextContent(
      "Optimization failed: database is locked",
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Optimization failed: database is locked", severity: "error" }),
    );
    expect(within(getSection("Backup and restore")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the optimize failure when the user optimizes again", async () => {
    const user = userEvent.setup();
    commands.vacuumDatabase.mockResolvedValueOnce(userVisibleFailure("database is locked"));
    await renderDataSettings();
    await user.click(screen.getByRole("button", { name: "Optimize" }));
    expect(await within(getSection("Database")).findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Optimize" }));

    await waitFor(() => {
      expect(within(getSection("Database")).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("keeps a backup failure in the backup section, not only in the toast", async () => {
    const user = userEvent.setup();
    commands.backupDatabase.mockResolvedValueOnce(userVisibleFailure("no space left on device"));
    await renderDataSettings();

    await user.click(screen.getByRole("button", { name: "Back up now" }));

    expect(await within(getSection("Backup and restore")).findByRole("alert")).toHaveTextContent(
      "Backup failed: no space left on device",
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Backup failed: no space left on device", severity: "error" }),
    );
    expect(within(getSection("Database")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the backup failure when the user backs up again", async () => {
    const user = userEvent.setup();
    commands.backupDatabase.mockResolvedValueOnce(userVisibleFailure("no space left on device"));
    await renderDataSettings();
    await user.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await within(getSection("Backup and restore")).findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back up now" }));

    await waitFor(() => {
      expect(within(getSection("Backup and restore")).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("keeps an open-log-folder failure in the logs section, not only in the toast", async () => {
    const user = userEvent.setup();
    commands.openLogDir.mockResolvedValueOnce(userVisibleFailure("Check OS permissions and try again."));
    await renderDataSettings();

    await user.click(screen.getByRole("button", { name: "Open log directory" }));

    expect(await within(getSection("Logs")).findByRole("alert")).toHaveTextContent(
      "Failed to open log directory: Check OS permissions and try again.",
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to open log directory: Check OS permissions and try again.",
        severity: "error",
      }),
    );
  });

  it("clears the open-log-folder failure when the user tries again", async () => {
    const user = userEvent.setup();
    commands.openLogDir.mockResolvedValueOnce(userVisibleFailure("Check OS permissions and try again."));
    await renderDataSettings();
    await user.click(screen.getByRole("button", { name: "Open log directory" }));
    expect(await within(getSection("Logs")).findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open log directory" }));

    await waitFor(() => {
      expect(within(getSection("Logs")).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("keeps a settings profile export failure in the settings profile section, not only in the toast", async () => {
    const user = userEvent.setup();
    commands.exportSettingsProfileToFile.mockResolvedValueOnce(userVisibleFailure("permission denied"));
    await renderDataSettings();

    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(await within(getSection("Settings profile")).findByRole("alert")).toHaveTextContent(
      "Failed to export settings profile: permission denied",
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to export settings profile: permission denied", severity: "error" }),
    );
  });

  it("clears the export failure when the user exports again", async () => {
    const user = userEvent.setup();
    commands.exportSettingsProfileToFile.mockResolvedValueOnce(userVisibleFailure("permission denied"));
    await renderDataSettings();
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(await within(getSection("Settings profile")).findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(within(getSection("Settings profile")).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("shows an info toast when the user cancels the export location picker", async () => {
    const user = userEvent.setup();
    commands.showSaveDialog.mockResolvedValueOnce(null);
    await renderDataSettings();

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    });
    expect(commands.exportSettingsProfileToFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Settings profile export canceled", severity: "info" }),
    );
  });

  it("keeps a settings profile import failure in the settings profile section, not only in the toast", async () => {
    const user = userEvent.setup();
    commands.importSettingsProfile.mockResolvedValueOnce(userVisibleFailure("unsupported profile version"));
    await renderDataSettings();

    await user.upload(
      screen.getByLabelText("Choose settings profile JSON"),
      new File(['{"version":99}'], "profile.json", { type: "application/json" }),
    );

    expect(await within(getSection("Settings profile")).findByRole("alert")).toHaveTextContent(
      "Failed to import settings profile: unsupported profile version",
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to import settings profile: unsupported profile version",
        severity: "error",
      }),
    );
  });

  it("clears the import failure when the user imports again", async () => {
    const user = userEvent.setup();
    commands.importSettingsProfile.mockResolvedValueOnce(userVisibleFailure("unsupported profile version"));
    await renderDataSettings();
    const profile = new File(['{"version":99}'], "profile.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Choose settings profile JSON"), profile);
    expect(await within(getSection("Settings profile")).findByRole("alert")).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Choose settings profile JSON"), profile);

    await waitFor(() => {
      expect(within(getSection("Settings profile")).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("tells the user in plain words that an oversized settings file is too large to import", async () => {
    const user = userEvent.setup();
    await renderDataSettings();

    await user.upload(
      screen.getByLabelText("Choose settings profile JSON"),
      new File(["a".repeat(SETTINGS_PROFILE_IMPORT_MAX_BYTES + 1)], "profile.json", { type: "application/json" }),
    );

    const alert = await within(getSection("Settings profile")).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Failed to import settings profile: The file is too large. Choose a settings file of 1.0 MiB or less.",
    );
    expect(alert).not.toHaveTextContent("UTF-8");
    expect(commands.importSettingsProfile).not.toHaveBeenCalled();
  });
});
