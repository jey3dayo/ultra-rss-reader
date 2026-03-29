import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountSyncSectionView } from "@/components/settings/account-sync-section-view";

describe("AccountSyncSectionView", () => {
  it("renders normalized sync controls with accessible labels", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [
            { value: "1800", label: "Every 30 minutes" },
            { value: "3600", label: "Every hour" },
          ],
          onChange: () => {},
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: () => {},
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "0",
          options: [
            { value: "30", label: "One month" },
            { value: "0", label: "Forever" },
          ],
          onChange: () => {},
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Syncing" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sync" })).toHaveTextContent("Every hour");
    expect(screen.getByRole("switch", { name: "Sync on wake" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Keep read items" })).toHaveTextContent("Forever");
  });

  it("delegates sync control changes", async () => {
    const user = userEvent.setup();
    const onSyncIntervalChange = vi.fn();
    const onSyncOnWakeChange = vi.fn();
    const onKeepReadItemsChange = vi.fn();

    render(
      <AccountSyncSectionView
        heading="Syncing"
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [
            { value: "3600", label: "Every hour" },
            { value: "7200", label: "Every 2 hours" },
          ],
          onChange: onSyncIntervalChange,
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: onSyncOnWakeChange,
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [
            { value: "30", label: "One month" },
            { value: "90", label: "Three months" },
          ],
          onChange: onKeepReadItemsChange,
        }}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sync" }));
    await user.click(await screen.findByRole("option", { name: "Every 2 hours" }));
    await user.click(screen.getByRole("switch", { name: "Sync on wake" }));
    await user.click(screen.getByRole("combobox", { name: "Keep read items" }));
    await user.click(await screen.findByRole("option", { name: "Three months" }));

    expect(onSyncIntervalChange).toHaveBeenCalledWith("7200");
    expect(onSyncOnWakeChange).toHaveBeenCalledWith(false);
    expect(onKeepReadItemsChange).toHaveBeenCalledWith("90");
  });
});
