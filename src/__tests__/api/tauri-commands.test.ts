import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addAccount,
  countAccountUnreadArticles,
  createOrUpdateBrowserWebview,
  getPlatformInfo,
  goBackBrowserWebview,
  listAccountArticles,
  listAccounts,
  listArticles,
  listFeeds,
  markArticleRead,
} from "@/api/tauri-commands";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("tauri-commands with mockIPC", () => {
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
    it("creates or updates the inline browser webview", async () => {
      const value = Result.unwrap(
        await createOrUpdateBrowserWebview("https://example.com/article", {
          x: 12,
          y: 34,
          width: 640,
          height: 480,
        }),
      );

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
      expect(value.kind).toBe("windows");
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
