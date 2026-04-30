# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - SQLite 接続中の DB を直接置き換えないよう、Dev 側 DB のバックアップ、アプリ終了、コピー、再起動まで含めた安全なフローにする
  - Windows と macOS の app data パス差、`ultra-rss-reader.db` / `-wal` / `-shm` の扱い、OS Keyring と Dev file credentials の差を考慮する
  - まずは `mise run app:dev:seed-from-prod` のような手動コマンドで安全性を固めてから、デバッグ画面ボタンへ接続する

## UI/UX 監査の残り

- [ ] Browser overlay 周辺への共通 motion 適用を検証する
  - Tauri child webview geometry と重なり、見た目の polish よりレイアウト安定性を優先する必要がある
  - 適用する場合は `browser-overlay-stage` / `browser-overlay-chrome` / native webview bounds の同期を実機で確認してから進める
  - `transitions-dev` の page side-by-side / panel reveal 相当を入れる場合は、WebView bounds 更新と CSS transform が二重に効かないかを先に確認する
  - まずは既存 overlay の resize / open / close 時に jank が出ているかを計測し、必要な箇所だけに限定する

- [ ] 高頻度・高密度 UI への motion 適用は専用検証バッチで進める
  - Article detail の記事切替は本文読書中の視線移動に影響するため、title / meta / tag area ごとに必要性を見て限定適用する
  - Feed tree drag overlay はドラッグ中の高頻度更新と重なるため、入口だけにするか、drag preview には適用しない方針も含めて実機確認する
  - `article-list-item` の row hover / selected transition は連続キー移動で毎フレーム効くため、`motion-static-hover-surface` への置換は計測後に行う
  - どちらも適用前後でキーボード操作、ドラッグ、連続記事移動時の jank を確認する

- [ ] Text / number swap の追加適用候補を実データ更新頻度で分ける
  - 現状: 件数バッジなどの短い数値は `MotionNumber` に寄せる。追加適用は同期カウント・検索結果数のような短い表示に限定する
  - 記事本文、長いタイトル、フィード名には適用しない。読む対象そのものが動いて見えると視線移動が増える

- [ ] `Debug HUD` の collision handling を見直す
  - dev アプリ実機で、HUD を表示したまま `設定` モーダルを開くと HUD がモーダル上に残り、内容を隠しうる
  - 2026-04-28 の実機レビューで、設定モーダル右下の操作領域と HUD が重なり、閉じるボタン周辺の可読性と操作性を下げることを再確認
  - 現状: HUD は `Move debug HUD` で 4 隅を巡回でき、閉じる操作は設定の `Debug HUD` と同じ preference を `false` にする
  - 少なくとも modal / dialog / toast などの高優先 overlay と重なったときは、自動で退避・縮小・片側ドック・一時非表示のいずれかが必要
  - 対象: `src/components/debug/focus-debug-hud-view.tsx`, `src/components/app-shell.tsx`

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
