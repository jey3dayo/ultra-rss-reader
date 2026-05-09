# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - 既存の `mise run app:dev:seed-from-prod` を前提に、デバッグ画面から誤操作なく呼べる UX と確認導線を設計する
  - Dev 側 DB のバックアップ場所、アプリ再起動、credentials はコピーされないことを UI 上で明示する

- [ ] `.claude/rules` index completeness contract 候補を追加する
  - `.claude/rules/*.md` が増えた時に `.claude/rules/README.md` への追記漏れが起きないよう、rules index の completeness を repo contract にする
  - `src/__tests__/config/repo-contracts.test.ts` で `README.md` 以外の rule file が index に相対リンクされ、必要なら `CLAUDE.md` の Documentation Map から辿れることを固定する
  - markdown link scan 拡張とは分け、rules index の source-of-truth drift だけを扱う

- [ ] sidebar sync event payload schema guard 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-sync.ts` の Tauri event handler が `sync-progress` / `sync-warning` payload をそのまま UI state と warning summarizer に渡すため、malformed payload の扱いを固定する
  - `src/__tests__/hooks/use-sidebar-sync.test.ts` で payload wrapper / raw payload / unknown payload の3系統を分け、ignore・toast・error surface の契約を決める
  - manual sync button の rejection handling とは分け、Tauri push event payload boundary だけを扱う

- [ ] sidebar account selection selected id normalization 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` の `resolveSidebarAccountSelectionAction()` が `selectedAccountId` を raw string のまま account id と照合するため、whitespace-padded selected id を invalid 扱いにするか trim するか固定する
  - `src/__tests__/components/sidebar-account-selection.test.ts` で `selectedAccountId: " acc-1 "` と `savedAccountId` の組み合わせを追加し、restore / persist / noop の期待値を明示する
  - preferred account id trim boundary や startup sync storage とは分け、現在選択中 account id の projection 境界だけを扱う

- [ ] article list empty state priority contract 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-body-props.ts` の `buildArticleListBodyEmptyState()` が search empty state を setup empty state より優先するため、no accounts / no feeds と検索 query が同時に成立した時の copy と action を固定する
  - `src/__tests__/components/use-article-list-body-props.test.ts` で `isSearchEmptyState: true` かつ `setupEmptyState: "no-accounts" | "no-feeds"` の期待値を追加する
  - search query lifecycle や setup wizard 表示とは分け、article list body の empty-state projection 優先順位だけを扱う

- [ ] article list header blank feed id control boundary 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-header-controls.tsx` の `resolveArticleListHeaderControlAvailability()` が `resolvedFeedId !== null` だけで feed display select を出すため、blank / whitespace feed id の扱いを固定する
  - `src/__tests__/components/article-list-header.test.tsx` で `resolvedFeedId: ""` / `"   "` を追加し、control を隠すか caller invariant として現仕様を明示する
  - feed display setting mutation や reader query scope id guard とは分け、header control availability の入力境界だけを扱う

- [ ] sidebar account status label duplicate id projection 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-account-status-labels.ts` の `buildSidebarAccountStatusLabels()` が `Object.fromEntries()` で label map を作るため、duplicate account id や blank account id の last-wins / omit 方針を固定する
  - `src/__tests__/hooks/use-sidebar-account-status-labels.test.tsx` で duplicate account id、blank account id、status map にだけ存在する id を追加し、scheduled retry label の projection contract を明示する
  - account DTO schema や `useAccountSyncStatuses()` の query construction とは分け、sidebar label map helper の projection 境界だけを扱う

- [ ] folder selection option blank/duplicate id contract 候補を追加する
  - `src/components/reader/hooks/feed-dialogs/use-folder-selection.ts` の `buildFolderOptions()` が `folders` の `id` / `name` をそのまま select option に渡すため、blank id が empty option と衝突する場合や duplicate folder id の表示方針を固定する
  - `src/__tests__/components/use-folder-selection.test.ts` で blank folder id、whitespace name、duplicate id を追加し、filter / fallback label / caller invariant のどれにするか決める
  - folder selection focus frame cleanup や create folder schema blank name とは分け、folder select option projection だけを扱う

- [ ] reading clear recent selected account blank guard 候補を追加する
  - `src/components/settings/hooks/use-reading-settings-view-props.ts` の `handleClearRecentArticles()` が `selectedAccountId` の truthy 判定だけを使うため、whitespace-only id で confirm と mutation が走るか確認する
  - `src/__tests__/components/use-reading-settings-view-props.test.tsx` で `selectedAccountId: "   "` / `"\n"` の disabled state と `clearHistory.mutate` 呼び出し有無を固定する
  - reader query selected account blank guard や recent articles query invalidation とは分け、settings history action の account id boundary だけを扱う

- [ ] settings modal content reset key delimiter contract 候補を追加する
  - `src/components/settings/hooks/use-settings-modal-view-props.tsx` の `contentResetKey` が `category:accountId:add:*` の文字列結合なので、account id や initial kind に delimiter 文字が入る場合の remount key 衝突を固定する
  - `src/__tests__/components/use-settings-modal-view-props.test.tsx` で account id に `:` / `add:` を含むケースを追加し、structured key helper へ切り出すか backend id invariant として明示する
  - settings nav id narrowing や deleted account snapshot contract とは分け、settings modal content remount key の生成境界だけを扱う

- [ ] sidebar starred count blank feed id projection 候補を追加する
  - `src/lib/sidebar/sidebar.ts` の `buildStarredCountByFeedId()` が starred article の `feed_id` をそのまま Map key にするため、blank / whitespace feed id を count するか除外するか固定する
  - `src/__tests__/lib/sidebar.test.ts` で blank feed id、whitespace feed id、duplicate normal feed id の starred count を追加し、Article DTO schema 前提か helper guard かを決める
  - nullable starred count schema や article DTO blank URL normalization とは分け、sidebar starred badge projection の feed id boundary だけを扱う

- [ ] article tag picker duplicate id projection 候補を追加する
  - `src/components/reader/article-tag-chips.tsx` の `buildArticleTagPickerLists()` が assigned tag id を Set に入れつつ assigned list 自体には duplicate を残すため、duplicate id / blank id の表示方針を固定する
  - `src/__tests__/components/article-tag-chips.test.tsx` で duplicate assigned tag、duplicate allTags、blank tag id を追加し、dedupe / caller invariant / schema rejection の境界を明示する
  - article tag picker mutation failure や keyboard/focus contract とは分け、picker list projection の tag identity boundary だけを扱う

- [ ] command search repeated prefix boundary 候補を追加する
  - `src/components/reader/hooks/command-palette/use-command-search.ts` の `parsePrefix()` が先頭1文字だけを prefix として扱うため、`">>sync"` / `"@@feed"` / `"##tag"` を query に残すか正規化するか固定する
  - `src/__tests__/hooks/use-command-search.test.ts` で repeated prefix、prefix 間 whitespace、unknown prefix-like character の期待値を追加する
  - command palette history parser や resource filtering ranking とは分け、search input prefix parser の文字列境界だけを扱う

- [ ] dom target shadow boundary contract 候補を追加する
  - `src/components/reader/dom-target.ts` の `isOutsideElement()` が `element.contains(target)` だけで判定するため、Shadow DOM 内 target や composed event path を outside と扱うか確認する
  - `src/__tests__/components/dom-target.test.ts` で open shadow root 内の button、detached node、host element を追加し、click-outside helper の DOM boundary を固定する
  - article tag picker close focus cleanup や dialog outside click behavior とは分け、shared DOM target helper の containment contract だけを扱う

- [ ] preferences system theme listener compatibility 候補を追加する
  - `src/stores/preferences-store.ts` の `applyTheme("system")` が `MediaQueryList.addEventListener` / `removeEventListener` 前提なので、旧 API の `addListener` だけを持つ runtime や mocked WebView で落ちないか確認する
  - `src/__tests__/stores/preferences-store.test.ts` で `addEventListener` 不在 / throw 時の fallback と cleanup 方針を固定する
  - system theme listener cleanup contract や app icon hook の matchMedia guard とは分け、preferences store の MediaQueryList API 互換だけを扱う

- [ ] preferences setPref latest-only failure surface 候補を追加する
  - `src/stores/preferences-store.ts` の `setPref()` は rapid toggle 時に古い persist failure が後から toast を出せるため、latest request 以外の失敗通知を出すかどうかを決める
  - `src/__tests__/stores/preferences-store.test.ts` で theme / language の deferred `setPreference` を使い、古い失敗と新しい成功の順序差を固定する
  - rejected persist failure guard とは分け、単一 preference の async ordering と user-visible failure surface だけを扱う

- [ ] account setup session blank id guard 候補を追加する
  - `src/stores/ui-store.ts` の `startAccountSetup` / `markAccountSetupFailed` / `markAccountSetupSucceeded` が blank account id を session state に入れない contract を固定する
  - `src/__tests__/lib/account-setup-session.test.ts` で whitespace-only id は no-op、trim 後 id は既存 owner を維持することを確認する
  - add account verification lock や account detail sync retry flow とは分け、account setup session state の id boundary だけを扱う

- [ ] breakpoint layout preference normalization 候補を追加する
  - `src/hooks/use-breakpoint.ts` の `resolvePreferredLayoutMode()` が `" compact "` や uppercase 値を invalid として wide 扱いするため、preferences schema default と同じ正規化方針に寄せるか確認する
  - `src/__tests__/hooks/use-breakpoint.test.ts` で whitespace / uppercase / unknown layout preference の期待値を固定する
  - responsive breakpoint 数値や mobile layout recovery とは分け、layout preference string の入力正規化だけを扱う

- [ ] confirm mark all read count boundary 候補を追加する
  - `src/hooks/use-confirm-mark-all-read.ts` が `count === 0` だけを no-op にするため、negative / `NaN` / `Infinity` count で confirm copy や `onConfirm` が走らないか固定する
  - `src/__tests__/hooks/use-confirm-mark-all-read.test.tsx` を追加し、nonpositive / nonfinite count は no-op、positive count だけが confirm または direct confirm になることを確認する
  - mark-all-read command schema や feed/folder unread count affordance とは分け、confirmation hook の count boundary だけを扱う

- [ ] menu event unknown payload formatting guard 候補を追加する
  - `src/hooks/use-menu-events.ts` の debug trace / warn が unknown payload を template literal へ直接入れるため、Symbol や throwing `toString` で handler が落ちないか確認する
  - `src/__tests__/hooks/use-menu-events.test.tsx` で non-string payload は action dispatch せず、safe string fallback で warn/debug できることを固定する
  - app action registry source-of-truth や native menu emitted action parity とは分け、menu event payload の logging boundary だけを扱う

- [ ] generated mutation invalidate error surface 候補を追加する
  - `src/hooks/create-mutation.ts` の `onSuccess` で `invalidate()` が throw した時、mutation 成功自体を失敗扱いにするか、error boundary へ出すかを決める
  - `src/__tests__/hooks/create-mutation.test.tsx` で mutationFn success 後の invalidate throw が toastなし reject / console warn / no-op のどれになるか固定する
  - query key literal cleanup や individual hook invalidation target とは分け、generated mutation helper の post-success error surface だけを扱う

- [ ] command palette runtime production loader guard 候補を追加する
  - `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts` の DEV scenario loader が production env で呼ばれないことを focused test として固定する
  - `src/__tests__/hooks/use-command-palette-runtime.test.tsx` で `vi.stubEnv("DEV", false)` 時に `loadRuntimeDevScenarios` が未呼び出しで、`devScenarios` が空のままになることを確認する
  - dev scenario dynamic import registry や runtime error surface とは分け、production guard の hook boundary だけを扱う

- [ ] sidebar subscription sort preference contract 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-tree.ts` が `sortSubscriptions` を受け取りつつ `_sortSubscriptions` として未使用なので、設定値を適用するか alphabetical 固定の廃止済み contract として整理する
  - `src/__tests__/components/use-sidebar-feed-tree.test.tsx` と `src/__tests__/components/sidebar-feed-tree-helpers.test.ts` で `newest_first` / `alphabetical` の期待値を明示する
  - folder `sort_order` や backend folder ordering とは分け、sidebar feed list の subscription sort preference だけを扱う

- [ ] sidebar feed drag disabled start guard 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts` の `handleDragStartFeed` が `canDragFeeds` / `isFeedsSectionOpen` を見ずに一度 drag state を立てるため、disabled 時に start 自体を無視するか effect cleanup 前提にするか固定する
  - `src/__tests__/components/use-sidebar-feed-drag-state.test.tsx` で folder なし / section closed / feed missing の start と active drop target の期待値を追加する
  - pointer drag threshold や visual drop target とは分け、repository update 前の hook state guard だけを扱う

- [ ] sidebar feed drag drop rejection surface 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-tree-props.ts` が `void handleDropToFolder(folderId)` で async drop を fire-and-forget するため、`moveFeedToFolder` reject 時に unhandled rejection にならないか確認する
  - `src/__tests__/components/use-sidebar-feed-drag-state.test.tsx` または feed tree props focused test で drop failure 時も drag state cleanup と error surface の方針を固定する
  - feed move mutation toast や backend folder assignment validation とは分け、frontend drag/drop callback の async failure boundary だけを扱う

- [ ] subscription review duplicate summary policy 候補を追加する
  - `src/lib/subscriptions/subscription-review-candidates.ts` の `buildSubscriptionReviewCandidates` が `feedArticleSummaries` を `Map(feed_id)` 化するため、同一 feed の重複 summary が来た時の勝ち順を固定する
  - `src/__tests__/lib/subscription-review-candidates.test.ts` で duplicate `feed_id` の latest/starred count を last-wins / first-wins / invalid input のどれにするか明示する
  - feed article summary query invalidation や duplicate feed policy とは分け、review candidate helper の summary projection だけを扱う

- [ ] subscription candidate map duplicate feed id 候補を追加する
  - `src/lib/subscriptions/subscriptions-index.ts` の `buildSubscriptionReviewCandidateMap` が duplicate candidate `feedId` を後勝ちにするため、同一 feed candidate が複数渡らない前提を test で固定する
  - `src/__tests__/lib/subscriptions-index.test.ts` で duplicate candidate 入力時の map value と summary count の扱いを明示する
  - review candidate ranking や hidden feed filtering とは分け、candidate map helper の duplicate key contract だけを扱う

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

- [ ] react-doctor Tailwind size shorthand 候補を追加する
  - `react-doctor/design-no-redundant-size-axes` の `w-N h-N` を view scope ごとに `size-N` へ置き換える
  - まず `article-empty-state-view` / `article-tag-picker` / `feed-tree-row` / `settings` small icons を小さな worker scope に分ける
  - Storybook specimen と test fixture は別バッチにし、UI 表示差分が出ないことを focused component test で確認する

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

- [ ] react-doctor iterable performance 候補を追加する
  - `js-combine-iterations` / `js-set-map-lookups` / `js-index-maps` を runtime hot path から優先して潰す
  - 対象候補: `src/lib/articles/article-list.ts` / `src/lib/subscriptions/subscriptions-index.ts` / `src/components/reader/hooks/command-palette/use-command-palette-data.ts`
  - test-only fixture や dev mock は後回しにし、同一入力で出力順が変わらない pure helper test を追加する

- [ ] react-doctor use-articles index map cleanup 候補を追加する
  - `src/hooks/use-articles.ts` の loop 内 `find` を事前 `Map` 化し、article mutation / tag mutation の出力順と cache update が変わらないようにする
  - `src/__tests__/hooks/use-articles.test.tsx` で同一入力時の article/tag association と invalidation side effect を固定する
  - mutation invalidation 候補とは分け、`useArticles` 周辺の lookup complexity だけを扱う

- [ ] react-doctor immutable sort cleanup 候補を追加する
  - `js-tosorted-immutable` の `[...array].sort()` を runtime file から `toSorted()` へ寄せる
  - 対象候補: `src/lib/sidebar/sidebar.ts` / `src/components/reader/hooks/sidebar/use-sidebar-feed-tree.ts` / `src/lib/subscriptions/subscriptions-index.ts`
  - ES target / runtime support を確認し、test fixture の sort cleanup とは別バッチにする

- [ ] react-doctor form preventDefault review 候補を追加する
  - `src/components/settings/add-account/account-config-form-view.tsx` と `src/components/settings/add-account/form-view.tsx` の submit handling を review する
  - Tauri desktop app として progressive enhancement 指摘をそのまま直すか、button-driven form contract として明示するか判断する
  - add account URL validation とは分け、form semantics と keyboard submit contract だけを扱う

- [ ] react-doctor Tailwind padding shorthand 候補を追加する
  - `react-doctor/design-no-redundant-padding-axes` の `px-N py-N` 同値指定を runtime view / Storybook specimen / debug view に分けて `p-N` へ寄せる
  - 対象候補: `shortcuts-help-modal` / `tag-list-view` / `settings-modal-view` / `focus-debug-hud-view` / UI reference specimen
  - size shorthand cleanup とは分け、padding shorthand だけを扱い、表示差分は focused component test または Storybook smoke で確認する

- [ ] react-doctor many boolean props decomposition 候補を追加する
  - `react-doctor/no-many-boolean-props` の対象 component を action group / named variant / discriminated props へ分割できるか確認する
  - 対象候補: `ArticleToolbarMoreMenu` / `sidebar-header-view` / `command-palette-resource-groups` / `sidebar-content-sections` / `command-palette-results`
  - toolbar taxonomy や command palette grouping 再設計とは分け、boolean prop surface の読みやすさと誤用防止だけを扱う

- [ ] react-doctor settings modal state effects 候補を追加する
  - `src/components/settings/settings-modal.tsx` の cascading setState を reducer または derived state に寄せる
  - modal open / category selection / account navigation の既存 state transition が変わらないことを `settings-modal` focused test で固定する
  - browser-view state effects とは分け、settings modal の state/effect 整理だけを扱う

- [ ] react-doctor badge hook state effects 候補を追加する
  - `src/hooks/use-badge.ts` の cascading setState を reducer / derived value / command result path に整理する
  - badge count 更新と platform unavailable 時の fallback が変わらない hook test を追加する
  - updater badge behavior や native command contract とは分け、badge hook 内の React state 整理だけを扱う

- [ ] react-doctor feed favicon ref state 候補を追加する
  - `src/components/shared/feed-favicon.tsx` の render で読まれない state を `useRef` に寄せ、不要 rerender を避ける
  - load/error event 後の fallback rendering と retry boundary が変わらない component test を追加する
  - feed detail panel 表示とは分け、favicon component の state-only handler だけを扱う

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

- [ ] react-doctor toSorted immutable cleanup 候補を追加する
  - `react-doctor/js-tosorted-immutable` の `[...array].sort()` を `toSorted()` へ寄せ、sort 前後の mutation contract を明確にする
  - 対象候補: `storybook-explorer-organization.test.ts` / `repo-contracts.test.ts` / `subscriptions-index.ts` / `dev/scenarios/helpers.ts`
  - Node / browser runtime compatibility を repo の target に合わせて確認し、必要なら test-only と runtime code を別バッチに分ける

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

- [ ] react-doctor shortcuts settings iteration cleanup 候補を追加する
  - `src/components/settings/hooks/use-shortcuts-settings-view-props.ts` の category ごとの `.filter().map()` を single-pass helper へ寄せる
  - shortcuts settings focused test で category order / shortcut labels / disabled state が変わらないことを固定する
  - shortcut taxonomy 変更とは分け、settings shortcuts view props の iteration cleanup だけを扱う

- [ ] react-doctor article tag chips iteration cleanup 候補を追加する
  - `src/components/reader/article-tag-chips.tsx` の assigned / available tag list 生成を single-pass 化できるか確認する
  - article tag chips focused test で chip order / selected state / empty state が変わらないことを固定する
  - article tag picker controller contract とは分け、tag chips view 内の iteration cleanup だけを扱う

- [ ] react-doctor sidebar feed tree helper iteration cleanup 候補を追加する
  - `src/components/reader/sidebar-feed-tree-helpers.ts` の folder model 生成で `.map().filter()` している箇所を、空 folder hide 条件込みの single-pass helper へ寄せる
  - sidebar feed tree helper test で folder order / unfiled feeds / empty folder visibility が変わらないことを固定する
  - feed tree drag/drop behavior とは分け、view model helper の iteration cleanup だけを扱う

- [ ] react-doctor sidebar startup folder expansion iteration cleanup 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts` の unread folder 抽出を single-pass 化する
  - startup expansion hook test で unread folder / manual collapsed folder / account switch 時の expansion が変わらないことを固定する
  - sidebar lifecycle false-positive review とは分け、startup folder expansion の list extraction だけを扱う

- [ ] react-doctor app sync-on-wake account extraction 候補を追加する
  - `src/App.tsx` の sync-on-wake 対象 account 抽出で `.filter().map()` している箇所を single-pass 化する
  - app root focused test で hidden duration / active account / disabled account の sync 対象が変わらないことを固定する
  - App visibility handler ref 候補とは分け、wake sync 対象抽出の iteration cleanup だけを扱う

- [ ] knip plugin-opener dependency boundary 候補を追加する
  - `@tauri-apps/plugin-opener` の npm dependency が TS 側で未使用扱いになる理由を確認し、Cargo plugin / `safeInvoke("plugin:opener|open_url")` との責務境界を整理する
  - 削除できる場合は package lock と browser action tests を更新し、残す場合は knip ignore / contract comment で意図を固定する
  - Tauri command schema dead export cleanup とは分け、opener plugin dependency のみ扱う

- [ ] knip markdownlint-cli2 false-positive contract 候補を追加する
  - `markdownlint-cli2` が `mise.toml` の markdown lint/format task から使われていることを knip が認識できる形にするか、明示 ignore へ寄せる
  - `mise run lint:md` と package scripts contract test で markdown task の実行経路が変わらないことを固定する
  - docs lint 方針変更とは分け、knip dependency surface の false-positive 解消だけを扱う

- [ ] react-doctor tauri dispatch Info.plist marker helper 候補を追加する
  - `scripts/tauri-cli-dispatch.ts` の stale macOS dev bundle 判定で使う Info.plist marker 文字列を helper / constants へ寄せる
  - tauri-cli-dispatch test で bundle identifier marker の有無と削除可否判定が変わらないことを固定する
  - tauri dispatch lookup set / script async waterfall とは分け、Info.plist marker 判定の読みやすさだけを扱う

- [ ] react-doctor tauri command contract extraction cleanup 候補を追加する
  - `src/__tests__/api/schemas.test.ts` と `tests/helpers/tauri-mocks.test.ts` の command extraction helper を single-pass / Set based に整理する
  - schema/command contract test で抽出順、重複排除、failure message が変わらないことを確認する
  - repo contract lookup cleanup とは分け、Tauri command contract test helper だけを扱う

- [ ] react-doctor sync result min/max cleanup 候補を追加する
  - `src/lib/sync/sync-result-feedback.ts` の `array.sort()[0]` による min/max 取得を `Math.min` / `Math.max` 相当へ寄せる
  - sync result feedback test で複数 timestamp / 空配列 / 同値の出力 copy が変わらないことを固定する
  - immutable sort cleanup とは分け、min/max 目的の sort elimination だけを扱う

- [ ] react-doctor article list length-check-first 候補を追加する
  - `src/lib/articles/article-list.ts` の `.every()` 比較に length short-circuit を追加する
  - article list pure helper test で長さ違いの配列が早期 false になり、同長配列の順序比較 contract が変わらないことを固定する
  - article list iterable performance とは分け、array equality guard だけを扱う

- [ ] react-doctor repo contract flatMap cleanup 候補を追加する
  - `src/__tests__/config/repo-contracts.test.ts` の `.map().filter(Boolean)` を `flatMap` に寄せる
  - repo contract test の assertion 対象と failure message が変わらないことを確認する
  - runtime iterable performance とは分け、test helper iteration cleanup だけを扱う

- [ ] react-doctor dev mock lookup index cleanup 候補を追加する
  - `src/dev/mocks.ts` の loop 内 `includes` / `find` を必要な箇所だけ `Set` / `Map` index に寄せる
  - account / feed / article 削除 cascade と list 系 mock の出力順が変わらないことを dev mock test で固定する
  - runtime hot path の iterable performance とは分け、dev mock data graph lookup だけを扱う

- [ ] react-doctor tauri dispatch lookup set 候補を追加する
  - `scripts/tauri-cli-dispatch.ts` の repeated membership check を `Set` 化する
  - Windows / non-Windows dispatch test で許可 command と拒否 command の判定が変わらないことを固定する
  - script async waterfall とは分け、CLI dispatch lookup performance だけを扱う

- [ ] react-doctor Storybook action strip reducer 候補を追加する
  - `src/components/storybook/ui-reference-canvas-specimens.tsx` の `ReaderHeaderActionStripSpecimen` にある関連 state を reducer 化する
  - UI reference canvas smoke で control toggles と specimen rendering が変わらないことを確認する
  - production reader header state とは分け、Storybook specimen の local state organization だけを扱う

- [ ] react-doctor Storybook ellipsis typography 候補を追加する
  - `src/components/storybook/ui-reference-canvas-specimens.tsx` の JSX text に残る three-period ellipsis を typographic ellipsis へ寄せる
  - Storybook text snapshot / smoke で表示 copy が意図通り `…` になることを固定する
  - product locale copy 変更とは分け、UI reference specimen の typography cleanup だけを扱う

- [ ] keyboard listener subscription boundary 候補を追加する
  - `src/hooks/use-keyboard.ts` の `useUiStore()` 全体購読を必要な selector に分け、無関係な UI state 更新で `keydown` listener が張り替わらないようにする
  - `src/__tests__/hooks/use-keyboard.test.tsx` で toast / sidebar state など無関係更新時の `addEventListener` / `removeEventListener` 回数を固定する
  - shortcut taxonomy や command action 変更とは分け、global listener subscription stability だけを扱う

- [ ] feed display mode optimistic cancel 候補を追加する
  - `src/hooks/use-update-feed-display-mode.ts` で楽観更新前に `feeds` query を cancel し、in-flight `listFeeds` が display mode を巻き戻さないようにする
  - `src/__tests__/hooks/use-update-feed-display-mode.test.tsx` で未解決 refetch 中の display mode 更新が古い result に上書きされないことを確認する
  - `useUpdateFeedFolder` との contract parity に限定し、feed settings UI 変更とは混ぜない

- [ ] sidebar navigation frame cleanup 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-navigation.ts` の focus / scroll 用 `requestAnimationFrame` を unmount / selection 変更時に cancel する
  - `src/__tests__/hooks/use-sidebar-feed-navigation.test.tsx` で frame 実行前に unmount した場合に stale focus が走らないことを確認する
  - sidebar startup folder expansion とは分け、keyboard navigation の frame cleanup だけを扱う

- [ ] article tag picker close focus cleanup 候補を追加する
  - `src/components/reader/hooks/article/use-article-tag-picker-popover.ts` の close 後 focus restore frame を cancel 可能にする
  - article tag picker hook / component test で Escape close 後、frame 前に unmount しても trigger focus が発火しないことを確認する
  - tag mutation や picker view props とは分け、popover close focus cleanup だけを扱う

- [ ] updater startup check unmount guard 候補を追加する
  - `src/hooks/use-updater.ts` の startup update check promise に cancelled guard を追加し、unmount 後に toast / warn が出ないようにする
  - `src/__tests__/hooks/use-updater.test.ts` で `useUpdater` unmount 後に startup check が resolve しても update toast が出ないことを確認する
  - updater progress payload schema とは分け、startup check lifecycle だけを扱う

- [ ] folder selection focus frame cleanup 候補を追加する
  - `src/components/reader/hooks/feed-dialogs/use-folder-selection.ts` の new folder input focus 用 `requestAnimationFrame` を reset / unmount 時に cancel する
  - use-folder-selection または add/rename dialog hook test で作成モード開始後 frame 前に閉じても stale focus が走らないことを確認する
  - add feed discovery race とは分け、folder selection focus cleanup だけを扱う

- [ ] settings preference key type boundary 候補を追加する
  - `src/stores/preferences-store.types.ts` の `setPref: (key: string, value: string)` を known preference key / shortcut key の contract に寄せる
  - `src/__tests__/stores/preferences-store.test.ts` または dedicated type contract で unknown key が型で止まることを `expectTypeOf` / `@ts-expect-error` で固定する
  - preference schema 再設計とは分け、settings store action key typing だけを扱う

- [ ] reading display preset paired preference 候補を追加する
  - `src/components/settings/hooks/use-reading-settings-view-props.ts` の display preset が `reader_mode_default` と `web_preview_mode_default` を別々に保存する failure contract を固定する
  - 片方だけ失敗した場合の state / backend 整合性を hook test と store test で確認する
  - preference persist rollback 全体とは分け、reading display preset の paired update だけを扱う

- [ ] data settings stale size response guard 候補を追加する
  - `src/components/settings/hooks/use-data-settings-controller.ts` で初回 `getDatabaseInfo()` の遅延 response が `vacuumDatabase()` 後の size を上書きしないようにする
  - `src/__tests__/components/use-data-settings-controller.test.ts` で deferred info request と vacuum success の順序逆転を固定する
  - database command busy / restore contract とは分け、settings controller state race だけを扱う

- [ ] fixture folder relationship contract 候補を追加する
  - `tests/helpers/fixtures.ts` の sample feed / folder 関係に folder scope を表現できる fixture を追加する
  - `tests/helpers/fixtures.test.ts` で `sampleFolders` と `sampleFeeds.folder_id` の参照整合性を固定する
  - Tauri default mock coverage とは分け、fixture graph の最小関係だけを扱う

- [ ] feed integrity cleanup mock contract 候補を追加する
  - `src/api/schemas/feed-integrity.ts` の cleanup response schema に合わせて `cleanup_feed_integrity_orphans` default mock を用意する
  - `tests/helpers/tauri-mocks.test.ts` で dry-run cleanup DTO を schema-valid に通し、invalid cleanup response validation も確認する
  - feed integrity UI polish とは分け、maintenance command mock / schema contract だけを扱う

- [ ] article toolbar layout prop boundary 候補を追加する
  - `src/components/reader/article-toolbar-view.tsx` の `ArticleToolbarActionStrip` が `useUiStore(layoutMode)` を直接読む構造を props 境界へ寄せる
  - `src/__tests__/components/article-toolbar-view.test.tsx` で store の layoutMode と prop が食い違っても prop 側で mobile / desktop action が決まることを固定する
  - toolbar action taxonomy とは分け、view の store access boundary だけを扱う

- [ ] sidebar header runtime prop boundary 候補を追加する
  - `src/components/reader/sidebar-header-view.tsx` の `useUiStore` / `usePlatformStore` / `hasTauriRuntime()` 直参照を controller 由来 props へ寄せる
  - `useSidebarHeaderProps` 側で `isMobile` / `useDesktopOverlay` を解決し、view test は props-only rendering に寄せる
  - sidebar layout 再設計とは分け、header view の runtime 判定分離だけを扱う

- [ ] tag dialog autofocus shared boundary 候補を追加する
  - `src/components/reader/create-tag-dialog-view.tsx` と `src/components/reader/rename-tag-dialog-view.tsx` の translation / input ref / open 時 autofocus frame の重複を整理する
  - create / rename tag dialog view test で open 時 focus/select と unmount 前後の frame cleanup を確認する
  - article tag picker close focus cleanup とは分け、tag dialog の autofocus boundary だけを扱う

- [ ] article list header label prop boundary 候補を追加する
  - `src/components/reader/article-list-header.tsx` の `useTranslation("reader")` 直参照を controller / view props の `labels` へ寄せる
  - `src/__tests__/components/article-list-header.test.tsx` で mark all read / search / close search label が props 由来になることを固定する
  - article list loading naming とは分け、header label contract だけを扱う

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

- [ ] sync scheduler backoff persistence error 候補を追加する
  - `src-tauri/src/service/sync_scheduler.rs` の `reset_error_count` / `increment_error_count` が `repo.save(&state)` 失敗を silent success にしないようにする
  - Rust test で backoff state 保存成功時の `is_in_backoff` と保存失敗時の error surface を固定する
  - scheduler interval tuning とは分け、backoff persistence failure handling だけを扱う

- [ ] OPML head title escaping contract 候補を追加する
  - `src-tauri/src/infra/opml.rs` の `generate_opml` で head title が二重 escape されないことを固定する
  - Rust test で `Test & Title` が `<title>Test &amp; Title</title>` になり、`&amp;amp;` を含まないことを確認する
  - OPML nested folder / import transaction とは分け、head title serialization だけを扱う

- [ ] E2E runtime error guard shared helper 候補を追加する
  - `e2e/app.spec.ts` と `e2e/storybook/ui-reference-canvas-smoke.spec.ts` に散っている runtime error guard を shared helper に寄せる
  - `pageerror` だけでなく `console.error` も拾う contract を最小 Playwright spec で固定する
  - E2E scenario 追加とは分け、runtime error detection helper だけを扱う

- [ ] shared dialog close label locale 候補を追加する
  - `src/components/ui/dialog.tsx` の `Close` 直書きを props または common locale key 経由に寄せる
  - dialog wrapper test で `showCloseButton` の accessible name が props 由来になり、未指定時 fallback が locale と一致することを確認する
  - feature dialog copy 変更とは分け、shared dialog primitive の close label だけを扱う

- [ ] dev mock account cascade delete 候補を追加する
  - `src/dev/mocks.ts` の `delete_account` mock で account 本体だけでなく feeds / folders / articles / recent history を掃除する
  - `src/__tests__/dev/dev-mocks.test.ts` で account 削除後の `listFeeds` / `listRecentArticles` / account scoped count が空または 0 になることを固定する
  - backend account deletion keyring order とは分け、browser dev mock data graph cleanup だけを扱う

- [ ] dev mock feed delete article cleanup 候補を追加する
  - `src/dev/mocks.ts` の `delete_feed` mock で削除記事に紐づく `mockArticleTags` と `mockArticleViewHistory` も掃除する
  - `src/__tests__/dev/dev-mocks.test.ts` で feed 削除後の `getArticleTags(deletedArticleId)` が空になり、recent articles に削除記事が戻らないことを固定する
  - dev mock account cascade delete とは分け、feed delete の article-related cleanup だけを扱う

- [ ] dev mock unknown command failure 候補を追加する
  - `src/dev/mocks.ts` の browser-only unknown command が `null` 成功にならないよう、test helper と同じく明示 reject にする
  - `src/__tests__/dev/dev-mocks.test.ts` で `invoke("unknown_dev_command")` が reject し、既知 command coverage は維持されることを固定する
  - Tauri default mock command coverage とは分け、browser dev mock unknown command policy だけを扱う

- [ ] sidebar expanded folders storage failure 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts` の expanded folder 永続化で `setItem` 失敗を捕捉する
  - `src/__tests__/hooks/use-sidebar-startup-folder-expansion.test.ts` で storage quota / unavailable 時も UI state 更新は維持されることを固定する
  - sidebar navigation frame cleanup とは分け、expanded folder persistence failure だけを扱う

- [ ] account repository provider kind decode 候補を追加する
  - `src-tauri/src/infra/db/sqlite_account.rs` で DB 上の未知 `kind` を `ProviderKind::Local` に丸めず decode error にする
  - Rust test で `kind='UnknownProvider'` の account row を `find_all` / `find_by_id` した時に persistence error になり、Local として返らないことを固定する
  - account deletion keyring order とは分け、account repository enum decode だけを扱う

- [ ] account verification status decode 候補を追加する
  - `src-tauri/src/infra/db/sqlite_account.rs` で未知 `connection_verification_status` を `Unverified` に丸めず decode error にする
  - Rust test で `connection_verification_status='expired'` の row が persistence error になり、Unverified として返らないことを固定する
  - provider kind decode とは分け、connection verification status decode だけを扱う

- [ ] tag repository blank name invariant 候補を追加する
  - `src-tauri/src/infra/db/sqlite_tag.rs` または domain constructor 境界で blank / whitespace-only tag name を拒否する
  - Rust test で repository/service 直利用でも blank tag が保存されず、`find_all` に空白 tag が出ないことを固定する
  - tag settings UI validation とは分け、repository/domain invariant だけを扱う

- [ ] add account service picker props boundary 候補を追加する
  - `src/components/settings/add-account/service-picker.tsx` の `useTranslation("settings")` と `SERVICE_CATEGORIES` 直参照を controller 由来 props へ寄せる
  - add account focused test で service picker view が props の category / service / description copy だけで render できることを固定する
  - add account form validation とは分け、service picker view/controller boundary だけを扱う

- [ ] add account disabled service locale 候補を追加する
  - `src/locales/en/settings.json` の `account.coming_soon` が日本語のままになっている点を修正し、disabled provider 表示で使う contract を固定する
  - `src/__tests__/components/add-account-form.test.tsx` と locale contract test で “Coming soon” / “準備中” が locale 由来で出ることを確認する
  - service picker props boundary とは分け、disabled service badge/copy だけを扱う

- [ ] account detail copy failure locale 候補を追加する
  - `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts` の server URL copy failure toast が raw `error.message` にならないようにする
  - `src/__tests__/components/account-detail.test.tsx` で clipboard failure 時に `ja` / `en` の locale wrapper 経由 toast になることを固定する
  - account detail credentials validation とは分け、copy failure feedback copy だけを扱う

- [ ] general settings language option contract 候補を追加する
  - `src/components/settings/hooks/use-general-settings-view-props.ts` の `English` / `日本語` self-label を locale 例外として残すか locale 管理へ寄せるか固定する
  - `src/__tests__/components/use-general-settings-view-props.test.ts` で `system` は locale 由来、`en` / `ja` は意図した self-label であることを確認する
  - general settings preference handling とは分け、language option label contract だけを扱う

- [ ] article summary HTML spacing 候補を追加する
  - `src/lib/content/html.ts` の `stripHtmlTags()` が block element / `br` / list item 境界を潰して `LeadBody` のような summary を作らないようにする
  - `src/__tests__/lib/html.test.ts` と必要なら `src/__tests__/components/article-list-item.test.tsx` で `<p>Lead</p><p>Body</p>` が `Lead Body` になることを固定する
  - article content danger boundary とは分け、plain text summary spacing だけを扱う

- [ ] article web preview blank URL guard 候補を追加する
  - `src/components/reader/hooks/article/use-article-browser-overlay-display.ts` と `src/lib/feed/feed-landing.ts` で whitespace-only article URL を preview 可能扱いしない
  - `src/__tests__/lib/feed-landing.test.ts` と既存 hook/component test で blank URL は overlay を開かず `missing_web_preview` へ落ちることを固定する
  - ArticleDto URL schema normalization とは分け、Web Preview availability boundary だけを扱う

- [ ] article reader relative link policy 候補を追加する
  - `src/components/reader/article-reader-body.tsx` で sanitized 本文内の相対リンククリックを app origin ではなく記事 URL 基準にするか無効化するか固定する
  - article reader focused test で `<a href="/posts/1">` の click が期待 URL へ解決される、または外部 open されないことを確認する
  - sanitizer URL filtering とは分け、reader body relative link click policy だけを扱う

- [ ] tag color picker radiogroup contract 候補を追加する
  - `src/components/shared/tag-color-picker.tsx` の色選択を単一選択グループとして扱えるようにする
  - `src/__tests__/components/tag-color-picker.test.tsx` で `radiogroup` / `radio` 相当の accessible grouping と arrow key selection を固定する
  - tag settings UI validation とは分け、shared color picker の keyboard/accessibility contract だけを扱う

- [ ] form dialog shell submit guard 候補を追加する
  - `src/components/shared/form-dialog-shell.tsx` の Enter submit と footer submit button が同じ submit guard を通るようにする
  - `src/__tests__/components/shared-form-controls.test.tsx` で `loading` / `submitDisabled` 中は Enter と footer click のどちらも `onSubmit` しないことを固定する
  - react-doctor form preventDefault review とは分け、shared dialog shell の submit path 統一だけを扱う

- [ ] labeled input inside action focus boundary 候補を追加する
  - `src/components/shared/labeled-input-row.tsx` の `actionPlacement="inside"` action が input focus / selection を奪わないようにする
  - `src/__tests__/components/shared-form-controls.test.tsx` で inside action の mouse click 後も input focus が保持され、action は 1 回だけ実行されることを固定する
  - copyable text field の個別挙動とは分け、labeled input row の inside action boundary だけを扱う

- [ ] nav row selected aria state contract 候補を追加する
  - `src/components/shared/nav-row-button.tsx` の `selected` と aria state の既定 contract を揃える
  - `src/__tests__/components/nav-row-button.test.tsx` で `selected` 時の既定 aria state と、caller が `aria-current` / `aria-pressed` を明示した場合の上書きを固定する
  - React 19 forwardRef cleanup とは分け、shared navigation row の selected state semantics だけを扱う

- [ ] open log directory error copy contract 候補を追加する
  - `src-tauri/src/commands/log_commands.rs` と `src/components/settings/hooks/use-data-settings-controller.ts` で log directory open failure が UI 上で二重説明にならないようにする
  - Rust test で command error message は短い action context に留め、TS test で localized toast が `Failed to open... Failed to open...` のように重複しないことを固定する
  - data settings stale size race とは分け、open log dir failure copy だけを扱う

- [ ] reqwest retryable error redaction 候補を追加する
  - `src-tauri/src/domain/error.rs` の unknown reqwest error fallback が raw URL / query を user-visible `Retryable` message に流さないようにする
  - Rust test で generic message に丸め、TS schema/UI test で secret-like query を含む message が surface へ出ないことを固定する
  - network retry policy とは分け、retryable error message redaction だけを扱う

- [ ] AppError non-empty message contract 候補を追加する
  - `src-tauri/src/commands/dto.rs` と `src/api/schemas/error.ts` で blank / whitespace-only AppError message を拒否または fallback 正規化する
  - Rust test で DomainError 変換結果が non-empty message になり、TS schema test で blank message の方針を固定する
  - individual command error copy とは分け、AppError DTO message invariant だけを扱う

- [ ] similarity test-only error type fixture 候補を追加する
  - `TestAppError` と `UserVisibleError` が 95.5% 類似なので、test-only user-visible error fixture type / builder を共有できるか確認する
  - `app-root.test.tsx` と `use-updater.test.ts` の error shape assertion が同じ意図なら helper 化し、違うなら local type 名で意図差分を明示する
  - AppError DTO invariant とは分け、test fixture type duplication だけを扱う

- [ ] similarity hook test props reuse 候補を追加する
  - `UseArticleActionShortcutsParams` と `TestShortcutsProps` が 91% 類似なので、hook test props が production hook params を再定義していないか確認する
  - test wrapper の追加 props だけを local type に残し、hook params は production type import に寄せられるか判断する
  - article action shortcut behavior 変更とは分け、test props type duplication だけを扱う

- [ ] similarity browser view harness props reuse 候補を追加する
  - `UseBrowserViewControllerParams` と `BrowserViewHarnessProps` が 96% 類似なので、browser view test harness が controller params を再定義していないか確認する
  - test-only override props だけを local type に残し、controller input contract は production type import または helper builder へ寄せる
  - browser controller behavior 変更とは分け、test harness props duplication だけを扱う

- [ ] similarity not-found error display type review 候補を追加する
  - `ArticleNotFoundStateViewProps` と `AccountDetailError` が 94.8% 類似なので、message/title/action を持つ not-found/error display shape を共有すべきか確認する
  - 共通化する場合は shared display state type に留め、article not-found copy と account detail toast/error copy は各 feature に残す
  - AppError DTO invariant とは分け、view/display error shape の type duplication だけを扱う

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
