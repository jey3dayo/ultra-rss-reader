import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

  it("uses the same section wrapper for feeds and tags headers", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const feedsHeader = await screen.findByRole("button", { name: "Feeds" });
    const tagsHeader = await screen.findByRole("button", { name: "Tags" });

    expect(feedsHeader.parentElement).toHaveClass("px-2", "py-2");
    expect(tagsHeader.parentElement).toHaveClass("px-2", "py-2");
  });

  it("uses the same leading icon slot width for feeds and tags", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const feedLabel = await screen.findByText("Tech Blog");
    const tagLabel = await screen.findByText("Later");

    const feedLeadingSlot = feedLabel.parentElement?.firstElementChild;
    const tagLeadingSlot = tagLabel.parentElement?.firstElementChild;

    expect(feedLeadingSlot).toHaveClass("h-5", "w-5", "shrink-0");
    expect(tagLeadingSlot).toHaveClass("h-5", "w-5", "shrink-0");
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

  it("opens the account switcher with expanded state and closes it on Escape", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const trigger = await screen.findByRole("button", { name: /Local/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Accounts" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(trigger).toHaveFocus();
  });
});
