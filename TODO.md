# Ultra RSS Reader — TODO

## ワイドスクリーン / フルスクリーン記事ビュー

- [x] フィード編集ダイアログに表示モード設定（フィード単位でワイドスクリーン ON/OFF）
- [x] ワイドスクリーンモード: サイドバー非表示、記事リスト＋ブラウザビュー2ペイン構成
- [x] 記事ビューアクションメニューにワイドスクリーン/フルスクリーン切替ボタン
- [x] Settings > Reading にデフォルト表示モード設定（通常/ワイド/フルスクリーン）

## タグ

- [x] タグ名変更ダイアログに色選択を追加（DB の `tags.color` カラムは既存）

## アプリアイコン設定

- [x] アプリアイコンの作成・設定（PR #10）
- [x] ライトモード対応（OS テーマに応じたアイコン切替） #11

## UI/UX レビュー対応

- [x] タグ追加ポップオーバーの新規タグ作成ボタンに accessible name を付与
- [x] モバイルでスマートビュー / すべて / フォルダ / アカウント選択時に記事一覧へ遷移
- [x] モバイル単一ペイン時の固定幅（`280px` / `380px`）を解消して full-width 化
- [x] CSP / `frame-ancestors` で埋め込み拒否された記事をブラウザビューで外部ブラウザ fallback に切り替える
- [x] フィード追加ダイアログの URL 検証を入力 UI と submit で一致させる

## 設定画面レビュー

- [x] Settings の Select / Switch が未保存時でも既定値を正しく表示するようにする（現状は UI と実際の挙動がズレる）
- [x] Settings > Actions の既定値を利用側と統一する（`action_share` の既定値が設定ストアとツールバーで不一致）
- [x] Settings > General > 未読バッジ「受信トレイのみ」を実装する（現状は `すべての未読` と同じ集計）
- [x] Settings > General > 記事を既読にする（`mark_article_as_read`）を実装するか、未使用設定として整理する

## ペイン遷移アニメーション

- [x] 購読→記事一覧→記事詳細のペイン遷移時にスライドアニメーションを追加する（`focusedPane` 切替に連動）

## ブラウザビューを Tauri Webview に置き換え

- [ ] iframe を廃止し、Tauri 2 の `WebviewBuilder` でネイティブ webview（macOS: WKWebView）をインライン配置する
  - X-Frame-Options / CSP による埋め込みブロックを根本解消
  - `can_go_back()` / `can_go_forward()` で正確なナビゲーション状態を取得
  - ナビゲーションイベント（`on_navigation`）で URL 変更を追跡
  - Rust 側: `WebviewWindowBuilder` で子 webview を動的作成、イベントをフロントエンドに通知
  - フロント側: Tauri コマンド経由で webview を制御（`go_back`, `go_forward`, `reload`, `close`）

## フォントスタイル設定が反映されない

- [x] `body` の `font-family: var(--font-sans)` がハードコードされており、Tailwind クラスによる切り替えが効かない → `font-family: inherit` に変更して解決

## キーチェーンアクセスのタイミング改善

- [x] dev ビルドで毎回 Keychain ダイアログが出る → 自己署名証明書 `UltraRSSReader-Dev` で署名し、`mise run app:dev:signed` で回避
- [ ] 起動直後の自動同期でキーチェーンダイアログが出るのを回避する（ユーザーが不信感を持つ）
  - 現状: `sync_scheduler` が `initial_interval` 後に自動で同期開始 → `keyring_store::get_password` でダイアログ表示
  - 改善案: フロントエンドからの初回マニュアル同期完了まで、バックグラウンドスケジューラーの同期を遅延させる
