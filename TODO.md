# Ultra RSS Reader — TODO

完了済みの UI review / overlay / settings / sidebar 改善項目は `CHANGELOG.md` の `[Unreleased]` に移動済み。

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 2026-04-12 購読整理 UI copy / 情報設計メモ

- [x] 購読整理画面に一括操作を追加する
  - 実装: `表示中をまとめて継続` / `表示中をまとめて保留`
  - 現在の filter と deferred 表示条件で見えている候補だけに作用する
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/components/feed-cleanup/feed-cleanup-page.tsx`

- [x] 購読整理画面の判断支援に優先度表示を追加する
  - 実装: `高優先 / 中優先 / 低優先` 相当の補助ラベルを queue / review に追加
  - recommendation copy は既存の `tone / titleKey / summaryKey` を維持したまま補強する
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/lib/feed-cleanup.ts`, `src/locales/ja/cleanup.json`, `src/locales/en/cleanup.json`

## 2026-04-13 Refactor フォローアップ

- [x] settings 系の共通 row / heading を `src/components/shared` へ寄せる
  - 問題: `settings-components.tsx` / `settings-page-view.tsx` / `account-sync-section-view.tsx` などに同系統の labeled control row 実装が散っている
  - 対象: `src/components/shared/*`, `src/components/settings/*`
  - 計画:
    1. 汎用な heading / select row / switch row を `shared` へ切り出す
    2. settings 周辺の重複実装を順次置き換える
    3. 既存の accessibility と selected label 表示をテストで維持する

- [x] settings/account 系の input row を `src/components/shared` へ寄せる
  - 問題: `LabeledControlRow + Input` の組み合わせが account form / credentials view / settings page にまだ散在している
  - 対象: `src/components/shared/*`, `src/components/settings/*`
  - 計画:
    1. 汎用な labeled input row を `shared` に追加する
    2. account 系の素直な text/password/url 行から順に置き換える
    3. name 属性と label 関連付けを既存テストで維持する

- [x] confirm dialog 系の shell / footer を `src/components/shared` に寄せる
  - 問題: `ConfirmDialog` と `ConfirmDialogView` がほぼ同型で、destructive footer も複数 dialog に重複している
  - 対象: `src/components/ui/confirm-dialog.tsx`, `src/components/shared/*`, `src/components/feed-cleanup/*`
  - 計画:
    1. store wrapper は `ConfirmDialogView` を再利用する
    2. destructive dialog footer を shared 化する
    3. dialog 既存テストで close / confirm 導線を維持する

- [x] add account form の select row を `shared` へ寄せる
  - 問題: `add-account-form-view.tsx` にだけ local な select row helper が残っている
  - 対象: `src/components/settings/add-account-form-view.tsx`, `src/components/shared/labeled-select-row.tsx`
  - 計画:
    1. local helper を `LabeledSelectRow` へ置き換える
    2. 既存の name 属性と表示ラベルを維持する

- [x] form footer の submit/cancel ボタンを shared に寄せる
  - 問題: `FormActionButtons` がある一方で、settings form と rename dialog に同型の footer 実装が残っている
  - 対象: `src/components/shared/form-action-buttons.tsx`, `src/components/settings/*`, `src/components/reader/*`
  - 計画:
    1. `Cancel/Submit` パターンを `FormActionButtons` へ統一する
    2. loading label と disabled 条件を既存どおり保つ

- [x] reader dialog の stacked field を `src/components/shared` に寄せる
  - 問題: `feed-dialog-form-view.tsx` / `folder-select-view.tsx` / `rename-tag-dialog-view.tsx` に同じ縦積み label+field パターンがある
  - 対象: `src/components/shared/*`, `src/components/reader/*`
  - 計画:
    1. shared に stacked input/select field を追加する
    2. reader dialog から順に置き換える
    3. accessible name と selected label を既存テストで維持する

- [x] feed dialog form の URL section を view component に切り出す
  - 問題: `feed-dialog-form-view.tsx` に URL input / discover button / discovered feed options / helper text の JSX が残っていて、dialog shell と section 描画が混ざっていた
  - 対象: `src/components/reader/feed-dialog-form-view.tsx`, `src/components/reader/feed-dialog-url-section.tsx`

- [x] rename feed dialog view props の params を shared types に寄せる
  - 問題: `use-rename-feed-dialog-view-props.ts` にだけ local な params 型が残っていて、rename dialog の view contract の正本が分かれていた
  - 対応: `UseRenameFeedDialogViewPropsParams` を `rename-feed-dialog.types.ts` に追加して、view props hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/rename-feed-dialog.types.ts`, `src/components/reader/use-rename-feed-dialog-view-props.ts`

- [x] feed tree view の unfoldered drop zone を view component に切り出す
  - 問題: `feed-tree-view.tsx` に unfoldered drop zone の JSX と styling が残っていて、tree shell と drop target 描画が混ざっていた
  - 対象: `src/components/reader/feed-tree-view.tsx`, `src/components/reader/feed-tree-unfoldered-drop-zone.tsx`

- [x] feed cleanup editor の input/select を shared field に寄せる
  - 問題: `feed-cleanup-feed-editor.tsx` にも stacked input/select パターンが残っている
  - 対象: `src/components/feed-cleanup/feed-cleanup-feed-editor.tsx`, `src/components/shared/*`
  - 計画:
    1. title と display mode を shared field に置き換える
    2. folder select と見た目・accessibility を揃える

- [x] feed cleanup panel card / detail row を domain 共通化する
  - 問題: overview / review / editor に card shell と key-value row の重複クラスが残っている
  - 対象: `src/components/feed-cleanup/*`
  - 計画:
    1. feed-cleanup 内部で card shell と detail row を小さく切り出す
    2. review / editor / overview の重複クラスを置き換える

- [x] oversized reader components を段階分割する
  - 問題: `article-view.tsx` と `sidebar.tsx` はまだ責務が広く、今後の変更コストが高かった
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/sidebar.tsx`, `src/components/reader/article-list.tsx`
  - 結果: top-level view は `article-view.tsx` / `sidebar.tsx` / `article-list.tsx` とも薄い shell になり、browser overlay・article actions・sidebar account/feed wiring は個別 hook / subview に分離された
  - 方針: 1 回で大きく割らず、warning を 1 つずつ消す単位で進めた

- [x] article-tag-picker の popover list/new-tag row を subview 化する
  - 問題: `article-tag-picker-view.tsx` に assigned tag 表示と popover list/new-tag row の JSX がまとまっていて、view shell と subview 描画が混ざっていた
  - 対象: `src/components/reader/article-tag-picker-view.tsx`, `src/components/reader/article-tag-picker-popover.tsx`

- [x] article-tag-picker の assigned tag chips を subview 化する
  - 問題: `article-tag-picker-view.tsx` に assigned tag chip の一覧描画が残っていて、view shell と chip list 描画が混ざっていた
  - 対象: `src/components/reader/article-tag-picker-view.tsx`, `src/components/reader/article-tag-chip-list.tsx`

- [x] article action hooks の contract を shared types に寄せる
  - 問題: `use-article-actions.ts` が `Parameters<typeof useArticleStatusActions>` に依存していて、status/actions hook の契約を 1 箇所で追いづらかった
  - 対応: `article-actions.types.ts` を追加して `useArticleStatusActions` / `useArticleActions` の params/result/mutation 型を寄せ、hook 実装は shared types を参照する形に寄せた
  - 対象: `src/components/reader/article-actions.types.ts`, `src/components/reader/use-article-actions.ts`, `src/components/reader/use-article-status-actions.ts`

- [x] article browser action helper の toast contract を shared types に寄せる
  - 問題: `article-browser-actions.ts` に local な toast params 型が残っていて、article action 系 helper と hook の contract が分かれていた
  - 対応: `ArticleToastActionParams` と `ArticleStatusToast` を `article-actions.types.ts` に寄せて、browser action helper は shared types を参照する形に寄せた
  - 対象: `src/components/reader/article-actions.types.ts`, `src/components/reader/article-browser-actions.ts`

- [x] command-palette の結果リスト描画を view component に切り出す
  - 問題: `command-palette.tsx` に actions/feeds/tags/articles/dev scenarios の `CommandList` 描画がまとまっていて、state 管理と view 描画が混ざっていた
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/reader/command-palette-results.tsx`

- [x] command-palette の store selector 群を ui state hook に寄せる
  - 問題: `command-palette.tsx` に `useUiStore` / `usePreferencesStore` / `usePlatformStore` の読み出しが残っていて、画面構成と state wiring が混ざっていた
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/reader/use-command-palette-ui-state.ts`

- [x] command-palette の query source と filtered result 導出を hook 化する
  - 問題: `command-palette.tsx` に feeds/tags/articles の query と recent/history/filter 判定が残っていて、検索データ導出と画面構成が混ざっていた
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/reader/use-command-palette-data.ts`

- [x] command-palette の orchestration を controller hook に寄せる
  - 問題: `command-palette.tsx` に translations/input/dev-scenario loading/results props 組み立てが残っていて、画面構成と controller orchestration が混ざっていた
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/reader/use-command-palette-controller.ts`

- [x] command-palette の action 定義を hook に寄せる
  - 問題: `useCommandPaletteController` に action list の定義と shortcut label 解決が残っていて、controller orchestration と action 定義が混ざっていた
  - 対象: `src/components/reader/use-command-palette-controller.ts`, `src/components/reader/use-command-palette-actions.ts`

- [x] command-palette の local state と dev scenario loading を runtime hook に寄せる
  - 問題: `useCommandPaletteController` に input reset / search state / dev scenario loading effect が残っていて、controller orchestration と runtime state 管理が混ざっていた
  - 対象: `src/components/reader/use-command-palette-controller.ts`, `src/components/reader/use-command-palette-runtime.ts`

- [x] command-palette の選択 handler 群を hook に寄せる
  - 問題: `useCommandPaletteController` に action/feed/tag/article/dev scenario の選択 handler が残っていて、controller orchestration と選択処理が混ざっていた
  - 対象: `src/components/reader/use-command-palette-controller.ts`, `src/components/reader/use-command-palette-handlers.ts`

- [x] command-palette の view props 組み立てを hook に寄せる
  - 問題: `useCommandPaletteController` に results props と prefix hint の組み立てが残っていて、controller orchestration と view props 導出が混ざっていた
  - 対象: `src/components/reader/use-command-palette-controller.ts`, `src/components/reader/use-command-palette-view-props.ts`

- [x] command-palette の results group 描画を subview に分ける
  - 問題: `command-palette-results.tsx` に recent/actions と feeds/tags/articles/dev scenarios の `CommandGroup` 描画がまとまっていて、results shell と group 実装が混ざっていた
  - 対応: `command-palette-action-groups.tsx` と `command-palette-resource-groups.tsx` に group 描画を分けて、results 本体は list shell に寄せた
  - 対象: `src/components/reader/command-palette-results.tsx`, `src/components/reader/command-palette-action-groups.tsx`, `src/components/reader/command-palette-resource-groups.tsx`

- [x] command-palette の shared results 型を `types` に寄せる
  - 問題: `command-palette-action-groups.tsx` と `use-command-palette-view-props.ts` が `command-palette-results.tsx` から型を取っていて、component file と型境界が混ざっていた
  - 対応: `command-palette.types.ts` に action item / results props / item value resolver を寄せて、results component は描画責務に寄せた
  - 対象: `src/components/reader/command-palette-results.tsx`, `src/components/reader/command-palette.types.ts`, `src/components/reader/use-command-palette-data.ts`, `src/components/reader/use-command-palette-view-props.ts`

- [x] command-palette の group props 型を shared types から再利用する
  - 問題: `command-palette-action-groups.tsx` と `command-palette-resource-groups.tsx` に local props 型が残っていて、`command-palette.types.ts` を作ったあとも subview 側で境界が重複していた
  - 対応: `CommandPaletteResultsProps` から `Pick` した group props 型を `command-palette.types.ts` に寄せて、subview 側は再利用に寄せた
  - 対象: `src/components/reader/command-palette.types.ts`, `src/components/reader/command-palette-action-groups.tsx`, `src/components/reader/command-palette-resource-groups.tsx`

- [x] command-palette の view props result 型を shared types に寄せる
  - 問題: `use-command-palette-view-props.ts` の `resultsProps` / `prefixHints` の返り値 shape が local なままで、controller と view の接着境界を型として再利用しづらかった
  - 対応: `command-palette.types.ts` に `CommandPaletteViewResultsProps` / `CommandPalettePrefixHints` / `CommandPaletteViewPropsResult` を追加して、view props hook の返り値を shared types に寄せた
  - 対象: `src/components/reader/command-palette.types.ts`, `src/components/reader/use-command-palette-view-props.ts`

- [x] command-palette controller の返り値型を shared types に寄せる
  - 問題: `use-command-palette-controller.ts` の返り値が暗黙型のままで、state wiring と `view props` をあわせた最終 contract を型として追いにくかった
  - 対応: `CommandPaletteControllerResult` を `command-palette.types.ts` に追加して、controller の返り値を shared contract に寄せた
  - 対象: `src/components/reader/command-palette.types.ts`, `src/components/reader/use-command-palette-controller.ts`

- [x] command-palette の runtime / actions / handlers / view-props params を shared types に寄せる
  - 問題: `command-palette.types.ts` に shared result 型がある一方で、`use-command-palette-runtime.ts` と `use-command-palette-view-props.ts` の params 型、`actions/handlers` の dependency contract は local hook 由来のままで、正本が分かれたままだった
  - 対応: `UseCommandPaletteRuntimeParams` / `UseCommandPaletteRuntimeResult` / `UseCommandPaletteActionsParams` / `UseCommandPaletteHandlersParams` / `UseCommandPaletteViewPropsParams` を `command-palette.types.ts` に寄せて、`useCommandPaletteUiState` や conditional infer への依存を減らした
  - 対象: `src/components/reader/command-palette.types.ts`, `src/components/reader/use-command-palette-actions.ts`, `src/components/reader/use-command-palette-runtime.ts`, `src/components/reader/use-command-palette-handlers.ts`, `src/components/reader/use-command-palette-view-props.ts`

- [x] command-palette の recent history helper を共通化する
  - 問題: `use-command-palette-data.ts` と `use-command-palette-handlers.ts` に history prefix / parse / format ルールが重複していて、recent action 表示と履歴書き込みの契約が分散していた
  - 対応: `command-palette-history.ts` に history entry の parse/format を寄せて、unit test で prefix 契約を固定した
  - 対象: `src/components/reader/command-palette-history.ts`, `src/components/reader/use-command-palette-data.ts`, `src/components/reader/use-command-palette-handlers.ts`, `src/__tests__/components/command-palette-history.test.ts`

- [x] article-pane controller から overlay action JSX を外す
  - 問題: `useArticlePaneController` が browser overlay の action strip JSX を直接返していて、controller orchestration と view 描画が混ざっていた
  - 対象: `src/components/reader/use-article-pane-controller.tsx`, `src/components/reader/article-view.tsx`, `src/components/reader/article-view.types.ts`

- [x] article-view の pane view 実装を別 file に切り出す
  - 問題: `article-view.tsx` に `ArticleToolbar` / `ArticlePane` の実装が残っていて、selection 分岐と pane view 描画が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-pane-view.tsx`

- [x] browser-view の webview state helper を module 化する
  - 問題: `useBrowserViewController` に initial state / missing-webview 判定 / loading state merge が残っていて、controller orchestration と webview state helper が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/browser-webview-state.ts`, `src/__tests__/components/browser-webview-state.test.ts`

- [x] browser-view の debug geometry event dispatch を hook 化する
  - 問題: `useBrowserViewController` に browser debug HUD 向け event dispatch effect が残っていて、controller orchestration と diagnostics bridge が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-debug-geometry-events.ts`

- [x] browser-view の surface issue helper を module 化する
  - 問題: `useBrowserViewController` と `browser-view.tsx` に failed/blocked/browser-mode 用の issue 定義が散っていて、surface state 表現と controller orchestration が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/browser-view.tsx`, `src/components/reader/browser-surface-issue.ts`, `src/__tests__/components/browser-surface-issue.test.ts`

- [x] browser-view の viewport width 監視を hook 化する
  - 問題: `useBrowserViewController` に overlay 用 viewport width の resize 監視が残っていて、controller orchestration と runtime state 管理が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-overlay-viewport-width.ts`, `src/__tests__/hooks/use-browser-overlay-viewport-width.test.tsx`

- [x] browser-view の request state と native diagnostics state を hook 化する
  - 問題: `useBrowserViewController` に `browserUrl` 切り替え時の request state reset と `nativeDiagnostics` の local state 管理が残っていて、controller orchestration と browser runtime state 管理が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-request-state.ts`, `src/components/reader/use-browser-native-diagnostics.ts`, `src/components/reader/browser-webview-state.ts`

- [x] browser-view runtime hook の contract を shared types に寄せる
  - 問題: `use-browser-view-runtime.ts` に local params/result 型と store `ReturnType` 依存が残っていて、browser runtime 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserViewRuntimeParams` / `UseBrowserViewRuntimeResult` を `browser-view.types.ts` に追加して、runtime hook は shared types と explicit store contract を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-view-runtime.ts`

- [x] browser-view event bridge の contract を shared types に寄せる
  - 問題: `use-browser-view-event-bridge.ts` に local params 型が残っていて、browser runtime/event bridge 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserViewEventBridgeParams` / `UseBrowserViewEventBridgeResult` を `browser-view.types.ts` に追加して、event bridge hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-view-event-bridge.ts`

- [x] browser-view surface controller の contract を shared types に寄せる
  - 問題: `use-browser-view-surface-controller.ts` に local params 型が残っていて、surface state/controller 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserViewSurfaceControllerParams` / `UseBrowserViewSurfaceControllerResult` を `browser-view.types.ts` に追加して、surface controller hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-view-surface-controller.ts`

- [x] browser-view surface state の contract を shared types に寄せる
  - 問題: `use-browser-view-surface-state.ts` に local params 型が残っていて、surface state 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserViewSurfaceStateParams` / `UseBrowserViewSurfaceStateResult` を `browser-view.types.ts` に追加して、surface state hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-view-surface-state.ts`

- [x] browser-webview events の contract を shared types に寄せる
  - 問題: `use-browser-webview-events.ts` に local params 型が残っていて、webview event listener 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserWebviewEventsParams` / `UseBrowserWebviewEventsResult` を `browser-view.types.ts` に追加して、events hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-webview-events.ts`

- [x] browser overlay shortcuts の params を shared types に寄せる
  - 問題: `use-browser-overlay-shortcuts.ts` に local params 型が残っていて、overlay shortcut hook の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserOverlayShortcutsParams` を `browser-view.types.ts` に追加して、overlay shortcuts hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-overlay-shortcuts.ts`

- [x] browser webview timeout / state changed の contract を shared types に寄せる
  - 問題: `use-browser-webview-load-timeout.ts` と `use-browser-webview-state-changed.ts` に local params 型が残っていて、browser helper 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserWebviewLoadTimeoutParams` と `UseBrowserWebviewStateChangedParams` を `browser-view.types.ts` に追加して、両 hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-webview-load-timeout.ts`, `src/components/reader/use-browser-webview-state-changed.ts`

- [x] browser webview sync 系 helper の contract を shared types に寄せる
  - 問題: `use-browser-webview-bounds-sync.ts` / `use-browser-webview-request-state.ts` / `use-browser-webview-sync.ts` に local params 型が残っていて、browser sync helper 境界の正本を `browser-view.types.ts` から追えなかった
  - 対応: `UseBrowserWebviewBoundsSyncParams` / `UseBrowserWebviewRequestStateParams` / `UseBrowserWebviewSyncParams` を `browser-view.types.ts` に追加して、各 hook は shared types を参照する形に寄せた
  - 対象: `src/components/reader/browser-view.types.ts`, `src/components/reader/use-browser-webview-bounds-sync.ts`, `src/components/reader/use-browser-webview-request-state.ts`, `src/components/reader/use-browser-webview-sync.ts`

- [x] browser-view の load timeout 監視を hook 化する
  - 問題: `useBrowserViewController` に embedded browser の load timeout 監視 effect が残っていて、controller orchestration と runtime timeout 管理が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-load-timeout.ts`

- [x] browser-view の webview event listener 登録を hook 化する
  - 問題: `useBrowserViewController` に native webview event の listen/unlisten 配線が残っていて、controller orchestration と event bridge が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-events.ts`

- [x] browser-view の overlay presentation class を helper 化する
  - 問題: `useBrowserViewController` に close/action/stage の class 導出が残っていて、controller orchestration と presentation ルールが混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/browser-overlay-presentation.ts`, `src/__tests__/components/browser-overlay-presentation.test.ts`

- [x] browser-view の geometry/class presentation 導出を helper 化する
  - 問題: `useBrowserViewController` に geometry 解決と compact 判定を前提にした class 導出が残っていて、controller orchestration と presentation view model 導出が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/browser-view-presentation.ts`, `src/__tests__/components/browser-view-presentation.test.ts`

- [x] browser-view の native event listener 登録を hook 化する
  - 問題: `useBrowserViewController` に state/fallback/closed/diagnostics の listener 登録が残っていて、controller orchestration と native event bridge が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-events.ts`

- [x] browser-view の bounds sync effect を hook 化する
  - 問題: `useBrowserViewController` に host resize / window resize の effect が残っていて、controller orchestration と webview bounds 同期が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-bounds-sync.ts`

- [x] browser-view の webview sync command orchestration を hook 化する
  - 問題: `useBrowserViewController` に create/update bounds の command orchestration と pending sync state が残っていて、controller orchestration と native webview runtime state が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-sync.ts`

- [x] browser-view の unmount cleanup を hook 化する
  - 問題: `useBrowserViewController` に closeBrowserWebview の cleanup effect が残っていて、controller orchestration と webview lifecycle cleanup が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-webview-cleanup.ts`

- [x] browser-view の retry / external-open handler を hook 化する
  - 問題: `useBrowserViewController` に retry と external browser open の action handler が残っていて、controller orchestration と surface action が混ざっていた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-view-actions.ts`

- [x] browser-view の diagnostics rail / surface state card を view component 化する
  - 問題: `browser-view.tsx` に diagnostics rail と surface failure card の詳細 JSX が残っていて、overlay shell 描画と subview 実装が混ざっていた
  - 対象: `src/components/reader/browser-view.tsx`, `src/components/reader/browser-diagnostics-rail.tsx`, `src/components/reader/browser-surface-state-card.tsx`

- [x] browser-view の surface state / runtime-unavailable 判定を surface controller hook に寄せる
  - 問題: `useBrowserViewController` に `surfaceIssue` state、failure handler、runtime-unavailable 判定が残っていて、controller orchestration と surface state 管理が混ざっていた
  - 対応: `use-browser-view-surface-state.ts` の安全網を維持したまま、translation/runtime 判定の接着を `use-browser-view-surface-controller.ts` へ寄せて controller 本体を軽くした
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-view-surface-state.ts`, `src/components/reader/use-browser-view-surface-controller.ts`

- [x] browser-view の runtime state wiring を hook 化する
  - 問題: `useBrowserViewController` に diagnostics 設定、browser URL、overlay refs、native diagnostics、viewport width などの runtime state 配線が残っていて、controller orchestration と runtime 初期化が混ざっていた
  - 対応: `use-browser-view-runtime.ts` に runtime state と ref 初期化を寄せて、controller 本体は orchestration に集中させた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/use-browser-view-runtime.ts`

- [x] sidebar の feed navigation と event listener を hook 化する
  - 問題: `sidebar.tsx` に feed 移動、folder 自動展開、`APP_EVENTS.navigateFeed` 購読が残っていて、tree 導出と責務が混ざっている
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-feed-navigation.ts`

- [x] sidebar の smart view 派生モデルを hook 化する
  - 問題: `sidebar.tsx` に unread/starred の表示条件と selected 判定が残っていて、表示データ整形と view orchestration が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-smart-views.ts`

- [x] sidebar の tag item 派生モデルを hook 化する
  - 問題: `sidebar.tsx` に tags/counts/selected 状態の合成が残っていて、tag section 用の view model 整形が本体に混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-tag-items.ts`

- [x] sidebar の UI action handler 群を hook 化する
  - 問題: `sidebar.tsx` に section toggle / account 選択 / settings-add-feed 導線の callback 群が残っていて、表示ロジックと UI action が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-ui-actions.ts`

- [x] sidebar の context menu renderer 群を hook 化する
  - 問題: `sidebar.tsx` に folder/feed/tag の context menu renderer callback が残っていて、view tree 構築と描画補助が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-context-menu-renderers.ts`

- [x] sidebar account switcher に sync retry 状態を表示する
  - 問題: 自動再試行待ちの account があっても sidebar からは状態が見えず、settings を開かないと backoff 状況が分からなかった
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/account-switcher-view.tsx`, `src/hooks/use-account-sync-statuses.ts`

- [x] account sync retry 時刻 formatter を reader/settings で共通化する
  - 問題: sidebar と settings に retry 時刻の整形ロジックが重複していた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-sync.ts`, `src/components/settings/account-detail.tsx`, `src/lib/account-sync-status-format.ts`

- [x] sidebar の store selector 群を ui state hook に寄せる
  - 問題: `sidebar.tsx` に `useUiStore` / `usePreferencesStore` の読み出しが多く残っていて、画面構成と state wiring が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-ui-state.ts`

- [x] sidebar の query source 取得を sources hook に寄せる
  - 問題: `sidebar.tsx` に accounts / feeds / folders / tags / account articles の query 呼び出しと基本集計が残っていて、source 取得と view orchestration が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-sources.ts`

- [x] sidebar の content shell を view component に切り出す
  - 問題: `sidebar.tsx` に subscriptions section / scroll area / footer actions / add-feed dialog の描画が残っていて、state orchestration と shell 描画が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/sidebar-content-view.tsx`

- [x] sidebar の content section 組み立てを view component に切り出す
  - 問題: `sidebar.tsx` に feed tree / tag section / add-feed dialog / empty state の JSX 組み立てが残っていて、view orchestration と section 描画が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/sidebar-content-sections.tsx`

- [x] sidebar の orchestration を controller hook に寄せる
  - 問題: `sidebar.tsx` に account/sync/tree/ui action まわりの hook 配線が残っていて、画面構成と controller 責務が混ざっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-controller.ts`

- [x] sidebar の feed section wiring を controller hook に寄せる
  - 問題: `useSidebarController` に drag state / feed tree / startup expansion / visibility fallback / feed navigation の接着が残っていて、controller orchestration が重くなっていた
  - 対象: `src/components/reader/use-sidebar-controller.ts`, `src/components/reader/use-sidebar-feed-section-controller.ts`

- [x] sidebar の section props 組み立てを view props hook に寄せる
  - 問題: `useSidebarController` に header/account/smart views/content sections の props 組み立てが残っていて、controller orchestration と view props 導出が混ざっていた
  - 対象: `src/components/reader/use-sidebar-controller.ts`, `src/components/reader/use-sidebar-view-props.ts`

- [x] sidebar の account section props 組み立てを helper に寄せる
  - 問題: `use-sidebar-section-props.ts` に account dropdown/title/menu wiring が残っていて、section props の中でも account section だけ props 組み立て責務が重かった
  - 対応: `use-sidebar-account-section-props.ts` へ account section props 導出を寄せて、section props 本体は section 間の接着に寄せた
  - 対象: `src/components/reader/use-sidebar-section-props.ts`, `src/components/reader/use-sidebar-account-section-props.ts`

- [x] sidebar の content sections props 組み立てを helper に寄せる
  - 問題: `use-sidebar-section-props.ts` に subscriptions/tags/add-feed dialog 向け props 組み立てが残っていて、section props 集約と content section 専用の props 導出が混ざっていた
  - 対応: `use-sidebar-content-sections-props.ts` へ content sections props の組み立てを寄せて、section props 本体は header/account/smart views の接着に寄せた
  - 対象: `src/components/reader/use-sidebar-section-props.ts`, `src/components/reader/use-sidebar-content-sections-props.ts`

- [x] sidebar の header / smart views props 組み立てを helper に寄せる
  - 問題: `use-sidebar-section-props.ts` に sync/add-feed header と smart views section の local object 組み立てが残っていて、section props 集約と top-level section の view model 導出が混ざっていた
  - 対応: `use-sidebar-header-props.ts` と `use-sidebar-smart-views-props.ts` へ props 導出を寄せて、section props 本体は helper 間の接着に寄せた
  - 対象: `src/components/reader/use-sidebar-section-props.ts`, `src/components/reader/use-sidebar-header-props.ts`, `src/components/reader/use-sidebar-smart-views-props.ts`

- [x] sidebar の feed tree props 組み立てを helper に寄せる
  - 問題: `use-sidebar-feed-section-controller.ts` に drag callbacks の request wrapper と `FeedTreeViewProps` の object 組み立てが残っていて、feed tree orchestration と view props 導出が混ざっていた
  - 対応: `use-sidebar-feed-tree-props.ts` へ `FeedTreeViewProps` 導出を寄せて、feed section controller 本体は tree data と drag/navigation orchestration に寄せた
  - 対象: `src/components/reader/use-sidebar-feed-section-controller.ts`, `src/components/reader/use-sidebar-feed-tree-props.ts`

- [x] sidebar helper 群の shared props 型を component export に寄せる
  - 問題: `use-sidebar-*-props.ts` と `use-sidebar-view-props.ts` に `Parameters<typeof ...>[0]` 由来の props 型が散っていて、helper が増えるほど型の正本が追いにくくなっていた
  - 対応: `SidebarHeaderViewProps` / `SidebarAccountSectionProps` / `SidebarContentSectionsProps` を component 側で export して、helper 群はそれを再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/sidebar-account-section.tsx`, `src/components/reader/sidebar-content-sections.tsx`, `src/components/reader/use-sidebar-*.ts`

- [x] sidebar の runtime state wiring を hook 化する
  - 問題: `useSidebarController` に section open state、account switcher、source query、sync wiring の初期化が残っていて、controller orchestration と runtime 配線が混ざっていた
  - 対応: `use-sidebar-runtime.ts` へ runtime state / refs / sync 接着を寄せて、controller 本体は section orchestration に集中させた
  - 対象: `src/components/reader/use-sidebar-controller.ts`, `src/components/reader/use-sidebar-runtime.ts`, `src/components/reader/use-sidebar-sync.ts`

- [x] sidebar sync feedback message 解決を helper に寄せる
  - 問題: `use-sidebar-sync.ts` に warning/manual sync 両経路の toast 文言辞書が重複していて、sync feedback の表現と event orchestration が混ざっていた
  - 対応: `sidebar-sync-feedback.ts` に summary -> localized message の変換を寄せて、warning/manual sync の両方から再利用するようにした
  - 対象: `src/components/reader/use-sidebar-sync.ts`, `src/components/reader/sidebar-sync-feedback.ts`

- [x] sidebar の account restore / startup expansion / hidden-state fallback を hook 化する
  - 問題: `sidebar.tsx` に account 復元、起動時 folder 展開、visibility fallback の effect が集まり、責務が重くなっていた
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/use-sidebar-account-selection.ts`, `src/components/reader/use-sidebar-startup-folder-expansion.ts`, `src/components/reader/use-sidebar-visibility-fallback.ts`

- [x] browser/list で意味を持つマジックナンバーを constants に寄せる
  - 対象: `src/components/reader/article-list.tsx`, `src/constants/browser.ts`, `src/constants/reader.ts`, `src/lib/browser-debug-geometry.ts`, `src/lib/browser-webview.ts`
  - 方針: 検索 debounce 時間、browser scale factor fallback、geometry 表示精度を定数名で管理する

- [x] app/runtime・dev scenario・data settings の意味付き数値を constants 化する
  - 対象: `src/App.tsx`, `src/stores/ui-store.ts`, `src/dev/scenarios/helpers.ts`, `src/components/settings/data-settings.tsx`
  - 方針:
    1. sleep 復帰判定・toast duration・dev scenario retry/wait・byte formatting を対象にする
    2. Tailwind の見た目寸法や Storybook のサンプル値までは広げない
    3. 定数ファイルは責務ごとに分け、既存の並行作業と衝突しにくくする

- [x] settings 系の散在型を `types` として整理する
  - 問題: view component 内に export された props / control 型が点在し、import 境界と責務の境界が一致していない
  - 対象候補: `src/components/settings/settings-page-view.tsx`, `src/components/settings/account-*-view.tsx`, `src/components/settings/add-account-form-view.tsx`
  - 今回の方針:
    1. 複数ファイルから参照される型だけを切り出す
    2. component 内部だけで閉じる private な型は無理に外へ出さない
    3. 振る舞い変更なしを前提に、import 経路だけを整理する
  - 実施:
    1. `settings-page.types.ts` を新設して settings page 系の props / control 型を集約
    2. `account-detail.types.ts` を新設して account detail 系 section props を集約
    3. 既存 view component は描画責務に寄せ、型 export を剥がした

- [x] feed cleanup view props を `types` として整理する
  - 問題: `feed-cleanup-page-view.tsx` に大きな inline props 型が埋め込まれ、overview / queue / review panel 間の共有型も view file 側に散っていた
  - 対象: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/components/feed-cleanup/feed-cleanup-*.tsx`
  - 実施:
    1. `feed-cleanup.types.ts` を新設して page / panel 間で共有する view props 型を集約
    2. `FeedCleanupPageView` の inline props を `FeedCleanupPageViewProps` に置き換えた
    3. review / queue / overview の props 型も同じ types file から参照するように整理した

- [x] feed cleanup の delete/editor props も `types` に寄せる
  - 問題: `feed-cleanup-delete-dialog.tsx` と `feed-cleanup-feed-editor.tsx` に view props の inline 定義が残っている
  - 対象: `src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx`, `src/components/feed-cleanup/feed-cleanup-feed-editor.tsx`, `src/components/feed-cleanup/feed-cleanup.types.ts`

- [x] feed cleanup editor/controller の型境界を `types` に寄せる
  - 問題: `use-feed-cleanup-feed-editor-controller.ts` の params / return と display option 型が local inline 定義のままで、editor 側の import 境界と責務境界がずれていた
  - 対象: `src/components/feed-cleanup/use-feed-cleanup-feed-editor-controller.ts`, `src/components/feed-cleanup/feed-cleanup.types.ts`

- [x] add account 系の view props を `types` に寄せる
  - 問題: `add-account-form-view.tsx` に form control と section props の中心定義が残っている
  - 対象: `src/components/settings/add-account-form-view.tsx`, `src/components/settings/*types*.ts`

- [x] add account service 定義と props 型を `types` / 定義 module に寄せる
  - 問題: `service-picker.tsx` が service 定義・props 型・UI をまとめて持ち、`account-config-form.tsx` / `accounts-nav-view.tsx` が component file へ直接依存していた
  - 対象: `src/components/settings/service-picker.tsx`, `src/components/settings/account-config-form.tsx`, `src/components/settings/accounts-nav-view.tsx`

- [x] article-view の browser overlay coordination を hook 化する
  - 問題: `article-view.tsx` に display mode 解決、overlay 開閉、focus return がまとまっていて、`ArticlePane` の責務が広かった
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-browser-overlay.ts`

- [x] article-view の article actions と keyboard shortcut を hook 化する
  - 問題: `ArticlePane` に read/star/copy/reading list の action と keyboard listener が残り、overlay 分離後も責務が重かった
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-actions.ts`

- [x] article action hook を context menu にも再利用する
  - 問題: `article-context-menu.tsx` に read/star/open browser の mutation 処理が重複し、`article-view` と同期して保守する必要があった
  - 対象: `src/components/reader/article-context-menu.tsx`, `src/components/reader/use-article-actions.ts`, `src/components/reader/article-view.tsx`

- [x] article action hook の read/star status 更新を専用 hook に寄せる
  - 問題: `use-article-actions.ts` に read/star mutation、retain 条件、toggle handler がまとまっていて、browser/link action と status action の責務が混ざっていた
  - 対応: `use-article-status-actions.ts` へ status mutation と toggle handler を寄せて、`use-article-actions.ts` は browser/link action と shortcut 接着に寄せた
  - 対象: `src/components/reader/use-article-actions.ts`, `src/components/reader/use-article-status-actions.ts`

- [x] article toolbar の action 重複を article action hook へ寄せる
  - 問題: `ArticleToolbar` にも read/star/copy/external browser の重複実装が残り、`ArticlePane` と action ロジックが二重管理になっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-actions.ts`

- [x] article-view の auto mark as read effect を hook 化する
  - 問題: `ArticlePane` に `after_reading=mark_as_read` の副作用と retain/recently-read 連携が残っていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-auto-mark.ts`

- [x] ArticleView の selection 解決を hook 化する
  - 問題: `ArticleView` に feed/account/tag/all の分岐、not-found 判定、selected article/feed 解決が残っていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-view-selection.ts`

- [x] article-view の store selector 群を ui state hook に寄せる
  - 問題: `article-view.tsx` に `useUiStore` / `usePreferencesStore` の読み出しが残っていて、pane orchestration と state wiring が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-view-ui-state.ts`

- [x] article-view の pane orchestration を controller hook に寄せる
  - 問題: `ArticlePane` に browser overlay / auto mark / close handler / overlay toolbar action の接着が残っていて、pane orchestration が重かった
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-pane-controller.tsx`

- [x] article-view の pane props を types と controller result に寄せる
  - 問題: `ArticleToolbar` props と overlay action strip の JSX 組み立てが `article-view.tsx` に残っていて、view props 境界と controller result が揃っていなかった
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-view.types.ts`, `src/components/reader/use-article-pane-controller.tsx`

- [x] article-view の pane view を別 file に切り出す
  - 問題: `article-view.tsx` に `ArticlePane` / `ArticleToolbar` の描画実装が残っていて、selection state view と pane view が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-pane-view.tsx`

- [x] article-view の state view を別 file に切り出す
  - 問題: `EmptyState` / `BrowserOnlyState` / not-found 表示が `article-view.tsx` に残り、view orchestration と state 表示が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-view-state.tsx`

- [x] article-view の reader body と browser action helper を別 file に切り出す
  - 問題: `article-view.tsx` に content link 処理、article meta/body、tag chips が残っていて、pane orchestration と reader body 実装が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-reader-body.tsx`, `src/components/reader/article-browser-actions.ts`, `src/components/reader/article-tag-chips.tsx`

  - [x] article-list の navigation と keyboard interaction を hook 化する
  - 問題: `article-list.tsx` に記事移動、ショートカット listener、list key handling が集まっていて、表示データ導出と責務が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-interactions.ts`

- [x] article-list の global event listener を interactions hook から分離する
  - 問題: `use-article-list-interactions.ts` に article navigation と focus-search / mark-all-read の window event 登録が残っていて、DOM interaction と global event bridge が混ざっていた
  - 対応: `use-article-list-global-events.ts` に window event 購読を寄せて、interactions hook は DOM refs と keyboard action 解決に寄せた
  - 対象: `src/components/reader/use-article-list-interactions.ts`, `src/components/reader/use-article-list-global-events.ts`

- [x] article-list の focused navigation を hook 化する
  - 問題: `use-article-list-interactions.ts` に adjacent article 解決、scroll 補正、focus return が残っていて、keyboard action 解決と DOM navigation が混ざっていた
  - 対応: `use-article-list-navigation.ts` に row navigation を寄せて、interactions hook は global event bridge と key handling に寄せた
  - 対象: `src/components/reader/use-article-list-interactions.ts`, `src/components/reader/use-article-list-navigation.ts`

- [x] article-list の keydown action 解決を hook 化する
  - 問題: `use-article-list-interactions.ts` に `resolveKeyboardAction` と UI action dispatch が残っていて、DOM refs 管理と keyboard action 解決が混ざっていた
  - 対応: `use-article-list-keydown-handler.ts` に list option 向け key handling を寄せて、interactions hook は refs / navigation / global event 接着に寄せた
  - 対象: `src/components/reader/use-article-list-interactions.ts`, `src/components/reader/use-article-list-keydown-handler.ts`

- [x] article-list の search state と debounce を hook 化する
  - 問題: `article-list.tsx` に検索開閉、debounce、input focus、検索 query 実行がまとまっていて、表示データ選別と責務が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-search.ts`

- [x] article-list の runtime state wiring を hook 化する
  - 問題: `use-article-list-controller.ts` に ui state / source query / search state の初期化が残っていて、controller orchestration と runtime 配線が混ざっていた
  - 対応: `use-article-list-runtime.ts` に `uiState + sources + search` の接着を寄せて、controller 本体は data/view state/orchestration に集中させた
  - 対象: `src/components/reader/use-article-list-controller.ts`, `src/components/reader/use-article-list-runtime.ts`

- [x] article-list の grouped view model を hook 化する
  - 問題: `article-list.tsx` に group label 解決と row 表示用 item 整形が残っていて、表示データ導出と画面構成が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-groups.ts`

- [x] article-list の view state 判定を hook 化する
  - 問題: `article-list.tsx` に context strip / footer mode / search-empty 判定が残っていて、表示状態の導出と画面構成が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-view-state.ts`

- [x] article-list の filtered/grouped data 導出を hook 化する
  - 問題: `article-list.tsx` に effective view mode、filtered articles、grouped articles、selected feed 解決が残っていて、データ導出と画面構成が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-data.ts`

- [x] article-list の query source 解決を hook 化する
  - 問題: `article-list.tsx` に selection から feed/tag/account scope を解決して query hook を呼ぶ責務が残っていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-sources.ts`

- [x] article-list の selection/scroll effect を hook 化する
  - 問題: `article-list.tsx` に選択記事の可視判定と selection change 時の scroll reset effect が残っていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-effects.ts`

- [x] article-list の feed display preset control を view component 化する
  - 問題: `article-list.tsx` に display preset Select の JSX が残っていて、header 配線と control 描画が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/article-list-feed-mode-control.tsx`

- [x] article-list の header control props 導出を hook 化する
  - 問題: `article-list.tsx` に sidebar button 文言・表示条件と feed mode control 配線が残っていて、header state 導出と画面構成が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-header-controls.tsx`

- [x] article-list の interaction hook に key map / refs を寄せる
  - 問題: `article-list.tsx` に keyboard shortcut map の生成と list/viewport ref の所有が残っていて、interaction orchestration と画面構成が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-interactions.ts`

- [x] article-list の body/context menu を view component に切り出す
  - 問題: `article-list.tsx` に list body と mark-all-read context menu の JSX が残っていて、画面構成と list shell 描画が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/article-list-body.tsx`

- [x] article-list の store selector 群を ui state hook に寄せる
  - 問題: `article-list.tsx` に `useUiStore` / `usePreferencesStore` の読み出しが多く残っていて、画面構成と state wiring が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-ui-state.ts`

- [x] article-list の orchestration を controller hook に寄せる
  - 問題: `article-list.tsx` に data/search/view-state/header/interactions の hook 配線が残っていて、画面構成と controller 責務が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-controller.ts`

- [x] reader の再利用境界がある state/controller 型を `types` 化する
  - 問題: `use-sidebar-feed-tree.ts` と `use-add-feed-dialog-controller.ts` に再利用余地のある union/state 型が残っている
  - 対象: `src/components/reader/use-sidebar-feed-tree.ts`, `src/components/reader/use-add-feed-dialog-controller.ts`

- [x] feed tree の drop target helper を module 化する
  - 問題: `use-feed-tree-drag.ts` に drop target attribute 名、target 解決、同値判定が残っていて、drag orchestration と target helper が混ざっていた
  - 対象: `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/feed-tree-drop-target.ts`, `src/components/reader/feed-tree-view.tsx`, `src/components/reader/feed-tree-folder-section.tsx`

- [x] feed dialog の shared props 型を `types` に寄せる
  - 問題: `rename-feed-dialog-view.tsx` が `feed-dialog-form-view.tsx` から型を直接 import していて、component file と型境界が混ざっていた
  - 対象: `src/components/reader/feed-dialog-form-view.tsx`, `src/components/reader/feed-dialog-form.types.ts`, `src/components/reader/rename-feed-dialog-view.tsx`

- [x] rename feed dialog の view/controller 型を `types` に寄せる
  - 問題: `rename-feed-dialog-view.tsx` と `use-rename-feed-dialog-controller.ts` に inline props / params / return 型が残っていて、component file と型境界が混ざっていた
  - 対象: `src/components/reader/rename-feed-dialog-view.tsx`, `src/components/reader/use-rename-feed-dialog-controller.ts`, `src/components/reader/rename-feed-dialog.types.ts`

- [x] rename feed dialog の view props 組み立てを hook に寄せる
  - 問題: `rename-feed-dialog.tsx` に display preset options、url fields、folder select props、labels の組み立てが残っていて、container wiring と view props 導出が混ざっていた
  - 対象: `src/components/reader/rename-feed-dialog.tsx`, `src/components/reader/use-rename-feed-dialog-view-props.ts`

- [x] feed tree drag session helper の契約を unit test で固定する
  - 問題: `feed-tree-drag-session.ts` が pointer drag の閾値と session 更新を担っているが、helper 単体の回帰テストがなかった
  - 対象: `src/components/reader/feed-tree-drag-session.ts`, `src/__tests__/components/feed-tree-drag-session.test.ts`

- [x] feed tree drop outcome helper の契約を unit test で固定する
  - 問題: `feed-tree-drag-outcome.ts` が pointer drag 終了時の outcome 分岐を担っているが、helper 単体の回帰テストがなかった
  - 対象: `src/components/reader/feed-tree-drag-outcome.ts`, `src/__tests__/components/feed-tree-drag-outcome.test.ts`

- [x] feed tree handle click suppression を hook 化する
  - 問題: `use-feed-tree-drag.ts` に drag 後 click 抑制の timer/ref 管理が残っていて、drag orchestration と handle click suppression が混ざっていた
  - 対象: `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/use-feed-tree-handle-click-suppression.ts`, `src/__tests__/hooks/use-feed-tree-handle-click-suppression.test.tsx`

- [x] feed tree drop outcome の side-effect dispatch を helper 化する
  - 問題: `use-feed-tree-drag.ts` に drop outcome 後の callback dispatch と pointer cleanup が残っていて、drag orchestration と outcome 適用が混ざっていた
  - 対象: `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/feed-tree-drag-outcome.ts`, `src/__tests__/components/feed-tree-drag-outcome.test.ts`

- [x] feed tree の point-to-target 解決を drop target helper に寄せる
  - 問題: `use-feed-tree-drag.ts` に `document.elementFromPoint` を使った drop target 解決が残っていて、drag orchestration と target 解決が混ざっていた
  - 対象: `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/feed-tree-drop-target.ts`, `src/__tests__/components/feed-tree-drop-target.test.ts`

- [x] feed tree pointer session guard を session helper に寄せる
  - 問題: `use-feed-tree-drag.ts` の `move/up/cancel` に pointerId 一致確認が重複していて、drag orchestration と session guard が混ざっていた
  - 対象: `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/feed-tree-drag-session.ts`, `src/__tests__/components/feed-tree-drag-session.test.ts`

- [x] article list の view props 型を component 実体に揃える
  - 問題: `use-article-list-view-props.ts` の手書き型が header/context/body/footer component の props とずれていて、`tsc` が `article-list` で停止していた
  - 対象: `src/components/reader/use-article-list-view-props.ts`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-list-context-strip.tsx`, `src/components/reader/article-list-body.tsx`, `src/components/reader/article-list-footer.tsx`

- [x] article list の hook result 型を view props 境界へ再利用する
  - 問題: `use-article-list-view-props.ts` に `headerControls` / `viewState` の result shape が再定義で残っていて、hook 境界の変更が view props 側へ伝播しにくかった
  - 対象: `src/components/reader/use-article-list-controller.ts`, `src/components/reader/use-article-list-view-props.ts`, `src/components/reader/use-article-list-header-controls.tsx`, `src/components/reader/use-article-list-view-state.ts`

- [x] article list の body props 組み立てを helper に寄せる
  - 問題: `use-article-list-view-props.ts` に loading/empty/groups/context menu 用の body props 組み立てが残っていて、header/context/footer との境界に対して body だけ責務が重かった
  - 対応: `use-article-list-body-props.ts` へ body props 導出を寄せて、`use-article-list-view-props.ts` は section ごとの接着に寄せた
  - 対象: `src/components/reader/use-article-list-view-props.ts`, `src/components/reader/use-article-list-body-props.ts`

- [x] browser view の subview props/controller slice 型を `types` に寄せる
  - 問題: `browser-overlay-chrome.tsx` と `browser-overlay-stage.tsx` に subview 用の `Pick<BrowserViewController, ...>` と union props が local 定義で散っていて、overlay refactor の型境界を追いにくかった
  - 対象: `src/components/reader/browser-view.tsx`, `src/components/reader/browser-overlay-chrome.tsx`, `src/components/reader/browser-overlay-stage.tsx`, `src/components/reader/browser-view.types.ts`

- [x] browser view の controller contract 型を `types` に寄せる
  - 問題: `use-browser-view-controller.ts` に `BrowserViewController` と diagnostics/layout/geometry alias が残っていて、`browser-view.types.ts` を作ったあとも型の正本が分散していた
  - 対象: `src/components/reader/use-browser-view-controller.ts`, `src/components/reader/browser-view.types.ts`

- [x] browser view runtime の返り値 contract から未使用 state を外す
  - 問題: `use-browser-view-runtime.ts` が `browserState` を返していたが、controller 側では使っておらず runtime 内部 state と外部 contract がずれていた
  - 対象: `src/components/reader/use-browser-view-runtime.ts`

- [x] sidebar の section/view props 型を shared types に寄せる
  - 問題: `use-sidebar-section-props.ts` / `use-sidebar-view-props.ts` / `use-sidebar-header-props.ts` に sidebar 向け props/result 型 alias が散っていて、型境界の正本を追いにくかった
  - 対応: `sidebar.types.ts` に section/view contract を集約して、sidebar hooks は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/use-sidebar-header-props.ts`, `src/components/reader/use-sidebar-section-props.ts`, `src/components/reader/use-sidebar-view-props.ts`

- [x] sidebar controller の返り値 contract を shared types に寄せる
  - 問題: `use-sidebar-controller.ts` の返り値が暗黙型のままで、section/view props を束ねた最終 contract を shared type として追いにくかった
  - 対応: `SidebarControllerResult` を `sidebar.types.ts` に追加して、controller の返り値を explicit contract に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/use-sidebar-controller.ts`

- [x] article-list view props の contract を shared types に寄せる
  - 問題: `use-article-list-view-props.ts` に layout/view mode と section props/result 型が local 定義で残っていて、controller から参照する返り値 contract の正本が hook file に閉じていた
  - 対応: `article-list.types.ts` に view props contract を寄せて、controller / view props hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-view-props.ts`, `src/components/reader/use-article-list-controller.ts`

- [x] sidebar feed section controller の contract を shared types に寄せる
  - 問題: `use-sidebar-feed-section-controller.ts` に `feed-tree` / `startup-folder-expansion` 由来の local param alias が残っていて、controller 境界の正本が hook file に閉じていた
  - 対応: `sidebar-feed-section.types.ts` に params/result contract を切り出して、feed section controller は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-section.types.ts`, `src/components/reader/use-sidebar-feed-section-controller.ts`

- [x] sidebar feed tree props helper の contract を shared types に寄せる
  - 問題: `use-sidebar-feed-tree-props.ts` に `FeedTreeViewProps` 由来の local param/result alias が残っていて、feed section 内の helper 境界が別 file に閉じていた
  - 対応: `sidebar-feed-section.types.ts` に `SidebarFeedTreeProps` / `SidebarFeedTreePropsParams` を追加して、feed tree props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-section.types.ts`, `src/components/reader/use-sidebar-feed-tree-props.ts`

- [x] sidebar controller の action wiring を helper に寄せる
  - 問題: `use-sidebar-controller.ts` に `selected_account_id` 保存 callback と feed folder mutation wrapper の匿名関数が残っていて、controller orchestration と action wiring が混ざっていた
  - 対応: `use-sidebar-controller-actions.ts` に account preference 保存・feed folder mutation wrapper・UI actions 接着を寄せて、controller 本体は section orchestration に寄せた
  - 対象: `src/components/reader/use-sidebar-controller.ts`, `src/components/reader/use-sidebar-controller-actions.ts`

- [x] sidebar sync hook の contract を shared types に寄せる
  - 問題: `use-sidebar-sync.ts` に sync params/result と warning payload alias が local 定義で残っていて、runtime から参照する sync 境界の正本が hook file に閉じていた
  - 対応: `sidebar-sync.types.ts` に sync params/result/payload を切り出して、sync hook と runtime は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-sync.types.ts`, `src/components/reader/use-sidebar-sync.ts`, `src/components/reader/use-sidebar-runtime.ts`

- [x] sidebar sources hook の contract を shared types に寄せる
  - 問題: `use-sidebar-sources.ts` の selected account param と source query の返り値 shape が local 定義のままで、runtime が束ねる source 境界の正本を追いにくかった
  - 対応: `sidebar-sources.types.ts` に params/result contract を切り出して、sources hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-sources.types.ts`, `src/components/reader/use-sidebar-sources.ts`

- [x] sidebar controller actions の contract を shared types に寄せる
  - 問題: `use-sidebar-controller-actions.ts` が `Parameters<typeof useSidebarUiActions>` と mutation 由来の local alias に依存していて、action helper 境界の正本を追いにくかった
  - 対応: `sidebar-controller.types.ts` に params/result contract を切り出して、`use-sidebar-ui-actions.ts` と `use-sidebar-controller-actions.ts` は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-controller.types.ts`, `src/components/reader/use-sidebar-ui-actions.ts`, `src/components/reader/use-sidebar-controller-actions.ts`

- [x] sidebar tag item helper の contract を shared types に寄せる
  - 問題: `sidebar-content-sections.tsx` が `useSidebarTagItems` の `Parameters` / `ReturnType` に依存していて、tag section の入力・出力境界を追いにくかった
  - 対応: `sidebar-tag-items.types.ts` に params/item contract を切り出して、`use-sidebar-tag-items.ts` と `tag-list-view.tsx` と `sidebar-content-sections.tsx` は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-tag-items.types.ts`, `src/components/reader/use-sidebar-tag-items.ts`, `src/components/reader/tag-list-view.tsx`, `src/components/reader/sidebar-content-sections.tsx`

- [x] feed-tree の shared view model 型を types file に寄せる
  - 問題: `feed-tree-view.tsx` / `feed-tree-folder-section.tsx` / `feed-tree-row.tsx` に folder/feed/drop target の型定義が分散していて、drag helper や sidebar helper が view file へ型依存していた
  - 対応: `feed-tree.types.ts` に feed/folder/drop target/view props contract を集約して、drag/sidebar helper と view component は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/feed-tree-view.tsx`, `src/components/reader/feed-tree-folder-section.tsx`, `src/components/reader/feed-tree-row.tsx`, `src/components/reader/use-feed-tree-drag.ts`, `src/components/reader/use-sidebar-feed-tree.ts`

- [x] feed-tree drag hook の contract を shared types に寄せる
  - 問題: `use-feed-tree-drag.ts` に drag params/result contract が local 定義で残っていて、feed tree drag 境界の正本を追いにくかった
  - 対応: `feed-tree.types.ts` に drag params/result contract を追加して、drag hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/use-feed-tree-drag.ts`

- [x] sidebar runtime の返り値 contract を shared types に寄せる
  - 問題: `use-sidebar-runtime.ts` の返り値が暗黙型のままで、account switcher / ui state / sources / sync を束ねた runtime 境界の正本を追いにくかった
  - 対応: `sidebar-runtime.types.ts` に account switcher / ui state / runtime result contract を切り出して、関連 hooks は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-runtime.types.ts`, `src/components/reader/use-sidebar-account-switcher.ts`, `src/components/reader/use-sidebar-ui-state.ts`, `src/components/reader/use-sidebar-runtime.ts`

- [x] sidebar feed drag state の contract を shared types に寄せる
  - 問題: `use-sidebar-feed-drag-state.ts` に drag state params/result と `feedById` の最小 shape が local 定義で残っていて、feed section 内の drag 境界の正本を追いにくかった
  - 対応: `sidebar-feed-section.types.ts` に drag state params/result contract を追加して、drag state hook と feed tree props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-section.types.ts`, `src/components/reader/use-sidebar-feed-drag-state.ts`

- [x] feed-tree drag hook の contract を shared types に寄せる
  - 問題: `use-feed-tree-drag.ts` に params/result alias が local 定義で残っていて、drag hook 境界の正本が hook file に閉じていた
  - 対応: `feed-tree.types.ts` に `UseFeedTreeDragParams` / `UseFeedTreeDragResult` を追加して、drag hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/use-feed-tree-drag.ts`

- [x] sidebar feed navigation の contract を shared types に寄せる
  - 問題: `use-sidebar-feed-navigation.ts` に navigation params が local 定義で残っていて、feed section 内の navigation 境界の正本を追いにくかった
  - 対応: `sidebar-feed-section.types.ts` に navigation params contract を追加して、navigation hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-section.types.ts`, `src/components/reader/use-sidebar-feed-navigation.ts`

- [x] sidebar smart views hook の contract を shared types に寄せる
  - 問題: `use-sidebar-smart-views.ts` に smart view params が local 定義で残っていて、sidebar section が束ねる smart views 境界の正本を追いにくかった
  - 対応: `sidebar.types.ts` に smart views params/result contract を追加して、smart views hook と section props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/use-sidebar-smart-views.ts`, `src/components/reader/use-sidebar-smart-views-props.ts`

- [x] sidebar props helper の contract を shared types に寄せる
  - 問題: `use-sidebar-account-section-props.ts` / `use-sidebar-content-sections-props.ts` / `use-sidebar-view-props.ts` に local params が残っていて、sidebar props helper 境界の正本を追いにくかった
  - 対応: `sidebar.types.ts` に account/content/view props params contract を追加して、各 helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/use-sidebar-account-section-props.ts`, `src/components/reader/use-sidebar-content-sections-props.ts`, `src/components/reader/use-sidebar-view-props.ts`

- [x] sidebar account selection の contract を shared types に寄せる
  - 問題: `use-sidebar-account-selection.ts` に account auto-selection params が local 定義で残っていて、runtime 配下の selection 境界の正本を追いにくかった
  - 対応: `sidebar-runtime.types.ts` に account selection params contract を追加して、selection hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-runtime.types.ts`, `src/components/reader/use-sidebar-account-selection.ts`

- [x] sidebar visibility fallback の contract を shared types に寄せる
  - 問題: `use-sidebar-visibility-fallback.ts` に fallback params が local 定義で残っていて、feed section helper 境界の正本を追いにくかった
  - 対応: `sidebar-feed-section.types.ts` に visibility fallback params contract を追加して、fallback hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-section.types.ts`, `src/components/reader/use-sidebar-visibility-fallback.ts`

- [x] feed-tree hover/drop helper の contract を shared types に寄せる
  - 問題: `feed-tree-hover-target.ts` と `feed-tree-drag-outcome.ts` に local params/result type が残っていて、drag helper 境界の正本を追いにくかった
  - 対応: `feed-tree.types.ts` に hover target / pointer drop outcome contract を追加して、helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/feed-tree-hover-target.ts`, `src/components/reader/feed-tree-drag-outcome.ts`

- [x] sidebar account status labels の contract を shared types に寄せる
  - 問題: `use-sidebar-account-status-labels.ts` に local な `AccountLike` が残っていて、sources helper の入力境界の正本を追いにくかった
  - 対応: `sidebar-sources.types.ts` に account status label source/params contract を追加して、status labels hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-sources.types.ts`, `src/components/reader/use-sidebar-account-status-labels.ts`

- [x] sidebar context menu renderers の contract を shared types に寄せる
  - 問題: `use-sidebar-context-menu-renderers.tsx` の返り値契約が hook file に閉じていて、controller から使う renderer 境界の正本を追いにくかった
  - 対応: `sidebar.types.ts` に context menu renderers result contract を追加して、renderer hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/use-sidebar-context-menu-renderers.tsx`

- [x] sidebar の content/feed/footer view props を shared types に寄せる
  - 問題: `sidebar-content-view.tsx` / `sidebar-feed-section.tsx` / `sidebar-footer-actions.tsx` に local props type が残っていて、sidebar view 補助 component の境界を `sidebar.types.ts` から一望できなかった
  - 対応: `sidebar.types.ts` に各 view props contract を追加して、sidebar content/feed/footer component は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/sidebar-content-view.tsx`, `src/components/reader/sidebar-feed-section.tsx`, `src/components/reader/sidebar-footer-actions.tsx`

- [x] feed-tree view 補助 component の props を shared types に寄せる
  - 問題: `feed-tree-empty-state.tsx` と `feed-tree-unfoldered-drop-zone.tsx` に local props type が残っていて、feed tree view 補助 component 境界の正本を追いにくかった
  - 対応: `feed-tree.types.ts` に empty state / unfoldered drop zone props contract を追加して、補助 component は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/feed-tree-empty-state.tsx`, `src/components/reader/feed-tree-unfoldered-drop-zone.tsx`

- [x] sidebar feed tree helper の contract を shared types に寄せる
  - 問題: `sidebar-feed-tree-helpers.ts` に `SortFeeds` と `FeedTreeViewModelOptions` が local 定義で残っていて、feed tree helper 境界の正本を追いにくかった
  - 対応: `sidebar-feed-tree.types.ts` に helper contract を追加して、feed tree helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-tree.types.ts`, `src/components/reader/sidebar-feed-tree-helpers.ts`

- [x] sidebar visible feed tree helper の contract を shared types に寄せる
  - 問題: `sidebar-feed-tree-helpers.ts` に visible feed tree 集約の params/result が local な導出に閉じていて、`use-sidebar-feed-tree.ts` との接着境界を `sidebar-feed-tree.types.ts` から追えなかった
  - 対応: `sidebar-feed-tree.types.ts` に visible feed tree params/result contract を追加して、helper と hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar-feed-tree.types.ts`, `src/components/reader/sidebar-feed-tree-helpers.ts`, `src/components/reader/use-sidebar-feed-tree.ts`

- [x] feed-tree row drag handle の props を shared types に寄せる
  - 問題: `feed-tree-row.tsx` に `DragHandleProps` が local 定義で残っていて、row 補助 component 境界の正本を追いにくかった
  - 対応: `feed-tree.types.ts` に drag handle props contract を追加して、row 補助 component は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/feed-tree.types.ts`, `src/components/reader/feed-tree-row.tsx`

- [x] sidebar/feed section types の feed-tree import を types file へ揃える
  - 問題: `sidebar.types.ts` と `sidebar-feed-section.types.ts` が `feed-tree-view.tsx` の再 export 経由で `FeedTreeViewProps` を参照していて、型の正本が component file を経由して見えていた
  - 対応: `FeedTreeViewProps` の import 元を `feed-tree.types.ts` へ揃えて、sidebar 側の shared types が view component を経由しない形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/sidebar-feed-section.types.ts`

- [x] account-switcher の props 型を shared types に寄せる
  - 問題: `account-switcher-view.tsx` と `account-switcher-menu.tsx` に props contract が分散していて、sidebar account section が component file へ型依存していた
  - 対応: `account-switcher.types.ts` に shared props contract を切り出して、account switcher view/menu と sidebar account section は再利用する形に寄せた
  - 対象: `src/components/reader/account-switcher.types.ts`, `src/components/reader/account-switcher-view.tsx`, `src/components/reader/account-switcher-menu.tsx`, `src/components/reader/sidebar-account-section.tsx`

- [x] sidebar controller の section orchestration を helper hook に寄せる
  - 問題: `use-sidebar-controller.ts` に smart views / context menus / feed section / section props 接着が残っていて、runtime wiring と section orchestration が混ざっていた
  - 対応: `use-sidebar-controller-sections.ts` に section orchestration を切り出して、controller 本体は runtime/actions/view props 接着へ寄せた
  - 対象: `src/components/reader/use-sidebar-controller.ts`, `src/components/reader/use-sidebar-controller-sections.ts`, `src/components/reader/sidebar.types.ts`

- [x] sidebar account section props の正本を sidebar types に寄せる
  - 問題: `sidebar-account-section.tsx` が自前で `SidebarAccountSectionProps` を定義していて、section contract の正本が component file に残っていた
  - 対応: `sidebar.types.ts` に `SidebarAccountSectionProps` を移して、section component は shared types を参照する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/sidebar-account-section.tsx`

- [x] article list presentation 周辺の contract を shared types に寄せる
  - 問題: `use-article-list-presentation.ts` の params と周辺 hook の入力型が local 定義のままで、presentation 層の境界を横断して追いにくかった
  - 対応: `article-list.types.ts` に presentation params contract を追加し、関連 hook は export した shared params/result を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-presentation.ts`, `src/components/reader/use-article-list-view-state.ts`, `src/components/reader/use-article-list-view-props.ts`, `src/components/reader/use-article-list-groups.ts`, `src/components/reader/use-article-list-header-controller.ts`, `src/components/reader/use-article-list-interactions.ts`

- [x] article list body props の contract を shared types に寄せる
  - 問題: `use-article-list-body-props.ts` の params 契約が hook file に閉じていて、body 組み立て境界の正本を追いにくかった
  - 対応: `article-list.types.ts` に body props params contract を追加して、body props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-body-props.ts`

- [x] article list search hook の contract を shared types に寄せる
  - 問題: `use-article-list-search.ts` の params/result 契約が hook file に閉じていて、runtime 配下の search 境界の正本を追いにくかった
  - 対応: `article-list.types.ts` に search params/result contract を追加して、search hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-search.ts`

- [x] article list sources hook の contract を shared types に寄せる
  - 問題: `use-article-list-sources.ts` の params/result 契約が hook file に閉じていて、runtime 配下の query source 境界の正本を追いにくかった
  - 対応: `article-list.types.ts` に sources params/result contract を追加して、sources hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-sources.ts`

- [x] article list header controls の contract を shared types に寄せる
  - 問題: `use-article-list-header-controls.tsx` の params 契約が hook file に閉じていて、header control 導出境界の正本を追いにくかった
  - 対応: `article-list.types.ts` に header controls params contract を追加して、header controls hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-header-controls.tsx`

- [x] article list header controls result の正本を shared types に寄せる
  - 問題: `UseArticleListHeaderControlsResult` が `use-article-list-header-controls.tsx` に残っていて、`article-list.types.ts` から result contract を一望できなかった
  - 対応: `article-list.types.ts` に header controls result contract を追加して、header controls hook と view props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-header-controls.tsx`, `src/components/reader/use-article-list-view-props.ts`

- [x] article list header actions result の正本を shared types に寄せる
  - 問題: `UseArticleListHeaderActionsResult` が `use-article-list-header-actions.ts` に残っていて、header actions の result contract を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に header actions result contract を追加して、header actions hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-header-actions.ts`

- [x] article list view props の params を shared types に寄せる
  - 問題: `UseArticleListViewPropsParams` が `use-article-list-view-props.ts` に残っていて、view props 導出境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に view props params contract を追加して、view props hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-view-props.ts`

- [x] article list interactions の contract を shared types に寄せる
  - 問題: `UseArticleListInteractionsParams` / `UseArticleListInteractionsResult` が `use-article-list-interactions.ts` に残っていて、interaction 導出境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に interactions params/result contract を追加して、interactions hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-interactions.ts`

- [x] article list view state の contract を shared types に寄せる
  - 問題: `UseArticleListViewStateParams` / `UseArticleListViewStateResult` が `use-article-list-view-state.ts` に残っていて、view state 導出境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に view state params/result contract を追加して、view state hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-view-state.ts`

- [x] article list effects の params を shared types に寄せる
  - 問題: `UseArticleListEffectsParams` が `use-article-list-effects.ts` に残っていて、effect 導出境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に effects params contract を追加して、effects hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-effects.ts`

- [x] article list groups の params を shared types に寄せる
  - 問題: `UseArticleListGroupsParams` が `use-article-list-groups.ts` に残っていて、group view model 導出境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に groups params contract を追加して、groups hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-groups.ts`

- [x] article list header subview props の正本を shared types に寄せる
  - 問題: `article-list-header.tsx` / `article-list-header-actions.tsx` / `article-list-header-search.tsx` に props contract が分散していて、header 境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に header/actions/search props contract を集約して、header subview は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-list-header-actions.tsx`, `src/components/reader/article-list-header-search.tsx`

- [x] article list context/body/footer props の正本を shared types に寄せる
  - 問題: `article-list-context-strip.tsx` / `article-list-body.tsx` / `article-list-footer.tsx` に view props contract が分散していて、list shell の境界を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に context/body/footer props contract を集約して、subview は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/article-list-context-strip.tsx`, `src/components/reader/article-list-body.tsx`, `src/components/reader/article-list-footer.tsx`

- [x] article list sources hook の contract を shared types に寄せる
  - 問題: `use-article-list-sources.ts` の params/result 契約が hook file に閉じていて、source query 境界の正本を `article-list.types.ts` から追えなかった
  - 対応: `article-list.types.ts` に sources params/result contract を追加して、sources hook と data hook は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/use-article-list-sources.ts`, `src/components/reader/use-article-list-data.ts`

- [x] sidebar header/content view props の正本を sidebar types に寄せる
  - 問題: `sidebar.types.ts` が `sidebar-header-view.tsx` と `sidebar-content-sections.tsx` の exported props に依存していて、shared types 側から component file へ逆参照していた
  - 対応: `sidebar.types.ts` に header/content section の props contract を持たせて、component と helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/sidebar-content-sections.tsx`, `src/components/reader/use-sidebar-content-sections-props.ts`

- [x] smart views view props の正本を sidebar types に寄せる
  - 問題: `sidebar.types.ts` が `smart-views-view.tsx` の exported props に依存していて、shared types 側から component file へ逆参照していた
  - 対応: `sidebar.types.ts` に smart views item/view props contract を持たせて、smart views view と props helper は shared types を再利用する形に寄せた
  - 対象: `src/components/reader/sidebar.types.ts`, `src/components/reader/smart-views-view.tsx`, `src/components/reader/use-sidebar-smart-views-props.ts`

## 2026-04-13 Premortem フォローアップ

- [x] release 前の native/manual verification gate を明文化する
  - 問題: `mise run ci` では FreshRSS live、native keyring、packaged updater の確認が落ちるため、CI 緑でも実機で壊れる余地がある
  - 対象: `README.md`, `CLAUDE.md`, `docs/release-manual-verification.md`

- [x] sync の partial success を見える化する
  - 問題: `pending_mutations` はあるが mutation push は batch 契約のままで、部分成功時に何が反映済みか追いにくい
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/service/sync_scheduler.rs`, `src/components/reader/*`, `src/components/settings/*`, `src/lib/*`, `src/locales/*`
  - 計画:
    1. partial success / warning / retry 待ちを区別できるログと UI 表示を整理する
    2. 失敗した account / mutation の把握に必要な情報を不足なく残す
    3. 既存の sync warning toast とテストを壊さずに観測性を上げる

- [x] 障害時の軽量 runbook を追加する
  - 問題: migration / updater / keyring / sync で復旧材料はあるが、どこを見るかと何を試すかが docs 上で分散している
  - 対象: `README.md`, `docs/incident-runbook.md`, `docs/release-manual-verification.md`

- [ ] DB migration recovery の追加 hardening は migration 変更時に issue #23 を参照する
  - 常設 TODO ではなく、次に migration を触るタイミングでまとめて扱う
  - 失敗系テストや復旧手順の補強は issue #23 に集約する

- [x] feed content の privacy/CSP 方針を決める
  - 問題: 互換性のため remote image / frame を許可しており、privacy と表示互換のトレードオフが未整理
  - 対象: `README.md`, `src-tauri/tauri.conf.json`, browser / reader 関連 docs
  - 実施:
    1. compatibility-first を現行方針として明文化した
    2. 詳細は `docs/feed-content-privacy.md` を正本とした
    3. tighter CSP や tracking pixel 対策は段階的 hardening として扱う
