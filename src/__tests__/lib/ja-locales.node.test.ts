import { describe, expect, it } from "vitest";
import jaReader from "@/locales/ja/reader.json";
import jaSettings from "@/locales/ja/settings.json";
import jaSubscriptions from "@/locales/ja/subscriptions.json";

describe("Japanese feed management labels", () => {
  it("uses 購読一覧 for the subscription workspace title", () => {
    expect(jaSubscriptions.title).toBe("購読一覧");
  });

  it("keeps subscription review reason labels consistent", () => {
    expect(jaSubscriptions.status_attention_30d).toBe("注意");
    expect(jaSubscriptions.reason_attention_30d).toBe("RSS上で30日以上、新しい記事がありません");
    expect(jaSubscriptions.reason_quiet_no_unread).toBe("RSS上で60日以上、新しい記事がなく未読もありません");
    expect(jaSubscriptions.status_stale_90d).toBe("長期停止候補");
    expect(jaSubscriptions.summary_stale).toBe("RSS上で90日更新なし");
    expect(jaSubscriptions.fact_stale_days).toBe("RSS上で更新なし {{count, count}}日");
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

  it("keeps reader and browser actions distinguishable", () => {
    expect(jaReader.back_to_reader).toBe("記事に戻る");
    expect(jaReader.view_in_browser).toBe("Webプレビューを開く");
    expect(jaReader.open_in_external_browser).toBe("外部ブラウザで開く");
    expect(jaReader.open_in_browser).toBe(jaReader.view_in_browser);
    expect(jaReader.browser_view).toBe(jaSettings.reading.in_app_browser);
    expect(jaReader.display_mode_preview).toBe(jaSettings.reading.in_app_browser);
    expect(jaReader.shortcuts.view_in_browser).toBe("Webプレビューを開く");
    expect(jaReader.shortcuts.open_external_browser).toBe("外部ブラウザで開く");
    expect(jaSettings.reading.standard).toBe("本文のみ");
    expect(jaSettings.reading.preview).toBe("本文 + Webプレビュー");
    expect(jaSettings.reading.in_app_browser).toBe("Webプレビュー");
    expect(jaSettings.reading.default_browser).toBe("既定のブラウザ");
    expect(jaSettings.reading.cmd_click_browser).toBe("{{modifier}}クリックでWebプレビューを開く");
    expect(jaSettings.debug.browser).toBe(jaSettings.reading.in_app_browser);

    expect(jaReader.back_to_reader).not.toContain("Webプレビュー");
    expect(jaReader.view_in_browser).not.toContain("外部ブラウザ");
    expect(jaReader.open_in_external_browser).not.toContain("Webプレビュー");
    expect(jaSettings.reading.standard).not.toContain("Webプレビュー");
    expect(jaSettings.reading.default_browser).not.toBe(jaSettings.reading.in_app_browser);
  });
});
