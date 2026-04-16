import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountDetailView } from "@/components/settings/account-detail-view";

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
            { label: "Server", value: "https://freshrss.example.com", truncate: true },
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
    expect(screen.getByTestId("account-detail-layout")).toHaveClass("max-w-[640px]");
    expect(screen.getByTestId("account-detail-layout")).toHaveClass("mx-auto");
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
});
