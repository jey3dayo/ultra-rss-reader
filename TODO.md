# Ultra RSS Reader — TODO

## UI改善（モック比較で洗い出し） — 完了

- [x] 記事リストにサマリー表示を追加
- [x] 記事リストにフィード名を表示
- [x] 記事ビューにフィード名を表示
- [x] 記事リストのヘッダーに検索ボタンを追加
- [x] Settings: Appearanceタブを追加
- [x] 既読記事の視覚的区別を改善
- [x] サイドバーのフォルダ階層表示

## 設定機能の実装（spec: docs/superpowers/specs/2026-03-27-settings-implementation-design.md）

### Phase 1: 永続化基盤 — 完了

- [x] SQLite V2マイグレーション（preferencesテーブル）
- [x] Rustコマンド（get_preferences / set_preference）
- [x] フロント preferences store + 起動時読み込み

### Phase 2: 各タブ実装 — 完了

- [x] General タブ（設定値の読み書き）
- [x] Appearance タブ（テーマ適用 + 表示設定）
- [x] Reading タブ（既読タイミング, Sort, Scroll）
- [x] Shortcuts タブ（read-only一覧）
- [x] Actions and Sharing タブ（サービス + Show in toolbar）
- [x] Bionic Reading タブ（Coming soon表示）
- [x] 不要タブ削除（Animations, Gestures, Services）

### Phase 3: 設定値の反映 — 完了

- [x] sort_unread, group_by, dim_archived, text_preview, image_previews
- [x] action_copy_link, action_open_browser, action_share (ツールバー連動)
- [x] theme 起動時適用 + system モード mediaQuery リスナー
- [x] after_reading (自動既読)
- [x] scroll_to_top_on_change (フィード切替時スクロールリセット)
- [x] open_links / cmd_click_browser (リンク開き方)
- [x] show_unread_count (サイドバー未読数表示)
- [x] display_favicons (フィードアイコン表示)
- [x] ask_before_mark_all (全件既読確認ダイアログ)

## Settings > Accounts（実装済み）

- [x] アカウント一覧表示
- [x] アカウント詳細
- [x] Sync間隔 / Sync on wake / Keep read items
- [x] Delete Account / Add Account

## 開発環境

- [ ] Storybook導入（UIが安定してから）

## リファクタリング

- [x] settings-modal.tsx → components/settings/ に分割済み
- [x] sidebar.tsx → AddFeedDialog, FeedItem, FolderSection を抽出済み
- [x] 生の `<button>` を components/ui/button.tsx (CVA) でラップして統一

## FreshRSS 同期

- [x] keyring_store モジュール（OS credential storage）
- [x] add_account に password パラメータ + keyring 保存
- [x] trigger_sync に FreshRSS 同期ブランチ（6ステップ）
- [x] feed/folder の re-sync 時に既存ID再利用（CASCADE削除防止）
- [x] UI にパスワードフィールド追加
- [x] pending_mutations への書き込み（既読/スター双方向同期）
- [x] SyncService / EventBus 統合（バックグラウンド定期同期）
- [x] folder_id の解決（フォルダ階層同期）
- [x] ページネーション（全記事履歴の同期）

## その他

- [x] OPML Export
- [ ] Inoreader連携
- [x] FTS5検索
- [ ] Tags
