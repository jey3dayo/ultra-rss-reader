import { describe, expect, it, vi } from "vitest";
import { buildFeedMarkAllReadConfirmation } from "@/components/reader/feed-mark-all-read";

describe("feed-mark-all-read", () => {
  it("builds confirmation data for marking a feed as read", () => {
    const onConfirmRead = vi.fn();
    const confirmation = buildFeedMarkAllReadConfirmation({
      feedId: "feed-1",
      unreadCount: 12,
      onConfirmRead,
    });

    expect(confirmation.count).toBe(12);
    confirmation.onConfirm();
    expect(onConfirmRead).toHaveBeenCalledWith("feed-1");
  });
});
