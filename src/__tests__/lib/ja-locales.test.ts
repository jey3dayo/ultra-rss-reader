import { describe, expect, it } from "vitest";
import jaCleanup from "@/locales/ja/cleanup.json";
import jaSidebar from "@/locales/ja/sidebar.json";

describe("Japanese feed management labels", () => {
  it("uses 購読の整理 for the sidebar and page title", () => {
    expect(jaSidebar.feed_cleanup).toBe("購読の整理");
    expect(jaCleanup.title).toBe("購読の整理");
  });
});
