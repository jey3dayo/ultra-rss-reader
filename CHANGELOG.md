# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

## [0.3.1] - 2026-03-29

### Features

- PR Insights Labeler ワークフロー追加

### Bug Fixes

- アプリアイコンを透過 PNG に変換（白背景の除去）
- リリースワークフロー CI 失敗の修正とビルドスクリプト承認

### Maintenance

- GitHub Actions を Node.js 24 互換バージョンにアップグレード
- リリースマトリクスから macos-13 x86_64 を削除

## [0.3.0] - 2026-03-28

### Features

- macOS ネイティブメニューバー（View / Accounts / Subscriptions / Item / Share）(#6)
- 自動アップデーター（tauri-plugin-updater + Ed25519 署名検証）(#9)
- カスタムアプリアイコン (#10)
- i18n 対応（日本語/英語切替、react-i18next + 言語設定永続化）
- UI 刷新（About メニュー、オーバーレイタイトルバー、記事リストリデザイン）
- アカウントリネーム機能 + server_url 表示
- タグ管理 API（リネーム/削除、記事数取得）
- カスタムキーボードショートカットのプリファレンス連携
- 最近既読の記事トラッキング（recentlyReadIds）
- ConfirmDialog（window.confirm を完全置換）
- feed_discovery モジュール公開

### Bug Fixes

- スイッチコンポーネントのサイズ・パディング調整
- アカウント名バリデーションをバイト数→文字数カウントに修正
- フィードディスカバリーに SSRF 保護を追加
- 検索ページネーション修正 + LIKE ワイルドカードエスケープ
- プリファレンスキーの ALLOWED_KEYS 許可リスト更新
- フィルターボタン順序修正（Unread → All → Starred）
- 同期状態・共有記事アイコンの整列
- createMutation の型安全性修正（TData ジェネリック追加）

### Maintenance

- Bionic Reading モジュール・設定を完全削除
- React Query の createQuery/createMutation ファクトリ抽出
- ハードコードされたショートカットラベルを i18n キーに置換
- Unknown Feed のセンチネル値によるグルーピング改善
- テストヘルパー（createWrapper）共通化
- GitHub Actions リリースワークフロー整備

## [0.1.0] - 2026-03-27

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
