import { describe, expect, it } from "vitest";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  STORAGE_CLEANUP_POLICY_CONNECTIONS,
  STORAGE_KEYS,
} from "@/constants/storage";
import { parseJsonWithSchemaOrNull } from "@/schemas/parse";
import {
  CommandHistoryStorageSchema,
  StorageCleanupPolicyConnectionsSchema,
  StoredSidebarExpandedFoldersSchema,
} from "@/schemas/storage";

describe("storage schemas", () => {
  it("drops non-string and blank command history entries while preserving string order", () => {
    expect(
      CommandHistoryStorageSchema.parse([
        "  feed:feed-1  ",
        null,
        { kind: "feed", id: "feed-2" },
        1,
        "",
        "   ",
        "\u0000",
        "action:open-settings",
      ]),
    ).toEqual(["feed:feed-1", "action:open-settings"]);
  });

  it("normalizes command history entries before applying de-duplication and size caps", () => {
    const oversizedEntry = `feed:${"x".repeat(MAX_COMMAND_HISTORY_ENTRY_LENGTH + 20)}`;

    expect(
      CommandHistoryStorageSchema.parse([" feed:feed-1 ", "feed:feed-1", "action:\u0000open-settings", oversizedEntry]),
    ).toEqual(["feed:feed-1", "action:open-settings", oversizedEntry.slice(0, MAX_COMMAND_HISTORY_ENTRY_LENGTH)]);
  });

  it("caps persisted command history entries at the storage boundary", () => {
    const entries = Array.from({ length: MAX_COMMAND_HISTORY + 5 }, (_, index) => ` item-${index} `);

    expect(CommandHistoryStorageSchema.parse(entries)).toEqual(
      entries.slice(0, MAX_COMMAND_HISTORY).map((entry) => entry.trim()),
    );
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
    const parsed = StoredSidebarExpandedFoldersSchema.parse({
      " account-1 ": [" folder-1 ", 42, "folder-2", null, "folder-1", "folder-2", "folder-3"],
      "account-2": "folder-3",
      "account-3": ["folder-2", "folder-4", "folder-2"],
      "account-4": { folderId: "folder-5" },
      " ": ["folder-6"],
      "account-5": [" ", "\u0000"],
    });

    expect(parsed).toEqual({
      "account-1": ["folder-1", "folder-2", "folder-3"],
      "account-3": ["folder-2", "folder-4"],
    });
    expect(Object.getPrototypeOf(parsed)).toBeNull();
  });

  it("normalizes sidebar expansion maps without exposing prototype keys", () => {
    const raw: Record<string, unknown> = Object.create(null);
    Object.defineProperty(raw, "__proto__", {
      configurable: true,
      enumerable: true,
      value: ["folder-proto"],
      writable: true,
    });
    raw.constructor = ["folder-constructor"];
    raw["account-\u0085id"] = ["folder-\u009fid", "folder-\u0000id"];

    const parsed = StoredSidebarExpandedFoldersSchema.parse(raw);

    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Object.getOwnPropertyDescriptor(parsed, "__proto__")).toMatchObject({
      enumerable: true,
      value: ["folder-proto"],
    });
    expect(parsed.__proto__).toEqual(["folder-proto"]);
    expect(parsed.constructor).toEqual(["folder-constructor"]);
    expect(parsed["account-id"]).toEqual(["folder-id"]);
    expect(Object.prototype).not.toHaveProperty("folder-proto");
  });

  it("documents sidebar expansion account pruning as insertion-order based", () => {
    const entries = Array.from({ length: MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS + 1 }, (_, index): [string, string[]] => [
      index === 0 ? "active-account" : `stale-account-${index}`,
      [`folder-${index}`],
    ]);

    const parsed = StoredSidebarExpandedFoldersSchema.parse(Object.fromEntries(entries));

    expect(Object.keys(parsed)).toEqual(
      entries.slice(0, MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS).map(([accountId]) => accountId),
    );
    expect(parsed["active-account"]).toEqual(["folder-0"]);
    expect(parsed[`stale-account-${MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS}`]).toBeUndefined();
  });

  it("caps oversized sidebar expansion maps at the storage boundary", () => {
    const folderIds = Array.from(
      { length: MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT + 5 },
      (_, index) => `folder-${index}`,
    );
    const entries = Array.from({ length: MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS + 5 }, (_, index): [string, string[]] => [
      `account-${index}`,
      folderIds,
    ]);

    const parsed = StoredSidebarExpandedFoldersSchema.parse(Object.fromEntries(entries));

    expect(Object.keys(parsed)).toEqual(
      entries.slice(0, MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS).map(([accountId]) => accountId),
    );
    expect(parsed["account-0"]).toEqual(folderIds.slice(0, MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT));
  });

  it("keeps sidebar expansion root failures as typed parse failures for caller fallback", () => {
    const result = StoredSidebarExpandedFoldersSchema.safeParse(["folder-1"]);

    expect(result.success).toBe(false);
    expect(parseJsonWithSchemaOrNull('["folder-1"]', StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
    expect(parseJsonWithSchemaOrNull("not-json", StoredSidebarExpandedFoldersSchema) ?? {}).toEqual({});
  });

  it("validates storage cleanup policy connections for settings reset and private export", () => {
    expect(StorageCleanupPolicyConnectionsSchema.parse(STORAGE_CLEANUP_POLICY_CONNECTIONS)).toEqual({
      settingsDataResetKeys: [
        STORAGE_KEYS.commandHistory,
        STORAGE_KEYS.sidebarExpandedFolders,
        STORAGE_KEYS.startupSyncLastTriggeredAt,
      ],
      privateDataExportKeys: [
        STORAGE_KEYS.theme,
        STORAGE_KEYS.commandHistory,
        STORAGE_KEYS.sidebarExpandedFolders,
        STORAGE_KEYS.startupSyncLastTriggeredAt,
      ],
    });
    expect(
      StorageCleanupPolicyConnectionsSchema.safeParse({
        settingsDataResetKeys: ["unknown"],
        privateDataExportKeys: [STORAGE_KEYS.theme],
      }).success,
    ).toBe(false);
  });
});
