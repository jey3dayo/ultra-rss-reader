import { beforeEach, describe, expect, it } from "vitest";
import { Result } from "@praha/byethrow";
import { addAccount, listAccounts, listArticles, listFeeds, markArticleRead } from "@/api/tauri-commands";
import { sampleAccounts, sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("tauri-commands with mockIPC", () => {
  beforeEach(() => {
    setupTauriMocks();
  });

  describe("listAccounts", () => {
    it("returns all accounts", async () => {
      const result = await listAccounts();
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual(sampleAccounts);
        expect(result.value).toHaveLength(2);
      }
    });
  });

  describe("listFeeds", () => {
    it("returns feeds for a given account", async () => {
      const result = await listFeeds("acc-1");
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual(sampleFeeds);
        expect(result.value).toHaveLength(2);
      }
    });

    it("returns empty array for unknown account", async () => {
      const result = await listFeeds("nonexistent");
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe("listArticles", () => {
    it("returns articles for a given feed", async () => {
      const result = await listArticles("feed-1");
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual(sampleArticles);
        expect(result.value).toHaveLength(2);
      }
    });

    it("returns empty array for unknown feed", async () => {
      const result = await listArticles("nonexistent");
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe("addAccount", () => {
    it("returns a new account DTO", async () => {
      const result = await addAccount("local", "My Feed");
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual({
          id: "acc-new",
          kind: "local",
          name: "My Feed",
        });
      }
    });
  });

  describe("markArticleRead", () => {
    it("succeeds without error", async () => {
      const result = await markArticleRead("art-1");
      expect(Result.isSuccess(result)).toBe(true);
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

    const result = await listAccounts();
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.error.message).toBe("Connection failed");
    }
  });
});
