# Settings Implementation — Design Specification

## Overview

設定画面のプレースホルダーを実機能に置き換える。Reeder準拠のタブ構成。
個人利用ツールのため、必要な設定のみ実装しYAGNIを徹底。

## タブ構成

| タブ                | 状態   | 概要                                                            |
| ------------------- | ------ | --------------------------------------------------------------- |
| General             | 実装   | App Icon badge, Browser設定, Article List表示, Mark All As Read |
| Appearance          | 実装   | Theme, Layout, Text, Display Counts, Article List表示オプション |
| Reading             | 実装   | Reader View, Sort, After reading動作, Scroll動作                |
| Bionic Reading      | 工事中 | About説明 + Coming soon表示                                     |
| Shortcuts           | 実装   | キーボードショートカット一覧（read-only）                       |
| Actions and Sharing | 実装   | サービス一覧 + Show in toolbar トグル                           |

削除するタブ: Animations, Gestures, Services（個人利用で不要）

## 永続化

### SQLite preferences テーブル

```sql
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Migration V2 として追加。

### Rust コマンド

- `get_preferences() -> HashMap<String, String>` — 全設定を一括取得（起動時）
- `set_preference(key, value)` — 個別設定の更新

### フロント

- Zustand `usePreferencesStore` で保持
- 変更時に `set_preference` を呼び SQLite に書き込み
- 起動時に `get_preferences` で一括読み込み

## 設定項目一覧

### General

| セクション       | キー                    | 型     | デフォルト       | 説明                   |
| ---------------- | ----------------------- | ------ | ---------------- | ---------------------- |
| APP ICON         | `unread_badge`          | select | `"dont_display"` | Unread count badge表示 |
| BROWSER          | `open_links`            | select | `"in_app"`       | リンクの開き方         |
| BROWSER          | `open_links_background` | bool   | `false`          | バックグラウンドで開く |
| ARTICLE LIST     | `sort_unread`           | select | `"newest_first"` | ソート順               |
| ARTICLE LIST     | `group_by`              | select | `"date"`         | グループ化方法         |
| ARTICLE LIST     | `cmd_click_browser`     | bool   | `false`          | ⌘-clickでブラウザ      |
| MARK ALL AS READ | `ask_before_mark_all`   | bool   | `true`           | 確認ダイアログ         |

### Appearance

| セクション     | キー                   | 型     | デフォルト     | 説明                       |
| -------------- | ---------------------- | ------ | -------------- | -------------------------- |
| GENERAL        | `list_selection_style` | select | `"modern"`     | リスト選択スタイル         |
| GENERAL        | `layout`               | select | `"automatic"`  | レイアウト                 |
| GENERAL        | `theme`                | select | `"dark"`       | テーマ (light/dark/system) |
| GENERAL        | `opaque_sidebars`      | bool   | `false`        | 不透明サイドバー           |
| GENERAL        | `grayscale_favicons`   | bool   | `false`        | グレースケールfavicon      |
| TEXT           | `font_style`           | select | `"sans_serif"` | フォントスタイル           |
| TEXT           | `font_size`            | select | `"medium"`     | フォントサイズ             |
| DISPLAY COUNTS | `show_starred_count`   | bool   | `true`         | Starred件数表示            |
| DISPLAY COUNTS | `show_unread_count`    | bool   | `true`         | Unread件数表示             |
| DISPLAY COUNTS | `show_all_count`       | bool   | `true`         | All items件数表示          |
| ARTICLE LIST   | `image_previews`       | select | `"medium"`     | 画像プレビューサイズ       |
| ARTICLE LIST   | `display_favicons`     | bool   | `true`         | favicon表示                |
| ARTICLE LIST   | `text_preview`         | bool   | `true`         | テキストプレビュー         |
| ARTICLE LIST   | `dim_archived`         | bool   | `true`         | 既読記事を薄く表示         |

### Reading

| セクション | キー                      | 型     | デフォルト       | 説明                     |
| ---------- | ------------------------- | ------ | ---------------- | ------------------------ |
| GENERAL    | `reader_view`             | select | `"off"`          | Reader View              |
| GENERAL    | `reading_sort`            | select | `"newest_first"` | ソート                   |
| GENERAL    | `after_reading`           | select | `"mark_as_read"` | 読了後のアクション       |
| SCROLL     | `scroll_to_top_on_change` | bool   | `true`           | フィード切替時にトップへ |

### Actions and Sharing

サービス一覧。各サービスに `show_in_toolbar` トグル。

| サービス          | キー                  | デフォルト |
| ----------------- | --------------------- | ---------- |
| Copy Link         | `action_copy_link`    | `true`     |
| Open in Browser   | `action_open_browser` | `true`     |
| Share (OS native) | `action_share`        | `false`    |

ツールバーのボタン表示はこの設定に連動。

### Shortcuts（read-only）

既存の `use-keyboard.ts` に定義されたショートカットを一覧表示。
カスタマイズは将来対応。

| カテゴリ   | ショートカット | アクション      |
| ---------- | -------------- | --------------- |
| Navigation | `j` / `k`      | 次/前の記事     |
| Navigation | `n` / `p`      | 次/前のフィード |
| Actions    | `m`            | 既読/未読トグル |
| Actions    | `s`            | スター トグル   |
| Actions    | `v`            | ブラウザで開く  |
| Actions    | `r`            | フィード更新    |
| Global     | `⌘,`           | 設定画面        |

## コンポーネント構成

変更対象:

- `src-tauri/migrations/V2__preferences.sql` — 新規
- `src-tauri/src/infra/db/migration.rs` — V2追加
- `src-tauri/src/commands/preference_commands.rs` — 新規
- `src/stores/preferences-store.ts` — 新規
- `src/hooks/use-preferences.ts` — 新規
- `src/components/reader/settings-modal.tsx` — 大幅改修
- `src/stores/ui-store.ts` — 不要タブ削除

## 実装順

1. SQLite V2マイグレーション + Rustコマンド
2. フロント preferences store + 起動時読み込み
3. General タブ実装（設定値の読み書き）
4. Appearance タブ実装（テーマ適用）
5. Reading タブ実装
6. Actions and Sharing タブ実装
7. Shortcuts タブ実装（read-only一覧）
8. Bionic Reading タブ（Coming soon）
9. 不要タブ削除（Animations, Gestures, Services）
10. 設定値の各コンポーネントへの反映
