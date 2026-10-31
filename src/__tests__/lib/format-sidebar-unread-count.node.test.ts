import { describe, expect, it } from "vitest";
import { normalizeArticleDisplayTitle } from "@/lib/articles/article-list-item-presentation";
import { formatSidebarUnreadCount } from "@/lib/sidebar/format-sidebar-unread-count";

describe("formatSidebarUnreadCount", () => {
  it("groups counts under the cap and exposes exact values in title metadata when capped", () => {
    expect(formatSidebarUnreadCount(1_234)).toEqual({ label: "1,234" });
    expect(formatSidebarUnreadCount(9_999)).toEqual({ label: "9,999" });
    expect(formatSidebarUnreadCount(12_345_678)).toEqual({ label: "9,999+", title: "12,345,678" });
  });
});

describe("normalizeArticleDisplayTitle", () => {
  it("matches the list item untitled fallback used in the reader meta heading", () => {
    expect(normalizeArticleDisplayTitle("")).toBe("Untitled article");
    expect(normalizeArticleDisplayTitle("   ")).toBe("Untitled article");
  });
});
