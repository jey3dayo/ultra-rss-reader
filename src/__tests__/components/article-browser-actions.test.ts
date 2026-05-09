import { Result } from "@praha/byethrow";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  type ArticleActionError,
  addArticleToReadingList,
  categorizeArticleActionError,
  copyArticleLink,
  normalizeArticleExternalBrowserUrl,
  openArticleInExternalBrowser,
  openUrlInExternalBrowser,
  resolveArticleActionErrorCategory,
} from "@/components/reader/article-browser-actions";
import { usePreferencesStore } from "@/stores/preferences-store";

describe("article-browser-actions", () => {
  const showToast = vi.fn();
  let calls: MockTauriCommandCall[] = [];

  beforeEach(() => {
    calls = [];
    showToast.mockReset();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows a success toast after copying a link", async () => {
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    await copyArticleLink("https://example.com/article", {
      showToast,
      successMessage: "Link copied",
    });

    expect(calls).toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: "https://example.com/article" },
    });
    expect(showToast).toHaveBeenCalledWith("Link copied");
  });

  it("shows the command error when copying fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "copy_to_clipboard") {
        throw { type: "UserVisible", message: "Clipboard unavailable" };
      }
      return undefined;
    });

    await copyArticleLink("https://example.com/article", {
      showToast,
      successMessage: "Link copied",
    });

    expect(showToast).toHaveBeenCalledWith("Clipboard unavailable");
  });

  it("logs categorized clipboard runtime failures when copying fails", async () => {
    const consoleError = vi.mocked(console.error);
    setupTauriMocks((cmd) => {
      if (cmd === "copy_to_clipboard") {
        throw { type: "UserVisible", message: "Clipboard unavailable" };
      }
      return undefined;
    });

    await copyArticleLink("https://example.com/article", {
      showToast,
      successMessage: "Link copied",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Copy failed:",
      expect.objectContaining({
        category: "runtime_unavailable",
        message: "Clipboard unavailable",
      }),
    );
    expect(showToast).toHaveBeenCalledWith("Clipboard unavailable");
  });

  it("preserves clipboard categories when copy link reports them", () => {
    const error = {
      type: "UserVisible",
      message: "Clipboard permission denied",
      category: "permission_denied",
      localeKey: "article_actions.errors.permission_denied",
    } satisfies ArticleActionError;

    expect(categorizeArticleActionError(error)).toBe(error);
  });

  it("projects invalid clipboard text without invoking Tauri", async () => {
    await copyArticleLink("", {
      showToast,
      successMessage: "Link copied",
    });

    expect(calls).toEqual([]);
    expect(showToast).toHaveBeenCalledWith("Invalid clipboard text");
  });

  it.each(["mailto:hello@example.com", "file:///tmp/article.html", "https://example.com/article\nnext"])(
    "projects invalid article link clipboard text without invoking Tauri: %j",
    async (url) => {
      await copyArticleLink(url, {
        showToast,
        successMessage: "Link copied",
      });

      expect(calls).toEqual([]);
      expect(showToast).toHaveBeenCalledWith("Invalid clipboard text");
    },
  );

  it("shows a success toast after adding a link to the reading list", async () => {
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "add_to_reading_list":
          return null;
        default:
          return undefined;
      }
    });

    await addArticleToReadingList("https://example.com/article", {
      showToast,
      successMessage: "Added to reading list",
    });

    expect(calls).toContainEqual({
      cmd: "add_to_reading_list",
      args: { url: "https://example.com/article" },
    });
    expect(showToast).toHaveBeenCalledWith("Added to reading list");
  });

  it("shows the command error when adding to the reading list fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "add_to_reading_list") {
        throw { type: "UserVisible", message: "Reading list unavailable" };
      }
      return undefined;
    });

    await addArticleToReadingList("https://example.com/article", {
      showToast,
      successMessage: "Added to reading list",
    });

    expect(showToast).toHaveBeenCalledWith("Reading list unavailable");
  });

  it("logs and surfaces rejected reading-list commands for fire-and-forget callers", async () => {
    const consoleError = vi.mocked(console.error);
    const addToReadingListSpy = vi
      .spyOn(tauriCommands, "addToReadingList")
      .mockRejectedValue(new Error("Reading list command rejected"));

    await addArticleToReadingList("https://example.com/article", {
      showToast,
      successMessage: "Added to reading list",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Add to reading list failed:",
      expect.objectContaining({
        category: "unknown",
        message: "Reading list command rejected",
      }),
    );
    expect(showToast).toHaveBeenCalledWith("Reading list command rejected");
    addToReadingListSpy.mockRestore();
  });

  it("opens a URL in the external browser with the requested background mode", async () => {
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    await openUrlInExternalBrowser("https://example.com/article", {
      background: false,
      showToast,
      errorLabel: "Failed to open preview in external browser",
    });

    expect(calls).toContainEqual({
      cmd: "open_in_browser",
      args: { url: "https://example.com/article", background: false },
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it.each([
    ["https://example.com/article", "https://example.com/article"],
    [" http://example.com/article ", "http://example.com/article"],
  ])("normalizes article external-browser URLs: %j", (input, expected) => {
    const result = normalizeArticleExternalBrowserUrl(input);

    expect(result).toSatisfy(Result.isSuccess);
    expect(Result.unwrap(result)).toBe(expected);
  });

  it.each(["mailto:hello@example.com", "file:///tmp/article.html", "javascript:alert('owned')", "/relative"])(
    "rejects non-http article external-browser URLs before invoking Tauri: %j",
    async (url) => {
      setupTauriMocks((cmd, args) => {
        calls.push({ cmd, args });
        return undefined;
      });

      const result = await openUrlInExternalBrowser(url, {
        background: false,
        showToast,
        errorLabel: "Failed to open in browser",
      });

      expect(result).toSatisfy(Result.isFailure);
      expect(calls).toEqual([]);
      expect(showToast).toHaveBeenCalledWith("Only http:// and https:// URLs are supported");
    },
  );

  it("rejects article external-browser URLs with credentials before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      return undefined;
    });

    const result = await openUrlInExternalBrowser("https://user:pass@example.com/article", {
      background: false,
      showToast,
      errorLabel: "Failed to open in browser",
    });

    expect(result).toSatisfy(Result.isFailure);
    expect(calls).toEqual([]);
    expect(showToast).toHaveBeenCalledWith("Article URLs must not include credentials");
  });

  it("opens an article in the background when the background preference is enabled", async () => {
    usePreferencesStore.setState({
      prefs: { open_links_background: "true" },
      loaded: true,
    });
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    await openArticleInExternalBrowser("https://example.com/article", showToast);

    expect(calls).toContainEqual({
      cmd: "open_in_browser",
      args: { url: "https://example.com/article", background: true },
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows the command error when opening a URL in the external browser fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "open_in_browser") {
        throw { type: "UserVisible", message: "Browser unavailable" };
      }
      return undefined;
    });

    await openUrlInExternalBrowser("https://example.com/article", {
      background: true,
      showToast,
      errorLabel: "Failed to open in browser",
    });

    expect(showToast).toHaveBeenCalledWith("Browser unavailable");
  });

  it("logs and surfaces rejected external-browser commands for fire-and-forget callers", async () => {
    const consoleError = vi.mocked(console.error);
    const openInBrowserSpy = vi
      .spyOn(tauriCommands, "openInBrowser")
      .mockRejectedValue(new Error("Browser command rejected"));

    await openUrlInExternalBrowser("https://example.com/article", {
      background: true,
      showToast,
      errorLabel: "Failed to open in browser",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to open in browser:",
      expect.objectContaining({
        category: "unknown",
        message: "Browser command rejected",
      }),
    );
    expect(showToast).toHaveBeenCalledWith("Browser command rejected");
    openInBrowserSpy.mockRestore();
  });

  it("classifies invalid URL errors without changing the external-browser toast message", async () => {
    const consoleError = vi.mocked(console.error);
    setupTauriMocks((cmd) => {
      if (cmd === "open_in_browser") {
        throw {
          type: "UserVisible",
          message: "Only http:// and https:// URLs are supported",
        };
      }
      return undefined;
    });

    await openUrlInExternalBrowser("javascript:alert('owned')", {
      background: false,
      showToast,
      errorLabel: "Failed to open in browser",
    });

    expect(consoleError).toHaveBeenLastCalledWith(
      "Failed to open in browser:",
      expect.objectContaining({
        category: "invalid_url",
        message: "Only http:// and https:// URLs are supported",
      }),
    );
    expect(showToast).toHaveBeenCalledWith("Only http:// and https:// URLs are supported");
  });

  it("classifies action error categories shared by copy and open actions", () => {
    expect(resolveArticleActionErrorCategory("Clipboard unavailable")).toBe("runtime_unavailable");
    expect(resolveArticleActionErrorCategory("Clipboard permission denied")).toBe("permission_denied");
    expect(resolveArticleActionErrorCategory("Only http:// and https:// URLs are supported")).toBe("invalid_url");
    expect(resolveArticleActionErrorCategory("Invalid clipboard text")).toBe("invalid_text");
    expect(resolveArticleActionErrorCategory("Unexpected failure")).toBe("unknown");
  });

  it("attaches locale keys to categorized action errors", () => {
    expect(
      categorizeArticleActionError({
        type: "UserVisible",
        message: "Clipboard unavailable",
      }),
    ).toEqual(
      expect.objectContaining({
        category: "runtime_unavailable",
        localeKey: "article_actions.errors.runtime_unavailable",
      }),
    );
    expect(
      categorizeArticleActionError({
        type: "UserVisible",
        message: "Unexpected failure",
      }),
    ).toEqual(
      expect.objectContaining({
        category: "unknown",
        localeKey: "article_actions.errors.unknown",
      }),
    );
  });
});
