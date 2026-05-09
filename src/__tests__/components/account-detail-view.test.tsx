import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountDetailView, type AccountDetailViewProps } from "@/components/settings/account-detail/view";

function renderAccountDetailView(syncSectionOverrides: Partial<AccountDetailViewProps["syncSection"]> = {}) {
  render(
    <AccountDetailView
      title="FreshRSS"
      generalSection={{
        heading: "General",
        nameLabel: "Description",
        nameValue: "FreshRSS",
        editNameTitle: "Click to edit",
        isEditingName: false,
        nameDraft: "FreshRSS",
        infoRows: [{ label: "Type", value: "FreshRSS" }],
        onStartEditingName: vi.fn(),
        onNameDraftChange: vi.fn(),
        onCommitName: vi.fn(),
        onNameKeyDown: vi.fn(),
      }}
      syncSection={{
        heading: "Syncing",
        syncInterval: {
          name: "sync-interval",
          label: "Sync",
          value: "3600",
          options: [{ value: "3600", label: "Every hour" }],
          onChange: vi.fn(),
        },
        syncOnWake: {
          label: "Sync on wake",
          checked: false,
          onChange: vi.fn(),
        },
        syncOnStartup: {
          label: "Sync on startup",
          checked: true,
          onChange: vi.fn(),
        },
        keepReadItems: {
          name: "keep-read-items",
          label: "Keep read items",
          value: "30",
          options: [{ value: "30", label: "One month" }],
          onChange: vi.fn(),
        },
        ...syncSectionOverrides,
      }}
      dangerZone={{
        dataHeading: "Data",
        dangerHeading: "Danger Zone",
        exportLabel: "Export OPML",
        deleteLabel: "Delete account",
        onExport: vi.fn(),
        onRequestDelete: vi.fn(),
      }}
    />,
  );
}

describe("AccountDetailView", () => {
  it("composes the account detail sections from view props", () => {
    render(
      <AccountDetailView
        title="Personal FreshRSS"
        subtitle="FreshRss"
        generalSection={{
          heading: "General",
          nameLabel: "Description",
          nameValue: "Personal FreshRSS",
          editNameTitle: "Click to edit",
          isEditingName: false,
          nameDraft: "Personal FreshRSS",
          infoRows: [
            { label: "Type", value: "FreshRSS" },
            {
              label: "Server",
              value: "https://freshrss.example.com",
              truncate: true,
            },
          ],
          onStartEditingName: vi.fn(),
          onNameDraftChange: vi.fn(),
          onCommitName: vi.fn(),
          onNameKeyDown: vi.fn(),
        }}
        syncSection={{
          heading: "Syncing",
          syncInterval: {
            name: "sync-interval",
            label: "Sync",
            value: "3600",
            options: [{ value: "3600", label: "Every hour" }],
            onChange: vi.fn(),
          },
          syncOnWake: {
            label: "Sync on wake",
            checked: false,
            onChange: vi.fn(),
          },
          syncOnStartup: {
            label: "Sync on startup",
            checked: true,
            onChange: vi.fn(),
          },
          keepReadItems: {
            name: "keep-read-items",
            label: "Keep read items",
            value: "30",
            options: [{ value: "30", label: "One month" }],
            onChange: vi.fn(),
          },
          statusRows: [
            { label: "Next automatic retry", value: "Apr 13, 12:15" },
            { label: "Last sync error", value: "Network timeout" },
          ],
        }}
        dangerZone={{
          dataHeading: "Data",
          dangerHeading: "Danger Zone",
          exportLabel: "Export OPML",
          deleteLabel: "Delete account",
          onExport: vi.fn(),
          onRequestDelete: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Personal FreshRSS" })).toBeInTheDocument();
    expect(screen.getByText("FreshRss")).toBeInTheDocument();
    expect(screen.getByTestId("account-detail-layout").closest('[data-slot="scroll-area-content"]')).toHaveClass(
      "max-w-[640px]",
      "mx-auto",
    );
    expect(screen.getByRole("heading", { level: 3, name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Syncing" })).toBeInTheDocument();
    expect(screen.getByText("Next automatic retry")).toBeInTheDocument();
    expect(screen.getByText("Apr 13, 12:15")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Danger Zone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export OPML" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("omits the subtitle block when no subtitle is provided", () => {
    render(
      <AccountDetailView
        title="FreshRSS"
        generalSection={{
          heading: "General",
          nameLabel: "Description",
          nameValue: "FreshRSS",
          editNameTitle: "Click to edit",
          isEditingName: false,
          nameDraft: "FreshRSS",
          infoRows: [{ label: "Type", value: "FreshRSS" }],
          onStartEditingName: vi.fn(),
          onNameDraftChange: vi.fn(),
          onCommitName: vi.fn(),
          onNameKeyDown: vi.fn(),
        }}
        syncSection={{
          heading: "Syncing",
          syncInterval: {
            name: "sync-interval",
            label: "Sync",
            value: "3600",
            options: [{ value: "3600", label: "Every hour" }],
            onChange: vi.fn(),
          },
          syncOnWake: {
            label: "Sync on wake",
            checked: false,
            onChange: vi.fn(),
          },
          syncOnStartup: {
            label: "Sync on startup",
            checked: true,
            onChange: vi.fn(),
          },
          keepReadItems: {
            name: "keep-read-items",
            label: "Keep read items",
            value: "30",
            options: [{ value: "30", label: "One month" }],
            onChange: vi.fn(),
          },
        }}
        dangerZone={{
          dataHeading: "Data",
          dangerHeading: "Danger Zone",
          exportLabel: "Export OPML",
          deleteLabel: "Delete account",
          onExport: vi.fn(),
          onRequestDelete: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByText(/^FreshRss$/)).not.toBeInTheDocument();
  });

  it("renders a header summary alongside the stacked title", () => {
    render(
      <AccountDetailView
        title="FreshRSS"
        subtitle="FreshRss"
        headerSummary={<div>Verified</div>}
        generalSection={{
          heading: "General",
          nameLabel: "Description",
          nameValue: "FreshRSS",
          editNameTitle: "Click to edit",
          isEditingName: false,
          nameDraft: "FreshRSS",
          infoRows: [{ label: "Type", value: "FreshRSS" }],
          onStartEditingName: vi.fn(),
          onNameDraftChange: vi.fn(),
          onCommitName: vi.fn(),
          onNameKeyDown: vi.fn(),
        }}
        syncSection={{
          heading: "Syncing",
          syncInterval: {
            name: "sync-interval",
            label: "Sync",
            value: "3600",
            options: [{ value: "3600", label: "Every hour" }],
            onChange: vi.fn(),
          },
          syncOnWake: {
            label: "Sync on wake",
            checked: false,
            onChange: vi.fn(),
          },
          syncOnStartup: {
            label: "Sync on startup",
            checked: true,
            onChange: vi.fn(),
          },
          keepReadItems: {
            name: "keep-read-items",
            label: "Keep read items",
            value: "30",
            options: [{ value: "30", label: "One month" }],
            onChange: vi.fn(),
          },
        }}
        dangerZone={{
          dataHeading: "Data",
          dangerHeading: "Danger Zone",
          exportLabel: "Export OPML",
          deleteLabel: "Delete account",
          onExport: vi.fn(),
          onRequestDelete: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("passes setup guidance through the sync section composition", () => {
    render(
      <AccountDetailView
        title="FreshRSS"
        headerSummary={<div>Verified</div>}
        generalSection={{
          heading: "General",
          nameLabel: "Description",
          nameValue: "FreshRSS",
          editNameTitle: "Click to edit",
          isEditingName: false,
          nameDraft: "FreshRSS",
          infoRows: [{ label: "Type", value: "FreshRSS" }],
          onStartEditingName: vi.fn(),
          onNameDraftChange: vi.fn(),
          onCommitName: vi.fn(),
          onNameKeyDown: vi.fn(),
          disabled: true,
        }}
        syncSection={{
          heading: "Initial setup in progress",
          note: "Finish the first sync before closing this screen.",
          syncInterval: {
            name: "sync-interval",
            label: "Sync",
            value: "3600",
            options: [{ value: "3600", label: "Every hour" }],
            onChange: vi.fn(),
            disabled: true,
          },
          syncOnWake: {
            label: "Sync on wake",
            checked: false,
            onChange: vi.fn(),
            disabled: true,
          },
          syncOnStartup: {
            label: "Sync on startup",
            checked: true,
            onChange: vi.fn(),
            disabled: true,
          },
          keepReadItems: {
            name: "keep-read-items",
            label: "Keep read items",
            value: "30",
            options: [{ value: "30", label: "One month" }],
            onChange: vi.fn(),
            disabled: true,
          },
          syncNowLabel: "Retry setup",
          onSyncNow: vi.fn(),
          secondaryActionLabel: "Edit credentials",
          onSecondaryAction: vi.fn(),
        }}
        dangerZone={{
          dataHeading: "Data",
          dangerHeading: "Danger Zone",
          exportLabel: "Export OPML",
          deleteLabel: "Delete account",
          onExport: vi.fn(),
          onRequestDelete: vi.fn(),
          disabled: true,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Initial setup in progress",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Finish the first sync before closing this screen.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit credentials" })).toBeInTheDocument();
  });

  it("renders determinate sync progress with the current account label", () => {
    renderAccountDetailView({
      progressLabel: "1 of 2 completed",
      progressValue: 50,
      progressCurrentLabel: "Syncing: FreshRSS",
    });

    expect(screen.getByText("1 of 2 completed")).toBeInTheDocument();
    expect(screen.getByText("Syncing: FreshRSS")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 2 completed" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders indeterminate sync progress without a numeric value", () => {
    renderAccountDetailView({
      progressLabel: "Starting sync",
      progressValue: null,
    });

    expect(screen.getByText("Starting sync")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Starting sync" })).not.toHaveAttribute("aria-valuenow");
  });

  it("omits sync progress when no progress label is provided", () => {
    renderAccountDetailView();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
