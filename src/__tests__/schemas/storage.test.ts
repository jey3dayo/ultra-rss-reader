import { describe, expect, it } from "vitest";
import { CommandHistoryStorageSchema, StoredSidebarExpandedFoldersSchema } from "@/schemas/storage";

describe("storage schemas", () => {
  it("drops non-string command history entries and preserves string order", () => {
    expect(
      CommandHistoryStorageSchema.parse([
        "feed:feed-1",
        null,
        { kind: "feed", id: "feed-2" },
        1,
        "",
        "action:open-settings",
      ]),
    ).toEqual(["feed:feed-1", "", "action:open-settings"]);
  });

  it("keeps account folder expansion maps while dropping invalid entries", () => {
    expect(
      StoredSidebarExpandedFoldersSchema.parse({
        "account-1": ["folder-1", 42, "folder-2", null],
        "account-2": "folder-3",
        "account-3": ["folder-4"],
        "account-4": { folderId: "folder-5" },
      }),
    ).toEqual({
      "account-1": ["folder-1", "folder-2"],
      "account-3": ["folder-4"],
    });
  });
});
