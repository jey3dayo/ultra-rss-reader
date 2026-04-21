# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## UI/UX 監査の残り

- [ ] ダークテーマでサイドバー冒頭のコントラストと温度感を検証する
  - account header のタイトル、時刻、hover/focus、未読サマリーカードが dark でも沈みすぎないかを Tauri 実機で確認する
  - light で整えた hierarchy が dark でも維持されるよう、必要なら色トークンと hover tone を微調整する
  - 候補箇所: `src/components/reader/account-switcher-view.tsx`, `src/components/reader/smart-views-view.tsx`, `src/styles/global.css`
- [ ] 複数アカウント時の hover / focus の手触りを実機で詰める
  - account header の hover と keyboard focus が視覚的に強すぎず弱すぎず、複数アカウント切り替えの affordance として自然かを Tauri 実機で確認する
  - hover / focus / expanded の状態差が素直に読めるよう、必要なら ring、text tone、chevron の反応を微調整する
  - 候補箇所: `src/components/reader/account-switcher-view.tsx`, `src/components/reader/account-switcher-menu.tsx`
- [ ] サイドバー周辺の回帰確認を広げる
  - `pnpm vitest run` の関連範囲を account switcher 単体から少し広げ、サイドバー選択や header 周辺のテストも含めて確認する
  - Tauri 実機でも hover、focus、expanded など状態差分のスクリーンショットを数枚残し、見た目の回帰確認に使える材料を揃える
  - 候補箇所: `src/__tests__/components/account-switcher-view.test.tsx`, `src/__tests__/components/sidebar-account-selection.test.ts`, `src/components/reader/account-switcher-view.tsx`
- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`
## 将来の同期改善候補

- [ ] 起動時同期を「選択中アカウント優先 + 残りは後続」に再設計する
  - 起動直後は現在見えているアカウントの鮮度を優先し、残りの `sync_on_startup` アカウントは後続で順次処理する案を検討する
  - `sync_on_startup` 設定の意味、選択中アカウントの決め方、失敗時の扱いを先に整理してから着手する
  - 候補箇所: `src/App.tsx`, `src-tauri/src/commands/sync_commands.rs`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
