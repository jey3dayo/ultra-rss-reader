import { describe, expect, it } from "vitest";
import jaCleanup from "@/locales/ja/cleanup.json";
import jaSidebar from "@/locales/ja/sidebar.json";

describe("Japanese feed management labels", () => {
  it("uses 購読の整理 for the sidebar and page title", () => {
    expect(jaSidebar.feed_cleanup).toBe("購読の整理");
    expect(jaCleanup.title).toBe("購読の整理");
  });

  it("keeps cleanup decision labels consistent", () => {
    expect(jaCleanup.defer).toBe("あとで確認");
    expect(jaCleanup.deferred_badge).toBe("あとで確認");
    expect(jaCleanup.review_status).toBe("未判断");
  });

  it("uses natural keep guidance copy in the review panel", () => {
    expect(jaCleanup.priority_keep).toBe("今は残す");
    expect(jaCleanup.summary_headline_keep).toBe("今は残してよさそうです");
    expect(jaCleanup.candidate_summary_healthy_feed).toBe("最近も動いていて、今すぐ触る必要はなさそうです。");
  });
});
