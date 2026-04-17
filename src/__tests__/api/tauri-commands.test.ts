import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addAccount,
  countAccountUnreadArticles,
  createMuteKeyword,
  createOrUpdateBrowserWebview,
  getAccountSyncStatus,
  getPlatformInfo,
  goBackBrowserWebview,
  listAccountArticles,
  listAccounts,
  listArticles,
  listFeeds,
  listMuteKeywords,
  markArticleRead,
  setMuteAutoMarkRead,
  updateMuteKeyword,
} from "@/api/tauri-commands";
import type { BrowserWebviewBounds } from "@/lib/browser-webview";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("tauri-commands with mockIPC", () => {
  const browserBounds: BrowserWebviewBounds = { x: 380, y: 48, width: 900, height: 720 };

  beforeEach(() => {
    setupTauriMocks();
  });

  describe("listAccounts", () => {
    it("returns all accounts", async () => {
      const value = Result.unwrap(await listAccounts());
      expect(value).toEqual(sampleAccounts);
      expect(value).toHaveLength(2);
    });
  });

  describe("listFeeds", () => {
    it("returns feeds for a given account", async () => {
      const value = Result.unwrap(await listFeeds("acc-1"));
      expect(value).toEqual(sampleFeeds);
      expect(value).toHaveLength(2);
    });

    it("returns empty array for unknown account", async () => {
      const value = Result.unwrap(await listFeeds("nonexistent"));
      expect(value).toEqual([]);
    });
  });

  describe("listArticles", () => {
    it("returns articles for a given feed", async () => {
      const value = Result.unwrap(await listArticles("feed-1"));
      expect(value).toEqual(sampleArticles);
      expect(value).toHaveLength(2);
    });

    it("returns empty array for unknown feed", async () => {
      const value = Result.unwrap(await listArticles("nonexistent"));
      expect(value).toEqual([]);
    });
  });

  describe("listAccountArticles", () => {
    it("returns articles for a given account", async () => {
      const value = Result.unwrap(await listAccountArticles("acc-1"));
      expect(value).toEqual(sampleArticles);
      expect(value).toHaveLength(2);
    });
  });

  describe("countAccountUnreadArticles", () => {
    it("returns unread count for a given account", async () => {
      const value = Result.unwrap(await countAccountUnreadArticles("acc-1"));
      expect(value).toBe(1);
    });
  });

  describe("mute keyword commands", () => {
    it("returns saved mute keywords", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "list_mute_keywords") {
          return [
            {
              id: "mute-1",
              keyword: "Kindle Unlimited",
              scope: "title_and_body",
              created_at: "2026-04-15T01:00:00Z",
              updated_at: "2026-04-15T01:00:00Z",
            },
          ];
        }
        return undefined;
      });

      const value = Result.unwrap(await listMuteKeywords());
      expect(value).toHaveLength(1);
      expect(value[0].keyword).toBe("Kindle Unlimited");
    });

    it("creates a mute keyword", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "create_mute_keyword") {
          return {
            id: "mute-1",
            keyword: String(args.keyword),
            scope: String(args.scope),
            created_at: "2026-04-15T01:00:00Z",
            updated_at: "2026-04-15T01:00:00Z",
          };
        }
        return undefined;
      });

      const value = Result.unwrap(await createMuteKeyword("Kindle Unlimited", "title"));
      expect(value.scope).toBe("title");
    });

    it("updates a mute keyword scope", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "update_mute_keyword") {
          return {
            id: String(args.muteKeywordId),
            keyword: "Kindle Unlimited",
            scope: String(args.scope),
            created_at: "2026-04-15T01:00:00Z",
            updated_at: "2026-04-15T01:10:00Z",
          };
        }
        return undefined;
      });

      const value = Result.unwrap(await updateMuteKeyword("mute-1", "body"));
      expect(value.scope).toBe("body");
    });

    it("toggles mute auto mark as read", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "set_mute_auto_mark_read") {
          return null;
        }
        return undefined;
      });

      Result.unwrap(await setMuteAutoMarkRead(true));
    });
  });

  describe("addAccount", () => {
    it("returns a new account DTO", async () => {
      const value = Result.unwrap(await addAccount("local", "My Feed"));
      expect(value).toEqual({
        id: "acc-new",
        kind: "local",
        name: "My Feed",
        server_url: null,
        username: null,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
      });
    });
  });

  describe("markArticleRead", () => {
    it("succeeds without error", async () => {
      Result.unwrap(await markArticleRead("art-1"));
    });
  });

  describe("browser webview commands", () => {
    it("creates or updates the dedicated browser webview window", async () => {
      const value = Result.unwrap(await createOrUpdateBrowserWebview("https://example.com/article", browserBounds));

      expect(value).toEqual({
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
      });
    });

    it("returns the updated navigation state after go back", async () => {
      const value = Result.unwrap(await goBackBrowserWebview());

      expect(value).toEqual({
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
      });
    });
  });

  describe("getPlatformInfo", () => {
    it("returns platform info from getPlatformInfo", async () => {
      const value = Result.unwrap(await getPlatformInfo());
      expect(value).toEqual({
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      });
    });
  });

  describe("getAccountSyncStatus", () => {
    it("returns account sync status from getAccountSyncStatus", async () => {
      const value = Result.unwrap(await getAccountSyncStatus("acc-1"));
      expect(value).toEqual({
        last_success_at: null,
        last_error: null,
        error_count: 0,
        next_retry_at: null,
      });
    });
  });
});

describe("tauri-commands with custom handler", () => {
  it("returns error for failing command", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        throw { type: "UserVisible", message: "Connection failed" };
      }
      return null;
    });

    const error = Result.unwrapError(await listAccounts());
    expect(error.message).toBe("Connection failed");
  });
});

describe("safeInvoke response validation", () => {
  it("returns error when response shape is invalid", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return [{ id: "acc-1" }]; // missing fields
      return null;
    });
    const result = await listAccounts();
    expect(Result.isFailure(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error.type).toBe("UserVisible");
    expect(error.message).toContain("validation failed");
  });
});

describe("setupTauriMocks validates args for custom handler", () => {
  it("passes validated args to custom handler", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_articles") return [];
      return null;
    });
    const ok = Result.unwrap(await listArticles("feed-1"));
    expect(ok).toEqual([]);
  });
});
