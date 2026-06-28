import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountSyncSectionView } from "@/components/settings/account-detail/sync-section-view";

function expectStandardSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("h-9", "min-h-9", "px-3");
  expect(button).toHaveClass("text-[13px]", "font-medium");
  expect(button).not.toHaveClass("h-11", "px-4");
}

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

  it("renders determinate sync progress text while syncing", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        progressLabel="1 of 3 completed"
        progressValue={33}
        progressCurrentLabel="Syncing: FreshRSS"
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

    expect(screen.getByRole("progressbar", { name: "1 of 3 completed" })).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("1 of 3 completed")).toBeInTheDocument();
    expect(screen.getByText("Syncing: FreshRSS")).toBeInTheDocument();
  });

  it("clamps determinate sync progress aria value to the progressbar range", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        progressLabel="3 of 2 completed"
        progressValue={150}
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
      />,
    );

    expect(screen.getByRole("progressbar", { name: "3 of 2 completed" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders indeterminate sync progress without a numeric value", () => {
    render(
      <AccountSyncSectionView
        heading="Syncing"
        progressLabel="Starting sync"
        progressValue={null}
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

    const progress = screen.getByRole("progressbar", { name: "Starting sync" });

    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByText("Starting sync")).toBeInTheDocument();
  });

  it("does not render sync progress when no progress label is provided", () => {
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
    expectStandardSettingsActionButton(button);
    expect(button).toHaveClass(
      "border",
      "border-[var(--settings-shell-control-border)]",
      "shadow-[var(--settings-shell-control-shadow)]",
      "bg-surface-2/82",
      "text-foreground",
    );
    expect(button.querySelector("[data-slot='loading-spinner']")).not.toBeNull();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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
    expect(screen.getByText("Next sync")).toHaveClass("text-[11px]", "text-foreground-soft");
  });

  it("renders setup note and secondary action for failed setup state", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onEditCredentials = vi.fn();

    render(
      <AccountSyncSectionView
        heading="Initial setup in progress"
        note="Finish the first sync before closing this screen."
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [{ value: "3600", label: "Every hour" }],
          onChange: () => {},
          disabled: true,
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: () => {},
          disabled: true,
        }}
        syncOnStartup={{
          label: "Sync on startup",
          checked: true,
          onChange: () => {},
          disabled: true,
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [{ value: "30", label: "One month" }],
          onChange: () => {},
          disabled: true,
        }}
        syncNowLabel="Retry setup"
        onSyncNow={onRetry}
        secondaryActionLabel="Edit credentials"
        onSecondaryAction={onEditCredentials}
      />,
    );

    expect(screen.getByText("Finish the first sync before closing this screen.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sync" })).toHaveAttribute("data-disabled", "");
    expect(screen.getByRole("switch", { name: "Sync on wake" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("switch", { name: "Sync on startup" })).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Retry setup" }));
    const editCredentialsButton = screen.getByRole("button", { name: "Edit credentials" });
    expectStandardSettingsActionButton(editCredentialsButton);
    await user.click(editCredentialsButton);

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onEditCredentials).toHaveBeenCalledOnce();
  });

  it("renders dev credential recovery as a separate action beside sync and secondary actions", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onEditCredentials = vi.fn();
    const onRecoverDevCredentials = vi.fn();

    render(
      <AccountSyncSectionView
        heading="Initial setup in progress"
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
        syncNowLabel="Retry setup"
        onSyncNow={onRetry}
        secondaryActionLabel="Edit credentials"
        onSecondaryAction={onEditCredentials}
        devCredentialsRecoveryActionLabel="Recover Dev credentials"
        devCredentialsRecoveryLoadingLabel="Recovering..."
        onDevCredentialsRecoveryAction={onRecoverDevCredentials}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retry setup" }));
    await user.click(screen.getByRole("button", { name: "Edit credentials" }));
    const recoveryButton = screen.getByRole("button", { name: "Recover Dev credentials" });
    expectStandardSettingsActionButton(recoveryButton);
    await user.click(recoveryButton);

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onEditCredentials).toHaveBeenCalledOnce();
    expect(onRecoverDevCredentials).toHaveBeenCalledOnce();
  });

  it("shows the dev credential recovery loading state and blocks competing sync actions", async () => {
    const user = userEvent.setup();
    const onSyncNow = vi.fn();
    const onRecoverDevCredentials = vi.fn();

    render(
      <AccountSyncSectionView
        heading="Initial setup failed"
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
        syncNowLabel="Retry setup"
        syncingLabel="Syncing now"
        onSyncNow={onSyncNow}
        devCredentialsRecoveryActionLabel="Recover Dev credentials"
        devCredentialsRecoveryLoadingLabel="Recovering..."
        onDevCredentialsRecoveryAction={onRecoverDevCredentials}
        isDevCredentialsRecoveryInFlight={true}
      />,
    );

    const retryButton = screen.getByRole("button", { name: "Retry setup" });
    expect(retryButton).toBeDisabled();
    const recoveryButton = screen.getByRole("button", { name: "Recovering..." });
    expect(recoveryButton).toBeDisabled();
    expect(recoveryButton).toHaveAttribute("aria-busy", "true");
    expect(recoveryButton.querySelector("[data-slot='loading-spinner']")).not.toBeNull();

    await user.click(retryButton);
    await user.click(recoveryButton);

    expect(onSyncNow).not.toHaveBeenCalled();
    expect(onRecoverDevCredentials).not.toHaveBeenCalled();
  });

  it("disables secondary and dev credential recovery actions while a sync action is in flight", async () => {
    const user = userEvent.setup();
    const onSecondaryAction = vi.fn();
    const onDevCredentialsRecoveryAction = vi.fn();

    render(
      <AccountSyncSectionView
        heading="Initial setup failed"
        syncInterval={{
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [{ value: "3600", label: "Every hour" }],
          onChange: () => {},
          disabled: true,
        }}
        syncOnWake={{
          label: "Sync on wake",
          checked: true,
          onChange: () => {},
          disabled: true,
        }}
        syncOnStartup={{
          label: "Sync on startup",
          checked: true,
          onChange: () => {},
          disabled: true,
        }}
        keepReadItems={{
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [{ value: "30", label: "One month" }],
          onChange: () => {},
          disabled: true,
        }}
        syncNowLabel="Retry setup"
        syncingLabel="Syncing now"
        onSyncNow={() => {}}
        isSyncing={true}
        secondaryActionLabel="Edit credentials"
        onSecondaryAction={onSecondaryAction}
        devCredentialsRecoveryActionLabel="Recover Dev credentials"
        onDevCredentialsRecoveryAction={onDevCredentialsRecoveryAction}
      />,
    );

    const secondaryButton = screen.getByRole("button", { name: "Edit credentials" });
    const recoveryButton = screen.getByRole("button", { name: "Recover Dev credentials" });
    expect(secondaryButton).toBeDisabled();
    expect(recoveryButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Syncing now" })).toBeDisabled();

    await user.click(secondaryButton);
    await user.click(recoveryButton);

    expect(onSecondaryAction).not.toHaveBeenCalled();
    expect(onDevCredentialsRecoveryAction).not.toHaveBeenCalled();
  });
});
