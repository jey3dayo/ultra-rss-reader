import { act, render, waitFor } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBadge } from "@/hooks/use-badge";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { setBadgeCountMock } = vi.hoisted(() => ({
  setBadgeCountMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setBadgeCount: setBadgeCountMock,
  }),
}));

function HookHarness() {
  useBadge();
  return null;
}

describe("useBadge", () => {
  beforeEach(() => {
    teardownTauriMocks();
    setupTauriMocks();
    setBadgeCountMock.mockReset();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ selectedAccountId: "acc-1" });
  });

  it("clears the badge when unread badge display is disabled", async () => {
    usePreferencesStore.setState({ prefs: { unread_badge: "dont_display" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(undefined);
    });
  });

  it("uses the selected account feed unread sum for all_unread", async () => {
    usePreferencesStore.setState({ prefs: { unread_badge: "all_unread" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(5);
    });
  });

  it("keeps all_unread badge reads on the selected account feed unread projection", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "list_feeds") {
        return [
          { ...sampleFeeds[0], id: "feed-selected-a", account_id: "acc-1", unread_count: 3 },
          { ...sampleFeeds[1], id: "feed-selected-b", account_id: "acc-1", unread_count: 4 },
        ];
      }

      if (cmd === "count_account_unread_articles") {
        throw new Error("all_unread badge must not read account unread totals");
      }

      return undefined;
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "all_unread" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(7);
    });

    expect(calls).toContainEqual({
      cmd: "list_feeds",
      args: { accountId: "acc-1" },
    });
    expect(calls.some((call) => call.cmd === "count_account_unread_articles")).toBe(false);
  });

  it("uses account unread count query result for only_inbox", async () => {
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(1);
    });
  });

  it("keeps only_inbox badge reads on the account unread endpoint", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "count_account_unread_articles") {
        return 7;
      }

      if (cmd === "list_feeds") {
        throw new Error("only_inbox badge must not read feed unread sums");
      }

      return undefined;
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(7);
    });

    expect(calls).toContainEqual({
      cmd: "count_account_unread_articles",
      args: { accountId: "acc-1" },
    });
    expect(calls.some((call) => call.cmd === "list_feeds")).toBe(false);
  });

  it("updates only_inbox badge count when the selected account changes", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "count_account_unread_articles") {
        return args.accountId === "acc-2" ? 9 : 2;
      }

      return undefined;
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(2);
    });

    act(() => {
      useUiStore.setState({ selectedAccountId: "acc-2" });
    });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(9);
    });

    expect(calls).toContainEqual({
      cmd: "count_account_unread_articles",
      args: { accountId: "acc-1" },
    });
    expect(calls).toContainEqual({
      cmd: "count_account_unread_articles",
      args: { accountId: "acc-2" },
    });
  });

  it("clears the badge without starting all_unread feed queries when no account is selected", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      return undefined;
    });
    useUiStore.setState({ selectedAccountId: null });
    usePreferencesStore.setState({ prefs: { unread_badge: "all_unread" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(undefined);
    });

    expect(calls.some((call) => call.cmd === "list_feeds")).toBe(false);
    expect(calls.some((call) => call.cmd === "count_account_unread_articles")).toBe(false);
  });

  it("clears the badge without starting only_inbox unread queries when no account is selected", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      return undefined;
    });
    useUiStore.setState({ selectedAccountId: null });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(undefined);
    });

    expect(calls.some((call) => call.cmd === "list_feeds")).toBe(false);
    expect(calls.some((call) => call.cmd === "count_account_unread_articles")).toBe(false);
  });

  it("clears selected account only_inbox badge after a zero unread query result", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "count_account_unread_articles") {
        return 0;
      }

      return undefined;
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "count_account_unread_articles",
        args: { accountId: "acc-1" },
      });
    });
    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(undefined);
    });
  });

  it("does not crash when the account unread count query fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "count_account_unread_articles") {
        throw new Error(`failed for ${String(args.accountId)}`);
      }

      if (cmd === "list_feeds") {
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      }

      return null;
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "count_account_unread_articles",
        args: { accountId: "acc-1" },
      });
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    expect(setBadgeCountMock).toHaveBeenLastCalledWith(undefined);

    consoleErrorSpy.mockRestore();
  });
});
