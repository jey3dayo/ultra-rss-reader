import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBadge } from "@/hooks/use-badge";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds, setupTauriMocks, teardownTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

  it("uses account unread count query result for only_inbox", async () => {
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(1);
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
