import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";

describe("storage constants", () => {
  it("keeps writable localStorage keys under the ultra-rss prefix", () => {
    const writableStorageKeys = Object.values(STORAGE_KEYS);

    expect(writableStorageKeys).not.toHaveLength(0);
    expect(writableStorageKeys.every((key) => key.startsWith("ultra-rss:"))).toBe(true);
  });
});
