# Ultra RSS Reader — TODO

## ブラウザビューを Tauri Webview に置き換え

- [ ] iframe を廃止し、Tauri 2 の `WebviewBuilder` でネイティブ webview（macOS: WKWebView）をインライン配置する
  - X-Frame-Options / CSP による埋め込みブロックを根本解消
  - `can_go_back()` / `can_go_forward()` で正確なナビゲーション状態を取得
  - ナビゲーションイベント（`on_navigation`）で URL 変更を追跡
  - Rust 側: `WebviewWindowBuilder` で子 webview を動的作成、イベントをフロントエンドに通知
  - フロント側: Tauri コマンド経由で webview を制御（`go_back`, `go_forward`, `reload`, `close`）

## キーチェーンアクセスのタイミング改善

- [ ] 起動直後の自動同期でキーチェーンダイアログが出るのを回避する（ユーザーが不信感を持つ）
  - 現状: `sync_scheduler` が `initial_interval` 後に自動で同期開始 → `keyring_store::get_password` でダイアログ表示
  - 改善案: フロントエンドからの初回マニュアル同期完了まで、バックグラウンドスケジューラーの同期を遅延させる
