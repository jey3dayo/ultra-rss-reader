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

- [ ] `tauri.conf.json` の updater 設定で公開鍵が正しく設定されていることを確認する
- [ ] ダウンロード中断時のリトライ/レジューム戦略を検討する
- [ ] アップデート失敗時のフォールバック動作をテストする

## データ肥大化とハウスキーピング戦略

- [ ] `housekeeping.rs` の保持ポリシーを確認・ドキュメント化する
- [ ] 記事の保持期間をユーザー設定で変更可能にすることを検討する
- [ ] DB サイズ表示と手動 VACUUM オプションの提供を検討する
