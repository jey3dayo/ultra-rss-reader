import { describe, expect, it } from "vitest";
import { formatSidebarUnreadCount } from "@/lib/sidebar/format-sidebar-unread-count";

describe("formatSidebarUnreadCount", () => {
  it("formats counts at or below the display cap with locale grouping", () => {
    expect(formatSidebarUnreadCount(0)).toEqual({ label: "0" });
    expect(formatSidebarUnreadCount(12_345)).toEqual({ label: "9,999+", title: "12,345" });
    expect(formatSidebarUnreadCount(1_234)).toEqual({ label: "1,234" });
    expect(formatSidebarUnreadCount(9_999)).toEqual({ label: "9,999" });
  });

  it("caps large counts and exposes the exact value as title metadata", () => {
    expect(formatSidebarUnreadCount(10_000)).toEqual({ label: "9,999+", title: "10,000" });
    expect(formatSidebarUnreadCount(12_345_678)).toEqual({ label: "9,999+", title: "12,345,678" });
  });
});
