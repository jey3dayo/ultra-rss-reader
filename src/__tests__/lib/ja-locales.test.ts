import { describe, expect, it } from "vitest";
import jaSubscriptions from "@/locales/ja/subscriptions.json";

describe("Japanese feed management labels", () => {
  it("uses 購読一覧 for the subscription workspace title", () => {
    expect(jaSubscriptions.title).toBe("購読一覧");
  });

  it("keeps subscription review reason labels consistent", () => {
    expect(jaSubscriptions.reason_no_unread).toBe("未読なし");
    expect(jaSubscriptions.reason_no_stars).toBe("スターなし");
    expect(jaSubscriptions.fact_stale_days).toBe("更新なし {{count}}日");
  });

  it("keeps in-place decision labels short", () => {
    expect(jaSubscriptions.decision_keep).toBe("残す");
    expect(jaSubscriptions.decision_defer).toBe("あとで");
  });
});
