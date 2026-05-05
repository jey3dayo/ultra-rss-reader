import { describe, expect, it } from "vitest";
import jaSettings from "@/locales/ja/settings.json";
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

  it("keeps settings labels concise around sidebar and reading controls", () => {
    expect(jaSettings.nav.data).toBe("データ");
    expect(jaSettings.general.navigation).toBe("サイドバー");
    expect(jaSettings.general.show_unread).toBe("未読を表示");
    expect(jaSettings.general.show_starred).toBe("スターを表示");
    expect(jaSettings.general.show_recent_articles).toBe("最近見た記事を表示");
    expect(jaSettings.general.show_tags).toBe("タグを表示");
    expect(jaSettings.general.startup_folder_expansion).toBe("起動時にフォルダを開く");
    expect(jaSettings.reading.read_state).toBe("既読");
    expect(jaSettings.reading.history).toBe("履歴");
    expect(jaSettings.reading.original_article_and_web_preview).toBe("表示とリンク");
    expect(jaSettings.reading.default_display_mode).toBe("開いた記事の表示");
    expect(jaSettings.reading.open_links).toBe("元記事リンクの開き方");
    expect(jaSettings.reading.mark_immediately).toBe("すぐ既読");
    expect(jaSettings.reading.mark_after_0_3s).toBe("0.3秒後に既読");
    expect(jaSettings.reading.mark_after_0_5s).toBe("0.5秒後に既読");
    expect(jaSettings.reading.mark_after_1s).toBe("1秒後に既読");
    expect(jaSettings.appearance.opaque_sidebars).toBe("サイドバーを不透明にする");
    expect(jaSettings.appearance.unread_list).toBe("未読数");
    expect(jaSettings.appearance.starred_list).toBe("スター数");
    expect(jaSettings.mute.behavior).toBe("ミュート時の動作");
  });
});
