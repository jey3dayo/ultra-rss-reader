import { describe, expect, it } from "vitest";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  STORAGE_KEY_POLICIES,
  STORAGE_KEYS,
} from "@/constants/storage";

describe("storage constants", () => {
  it("keeps writable localStorage keys under the ultra-rss prefix", () => {
    const writableStorageKeys = Object.values(STORAGE_KEYS);

    expect(writableStorageKeys).not.toHaveLength(0);
    expect(writableStorageKeys.every((key) => key.startsWith("ultra-rss:"))).toBe(true);
  });

  it("keeps every writable localStorage key assigned to a schema owner and cleanup policy", () => {
    const storageKeyNames = Object.keys(STORAGE_KEYS);

    expect(Object.keys(STORAGE_KEY_POLICIES)).toEqual(storageKeyNames);
    expect(Object.values(STORAGE_KEY_POLICIES)).toEqual([
      {
        owner: "preferences-store",
        schema: "theme-preference",
        cleanup: "mirror-retained",
      },
      {
        owner: "command-palette-history",
        schema: "command-history-json",
        cleanup: "user-clearable",
      },
      {
        owner: "sidebar-startup-folder-expansion",
        schema: "sidebar-expanded-folders-json",
        cleanup: "user-clearable",
      },
      {
        owner: "startup-sync-storage",
        schema: "startup-sync-timestamp",
        cleanup: "startup-window-expiring",
      },
    ]);
  });

  it("keeps storage normalization limits positive and bounded", () => {
    expect(MAX_COMMAND_HISTORY).toBeGreaterThan(0);
    expect(MAX_COMMAND_HISTORY_ENTRY_LENGTH).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT).toBeGreaterThan(0);
  });
});
