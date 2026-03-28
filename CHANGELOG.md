# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

### Features

- FreshRSS 双方向同期（既読/スター、フォルダ階層、ページネーション、バックグラウンド定期同期、sync-on-wake）
- 設定画面（General / Appearance / Reading / Shortcuts / Actions / Bionic Reading）+ SQLite 永続化
- i18n（日本語/英語切替、react-i18next）
- フィードディスカバリー（サイト URL → RSS フィード自動検出）
- キーボードショートカット一式 + カスタマイズ UI
- アカウント管理（追加/削除/リネーム、同期間隔設定）
- タグ管理（リネーム/削除、記事数表示、コンテキストメニュー）
- FTS5 全文検索（日本語対応 + LIKE フォールバック）
- OPML エクスポート
- macOS ネイティブメニューバー（View / Accounts / Subscriptions / Item / Share）
- Bionic Reading（太字比率設定 + 記事ビュー適用）
- ConfirmDialog（window.confirm 完全置換）

### Bug Fixes

- 記事リストプレビューの HTML タグ生表示を修正
- 検索の日本語混在テキスト対応
- 記事アクションボタンの既読/スター状態反映
- 設定トグルスイッチの表示崩れ修正
- Unread ビューで既読記事がグレーアウト表示に変更

### Improvements

- 3 ペインレイアウト（サイドバー、記事リスト、記事ビュー）
- フィルターボタンのサイクル UX 改善
- 同期ボタンのローディング + 完了通知
- 記事ヘッダーのリンク化（タイトル→WebView、フィード名→フィードへ移動）
- 記事リストツールバーに全既読ボタン追加
- フィード編集ダイアログにフォルダ割り当て追加

### Maintenance

- Storybook 導入
- コンポーネント分割（settings-modal, sidebar）
- UI コンポーネント統一（CVA button）
- dev ツール追加（markdownlint, yamllint, mise タスク）
