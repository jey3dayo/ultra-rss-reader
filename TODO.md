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

- [ ] oversized reader components を段階分割する
  - 問題: `article-view.tsx` と `sidebar.tsx` はまだ責務が広く、今後の変更コストが高い
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/sidebar.tsx`, `src/components/reader/article-list.tsx`
  - 計画:
    1. `article-view` は browser overlay coordination と article actions を段階的に外へ出す
    2. `sidebar` は account restore / startup expansion / hidden-state fallback を hook 化する
    3. 1 回で大きく割らず、warning を 1 つずつ消す単位で進める

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

- [x] article toolbar の action 重複を article action hook へ寄せる
  - 問題: `ArticleToolbar` にも read/star/copy/external browser の重複実装が残り、`ArticlePane` と action ロジックが二重管理になっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-actions.ts`

- [x] article-view の auto mark as read effect を hook 化する
  - 問題: `ArticlePane` に `after_reading=mark_as_read` の副作用と retain/recently-read 連携が残っていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-auto-mark.ts`

- [x] ArticleView の selection 解決を hook 化する
  - 問題: `ArticleView` に feed/account/tag/all の分岐、not-found 判定、selected article/feed 解決が残っていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/use-article-view-selection.ts`

- [x] article-view の state view を別 file に切り出す
  - 問題: `EmptyState` / `BrowserOnlyState` / not-found 表示が `article-view.tsx` に残り、view orchestration と state 表示が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-view-state.tsx`

- [x] article-view の reader body と browser action helper を別 file に切り出す
  - 問題: `article-view.tsx` に content link 処理、article meta/body、tag chips が残っていて、pane orchestration と reader body 実装が混ざっていた
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-reader-body.tsx`, `src/components/reader/article-browser-actions.ts`, `src/components/reader/article-tag-chips.tsx`

  - [x] article-list の navigation と keyboard interaction を hook 化する
  - 問題: `article-list.tsx` に記事移動、ショートカット listener、list key handling が集まっていて、表示データ導出と責務が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-interactions.ts`

- [x] article-list の search state と debounce を hook 化する
  - 問題: `article-list.tsx` に検索開閉、debounce、input focus、検索 query 実行がまとまっていて、表示データ選別と責務が混ざっていた
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/use-article-list-search.ts`

- [x] reader の再利用境界がある state/controller 型を `types` 化する
  - 問題: `use-sidebar-feed-tree.ts` と `use-add-feed-dialog-controller.ts` に再利用余地のある union/state 型が残っている
  - 対象: `src/components/reader/use-sidebar-feed-tree.ts`, `src/components/reader/use-add-feed-dialog-controller.ts`

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

- [ ] feed content の privacy/CSP 方針を決める
  - 問題: 互換性のため remote image / frame を許可しており、privacy と表示互換のトレードオフが未整理
  - 対象: `README.md`, `src-tauri/tauri.conf.json`, browser / reader 関連 docs
  - 方針:
    1. まずはプロダクト方針を決めてから実装に入る
    2. tracking pixel 対策や tighter CSP は、その方針に沿って段階的に進める
