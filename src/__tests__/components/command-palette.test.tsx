import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/reader/command-palette";
import { STORAGE_KEYS } from "@/constants/storage";
import * as actions from "@/lib/actions";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      commandPaletteOpen: true,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [{ id: "tag-1", name: "Later", color: "#3b82f6" }];
        case "search_articles":
          return sampleArticles.filter((article) =>
            article.title.toLowerCase().includes(String(args.query).toLowerCase()),
          );
        default:
          return null;
      }
    });
  });

  it("shows recent actions when opened without a query", async () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["action:open-settings"]));

    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Recent Actions")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();
  });

  it("falls back to the normal action list when history is empty", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByText("Recent Actions")).not.toBeInTheDocument();
  });

  it("selecting a feed updates selection and closes the palette", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, "@Tech");
    await user.click(await screen.findByRole("option", { name: /Tech Blog/ }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  it("filters to action results for the action prefix", async () => {
    const user = userEvent.setup();
    const executeAction = vi.spyOn(actions, "executeAction").mockImplementation(() => {});

    render(<CommandPalette />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText("Search commands…");
    await user.type(input, ">settings");

    expect(await screen.findByText("Actions", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Tech Blog/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Open settings/ }));

    await waitFor(() => {
      expect(executeAction).toHaveBeenCalledWith("open-settings");
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    });
  });
});
