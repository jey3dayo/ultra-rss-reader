# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## UI/UX 監査の残り

- [ ] `Debug HUD` の collision handling を見直す
  - dev アプリ実機で、HUD を表示したまま `設定` モーダルを開くと HUD がモーダル上に残り、内容を隠しうる
  - 少なくとも modal / dialog / toast などの高優先 overlay と重なったときは、自動で退避・縮小・片側ドック・一時非表示のいずれかが必要
  - 対象: `src/components/debug/focus-debug-hud-view.tsx`, `src/components/app-shell.tsx`

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
