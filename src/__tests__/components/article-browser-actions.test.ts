import { beforeEach, describe, expect, it, vi } from "vitest";
import { addArticleToReadingList, copyArticleLink } from "@/components/reader/article-browser-actions";
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
});
