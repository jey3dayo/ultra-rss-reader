import { describe, expect, it } from "vitest";
import { safeParseJsonWithSchema } from "@/schemas/parse";
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

  it("keeps command history root failures as typed parse failures for caller fallback", () => {
    const result = CommandHistoryStorageSchema.safeParse({
      0: "action:open-settings",
    });

    expect(result.success).toBe(false);
    expect(safeParseJsonWithSchema('{"0":"action:open-settings"}', CommandHistoryStorageSchema) ?? []).toEqual([]);
    expect(safeParseJsonWithSchema("not-json", CommandHistoryStorageSchema) ?? []).toEqual([]);
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

  it("keeps sidebar expansion root failures as typed parse failures for caller fallback", () => {
    const result = StoredSidebarExpandedFoldersSchema.safeParse(["folder-1"]);

    expect(result.success).toBe(false);
    expect(safeParseJsonWithSchema('["folder-1"]', StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
    expect(safeParseJsonWithSchema("not-json", StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
  });
});
