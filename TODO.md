# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - 既存の `mise run app:dev:seed-from-prod` を前提に、デバッグ画面から誤操作なく呼べる UX と確認導線を設計する
  - Dev 側 DB のバックアップ場所、アプリ再起動、credentials はコピーされないことを UI 上で明示する

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

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 問題化リスク優先キュー

### P0: 失敗の沈黙・データ不整合につながる候補

- [ ] P0 startup sync rejection surface を修正する
  - 対象: `src/App.tsx`
  - `triggerStartupSync(selectedAccountId).then(...)` に rejected promise の catch がなく、native command wrapper や runtime boundary が reject した時に起動時同期の失敗が沈黙する
  - `Result.fail` と rejected promise を分けて log-only 方針を固定し、startup throttle marker を成功前に書く現状で問題ないかも一緒に確認する
  - focused check: `pnpm exec vitest run src/__tests__/app/app-root.test.tsx src/__tests__/app.test.tsx`

- [ ] P0 sync-on-wake rejected promise / partial failure surface を修正する
  - 対象: `src/App.tsx`
  - `runSyncOnWake()` は account ごとの `syncAccount(accountId).then(...)` を `Promise.all` しているが、rejected promise と partial failure の扱いが明確でない
  - 1 account の reject で他 account の結果処理や query invalidation がどうなるかを決め、partial failure を log-only / toast / retry のどれにするか contract test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/app/app-root.test.tsx src/__tests__/app.test.tsx`

- [ ] P0 browser retry fire-and-forget sync failure を修正する
  - 対象: `src/components/reader/hooks/browser/use-browser-view-actions.ts`
  - `handleRetry()` が optimistic に browser state を戻した後、`void syncBrowserWebview(browserUrl, "create")` の rejected promise を処理していない
  - retry 失敗時に surface issue / toast / log のどれで戻すかを決め、再試行 UI が成功状態に見えたまま残らないことを focused test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-browser-view-actions.test.tsx src/__tests__/components/browser-view.test.tsx`

- [ ] P0 sidebar feed landing fire-and-forget failure を修正する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`
  - `open_first_article_on_feed_selection` path が `void openFeedLanding(feedId)` を失敗未処理で呼び、feed fetch failure / missing article / rejected promise が sidebar 操作から見えない
  - command palette 側と同等に `Result.fail` と rejected promise を分け、selectFeed fallback または toast の方針を固定する
  - focused check: `pnpm exec vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/hooks/use-command-palette-handlers-resource.test.ts`

- [ ] P0 delete feed post-success invalidation failure を修正する
  - 対象: `src/hooks/use-delete-feed.ts`
  - delete success 後に `accountArticles` / `feedArticleSummaries` invalidation を fire-and-forget しており、cache refresh 失敗時も成功 toast だけが残る
  - delete mutation success と cache refresh failure を分け、少なくとも rejection log と regression test を追加する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-delete-feed.test.tsx`

- [ ] P0 tag mutation invalidation failure を修正する
  - 対象: `src/hooks/use-tags.ts`
  - `invalidateTagQueryKeys()` が tag create / rename / delete / article assignment 後の `invalidateQueries` rejection を未処理にしている
  - mutation success を覆さない log-only helper に寄せるか、ユーザー表示が必要な failure として扱うかを決める
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-tags.test.tsx src/__tests__/components/tags-settings.test.tsx`

- [ ] P0 mute keyword invalidation failure を修正する
  - 対象: `src/hooks/use-mute-keywords.ts`
  - `invalidateMuteKeywordQueries()` が mute keyword / article invalidation を複数 fire-and-forget しており、filter 表示の stale 状態が残る失敗を捕捉できない
  - `src/lib/query/query-invalidation.ts` の catch 付き方針へ寄せ、failure は log-only か user-visible かを固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-mute-keywords.test.tsx src/__tests__/components/mute-settings.test.tsx`

- [ ] P0 account setup sync status invalidation failure を修正する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`
  - `runAccountSetupSync()` が sync success / failure 後の `account-sync-status` invalidation を `void` で投げ、setup UI state と status rows がズレる failure を捕捉できない
  - setup completion の success/failure と status refresh failure を分け、log-only か retry surface かを test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-account-detail-sync-controls.test.tsx src/__tests__/hooks/use-account-detail-sync-status-rows.test.tsx`

### P1: runtime boundary / stale async が問題化しやすい候補

- [ ] P1 app icon theme drain rejection / stale request を修正する
  - 対象: `src/hooks/use-app-icon-theme.ts`
  - `queueMicrotask(() => void drainIconRequests())` が rejected promise を catch せず、runtime icon replacement failure が unhandled になり得る
  - latest-only queue は維持しつつ、`setWindowIcon` rejection / unsupported platform / unmount 後 request を focused test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-app-icon-theme.test.tsx`

- [ ] P1 always-on-top preference side effect rejection を修正する
  - 対象: `src/hooks/use-window-always-on-top.ts`
  - `setWindowAlwaysOnTop(enabled).then(...)` に catch がなく、native command wrapper が reject した場合に preference side effect の失敗が沈黙する
  - unsupported は no-op、その他は warn という現行方針を rejected promise にも適用し、rapid toggle の stale log 抑制を test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-window-always-on-top.test.tsx`

- [ ] P1 matchMedia listener compatibility を修正する
  - 対象: `src/stores/preferences-store.ts`, `src/hooks/use-app-icon-theme.ts`, `src/components/reader/browser-view.tsx`
  - runtime boundary rule は missing listener APIs の fallback を求めているが、複数箇所で `mediaQuery.addEventListener/removeEventListener` 前提の実装が残っている
  - `addListener/removeListener` fallback または helper 化を行い、missing `matchMedia` / missing listener / cleanup を contract test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/hooks/use-app-icon-theme.test.tsx src/__tests__/components/browser-view.test.tsx`

- [ ] P1 browser webview create/focus latest-only ordering を検証する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - create / resize / focus / pending bounds が重なる時に、古い create result や focus failure が新しい `browserUrl` の surface issue を上書きしないか確認する
  - deferred promise test で create A -> create B -> A settle の順序を固定し、必要なら request id を追加する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-browser-webview-sync.test.tsx src/__tests__/components/browser-view.test.tsx`

- [ ] P1 startup folder expansion localStorage boundary を補強する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`
  - `window.localStorage` read/write failure は catch されているが、`window` unavailable と malformed cross-account state の contract が薄い
  - browser preview / SSR-like test / malformed JSON / write quota failure を分け、React state fallback が壊れないことを固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-sidebar-startup-folder-expansion.test.ts`

- [ ] P1 command history storage boundary を補強する
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`
  - command palette history は localStorage read/write failure を握りつぶす方針だが、schema cleanup write failure と add/clear failure の contract を明確化できていない
  - unavailable / throwing read / throwing write / malformed JSON / oversized history を test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/components/command-palette-history.test.ts src/__tests__/components/command-palette.test.tsx`

- [ ] P1 Tauri listener ready error visibility を補強する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `src/App.tsx`
  - `attachTauriListeners()` は cleanup を返すだけで `ready` を呼び出し側へ返さないため、listener registration failure の扱いが App 側から見えにくい
  - App の `sync-completed` listener は unavailable / registration reject / cleanup reject を log-only とするのか、dev warning にするのかを contract test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/lib/tauri-event-listeners.test.ts src/__tests__/app/app-root.test.tsx`

### P2: 事故予防として早めに固定したい候補

- [ ] P2 query invalidation helper への集約を進める
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/use-tags.ts`, `src/hooks/use-mute-keywords.ts`, `src/hooks/use-delete-feed.ts`, `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`
  - cache invalidation の failure 方針が file ごとに揺れており、今後の mutation 追加で同じ fire-and-forget 漏れが再発しやすい
  - log-only helper / user-visible helper / awaited helper を分け、各 caller がどれを使うかを明示する
  - focused check: `pnpm exec vitest run src/__tests__/lib/query-invalidation.test.ts src/__tests__/hooks/use-tags.test.tsx src/__tests__/hooks/use-mute-keywords.test.tsx`

- [ ] P2 browser action rejected promise parity を確認する
  - 対象: `src/lib/actions.ts`, `src/components/reader/hooks/browser/use-browser-view-actions.ts`, `src-tauri/src/browser_webview.rs`
  - menu action / toolbar action / injected bridge で back-forward-reload-close の failure surface が揃っているか確認する
  - injected bridge は log-only、frontend action は toast など、入口ごとの policy を対応表にして tests を足す
  - focused check: `pnpm exec vitest run src/__tests__/lib/actions.test.ts src/__tests__/components/browser-view.test.tsx`

- [ ] P2 feed landing failure surface parity を確認する
  - 対象: `src/hooks/use-feed-landing.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`, `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`
  - command palette と sidebar feed selection で feed landing failure の toast / selection fallback / browser close 方針が揃っていない
  - missing account / feed not found / fetch failed / no article の結果を入口ごとに固定する
  - focused check: `pnpm exec vitest run src/__tests__/hooks/use-command-palette-handlers-resource.test.ts src/__tests__/components/sidebar.test.tsx`

- [ ] P2 native preference side effect policy を整理する
  - 対象: `src/stores/preferences-store.ts`, `src/hooks/use-window-always-on-top.ts`, `src/hooks/use-app-icon-theme.ts`, `src/hooks/use-badge.ts`
  - theme / language / always-on-top / icon / badge の side effect が、persist failure・native failure・latest-only のどれを user-visible にするか揺れている
  - UI preference は optimistic 維持、native side effect は log-only など、CLAUDE.md の Async Side Effect Policy に合わせた共通方針を test とコメントで固定する
  - focused check: `pnpm exec vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/hooks/use-badge.test.tsx`

- [ ] P2 account setup duplicate submit / navigation away contract を固定する
  - 対象: `src/components/settings/add-account/account-config-form.tsx`, `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`, `src/lib/account/account-setup-session.types.ts`
  - account setup sync と settings navigation が重なる時に、setup session owner / retry / cancel / success close の順序が崩れると重複同期や stale UI につながる
  - duplicate submit、navigation away、sync reject、setup retry の state machine を focused test で固定する
  - focused check: `pnpm exec vitest run src/__tests__/components/add-account-form.test.tsx src/__tests__/hooks/use-account-detail-sync-controls.test.tsx`

## 次の並列バッチ候補

- [ ] TypeScript feature-local `.types.ts` split 候補を追加する
  - feature-local 候補: `src/components/reader/feed-tree.types.ts`、`sidebar.types.ts`、`sidebar-feed-section.types.ts`、`article-list.types.ts`、`browser-view.types.ts`、`command-palette.types.ts`、`add-feed-dialog.types.ts`、`rename-feed-dialog.types.ts`、`src/components/settings/settings-page.types.ts`、`settings-nav.types.ts`、`settings-modal.types.ts`、`account-detail/types.ts`
  - Props / Params / Result が同じ file に混在している箇所を、view contract / controller contract / hook-local contract の小バッチに分けて整理する
  - runtime behavior は変えず、feature 内 consumer が多い型の責務分割と name clarity だけを扱う

- [ ] TypeScript local-only exported Props/Params/Result 候補を追加する
  - local-only 候補: `src/components/settings/add-account/form-view.types.ts`、`src/components/reader/account-switcher.types.ts`、`article-view.types.ts`、`sidebar-sync.types.ts`、`sidebar-controller.types.ts`、`sidebar-runtime.types.ts`、`sidebar-sources.types.ts`、`sidebar-tag-items.types.ts`、`article-actions.types.ts`
  - exported `*Props` / `Use*Params` / `Use*Result` の consumer が 1 runtime component / 1 hook group / story-only に閉じるものを owner file へ戻せるか確認する
  - public contract 候補とは分け、localized type の export 削減だけを扱う

- [ ] TypeScript schema-derived DTO boundary 候補を追加する
  - schema-derived 候補: `AccountDto` / `ArticleDto` / `FeedDto` / `FolderDto` / `TagDto` / `MuteKeywordDto` / `PreferencesDto` / `BrowserWebviewState` を import する reader/settings/lib/store types と、手書き `SyncProgressEventDto`
  - DTO alias や view model が `z.output` / `z.infer` / `api/tauri-commands` の source of truth と重複していないか確認し、UI 専用 shape は `*ViewModel` / `*UiState` として意図を明確にする
  - IPC / localStorage / app-config schema の validation 変更とは分け、type source-of-truth と DTO/UI state boundary だけを扱う

- [ ] similarity updater/sidebar lifecycle false-positive review 候補を追加する
  - `use-sidebar-account-selection` と `use-updater`、`use-browser-webview-bounds-sync` と `use-updater` が 91-92% 類似なので、effect cleanup / status polling skeleton だけの一致か確認する
  - 共通化する場合は interval/listener cleanup helper だけに限定し、updater check flow と account selection side effect は分けたままにする
  - updater hook state effects とは分け、lifecycle boilerplate の共通化可否判断だけを扱う

- [ ] react-doctor browser-view state effects 候補を追加する
  - `src/components/reader/browser-view.tsx` の cascading setState / state-only handler / trivial `useMemo` を整理する
  - reducer 化する state と `useRef` 化する render 非依存 state を分け、browser surface state test を追加する
  - Browser WebView geometry 数値や native bounds 挙動は触らず、React state/effect の形だけを扱う

- [ ] react-doctor dead code type surface 候補を追加する
  - `knip/types` / `knip/exports` の unused type/export を feature ごとに棚卸しする
  - `article-list.types.ts` / `browser-view.types.ts` / `command-palette.types.ts` など広い contract は一括削除せず参照範囲ごとに分ける
  - public wrapper API と Storybook helper export は allowlist 化し、実 dead code だけを削除する

- [ ] react-doctor UI primitive dead export allowlist 候補を追加する
  - `src/components/ui/button.tsx` / `dialog.tsx` / `input.tsx` / `select.tsx` / `scroll-area.tsx` / `collapsible.tsx` の unused type/export 指摘を wrapper public API として残すか削るか判断する
  - shared primitive contract test または knip allowlist で意図した public export を固定する
  - Base UI / primitive migration とは分け、現行 UI wrapper の export surface 明文化だけを扱う

- [ ] react-doctor Tauri command schema dead export 候補を追加する
  - `src/api/tauri-commands.ts` / `src/api/schemas/commands.ts` / `platform-info.ts` / `feed-integrity.ts` の unused export 指摘を command boundary ごとに棚卸しする
  - invoke wrapper tests が必要な schema を直接 import しているかを確認し、未使用 command schema だけ削除または allowlist 化する
  - IPC validation task とは分け、Tauri command/schema export surface の dead code cleanup だけを扱う

- [ ] react-doctor many boolean props decomposition 候補を追加する
  - `react-doctor/no-many-boolean-props` の対象 component を action group / named variant / discriminated props へ分割できるか確認する
  - 対象候補: `ArticleToolbarMoreMenu` / `sidebar-header-view` / `command-palette-resource-groups` / `sidebar-content-sections` / `command-palette-results`
  - toolbar taxonomy や command palette grouping 再設計とは分け、boolean prop surface の読みやすさと誤用防止だけを扱う

- [ ] react-doctor settings modal state effects 候補を追加する
  - `src/components/settings/settings-modal.tsx` の cascading setState を reducer または derived state に寄せる
  - modal open / category selection / account navigation の既存 state transition が変わらないことを `settings-modal` focused test で固定する
  - browser-view state effects とは分け、settings modal の state/effect 整理だけを扱う

- [ ] react-doctor shortcuts help effect handler 候補を追加する
  - `src/components/reader/shortcuts-help-modal.tsx` の `useEffect` による event-handler 相当処理を open/change handler 境界へ寄せる
  - modal open 時の focus / scroll / selected shortcut 表示が変わらない focused test を追加する
  - shortcut recording Alt key contract とは分け、shortcuts help modal の effect handler 整理だけを扱う

- [ ] react-doctor preferences view transition 候補を追加する
  - `src/stores/preferences-store.ts` の `document.startViewTransition()` 直接呼び出しを React 19 の view transition 方針に合わせるか、Tauri app 方針として明示的に残すか決める
  - 方針を test または repo contract に固定し、`react-doctor/no-document-start-view-transition` の抑制が必要なら理由を局所化する
  - motion / browser overlay 検証とは分け、theme preference transition の integration boundary だけを扱う

- [ ] react-doctor script async waterfall 候補を追加する
  - `scripts/seed-dev-db-from-prod.ts` / `scripts/tauri-cli-dispatch.ts` / `scripts/tauri-dev-vite-manager.ts` の独立 await loop を `Promise.all` 化できる箇所だけ整理する
  - filesystem / process 起動順に依存する処理は除外し、script unit test で dispatch order と failure handling を固定する
  - app runtime async flow とは分け、developer script の async-await-in-loop 指摘だけを扱う

- [ ] react-doctor test async waterfall 候補を追加する
  - `react-doctor/server-sequential-independent-await` が出ている test 群を、読みやすさを壊さない範囲で setup await と assertion await に分ける
  - 対象候補: `use-updater.test.ts` / `tauri-commands.test.ts` / `sidebar.test.tsx` / `scenario-runtime.test.ts`
  - production code の async policy とは分け、test runtime の無駄な waterfall cleanup だけを扱う

- [ ] react-doctor async loop concurrency 候補を追加する
  - `react-doctor/async-await-in-loop` のうち、独立実行できる script/dev helper の loop await を `Promise.all` 系へ寄せる
  - 対象候補: `scripts/tauri-dev-vite-manager.ts` / `scripts/tauri-cli-dispatch.ts` / `scripts/seed-dev-db-from-prod.ts` / `src/dev/scenarios/helpers.ts`
  - 順序依存がある database seed / dispatch check は先に dependency を明文化し、test async waterfall cleanup とは分ける

- [ ] react-doctor dev scenario dynamic import 候補を追加する
  - `src/dev/scenario-runtime.ts` の dynamic import path を bundler が静的解析できる manifest / registry import へ寄せる
  - dev scenario ID 追加時に import registry から漏れない contract test を追加する
  - dev intent scenario id coverage とは分け、scenario runtime の bundle-splitting/import boundary だけを扱う

- [ ] react-doctor knip unused files cleanup 候補を追加する
  - `knip/files` の unused file 指摘を実 unused / config entrypoint / Storybook or Playwright entrypoint に分類する
  - 対象候補: `playwright.storybook.config.ts` / legacy settings form files / `src/dev/scenarios/index.ts`
  - dead code type surface とは分け、file-level export/entrypoint contract と削除可否だけを扱う

- [ ] react-doctor knip duplicate exports cleanup 候補を追加する
  - `knip/duplicates` の duplicate export を schema barrel / story runtime helper ごとに整理する
  - 対象候補: `src/api/schemas/common.ts` の count/nonnegative schema exports と `src/components/storybook/story-tauri-runtime.ts`
  - public import path を壊さないよう repo contract test を添え、unused type cleanup とは分けて扱う

- [ ] react-doctor app sync-on-wake account extraction 候補を追加する
  - `src/App.tsx` の sync-on-wake 対象 account 抽出で `.filter().map()` している箇所を single-pass 化する
  - app root focused test で hidden duration / active account / disabled account の sync 対象が変わらないことを固定する
  - App visibility handler ref 候補とは分け、wake sync 対象抽出の iteration cleanup だけを扱う

- [ ] similarity reader UI state hook factory 候補を追加する
  - `useArticleViewUiState` と `useCommandPaletteUiState` が 88% 類似なので、open/close/toggle 系 state hook factory へ寄せられるか確認する
  - 共通化する場合は public hook return names を保ち、article view と command palette の focused hook test で state transition が変わらないことを固定する
  - command palette controller contract とは分け、UI boolean state hook の重複だけを扱う

- [ ] similarity account detail editor state review 候補を追加する
  - `useArticleListViewState` と `use-account-detail-name-editor` が 90% 類似なので、draft / saving / error state の reducer pattern を共通化できるか確認する
  - 共通化する場合は generic edit-state reducer だけに限定し、article list presentation state と account name validation / submit flow は混ぜない
  - account detail section contract とは分け、editor/view state skeleton の similarity 判定だけを扱う

- [ ] similarity article list navigation false-positive review 候補を追加する
  - `useArticleListNavigation` / `useAddFeedDialogActions` / `buildSubscriptionReviewCandidates` が 91-93% 類似として出ているため、実際に共通化可能な navigation math か hook boilerplate かを確認する
  - 共通化できる場合は item index movement / wrap / selection lookup の pure helper だけに限定し、add feed action や subscription review の domain logic は混ぜない
  - article list iterable performance とは分け、navigation-like similarity の判定と小さな helper 抽出だけを扱う

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する

- [ ] 参照範囲が広い settings 配置候補を別バッチで見直す
  - `settings-nav.types.ts` は settings rail contract として `SettingsNavView` / `AccountsNavView` / Storybook specimen / view tests にまたがるため、settings nav 境界が増えた時に再評価する
  - `settings-page.types.ts` は public page/control contract に絞る。control union が肥大化した時は page/control contract 自体の分割を検討する
  - `settings-modal.types.ts` は modal view contract に絞る。新しい settings surface が増えて content routing props が再び肥大化した時に分離する

- [ ] 参照範囲が広い root-level type を別バッチで分割する
  - reader selection は `src/lib/reader/reader-selection.types.ts` を source of truth にする。新しい `UiSelection` alias は増やさない
  - さらに state type を分割する場合は、`src/stores/ui-store.ts` 自体を slice 化できる段階で実施する。store action / selector / dev scenario への参照が広いため別バッチにする

- [ ] 小粒 cleanup 候補を別バッチで見直す
  - UI class variant の追加テストは shared component の semantic token / role contract に限定する。hover 全量や visual snapshot は固定しない
  - pure helper の追加テストは、article list selection / navigation / grouping / mark-all-read count など挙動の契約として価値があるものだけ残す
  - view-level props の `export type` は hook / Storybook / tests の contract として使うものだけ残す。外部 import がない helper props は触るファイルごとに local type へ戻す
  - reader の残りは browser geometry など参照範囲が広い単位で見直す
  - `src/components/ui/` の primitive wrapper props は shadcn/Base UI wrapper API として扱う。外部 import がなくても、公開 wrapper contract の方針を決めるまでは一括 local 化しない
  - shared component の `.types.ts` は、複数ファイルで共有する contract だけ残す。`dialog.types.ts` の `ConfirmDialogVariant` のように store / view にまたがるものは、呼び出し境界が変わる時に見直す
  - Browser geometry の数値固定や picker 専用 chip variant の網羅は参照範囲が広く、実機/呼び出し側 layout 影響を見てから別バッチで扱う

- [ ] pure helper test 候補を別バッチで追加する
  - article list selection / navigation scroll / grouping / mark-all-read count は、境界値と source selection の契約テストを追加する価値がある
  - UI snapshot、hover class 全量、motion class の見た目固定は避け、失敗時に仕様差分が分かる assertion に限定する

- [ ] subscriptions index view contract 整理候補を別バッチで見直す
  - `subscriptions-index-page-view.tsx` / list pane / detail pane / overview summary の props を、view file local と shared page contract に分ける
  - `src/lib/subscriptions/subscriptions-index.types.ts` は list row / summary card / detail metrics の共有モデルとして扱い、UI props と混ぜない
  - keep / defer / delete の decision flow は状態更新と toast にまたがるため、型整理とは別バッチにする

- [ ] app shell / keyboard boundary 整理候補を別バッチで見直す
  - global keyboard handling に reader pane 固有の分岐が増えていないか、pane helper へ戻せるものを棚卸しする
  - focus return / selected sidebar target / selected article row の復帰処理は、reader focus helper と hook の責務境界を先に整理する
  - shortcut の表示ラベル変更や i18n copy 変更は、挙動整理と同じバッチに混ぜない

- [ ] store slice boundary 整理候補を別バッチで見直す
  - `ui-store.ts` の reader selection / layout state / settings modal / toast / sync progress / account setup session を、参照範囲ごとに slice 化できるか確認する
  - `preferences-store.ts` は schema と永続化 contract があるため、UI store 分割とは同じバッチに混ぜない
  - store selector の import 先が多いため、まずは type alias / action group の棚卸しだけ行い、挙動変更は避ける

- [ ] subscriptions index state hook 整理候補を別バッチで見直す
  - `use-subscriptions-index-state.ts` の selected row / summary filter / kept-deferred state / return state を、page state と list state に分けられるか確認する
  - `SubscriptionsWorkspaceReturnState` は navigation return contract なので、内部 state 整理とは別扱いにする
  - keep / defer / delete 後の選択維持は UX 挙動に直結するため、型整理より先に existing tests を確認する

- [ ] subscriptions component props local 化候補を別バッチで見直す
  - `subscriptions-index-page-view.tsx`、`subscriptions-list-pane.tsx`、`subscription-detail-pane.tsx`、`subscriptions-overview-summary.tsx` の view props を component-local に寄せられるか確認する
  - `subscriptions-index.types.ts` の row / summary / detail model は lib 共有 contract として残し、component props と混ぜない
  - Storybook stories と component tests の fixture 型が参照している場合は、fixture helper 側へ型境界を寄せる

- [ ] Storybook UI reference 分割候補を別バッチで見直す
  - `ui-reference-canvas-specimens.tsx` が大きくなっているため、foundations / controls / workspace / settings / navigation の specimen 群へ分割できるか確認する
  - visual specimen の copy や className 変更はデザイン差分になるため、まずは export / import 境界だけを整理する
  - `storybook-explorer-organization.test.ts` が期待する構成を先に確認し、story title / canvas 名を変えない

- [ ] schema contract test 整理候補を別バッチで追加する
  - preferences schema / API schemas / Tauri command result parsing のうち、境界値が不足している contract test を棚卸しする
  - runtime validation の失敗時メッセージや fallback は、ユーザー表示 copy ではなく typed result の契約として固定する
  - schema helper の追加は既存の schema/parser API に合わせ、新しい独自 parser を増やさない

- [ ] shared workspace layout contract 整理候補を別バッチで見直す
  - `workspace-pane-layout.ts` と `app-layout.tsx` の pane sizing / shell boundary / responsive constraints を、shared layout contract と app shell usage に分けられるか確認する
  - layout token や CSS class の変更は visual impact があるため、まずは型・helper配置と tests の責務整理に限定する
  - app shell の overlay / debug HUD / modal collision とは別バッチにする

- [ ] Tauri command/schema contract 整理候補を別バッチで見直す
  - `src/api/tauri-commands.ts` と `src/api/schemas/*` の command response validation を、command group 単位で棚卸しする
  - Rust command DTO と frontend schema のズレを検出する contract test を優先し、UI 側の fallback copy 変更とは混ぜない
  - database / account / feed / browser webview command は失敗時の戻り値契約が違うため、worker scope を分ける

- [ ] Tauri menu / shortcut contract 整理候補を別バッチで見直す
  - `src-tauri/src/menu.rs` / `menu_i18n.rs` と frontend shortcut handling の action id 対応を一覧化する
  - menu label の i18n と frontend shortcut 表示は別レイヤーなので、まずは action id と emitted event の contract test を優先する
  - native menu の checked state と UI preference state の同期は挙動影響があるため、型・テスト整理とは分ける

- [ ] Rust DB repository test 候補を別バッチで追加する
  - sqlite account / feed / folder / article / tag / sync state repository の境界値を、migration 適用済み DB fixture で固定する
  - WAL / SHM や app data path の運用検証とは分け、repository method の入出力契約に限定する
  - 既存 integration test が広い場合は、repository ごとの小さい fixture helper を先に作る

- [ ] dev mock / scenario runtime 整理候補を別バッチで見直す
  - `src/dev/mock-data.ts` / `mocks.ts` / scenario registry の fixture を、reader / settings / browser / subscriptions の利用面ごとに分けられるか確認する
  - command palette dev scenario と browser geometry scenario は実行環境依存が違うため、同じ worker に混ぜない
  - mock data の表示文言変更は Storybook / tests に波及するため、まずは fixture boundary の整理に限定する

- [ ] updater / release readiness 検証候補を別バッチで見直す
  - `.github/workflows/release.yml`、`src-tauri/tauri.conf.json`、`updater_commands.rs` の updater 設定・署名・fallback を確認する
  - local test で固定できる設定検証と、実 release artifact が必要な検証を分ける
  - release note / manual verification docs への反映は、実際の release 作業とは別コミットにする

- [ ] locale / copy contract 整理候補を別バッチで見直す
  - reader / settings / native menu / updater の表示文言が、同じ概念に対して異なるキー名や表現を使っていないか棚卸しする
  - `ja-locales` / `ui-language` 系 tests に、キー存在だけでなく reader/preview/external browser の意味差分を固定する assertion を追加する
  - copy 変更は UI regression になりやすいため、型整理や layout 変更とは混ぜない

- [ ] provider / sync flow boundary 整理候補を別バッチで見直す
  - `sync_flow.rs` / `sync_scheduler.rs` / provider traits / greader provider の責務を、provider adapter と app sync orchestration に分けて棚卸しする
  - pending mutation / sync state / account sync status はデータ整合性に関わるため、UI sync feedback の型整理とは混ぜない
  - network error / auth error / rate limit など失敗種別は domain error contract の test を先に固定する

- [ ] feed content privacy hardening 候補を別バッチで設計する
  - `docs/feed-content-privacy.md` の方針に沿って、reader mode remote image / frame / sanitizer version の実測観点を整理する
  - CSP や sanitizer を一括で締めず、provider compatibility と Web Preview 影響を分けて検証する
  - privacy mode や tracking pixel 対策を入れる場合は、settings UI と Rust sanitizer の境界を別々に扱う

- [ ] runtime utility contract 整理候補を別バッチで見直す
  - clipboard / window events / badge / always-on-top / window chrome の runtime wrapper を、Tauri runtime あり/なしの fallback contract として棚卸しする
  - dev/browser tests で固定できる fallback と packaged app manual verification が必要な挙動を分ける
  - capability JSON の permission 変更は runtime wrapper 整理とは別コミットにする

- [ ] scripts dispatch contract 整理候補を別バッチで見直す
  - `tauri-cli-dispatch.ts` / `windows-command-dispatch.ts` / `windows-dispatch.ts` の WSL/Windows path/env handling を test fixture と実行 contract に分ける
  - seed dev DB script は安全確認・backup・process check を優先し、dispatch helper の refactor と混ぜない
  - CI で拾える dry-run test とローカル実機検証が必要な path conversion を分ける

- [ ] GitHub workflow / issue template 整理候補を別バッチで見直す
  - `.github/workflows/*` と issue templates の label / release-readiness / manual-verification 表現を、運用ラベルの source of truth に揃える
  - labeler config と PR insights の自動付与は既存運用に影響するため、CI workflow 変更とは別バッチにする
  - release workflow の artifact matrix と updater signing は、docs 更新だけでなく実 release dry-run の観点を残す

- [ ] reader context menu action 整理候補を別バッチで見直す
  - article item / article list background / feed / folder / smart view / account の context menu action を、action id と呼び出し hook の対応表として棚卸しする
  - mark all read / old unread read / open in browser / copy link は scope 判定が違うため、UI props 整理とは混ぜず action contract test を優先する
  - Base UI context menu の className や visual token 変更は別バッチにし、まずは既存 menu item の enabled/disabled 条件を固定する

- [ ] reader focus navigation contract test 候補を別バッチで追加する
  - sidebar -> list -> article pane -> browser overlay の focus return を、keyboard event と selected target の契約として小さい test に分ける
  - `reader-focus` helper、article list keydown handler、sidebar controller の責務を混ぜず、復帰先ごとに fixture を作る
  - scroll / requestAnimationFrame / setTimeout の実装詳細は直接固定せず、最終的な active element と selected state を assertion にする

- [ ] dev scenario runtime error surface 整理候補を別バッチで見直す
  - `src/dev/intent.ts` / `src/dev/scenario-runtime.ts` / scenario runner の error union と fallback message を、dev build 専用 contract として棚卸しする
  - command palette から scenario を実行する flow は UI toast と recent history に影響するため、runtime loader の型整理とは別 worker にする
  - dynamic import path や `import.meta.env.DEV` の分岐は bundler 依存があるため、unit test と dev app smoke を分ける

- [ ] native menu checked state 同期候補を別バッチで検証する
  - `src-tauri/src/menu.rs` の check menu item toggle と frontend preference state が、view filter / sort unread / group by feed でズレないか確認する
  - menu action emit の contract test と、実 native menu の checked 表示確認を分ける
  - i18n label や shortcut 表示変更は locale/copy batch に残し、ここでは state sync と event ordering だけを見る

- [ ] Rust domain error mapping test 候補を別バッチで追加する
  - `src-tauri/src/domain/error.rs` の reqwest / sqlite / provider error mapping を、ユーザー向け actionable message と internal kind の境界で固定する
  - DNS / timeout / auth / rate limit / malformed response を provider sync flow と混ぜず、domain error の pure test として追加する
  - copy の文面変更は locale/copy 扱いにし、ここでは error category と recovery guidance の有無を確認する

- [ ] tag / mute settings contract 整理候補を別バッチで見直す
  - tag settings、reader tag list、article tag picker、mute settings の command/schema/hook/view contract を、tag と mute で分けて棚卸しする
  - `tag-color-picker` や tag chip の visual token 変更は避け、まずは create/rename/delete と count 更新のデータ契約を固定する
  - mute keyword scope と article filtering は reader 表示に直結するため、settings form props local 化とは別バッチにする

- [ ] credentials / keyring verification 候補を別バッチで整理する
  - `src-tauri/src/infra/keyring_store.rs` と account detail credentials editor の保存/更新/削除/restart 復元を、native keyring と dev credentials で分けて検証する
  - `.env` や実 credential 値は扱わず、存在確認・失敗種別・fallback 表示の contract test と packaged manual verification に分ける
  - FreshRSS connection verification と keyring 保存はユーザー影響が違うため、provider login flow の refactor とは混ぜない

- [ ] browser webview history / shortcut contract 候補を別バッチで見直す
  - `src/lib/browser/webview-history.ts` と `src-tauri/src/browser_webview.rs` の back/forward/reload/open external availability を、frontend helper と native webview state で分けて棚卸しする
  - browser overlay shortcut は article shortcut と衝突しやすいため、`use-browser-overlay-shortcuts.ts` の event ownership を別に確認する
  - geometry/layout 数値は既存の browser geometry 候補に残し、ここでは history stack と action availability のみ扱う

- [ ] app icon / badge runtime 検証候補を別バッチで追加する
  - `use-app-icon-theme.ts`、`use-badge.ts`、provider icon fallback の runtime あり/なし contract を、frontend hook test と packaged app manual verification に分ける
  - macOS dock badge、Windows taskbar badge、icon theme replacement は OS 差が大きいため、shared runtime wrapper の型整理とは別に検証する
  - visual asset の差し替えや icon デザイン変更は入れず、状態反映と failure fallback だけを固定する

- [ ] sanitizer / article content migration 候補を別バッチで検証する
  - `src-tauri/src/infra/sanitizer.rs`、`sanitizer_version`、`article_content_text` migration の関係を、保存済み記事と新規同期記事で分けて確認する
  - privacy hardening とは別に、既存記事の再 sanitize 条件、検索用 text extraction、malformed HTML の fallback を test で固定する
  - CSP や remote image policy は privacy batch に残し、ここでは content normalization と migration compatibility に限定する

- [ ] query / mutation wrapper contract 整理候補を別バッチで見直す
  - `src/hooks/create-query.ts` / `src/hooks/create-mutation.ts` / `src/lib/query/query-invalidation.ts` の Result unwrap、toast、cache invalidation の責務を棚卸しする
  - account/feed/article/tag/subscription の hook 利用面にまたがるため、実装変更前に query key と invalidation target の対応表を作る
  - React Query の retry/staleTime 変更は挙動影響が大きいため、型整理や helper test とは別バッチにする

- [ ] feed discovery / add feed pipeline 候補を別バッチで検証する
  - `src-tauri/src/infra/feed_discovery.rs`、`opml_commands.rs`、add feed dialog actions の URL normalization / discovered feed option / folder assignment を分けて確認する
  - discovery failure と submit failure は表示 copy と retry 導線が違うため、dialog view props 整理とは混ぜない
  - 実 network が必要な確認は manual verification に回し、parser/DTO/command response は fixture test で固定する

- [ ] reader query / article scope matrix 整理候補を別バッチで見直す
  - `src/lib/reader/reader-query.ts` と `docs/reader-article-scope-matrix.md` の feed/folder/tag/recent/starred/unread scope が実装とズレていないか棚卸しする
  - article list sources / search / grouping / footer mode control は参照範囲が広いため、scope resolver の pure helper test を先に追加する
  - viewMode の clamp や recently viewed history 更新は UX 挙動に直結するため、UI props local 化とは混ぜない

- [ ] Storybook fixture runtime 整理候補を別バッチで見直す
  - `src/components/storybook/story-tauri-runtime.ts`、`story-query-client-provider.tsx`、UI reference canvas の mock runtime を、component isolation と app-like scenario で分ける
  - story title / canvas taxonomy は既存 tests が見ているため、rename ではなく fixture provider の責務整理に限定する
  - Tauri runtime mock と dev scenario mock data は用途が違うため、同じ worker に混ぜない

- [ ] platform abstraction contract 整理候補を別バッチで見直す
  - `src-tauri/src/platform/mod.rs`、`src/stores/platform-store.ts`、`src/constants/platform.ts` の OS 判定と capability 表現を、native と frontend で分けて棚卸しする
  - macOS / Windows / Linux の表示差は UI copy や shortcut label に波及するため、platform kind の source of truth を先に固定する
  - Tauri capability JSON や packaged app の permission 変更は runtime utility batch に残し、ここでは platform DTO と store contract に限定する

- [ ] logging / debug trace contract 候補を別バッチで追加する
  - `src-tauri/src/commands/log_commands.rs`、`src/lib/debug-input-trace` 系、Debug HUD の trace 表示を、production log と dev-only trace で分ける
  - key input trace / browser geometry diagnostics / sync error logs は用途が違うため、同じ debug UI に詰め込まず source ごとに contract を固定する
  - file logging の保存先や rotation は packaged app 影響があるため、UI 表示整理とは別の manual verification にする

- [ ] dialog / confirm flow contract 整理候補を別バッチで見直す
  - `app-confirm-dialog.tsx`、`confirm-dialog-view.tsx`、destructive dialog、feed/tag delete dialogs の variant / copy / action result contract を棚卸しする
  - shared dialog props と feature-specific submit state を混ぜず、confirm variant と destructive footer の contract test を先に補強する
  - modal stacking や Debug HUD collision は overlay 実機検証に残し、ここでは close/cancel/confirm の state transition に限定する

- [ ] screen snapshot / first-screen readiness 候補を別バッチで検証する
  - `use-screen-snapshot.ts`、startup account/feed selection、SQLite first screen snapshot の復元条件を、startup read model と UI fallback で分けて確認する
  - app launch 直後の loading skeleton、last selected account、recent article history は UX 影響が大きいため、fixture test と app smoke を分ける
  - DB migration や sync-on-startup と同時に変えると原因が追いにくいため、first-screen readiness の契約だけを先に固定する

- [ ] workspace pane / mobile recovery layout 候補を別バッチで見直す
  - `workspace-pane-layout.ts`、`app-layout.tsx`、mobile pane recovery の pane sizing / focus target / back affordance を棚卸しする
  - desktop 3-pane layout と mobile recovery は責務が違うため、responsive class 変更より先に layout state の contract test を追加する
  - browser overlay geometry と Debug HUD overlay は別バッチに残し、ここでは reader pane と settings modal の shell boundary に限定する

- [ ] share / clipboard action contract 候補を別バッチで見直す
  - `src-tauri/src/commands/share_commands.rs`、`src/lib/runtime/clipboard.ts`、article share menu の copy/open action を、native command と frontend fallback で分けて棚卸しする
  - clipboard unavailable / permission denied / invalid URL はユーザー表示が違うため、toast copy 変更ではなく action result category の test を先に固定する
  - native share menu の表示や shortcut 変更は menu/copy batch に残し、ここでは copy link / open external / readonly field copy の実行契約に限定する

- [ ] article retention / cleanup candidate 候補を別バッチで追加する
  - `src/lib/articles/article-retention.ts` と subscription review candidates の stale/no unread/no stars 判定を、retention policy と cleanup recommendation で分ける
  - feed cleanup page の decision flow は subscriptions index と重なるため、まずは pure helper の boundary test に限定する
  - 実データ削除や bulk action は destructive flow に関わるため、confirm dialog batch と同時に変更しない

- [ ] feed tree drag/drop interaction contract 候補を別バッチで見直す
  - `feed-tree-drag-session.ts`、drop target、hover target、folder flow の drag outcome を、pointer session と repository update action で分けて棚卸しする
  - drag overlay motion や visual token は motion/browser 実機検証に残し、ここでは valid/invalid drop target と folder assignment result を固定する
  - touch/mobile drag は desktop pointer drag と前提が違うため、mobile recovery layout とは別の manual verification にする

- [ ] provider normalizer / account DTO contract 候補を別バッチで検証する
  - `src-tauri/src/infra/provider/normalizer.rs`、provider traits、account DTO schema の display name / icon URL / capability flags を対応表で確認する
  - FreshRSS / GReader / local provider は認証・検索対応・delta sync の前提が違うため、provider ごとに fixture を分ける
  - account settings UI の表示 copy 変更は含めず、provider response normalization と frontend schema compatibility に限定する

- [ ] sidebar startup folder expansion 候補を別バッチで検証する
  - `use-sidebar-startup-folder-expansion.ts`、last selected account/feed/folder、folder selection feed filter の初期展開条件を整理する
  - startup sync や first-screen snapshot と同時に変えると原因が追いにくいため、sidebar tree state の pure/helper test を先に追加する
  - user-triggered folder toggle と startup restore は UX 意味が違うため、state transition を分けて固定する

- [ ] account setup lock / session contract 候補を別バッチで見直す
  - `account-setup-session.types.ts`、add account controller、accounts nav の setup session lock を、wizard flow と settings navigation で分けて棚卸しする
  - duplicate submit / navigation away / failed credential verification はデータ破損につながるため、UI copy より先に state machine の境界を固定する
  - service picker の visual や provider icon 変更は含めず、setup session ownership と cancel/retry contract に限定する

- [ ] mute settings reducer transition contract 候補を別バッチで追加する
  - `src/components/settings/mute-settings.tsx` 周辺で add / edit / delete modal state transition と draft reset の契約を focused test で固定する
  - mute SQL/Rust match parity、auto mark preference guard、settings copy は別スコープに残す
