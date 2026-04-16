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
        syncOnStartup={{
          label: "Sync on startup",
          checked: false,
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
    expect(screen.getByRole("switch", { name: "Sync on startup" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Keep read items" })).toHaveTextContent("Forever");
  });

  it("delegates sync control changes", async () => {
    const user = userEvent.setup();
    const onSyncIntervalChange = vi.fn();
    const onSyncOnWakeChange = vi.fn();
    const onSyncOnStartupChange = vi.fn();
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
        syncOnStartup={{
          label: "Sync on startup",
          checked: false,
          onChange: onSyncOnStartupChange,
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
    await user.click(screen.getByRole("switch", { name: "Sync on startup" }));
    await user.click(screen.getByRole("combobox", { name: "Keep read items" }));
    await user.click(await screen.findByRole("option", { name: "Three months" }));

    expect(onSyncIntervalChange).toHaveBeenCalledWith("7200");
    expect(onSyncOnWakeChange).toHaveBeenCalledOnce();
    expect(onSyncOnWakeChange.mock.calls[0]?.[0]).toBe(false);
    expect(onSyncOnStartupChange).toHaveBeenCalledOnce();
    expect(onSyncOnStartupChange.mock.calls[0]?.[0]).toBe(true);
    expect(onKeepReadItemsChange).toHaveBeenCalledWith("90");
  });

  it("shows a loading button while syncing", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [{ value: "3600", label: "Every hour" }],
          onChange: () => {},
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: () => {},
        }}
        syncOnStartup={{
          label: "Sync on startup",
          checked: true,
          onChange: () => {},
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [{ value: "30", label: "One month" }],
          onChange: () => {},
        }}
        syncNowLabel="Sync Now"
        syncingLabel="Syncing..."
        onSyncNow={() => {}}
        isSyncing={true}
      />,
    );

    const button = screen.getByRole("button", { name: "Syncing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("w-full");
    expect(button).toHaveClass("sm:w-auto");
    expect(button.querySelector("[data-slot='loading-spinner']")).not.toBeNull();
  });

  it("uses softened support surfaces for scheduler status rows", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [{ value: "3600", label: "Every hour" }],
          onChange: () => {},
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: () => {},
        }}
        syncOnStartup={{
          label: "Sync on startup",
          checked: true,
          onChange: () => {},
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [{ value: "30", label: "One month" }],
          onChange: () => {},
        }}
        statusRows={[
          { label: "Next sync", value: "Today at 10:30" },
          { label: "Retry", value: "in 15 minutes" },
        ]}
      />,
    );

    const statusSurface = screen.getByText("Today at 10:30").closest("div.rounded-md");

    expect(statusSurface).toHaveClass("bg-surface-1/72");
    expect(screen.getByText("Next sync")).toHaveClass("text-foreground-soft");
  });
});
