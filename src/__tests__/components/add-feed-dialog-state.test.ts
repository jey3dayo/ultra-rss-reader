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
        discovering: true,
        discoveryRequestId: 1,
        discoveredFeeds: [{ url: "https://before.example.com/feed.xml", title: "Before" }],
        selectedFeedUrl: "https://before.example.com/feed.xml",
      },
      { type: "set-url", url: "https://after.example.com/feed.xml" },
    );

    expect(next.url).toBe("https://after.example.com/feed.xml");
    expect(next.discovering).toBe(false);
    expect(next.discoveryRequestId).toBeNull();
    expect(next.discoveredFeeds).toEqual([]);
    expect(next.selectedFeedUrl).toBeNull();
  });

  it("ignores stale discovery actions after the active request changes", () => {
    const state = addFeedDialogReducer(createInitialAddFeedDialogState(), {
      type: "start-discover",
      requestId: 2,
    });

    const next = addFeedDialogReducer(state, {
      type: "discover-single",
      requestId: 1,
      feeds: [{ url: "https://old.example.com/feed.xml", title: "Old Feed" }],
    });

    expect(next).toBe(state);
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

  it("treats whitespace-only titles as untitled for discover-single success message", () => {
    const next = addFeedDialogReducer(createInitialAddFeedDialogState(), {
      type: "discover-single",
      feeds: [{ url: "https://example.com/feed.xml", title: "   " }],
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
      folderSelection: {
        isCreatingFolder: false,
        newFolderName: "",
      },
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
      folderSelection: {
        isCreatingFolder: true,
        newFolderName: "   ",
      },
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.isManualUrlValid).toBe(true);
    expect(derived.isDiscoverDisabled).toBe(false);
    expect(derived.isSubmitDisabled).toBe(true);
  });

  it("adds feed URL descriptions only when discovered feed labels are duplicated", () => {
    const derived = resolveAddFeedDialogDerived({
      state: {
        ...createInitialAddFeedDialogState(),
        discoveredFeeds: [
          { title: "Updates", url: "https://example.com/feed.xml" },
          { title: "Updates", url: "https://example.com/atom.xml" },
          { title: "Release Notes", url: "https://example.com/releases.xml" },
        ],
      },
      folderSelection: {
        isCreatingFolder: false,
        newFolderName: "",
      },
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.discoveredFeedOptions).toEqual([
      {
        value: "https://example.com/feed.xml",
        label: "Updates",
        description: "example.com/feed.xml",
      },
      {
        value: "https://example.com/atom.xml",
        label: "Updates",
        description: "example.com/atom.xml",
      },
      {
        value: "https://example.com/releases.xml",
        label: "Release Notes",
        description: undefined,
      },
    ]);
  });

  it("uses the URL as the discovered feed option label when discovery returns no title", () => {
    const derived = resolveAddFeedDialogDerived({
      state: {
        ...createInitialAddFeedDialogState(),
        discoveredFeeds: [{ title: "", url: "https://example.com/feed.xml" }],
      },
      folderSelection: {
        isCreatingFolder: false,
        newFolderName: "",
      },
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.discoveredFeedOptions).toEqual([
      {
        value: "https://example.com/feed.xml",
        label: "https://example.com/feed.xml",
        description: undefined,
      },
    ]);
  });

  it("uses the URL as the discovered feed option label when discovery returns a whitespace title", () => {
    const derived = resolveAddFeedDialogDerived({
      state: {
        ...createInitialAddFeedDialogState(),
        discoveredFeeds: [{ title: "   ", url: "https://example.com/feed.xml" }],
      },
      folderSelection: {
        isCreatingFolder: false,
        newFolderName: "",
      },
      invalidUrlHint: "Invalid URL",
      exampleUrlHint: "Example URL",
    });

    expect(derived.discoveredFeedOptions).toEqual([
      {
        value: "https://example.com/feed.xml",
        label: "https://example.com/feed.xml",
        description: undefined,
      },
    ]);
  });
});
