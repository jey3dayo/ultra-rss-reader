import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addArticleToReadingList,
  copyArticleLink,
  openUrlInExternalBrowser,
} from "@/components/reader/article-browser-actions";
import { type MockTauriCommandCall, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("article-browser-actions", () => {
  const showToast = vi.fn();
  let calls: MockTauriCommandCall[] = [];

  beforeEach(() => {
    calls = [];
    showToast.mockReset();
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
});
