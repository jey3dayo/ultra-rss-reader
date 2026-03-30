# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

## [0.5.0] - 2026-03-30

### Features

- アカウント詳細にパスワード伏せ字表示、接続テスト、手動同期アクションを追加
- 同期進捗イベントを導入し、進捗バー・ローディング状態・部分失敗表示を UI に反映
- アカウント単位の同期コマンド、指数バックオフ付きスケジューリング、既読記事パージ統合、GReader 差分同期カーソルを追加
- 設定画面に DB 管理機能を追加し、サイズ表示、手動 VACUUM、自動バックアップ、記事保持 60 日設定を提供
- タグの記事数表示と記事一覧をアカウント単位で絞り込めるようにした
- 選択中アカウントの永続化と、開発モード向けファイルベース認証情報ストアを追加
- アップデーターの再確認フローと、インストール済みアプリの quarantine 解除・署名・起動タスクを追加

### Bug Fixes

- 同期スケジューラ変更に対するコードレビュー指摘を反映し、マイグレーション復旧処理を堅牢化
- ブラウザ起動で許可する URL スキームを `http` / `https` に限定
- macOS 開発環境でのキーチェーン ACL 競合とランタイム時のアプリアイコン置換を修正
- 開発用ウィンドウサイズ、オーバーレイタイトルバー、記事リストの Feed Title ヘッダー表示を修正

### Documentation

- 重い TODO 項目を GitHub Issues に移行し、残タスクに前提条件と難易度メモを追加した（#17, #18, #19）
- 同期、バックアップ、URL スキーム制限、記事保持、UI 改善に関する TODO の完了状況を更新
- DB マイグレーション復旧とアップデーター署名フォールバックの設計メモを整理
- superpowers 用プラン文書と開発ルールの表記を整備

### Maintenance

- ブラウザビューを iframe から Tauri Webview ベースへ置き換え、自動同期開始条件を見直した（#16）
- sync コマンド群の分割、`SyncResult` 導入、未使用同期モジュール削除で同期基盤を整理
- `mise` タスクを RTK ラップに切り替え、`app:dev` の開発設定と認証情報フローを改善
- アカウント詳細・起動時同期・ブラウザ Webview 周りのテストを追加し、アップデーター署名設定の検証を強化
- アプリアイコンの余白と開発向けビルド設定を調整
- `tracing_subscriber` 初期化と production 用 bundle identifier 上書き設定を整備

## [0.4.0] - 2026-03-30

### Features

- コマンドパレット（⌘Shift+K）でフィード/記事/設定への素早いアクセス + アクション実行
- Zod による IPC リクエスト/レスポンスバリデーション（safeInvoke）
- スライディングペーンのトランジションアニメーション（モバイル/コンパクト）
- DB バックアップ/リストア機能と初期化時の自動統合
- 同期の排他制御（concurrent sync prevention）
- シェアメニュー（ツールバー + 設定トグル）
- タグカラーピッカー
- サービスピッカー（アカウント追加の2ステップフロー）
- GradientSwitch コンポーネント（Base UI ダークテーマスタイル）
- サイドバーセクションの表示/非表示設定
- フィードごとの表示モード切替
- 確認ダイアログのリデザイン（アイコン対応）
- アカウント認証情報の編集機能
- ツールチップ追加（記事リストヘッダー/サイドバー）
- リロード/停止ボタンのトグル表示
- FreshRSS/Inoreader 接続バリデーション
- 署名付き開発ビルドタスク（Keychain ダイアログ回避）
- 各種設定項目の動作反映（unread_badge, font_style, font_size, layout, grayscale_favicons, sidebar preferences 等）
- 初回ユーザー向けアカウント追加ガイダンス
- macOS バックグラウンドでのリンク開放
- フィードセクション折りたたみ
- Dock アンリードバッジ
- ショートカットリセット確認ダイアログ
- テーマ連動アプリアイコン切替

### Bug Fixes

- GReader アイテム ID の正規化で既読状態が正しく同期
- GReader ストリーム取得上限を 50→200 に拡大
- webview の font-family 継承修正
- アカウント「説明」→「名前」ラベルリネームと編集ヒント改善
- gradient-switch OFF 状態の修正
- クロスオリジン iframe リロード修正
- settings ScrollArea のスクロール修正
- ブラウザ back/forward ボタンの disabled 状態修正
- macOS アプリアイコンの角丸マスク適用
- Select ポップアップの z-index 修正（Dialog overlay 対応）
- ウィンドウドラッグの有効化（タイトルバー/サイドバーヘッダー）
- フィード未読数の再計算修正（既読マーク後）
- 「お気に入り」→「スター」表記統一
- サブスクリプションソート順の保持
- タグピッカー Escape キーのスコープ修正
- ブラウザビューの embed フォールバック改善
- カラートークンの体系化（accent, ring, destructive）

### Maintenance

- フォーム要素の Base UI 移行（Input, Select, RadioGroup）
- Storybook コンポーネント分離
- SidebarNavButton 共通コンポーネント抽出
- feed-tree-view の冗長フラグメント除去
- PR labeler ワークフロー追加
- feature branch → PR → merge 運用確立
- リリースコマンドの3フェーズ構造リデザイン
- テストカバレッジ改善（コマンドパレット、確認ダイアログ、同期排他制御等）

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
