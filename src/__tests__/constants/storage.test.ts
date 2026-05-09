import { describe, expect, it } from "vitest";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  STORAGE_KEYS,
} from "@/constants/storage";

describe("storage constants", () => {
  it("keeps writable localStorage keys under the ultra-rss prefix", () => {
    const writableStorageKeys = Object.values(STORAGE_KEYS);

    expect(writableStorageKeys).not.toHaveLength(0);
    expect(writableStorageKeys.every((key) => key.startsWith("ultra-rss:"))).toBe(true);
  });

  it("keeps storage normalization limits positive and bounded", () => {
    expect(MAX_COMMAND_HISTORY).toBeGreaterThan(0);
    expect(MAX_COMMAND_HISTORY_ENTRY_LENGTH).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT).toBeGreaterThan(0);
  });
});
