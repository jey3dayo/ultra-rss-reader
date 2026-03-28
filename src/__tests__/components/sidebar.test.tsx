import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

let syncCompletedListener: (() => void) | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, callback: () => void) => {
    if (eventName === "sync-completed") {
      syncCompletedListener = callback;
    }
    return () => {
      if (eventName === "sync-completed") {
        syncCompletedListener = null;
      }
    };
  }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    syncCompletedListener = null;
    setupTauriMocks();
  });

  it("renders the sidebar heading", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Ultra RSS")).toBeInTheDocument();
  });

  it("renders smart view items (Unread and Starred buttons)", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Starred")).toBeInTheDocument();
  });

  it("renders feeds after data loads", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    // After accounts load, the first account is auto-selected, which triggers feeds query
    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("shows unread count for feeds with unread articles", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Tech Blog has unread_count: 5 (also shown in total unread)
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });

  it("does not update last synced time when sync is skipped", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") return false;
      return null;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Today at /)).not.toBeInTheDocument();
  });

  it("updates last synced time from sync-completed event", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    expect(syncCompletedListener).not.toBeNull();

    syncCompletedListener?.();

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });
  });
});
