# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`
- [ ] 小さいアイコン操作の受理フィードバックを横展開する
  - 更新ボタンで入れた「短い 1 周スピン」を基準に、IAB の reload / 戻る / 進むなどにも同じ温度感を揃える
  - 実処理開始とクールダウン・無効時のフィードバックは誤認しないよう、回転時間や強さを整理する
  - 候補箇所: `src/components/reader/browser-overlay-chrome.tsx`, `src/components/reader/sidebar-header-view.tsx`

## 将来の同期改善候補

- [ ] 起動時同期を「選択中アカウント優先 + 残りは後続」に再設計する
  - 起動直後は現在見えているアカウントの鮮度を優先し、残りの `sync_on_startup` アカウントは後続で順次処理する案を検討する
  - `sync_on_startup` 設定の意味、選択中アカウントの決め方、失敗時の扱いを先に整理してから着手する
  - 候補箇所: `src/App.tsx`, `src-tauri/src/commands/sync_commands.rs`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
