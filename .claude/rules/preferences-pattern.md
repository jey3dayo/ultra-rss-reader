---
paths:
  - "src/**/*.{ts,tsx}"
---

# Preferences 読み書きパターン

## 制約

- preferences の読み取りは必要な値だけを購読するセレクタ形式を使う
- 既知 preference の default / legacy value / invalid value fallback は `src/schemas/preferences.ts` の `preferenceDefaults` と `resolvePreferenceValue` を source of truth にする
- component 側に ad hoc な `?? "default"` を増やさず、既存の selector / view-props hook / resolver pattern に寄せる
- 書き込みは `setPref(key, value)` を使う。直接 `prefs` を変更しない
- preferences の値は全て `string` 型。boolean は `"true"` / `"false"` で管理する
- 新しい preference を追加する時は frontend schema/default、Tauri allowlist、load normalization、persist failure surface、UI selector の5点を同じ変更範囲で確認する
- persist failure は optimistic state を維持するか rollback するかを明示し、ユーザーに見せるべき失敗は toast で通知する
- browser API や storage と連動する preference は、runtime unavailable / throwing API / listener cleanup を focused test に含める

## 根拠

Zustand のセレクタパターンにより、対象の pref が変わった時のみ再レンダリングされる。store 全体を購読すると全設定変更で全コンポーネントが再レンダリングされてしまう。

Preference は UI state であると同時に local persisted data でもあるため、schema normalization と persistence failure behavior を揃えないと、表示値・保存値・起動時 fallback が drift する。

## Preference Allowlist

この表は `src/schemas/preferences.ts` と Rust preference allowlist から生成される契約表で、preference schema contract test の対象。

<!-- preference-allowlist:start -->
| Preference key | Source | Default owner |
| --- | --- | --- |
| `theme` | frontend schema | required unless hidden |
| `language` | frontend schema | required unless hidden |
| `unread_badge` | frontend schema | required unless hidden |
| `open_links` | frontend schema | required unless hidden |
| `open_links_background` | frontend schema | required unless hidden |
| `sort_unread` | frontend schema | required unless hidden |
| `group_by` | frontend schema | required unless hidden |
| `cmd_click_browser` | frontend schema | required unless hidden |
| `ask_before_mark_all` | frontend schema | required unless hidden |
| `list_selection_style` | frontend schema | required unless hidden |
| `sidebar_density` | frontend schema | required unless hidden |
| `layout` | frontend schema | required unless hidden |
| `opaque_sidebars` | frontend schema | required unless hidden |
| `grayscale_favicons` | frontend schema | required unless hidden |
| `font_style` | frontend schema | required unless hidden |
| `font_size` | frontend schema | required unless hidden |
| `show_starred_count` | frontend schema | required unless hidden |
| `show_unread_count` | frontend schema | required unless hidden |
| `show_sidebar_unread` | frontend schema | required unless hidden |
| `show_sidebar_starred` | frontend schema | required unless hidden |
| `show_sidebar_recent_articles` | frontend schema | required unless hidden |
| `show_sidebar_tags` | frontend schema | required unless hidden |
| `startup_folder_expansion` | frontend schema | required unless hidden |
| `image_previews` | frontend schema | required unless hidden |
| `display_favicons` | frontend schema | required unless hidden |
| `text_preview` | frontend schema | required unless hidden |
| `dim_archived` | frontend schema | required unless hidden |
| `reader_mode_default` | frontend schema | required unless hidden |
| `web_preview_mode_default` | frontend schema | required unless hidden |
| `web_preview_keep_focus` | frontend schema | required unless hidden |
| `window_always_on_top` | frontend schema | required unless hidden |
| `reading_sort` | frontend schema | required unless hidden |
| `after_reading` | frontend schema | required unless hidden |
| `scroll_to_top_on_change` | frontend schema | required unless hidden |
| `open_first_article_on_feed_selection` | frontend schema | required unless hidden |
| `sort_subscriptions` | frontend schema | required unless hidden |
| `sync_on_startup` | frontend schema | required unless hidden |
| `developer_mode` | frontend schema | required unless hidden |
| `action_copy_link` | frontend schema | required unless hidden |
| `action_open_browser` | frontend schema | required unless hidden |
| `mute_auto_mark_read` | frontend schema | required unless hidden |
| `recent_articles_history_enabled` | frontend schema | required unless hidden |
| `debug_agentation_visibility` | frontend schema | required unless hidden |
| `debug_browser_hud` | frontend schema | required unless hidden |
| `debug_web_preview_url` | frontend schema | required unless hidden |
| `selected_account_id` | backend-owned | backend/runtime only |
| `startup_remote_state_repair_v1` | backend-owned | backend/runtime only |
| `shortcut_next_article` | shortcut definition | shortcutDefaults |
| `shortcut_prev_article` | shortcut definition | shortcutDefaults |
| `shortcut_scroll_article_down` | shortcut definition | shortcutDefaults |
| `shortcut_scroll_article_up` | shortcut definition | shortcutDefaults |
| `shortcut_next_feed` | shortcut definition | shortcutDefaults |
| `shortcut_prev_feed` | shortcut definition | shortcutDefaults |
| `shortcut_reload_webview` | shortcut definition | shortcutDefaults |
| `shortcut_focus_sidebar` | shortcut definition | shortcutDefaults |
| `shortcut_toggle_sidebar` | shortcut definition | shortcutDefaults |
| `shortcut_toggle_read` | shortcut definition | shortcutDefaults |
| `shortcut_toggle_star` | shortcut definition | shortcutDefaults |
| `shortcut_open_in_app_browser` | shortcut definition | shortcutDefaults |
| `shortcut_open_external_browser` | shortcut definition | shortcutDefaults |
| `shortcut_mark_all_read` | shortcut definition | shortcutDefaults |
| `shortcut_show_unread` | shortcut definition | shortcutDefaults |
| `shortcut_show_all` | shortcut definition | shortcutDefaults |
| `shortcut_show_starred` | shortcut definition | shortcutDefaults |
| `shortcut_cycle_filter` | shortcut definition | shortcutDefaults |
| `shortcut_search` | shortcut definition | shortcutDefaults |
| `shortcut_open_command_palette` | shortcut definition | shortcutDefaults |
| `shortcut_close_or_clear` | shortcut definition | shortcutDefaults |
| `shortcut_open_settings` | shortcut definition | shortcutDefaults |
<!-- preference-allowlist:end -->

## 例

### 正しい

```typescript
// 個別セレクタで必要な値だけ購読
const dimArchived = usePreferencesStore((s) =>
  resolvePreferenceValue(s.prefs, "dim_archived"),
);
const textPreview = usePreferencesStore((s) =>
  resolvePreferenceValue(s.prefs, "text_preview"),
);

// 書き込み
const setPref = usePreferencesStore((s) => s.setPref);
setPref("theme", "dark");
```

### 不正

```typescript
// store 全体を購読 — 全 pref 変更で再レンダリング
const { prefs, setPref } = usePreferencesStore();

// prefs を直接変更 — 永続化されない
prefs.theme = "dark";

// component 固有 default を増やして schema default と drift させる
const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
```

## 強制

- [x] 手動レビュー
