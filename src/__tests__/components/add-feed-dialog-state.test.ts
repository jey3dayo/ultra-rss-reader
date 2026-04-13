import { describe, expect, it } from "vitest";
import {
  addFeedDialogReducer,
  createInitialAddFeedDialogState,
  isValidFeedUrl,
  resolveAddFeedDialogDerived,
} from "@/components/reader/add-feed-dialog-state";

describe("addFeedDialogReducer", () => {
  it("resets discovered feeds when url changes", () => {
    const next = addFeedDialogReducer(
      {
        ...createInitialAddFeedDialogState(),
        url: "https://before.example.com/feed.xml",
        discoveredFeeds: [{ url: "https://before.example.com/feed.xml", title: "Before" }],
        selectedFeedUrl: "https://before.example.com/feed.xml",
      },
      { type: "set-url", url: "https://after.example.com/feed.xml" },
    );

    expect(next.url).toBe("https://after.example.com/feed.xml");
    expect(next.discoveredFeeds).toEqual([]);
    expect(next.selectedFeedUrl).toBeNull();
  });

  it("keeps only titled feeds for discover-single success message", () => {
    const next = addFeedDialogReducer(createInitialAddFeedDialogState(), {
      type: "discover-single",
      feeds: [{ url: "https://example.com/feed.xml", title: "" }],
    });

    expect(next.successMessage).toBe("feed_detected");
    expect(next.discoveredFeeds).toEqual([]);
    expect(next.selectedFeedUrl).toBe("https://example.com/feed.xml");
  });
});

describe("isValidFeedUrl", () => {
  it("accepts http and https urls only", () => {
    expect(isValidFeedUrl("https://example.com/feed.xml")).toBe(true);
    expect(isValidFeedUrl("http://example.com/feed.xml")).toBe(true);
    expect(isValidFeedUrl("ftp://example.com/feed.xml")).toBe(false);
    expect(isValidFeedUrl("not-a-url")).toBe(false);
  });
});

describe("resolveAddFeedDialogDerived", () => {
  it("returns invalid hint and disables actions for invalid manual urls", () => {
    const derived = resolveAddFeedDialogDerived({
      state: {
        ...createInitialAddFeedDialogState(),
        url: "invalid-url",
      },
      isCreatingFolder: false,
      newFolderName: "",
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.hasManualUrl).toBe(true);
    expect(derived.isManualUrlValid).toBe(false);
    expect(derived.urlHint).toBe("Invalid URL");
    expect(derived.urlHintTone).toBe("error");
    expect(derived.isDiscoverDisabled).toBe(true);
    expect(derived.isSubmitDisabled).toBe(true);
  });

  it("requires a new folder name when creating a folder", () => {
    const derived = resolveAddFeedDialogDerived({
      state: {
        ...createInitialAddFeedDialogState(),
        url: "https://example.com/feed.xml",
      },
      isCreatingFolder: true,
      newFolderName: "   ",
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.isManualUrlValid).toBe(true);
    expect(derived.isDiscoverDisabled).toBe(false);
    expect(derived.isSubmitDisabled).toBe(true);
  });
});
