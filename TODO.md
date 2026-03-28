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

- [x] Storybook導入

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
- [x] Inoreader連携
- [x] FTS5検索
- [x] Tags

## 技術的改善（レビュー指摘）

- [x] 検索入力のデバウンス（300ms）
- [x] Account ドロップダウンの click-outside 閉じ処理
- [x] settings-modal の listen 競合修正（cancelled フラグ）
- [x] markAllRead バッチAPI化（Rust側コマンド追加）
- [x] 同時sync実行ガード（AtomicBool + SyncGuard RAII）

## UI回遊レビューの修正（2026-03-27）

- [x] アカウント全体の `All / Unread / Starred` 一覧取得を修正
- [x] 記事一覧ヘッダーの未読件数を現在の表示対象に合わせる
- [x] compact レイアウトでサイドバーへ戻る導線を追加
- [x] Settings ダイアログの閉じるボタンにアクセシブルネームを付与
- [x] 関連テスト追加
- [x] `mise run check` 実行

## すぐやれる小粒タスク

- [x] Shortcuts: `m` で選択記事の既読切り替え
- [x] Shortcuts: `s` で選択記事のスター切り替え
- [x] Shortcuts: `v` で記事を in-app browser で開く
- [x] Shortcuts: `b` で記事を外部ブラウザで開く
- [x] Shortcuts: `a` で現在リストを一括既読
- [x] Shortcuts: `/` で記事検索入力にフォーカス

## ブラウザ回遊で見つかった修正候補

- [x] フォーム入力欄に `name` 属性を付けて Console issue を解消する
- [x] dev-mock のサムネイル URL を差し替えて CORB issue を解消する

## モック・未実装の実装（2026-03-27 調査）

### A: 小粒（フロントのみ） — 完了

- [x] window.alert → toast 通知に置換（account-detail, add-account-form）

### B: 中規模（UI + バックエンド連携） — 完了

- [x] Account Detail: Syncing セクションのハードコード値を実データに置換
- [x] Bionic Reading 設定 UI の実装（太字比率・プレビュー + 記事ビュー適用）

### C: 大規模（バックエンド同期基盤） — 完了

- [x] SyncService: SyncAll / SyncAccount で run_full_sync を実際に呼び出す
- [x] SyncService: ManualRefresh / PurgeOldArticles の実処理
- [x] sync_flow: folder_id 解決（folder_remote_id → ローカル FolderId）

## sync_on_wake ランタイム実装 — 完了

- [x] OS スリープ復帰イベントの検知（visibilitychange + 30秒閾値）
- [x] 復帰時に sync_on_wake=true のアカウントのみ同期を発火

## フィード編集ダイアログにフォルダ割り当て追加 — 完了

- [x] Rust: FeedRepository に update_folder メソッド追加 + Tauri コマンド
- [x] TS: tauri-commands に updateFeedFolder ラッパー追加
- [x] UI: rename-feed-dialog にフォルダ一覧 + 選択UI追加
- [x] dev-mock: update_feed_folder ハンドラ追加

## Reeder比較レビュー（2026-03-28）

### バグ・壊れている機能（高優先）

- [x] 記事リストのプレビューにHTMLタグが生表示される（HTMLストリップ処理の欠落）
- [x] 検索が機能していない（FTS5+LIKEフォールバックで日本語混在テキスト対応）
- [x] 記事ビューのアクションボタンが状態を反映しない（既読/未読・スターのアイコン切替なし）
- [x] BRボタンの用途が間違っている（Bionic ReadingトグルであるべきがWebView開く機能に）
- [x] 設定画面のトグルスイッチ表示崩れ（OFF状態に隙間） + デフォルト値を全てONに変更

### UX改善（中優先）

- [x] フィルターボタンの遷移UX改善（中央ボタンでSTARRED → UNREAD → ALLサイクル）
- [x] 同期ボタンのフィードバック不足（ローディングアニメーション + 完了通知）
- [x] 最終同期時刻の表示（「Today」→「Today at 16:11」形式）
- [x] 外部ブラウザで開くボタンの欠落（BRとは別にExternalLinkアイコンで分離）
- [x] 記事ヘッダーにリンクがない（タイトルクリック→WebView、フィード名→フィードへ移動）
- [x] Unreadビューで既読記事が即消えする（グレーアウトして残し、画面遷移時に消す）
- [x] 記事リストツールバーに全既読ボタンがない（常時アクセス可能にする）
- [x] 設定画面のアクションボタンのデザイン改善（link variant → outline/destructive）

### 機能追加（中〜低優先）

- [x] フィード新規追加ダイアログにフォルダ選択を追加（既存フォルダ一覧 + 新規フォルダ作成）
- [x] フィードディスカバリー（サイトURLからRSSフィードを自動検出、HTMLのlink[rel=alternate]探索）
- [x] タグセクションのUI改善（アコーディオン折りたたみ + 記事数表示）
- [x] タグのコンテキストメニューに編集・削除を追加
- [x] ショートカットキーのカスタマイズ（表示のみ→変更可能に、カテゴリ別表示、重複検出、Reset to Defaults）
- [x] アカウント名のリネーム機能（設定画面のDescription編集可能化 + バリデーション）
- [x] アカウント設定にServer URL表示、READINGセクション追加（Reeder参考）

### 大規模タスク（独立spec推奨）

- [ ] macOSネイティブメニューバーの活用（View/Accounts/Subscriptions/Item/Shareメニュー構成）
  - View: Filter(⌘1/2/3), Theme, Layout, Sort Unread Items, Group Items, Full Screen
  - Accounts: Sync All(R), Show Accounts(U), Add Account, アカウント切替(⌘1/2)
  - Subscriptions: Sync(R), Previous/Next(P/N), Toggle Folder, Add Subscription(X)
  - Item: Previous/Next(K/J), Show Article(I), Reader View(G), Bionic Reading(⌥G), View in Browser(V), Open in Arc(B), Filter(F), Tags(T), Unstar(S), Mark as Unread(M), Mark All as Read(A), Clear(C)
  - Share: Copy Link, Add to Reading List, AirDrop, Mail, Notes, Open in Safari/Chrome/Firefox
- [x] i18n対応（UIテキストを日本語/英語切替可能に、react-i18next導入。tauri-plugin-i18nはコミュニティ製で成熟度低のため非採用）
