import { describe, expect, it } from "vitest";
import { MAX_COMMAND_HISTORY } from "@/constants/storage";
import { parseJsonWithSchemaOrNull } from "@/schemas/parse";
import { CommandHistoryStorageSchema, StoredSidebarExpandedFoldersSchema } from "@/schemas/storage";

describe("storage schemas", () => {
  it("drops non-string and blank command history entries while preserving string order", () => {
    expect(
      CommandHistoryStorageSchema.parse([
        "feed:feed-1",
        null,
        { kind: "feed", id: "feed-2" },
        1,
        "",
        "   ",
        "action:open-settings",
      ]),
    ).toEqual(["feed:feed-1", "action:open-settings"]);
  });

  it("caps persisted command history entries at the storage boundary", () => {
    const entries = Array.from({ length: MAX_COMMAND_HISTORY + 5 }, (_, index) => `item-${index}`);

    expect(CommandHistoryStorageSchema.parse(entries)).toEqual(entries.slice(0, MAX_COMMAND_HISTORY));
  });

  it("keeps command history root failures as typed parse failures for caller fallback", () => {
    const result = CommandHistoryStorageSchema.safeParse({
      0: "action:open-settings",
    });

    expect(result.success).toBe(false);
    expect(parseJsonWithSchemaOrNull('{"0":"action:open-settings"}', CommandHistoryStorageSchema) ?? []).toEqual([]);
    expect(parseJsonWithSchemaOrNull("not-json", CommandHistoryStorageSchema) ?? []).toEqual([]);
  });

  it("keeps account folder expansion maps while dropping invalid entries", () => {
    expect(
      StoredSidebarExpandedFoldersSchema.parse({
        "account-1": ["folder-1", 42, "folder-2", null, "folder-1", "folder-2", "folder-3"],
        "account-2": "folder-3",
        "account-3": ["folder-2", "folder-4", "folder-2"],
        "account-4": { folderId: "folder-5" },
      }),
    ).toEqual({
      "account-1": ["folder-1", "folder-2", "folder-3"],
      "account-3": ["folder-2", "folder-4"],
    });
  });

  it("keeps sidebar expansion root failures as typed parse failures for caller fallback", () => {
    const result = StoredSidebarExpandedFoldersSchema.safeParse(["folder-1"]);

    expect(result.success).toBe(false);
    expect(parseJsonWithSchemaOrNull('["folder-1"]', StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
    expect(parseJsonWithSchemaOrNull("not-json", StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
  });
});
