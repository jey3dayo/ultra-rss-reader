# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - SQLite 接続中の DB を直接置き換えないよう、Dev 側 DB のバックアップ、アプリ終了、コピー、再起動まで含めた安全なフローにする
  - Windows と macOS の app data パス差、`ultra-rss-reader.db` / `-wal` / `-shm` の扱い、OS Keyring と Dev file credentials の差を考慮する
  - まずは `mise run app:dev:seed-from-prod` のような手動コマンドで安全性を固めてから、デバッグ画面ボタンへ接続する

## 閲覧復帰

- 実装は一体化しすぎず、次の段階に分けて進める
  1. 閲覧履歴基盤: 記事を開いた履歴の永続化、記録 ON/OFF、履歴削除、`すべて既読` との分離
  2. 最近見た記事: 永続化した履歴を使い、クラッシュ・終了後に戻れるスマートビューを追加
  3. 追っているフィード / おすすめ記事: 履歴が溜まってからスコアリングを調整し、継続的に読むフィードや記事を出す

- [ ] 「追っているフィード」または「おすすめ記事」スマートビューを検討する
  - 単純な閲覧回数ではなく、直近 30 日の読了率、読んだ日数、スター、外部ブラウザ閲覧、最近読んだかを元にスコアリングする
  - NHK のように配信数が多く単発でたまに読むフィードは、読了率や継続性が低ければ上位に出さない
  - 漫画、Must Read、テック記事など、配信されたらだいたい読むフィードを上げる
  - `すべて既読` 操作は実閲覧とは分け、開いた記事・滞在時間・スターなどの能動的な履歴を優先する
  - 設定からおすすめ算出の ON/OFF と、サイドバー表示の ON/OFF を切り替えられるようにする
  - フィード単位で `おすすめに出す` / `おすすめに出さない` の手動補正を検討する

## UI/UX 監査の残り

- [ ] `Debug HUD` の collision handling を見直す
  - dev アプリ実機で、HUD を表示したまま `設定` モーダルを開くと HUD がモーダル上に残り、内容を隠しうる
  - 2026-04-28 の実機レビューで、設定モーダル右下の操作領域と HUD が重なり、閉じるボタン周辺の可読性と操作性を下げることを再確認
  - 修正方針: HUD は overlay デバッグにも必要なため自動非表示にはせず、4 隅へ移動できる導線で重なりを避ける。閉じる操作は設定の `Debug HUD` と同じ preference を `false` にする
  - 少なくとも modal / dialog / toast などの高優先 overlay と重なったときは、自動で退避・縮小・片側ドック・一時非表示のいずれかが必要
  - 対象: `src/components/debug/focus-debug-hud-view.tsx`, `src/components/app-shell.tsx`

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する

## リファクタ再実行メモ

- [ ] 別作業のアニメーション実装が落ち着いた後に、unused cleanup を再実行する
  - `react-doctor` の候補: `src/components/ui/confirm-dialog.tsx`, `src/components/ui/switch.tsx`, `src/constants/index.ts`
  - `src/lib/webview-history.ts` は一度削除後に別作業で revert されたため、必要性を確認してから触る
  - `settings-modal.tsx` の accounts view 解決ロジックは一度 `resolveSettingsAccountsView` 抽出で警告解消できたが、別作業で revert されたため再適用前に最新実装を確認する
  - `similarity-ts --threshold 0.95 src` の残りは `useArticleListKeydownHandler` と `useArticleListNavigation` のみ。責務差があるため、無理な共通化はしない
  - 再開時は `mise run check` と `mise run build` まで通す
