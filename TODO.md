# Ultra RSS Reader — TODO

## ブラウザビューを Tauri Webview に置き換え

- [x] iframe を廃止し、Tauri 2 の `WebviewBuilder` でネイティブ webview（macOS: WKWebView）をインライン配置する
  - X-Frame-Options / CSP による埋め込みブロックを根本解消
  - `can_go_back()` / `can_go_forward()` で正確なナビゲーション状態を取得
  - ナビゲーションイベント（`on_navigation`）で URL 変更を追跡
  - Rust 側: `WebviewWindowBuilder` で子 webview を動的作成、イベントをフロントエンドに通知
  - フロント側: Tauri コマンド経由で webview を制御（`go_back`, `go_forward`, `reload`, `close`）

## キーチェーンアクセスのタイミング改善

- [x] 起動直後の自動同期でキーチェーンダイアログが出るのを回避する（ユーザーが不信感を持つ）
  - 現状: `sync_scheduler` が `initial_interval` 後に自動で同期開始 → `keyring_store::get_password` でダイアログ表示
  - 改善案: フロントエンドからの初回マニュアル同期完了まで、バックグラウンドスケジューラーの同期を遅延させる

## DB マイグレーション失敗時のリカバリ戦略

- [ ] マイグレーションをトランザクションで包む
  - 現状: `execute_batch` で実行しているが、途中失敗で DB が中間状態に陥る可能性がある
- [ ] マイグレーション実行前に自動バックアップを取る
  - `infra/db/backup.rs` が存在するので、migration 実行前に呼び出す
- [ ] マイグレーション失敗時にユーザーへ分かりやすいエラーメッセージとリストア手順を案内する

## 自動アップデートの署名検証とロールバック

- [x] `tauri.conf.json` の updater 設定で公開鍵が正しく設定されていることを確認する
- [x] ダウンロード中断時のリトライ/レジューム戦略を検討する
- [ ] アップデート失敗時のフォールバック動作をテストする

## 同期パフォーマンス改善

- [x] 全アカウントの順次同期を並列化する（`futures::future::join_all`）
- [x] 部分失敗時に失敗アカウント名をフロントに通知する（`SyncResult` 型導入）
- [x] デッドコード削除: 本番未接続の `sync_service` / `event_bus` / `housekeeping` を除去
- [ ] アカウント単位の同期コマンドを追加し、選択中アカウントのみ同期できるようにする
- [ ] 差分同期の最適化（最終同期時刻以降の変更のみ取得）
- [ ] 同期中の進捗をフロントに通知する（アカウント単位の進捗イベント）

## データ肥大化とハウスキーピング戦略

- [ ] ハウスキーピング処理を `sync_scheduler` に組み込む（`housekeeping.rs` は削除済み、パージ処理が未配線）
- [ ] 記事の保持期間をユーザー設定で変更可能にすることを検討する
- [ ] DB サイズ表示と手動 VACUUM オプションの提供を検討する
