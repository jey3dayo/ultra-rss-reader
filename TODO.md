# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] P1 デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - 既存の `mise run app:dev:seed-from-prod` を前提に、デバッグ画面から誤操作なく呼べる UX と確認導線を設計する
  - Dev 側 DB のバックアップ場所、アプリ再起動、credentials はコピーされないことを UI 上で明示する

## UI/UX 監査の残り

- [ ] P3 Browser overlay 周辺への共通 motion 適用を検証する
  - Tauri child webview geometry と重なり、見た目の polish よりレイアウト安定性を優先する必要がある
  - 適用する場合は `browser-overlay-stage` / `browser-overlay-chrome` / native webview bounds の同期を実機で確認してから進める
  - `transitions-dev` の page side-by-side / panel reveal 相当を入れる場合は、WebView bounds 更新と CSS transform が二重に効かないかを先に確認する
  - まずは既存 overlay の resize / open / close 時に jank が出ているかを計測し、必要な箇所だけに限定する

- [ ] P3 高頻度・高密度 UI への motion 適用は専用検証バッチで進める
  - Article detail の記事切替は本文読書中の視線移動に影響するため、title / meta / tag area ごとに必要性を見て限定適用する
  - Feed tree drag overlay はドラッグ中の高頻度更新と重なるため、入口だけにするか、drag preview には適用しない方針も含めて実機確認する
  - `article-list-item` の row hover / selected transition は連続キー移動で毎フレーム効くため、`motion-static-hover-surface` への置換は計測後に行う
  - どちらも適用前後でキーボード操作、ドラッグ、連続記事移動時の jank を確認する

- [ ] P3 モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 問題化リスク追加候補

- [ ] P0 manual sync cooldown failure contract を固定する
  - 対象: `src/lib/sync/manual-sync.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`
  - `triggerManualSyncWithCooldownResult()` は `triggerSync()` の `Result.fail` 後にも cooldown を進めるため、失敗直後の再試行をブロックしてよいか確認する
  - rejected promise / `Result.fail` / already in progress / cooldown の user feedback を分け、manual sync hook test で固定する

- [ ] P0 feed folder optimistic rollback と post-success invalidation を固定する
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts`
  - feed drag/drop は optimistic に `folder_id` を更新するが、success 後の invalidation failure や concurrent drop の rollback 順序が未固定
  - drop A -> drop B -> A fail / B success の deferred mutation test を追加し、最終 folder と toast の契約を固定する

- [ ] P0 article auto mark stale mutation contract を固定する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`
  - delayed auto mark の timeout と `setRead.mutate` callback が article switch / unmount / unread view retention と重なる時の state rollback が事故りやすい
  - article A timer pending -> article B selected -> A mutation fail の順序で retained article / recently read / toast が正しいことを focused test で固定する

- [ ] P0 browser overlay close rejected promise contract を修正する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - `closeBrowserWebview().then(...).finally(...)` に rejected promise の catch がなく、native command reject 時に close finalize と unhandled rejection が混在し得る
  - close failure は log-only で reader へ戻すのか、surface issue として残すのかを決め、close in-flight の解除も test で固定する

- [ ] P0 add account setup sync duplicate submit contract を補強する
  - 対象: `src/components/settings/add-account/account-config-form.tsx`, `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`
  - account create success 後の setup sync と account detail retry が並ぶと、setup session owner と selected account が stale になり得る
  - duplicate submit / navigation away / retry while syncing / sync reject を state machine として fixed test にする

- [ ] P1 settings sync status refetch rejection surface を追加する
  - 対象: `src/components/settings/account-detail/account-detail.tsx`, `src/components/settings/settings-modal.tsx`
  - `onSyncStatusChanged` と settings open 時の `syncStatusQuery.refetch()` が `void` で呼ばれており、refetch rejection の扱いが揃っていない
  - refetch failure は log-only か sync status row の warning にするか決め、account detail / settings modal の focused test で固定する

- [ ] P1 settings modal lazy preload rejection を補強する
  - 対象: `src/components/app-shell.tsx`
  - DEV 時の `void loadSettingsModalModule()` は preload failure を catch せず、lazy load の failure は boundary に任せる構造との差がある
  - preload reject は dev warning、actual render reject は boundary で modal close、という役割分担を test で固定する

- [ ] P1 browser matchMedia listener fallback を補強する
  - 対象: `src/components/reader/browser-view.tsx`, `src/hooks/use-app-icon-theme.ts`
  - `mediaQuery.addEventListener/removeEventListener` 前提の箇所が残っており、古い WebView / test double の missing listener API で落ちる可能性がある
  - `addListener/removeListener` fallback か shared helper へ寄せ、missing listener / cleanup throw を focused test にする

- [ ] P1 browser webview event malformed payload rate limit を検討する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-events.ts`
  - malformed native event payload を毎回 `console.warn` するため、native 側 bug や noisy event で log が埋まり、実障害の原因追跡が難しくなる
  - event type ごとの warn once / sampled log / diagnostics counter のどれにするか決め、payload rejection contract は維持する

- [ ] P1 browser injected bridge listener lifecycle を検証する
  - 対象: `src-tauri/src/browser_webview.rs`
  - injected script が `window.addEventListener` と focus override を入れるため、navigation / reload / recreate 時に listener が重複しないか実機寄りに確認する
  - bridge install idempotence、mouse back/forward in-flight、close in-flight の contract test または manual verification を追加する

- [ ] P1 browser webview bounds listener readiness timeout を検討する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`
  - `waitForBrowserWebviewListeners()` が listener registration を待つ構造だが、registration failure 時に bounds sync がどの程度進むべきか明確でない
  - ready reject / unavailable runtime / slow listener registration の時に create を止めるか degraded mode で続けるかを fixed test にする

- [ ] P1 browser theme wipe timer stale cleanup を固定する
  - 対象: `src/components/reader/browser-view.tsx`
  - theme wipe の timeout と system theme listener が重なる時、rapid theme changes / unmount / missing matchMedia listener で stale animation state が残らないか未固定
  - rapid light -> dark -> system change と unmount cleanup を component test で固定する

- [ ] P1 data settings global loading cleanup を固定する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`
  - VACUUM / open log dir 中に settings modal を閉じると `setSettingsLoading(false)` を呼ばない設計になっており、global loading state の owner が曖昧
  - unmount 中の native command settle 後に loading が残らないか、または modal unmount 側が必ず cleanup する契約を test で固定する

- [ ] P1 startup sync storage warning policy を整理する
  - 対象: `src/lib/sync/startup-sync-storage.ts`, `src/App.tsx`
  - localStorage unavailable / write failure を warn するようになっているが、startup path で毎起動 noisy にならないかと throttle bypass の影響が未整理
  - unavailable storage 時の sync frequency、future timestamp cleanup failure、legacy key migration failure を contract test で固定する

- [ ] P1 article search focus runtime boundary を補強する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-search.ts`
  - `requestAnimationFrame` と `window.setTimeout` を直接使う focus retry があり、browser preview / test runtime で API が欠ける時の fallback が未固定
  - missing `requestAnimationFrame` / unmounted input / account switch 中 focus の contract を focused test にする

- [ ] P1 browser overlay viewport resize fallback を補強する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-viewport-width.ts`
  - initial width fallback はあるが、resize event binding failure や mobile recovery layout で viewport width が stale になるケースが未固定
  - window unavailable / resize dispatch / cleanup failure の test を追加し、fallback width の意味を明示する

- [ ] P2 command palette dev scenario load failure visibility を整理する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`, `src/dev/scenario-runtime.ts`
  - dev scenario loader failure を空配列にしており、DEV で scenario が消えたのか loader が壊れたのか見分けにくい
  - DEV だけ warning / debug toast / diagnostics へ寄せるか決め、production bundle には影響しない contract を追加する

- [ ] P2 app shell debug HUD portal target contract を固定する
  - 対象: `src/components/app-shell.tsx`
  - Debug HUD が `document.body` portal と `document.activeElement` に依存するため、test/runtime boundary では document unavailable や focus target malformed の扱いが曖昧
  - Debug HUD 有効時だけの boundary helper に寄せ、document unavailable では no-op になる contract を固定する

- [ ] P2 reader focus DOM selector drift を検出する
  - 対象: `src/lib/reader-focus.ts`, reader list/sidebar/account pane components
  - focus helper が data attribute selector に強く依存しており、view refactor で attribute が外れると keyboard navigation が silent fallback になりやすい
  - selector source of truth または repo contract test を追加し、主要 focus target attribute の存在を固定する

- [ ] P2 old unread read action stale count contract を補強する
  - 対象: `src/components/reader/hooks/feed-actions/use-old-unread-read-action.ts`, feed/folder/smart context menus
  - old unread count fetch と confirm action の間で unread count が変わった時、confirm message と実行結果のズレが起き得る
  - count fetch failure / count becomes zero / action reject の user feedback を focused test で固定する

- [ ] P2 scroll overflow ResizeObserver fallback を補強する
  - 対象: `src/components/settings/hooks/use-scroll-overflow-state.ts`
  - scroll overflow state は `requestAnimationFrame` / ResizeObserver / DOM measurement に依存するため、observer unavailable や rapid resize で stale shadow が残りやすい
  - missing ResizeObserver / unmount before RAF / content resize の focused test を追加する

- [ ] P2 account detail export object URL cleanup を固定する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`
  - OPML export の object URL revoke が timer 依存で、download click failure / unmount / rapid export で URL cleanup が漏れないか未固定
  - createObjectURL / revokeObjectURL / anchor click failure を runtime boundary test で固定する

- [ ] P2 feed URL normalization failure copy を整理する
  - 対象: `src/lib/feed/feed.ts`, `src/components/reader/feed-context-menu.tsx`, add feed dialog actions
  - URL parsing failure が helper / context menu / add feed flow で別々に処理され、invalid URL の user-facing copy と log policy が揺れやすい
  - malformed URL / protocol-relative URL / throwing URL constructor 相当の contract test を追加する

- [ ] P2 Tauri dev Vite manager timeout diagnostics を改善する
  - 対象: `scripts/tauri-dev-vite-manager.ts`
  - port wait timeout や Vite start failure が発生した時、既存 process / stale listener / Node version のどれが原因かログから切り分けにくい
  - timeout error に checked port / command / elapsed ms / next action を含める script test を追加する

- [ ] P3 story/runtime mock window global cleanup を追加する
  - 対象: `src/components/storybook/story-tauri-runtime.ts`, `src/dev/mocks.ts`
  - story/dev mock が `window.__TAURI_INTERNALS__` など global を触るため、story 間や test 間で leaked runtime state が残ると false positive になる
  - install / restore / already installed の contract test を追加し、Storybook fixture cleanup と分ける

- [ ] P0 add account post-success invalidation failure を修正する
  - 対象: `src/components/settings/add-account/account-config-form.tsx`
  - account 作成成功後に `qc.invalidateQueries({ queryKey: ["accounts"] })` / `["feeds"]` を await も catch もせず呼んでおり、cache refresh failure と setup sync 開始の順序が未固定
  - account creation success、cache invalidation failure、setup sync reject を分け、created account の選択と settings account id が stale にならないことを test で固定する

- [ ] P0 sidebar sync status invalidation failure を修正する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`
  - `sync-completed` event 後の `queryClient.invalidateQueries(accountSyncStatusQueryKey())` が fire-and-forget で、sync status row が stale のまま残る failure を捕捉できない
  - invalidation failure は log-only / toast / status warning のどれにするか決め、malformed event payload と合わせて focused test にする

- [ ] P0 feed display preset fire-and-forget failure を修正する
  - 対象: `src/components/reader/feed-context-menu.tsx`, `src/components/reader/folder-context-menu.tsx`
  - feed/folder display preset update が fire-and-forget で、persist failure 時に選択 UI と backend preference がズレる
  - single feed と folder bulk update で、partial failure / rejected promise / optimistic UI 維持の方針を分けて test する

- [ ] P0 old unread read context action failure surface を固定する
  - 対象: `src/components/reader/feed-context-menu.tsx`, `src/components/reader/folder-context-menu.tsx`, `src/components/reader/smart-view-context-menu.tsx`
  - `void markOldUnreadRead(days)` が複数入口にあり、count fetch と mark action の failure が context menu 呼び出し元から見えにくい
  - account/feed/folder scope ごとに failure toast、cooldown、post-success invalidation を固定し、context menu 側は同じ helper policy に寄せる

- [ ] P1 feed open site native command rejection を修正する
  - 対象: `src/components/reader/feed-context-menu.tsx`
  - `openInBrowser(url, bg).then(...)` に catch がなく、native command wrapper が reject した場合の toast/log が抜ける
  - invalid URL / `Result.fail` / rejected promise を分け、article open external action と同じ error category に寄せる

- [ ] P1 command palette history noisy storage warning を調整する
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`
  - localStorage failure を warn するようになっているが、private mode / blocked storage で palette 操作ごとに noisy log になり得る
  - warn once / dev-only warn / silent fallback のどれにするか決め、history は in-memory fallback なしでよいかを contract test にする

- [ ] P1 article tag picker DOM listener boundary を補強する
  - 対象: `src/components/reader/hooks/article/use-article-tag-picker-popover.ts`
  - popover open 時に `document.addEventListener` / `requestAnimationFrame` / `document.activeElement` を直接使うため、test double や detached DOM で failure が起きやすい
  - document unavailable、outside click、Escape close、focus restore frame cleanup を focused test で固定する

- [ ] P1 sidebar account switcher DOM listener boundary を補強する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-account-switcher.ts`
  - account dropdown の outside click と selected item focus が document / requestAnimationFrame 前提で、sidebar collapse や account list update と競合しやすい
  - open -> accounts change -> close -> restore focus の順序と RAF cleanup を focused test で固定する

- [ ] P1 sidebar cooldown interval runtime boundary を補強する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`
  - manual sync cooldown 表示が `window.setInterval` 前提で、runtime unavailable / timer drift / rapid cooldown reset の契約が未固定
  - missing window、cooldown extended、component unmount の interval cleanup を hook test で固定する

- [ ] P1 browser webview load timeout fallback を補強する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts`
  - load timeout が `window.setTimeout` 前提で、browser URL change と loading flag の組み合わせによる stale failure surface が未固定
  - URL A loading -> URL B selected -> A timeout settle の順序で B に error を出さないことを focused test にする

- [ ] P1 browser overlay focus return RAF fallback を補強する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts`
  - overlay close 後の focus return が `requestAnimationFrame` と複数 DOM selector に依存しており、selected article が消えた時の fallback 順序が重要
  - selected row removed / previous target disconnected / fallback root missing の順序を test で固定する

- [ ] P1 sidebar feed navigation RAF cleanup を補強する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-navigation.ts`, `src/components/reader/hooks/sidebar/use-sidebar-controller.ts`
  - feed navigation focus が RAF と timeout に依存し、account switch / folder collapse / sidebar collapse と重なると stale focus が戻る可能性がある
  - pending focus frame cancellation と account switch 後の target recalculation を focused test で固定する

- [ ] P1 article list keydown RAF selection ordering を補強する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-keydown-handler.ts`, `src/components/reader/hooks/article-list/use-article-list-effects.ts`
  - keyboard navigation と RAF focus が article list update / search result update と重なる時、古い row へ focus する可能性がある
  - selected article deleted、search query changed、next/prev repeated keydown の ordering を focused test で固定する

- [ ] P1 browser debug geometry event payload contract を補強する
  - 対象: `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts`, `src/components/app-shell.tsx`
  - debug geometry event は `window.dispatchEvent(CustomEvent)` 前提で、payload null / malformed / rapid event の表示契約が散らばりやすい
  - dev-only diagnostics と production no-op の境界を明示し、Debug HUD 側の malformed payload handling を test にする

- [ ] P2 feed tree click suppression timer cleanup を補強する
  - 対象: `src/components/reader/hooks/feed-tree/use-feed-tree-handle-click-suppression.ts`
  - drag handle click suppression は timer 依存で、drag cancel / drop / unmount の順序によって suppress flag が残る可能性がある
  - drag start -> cancel -> click、drag start -> unmount の timer cleanup を focused test にする

- [ ] P2 folder selection focus RAF cleanup を補強する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-folder-selection.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-controller.ts`
  - add/rename feed dialog の folder selection focus が RAF 依存で、dialog close や option list update と重なると stale focus が起きやすい
  - close before RAF、folder list changed、new folder created の focus contract を focused test で固定する

- [ ] P2 rename feed copy action rejection surface を補強する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-controller.ts`, `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-view-props.ts`
  - readonly URL copy は `void controller.handleCopy(...)` で呼ばれ、clipboard failure の toast/log policy が dialog 呼び出し元から見えにくい
  - clipboard unavailable / permission denied / empty URL を action result category として固定する

- [ ] P2 article action fire-and-forget parity を整理する
  - 対象: `src/components/reader/hooks/article/use-article-actions.ts`, `src/components/reader/article-browser-actions.ts`
  - open external / copy link / add to reading list は fire-and-forget 入口だが、toast と log の粒度が action ごとに揺れる可能性がある
  - invalid URL、native reject、clipboard unavailable、reading list unsupported の user feedback を同じ contract へ寄せる

- [ ] P2 settings account detail copy server URL failure を補強する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-view-props.tsx`, `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`
  - server URL copy は view props から `void controller.handleCopyServerUrl()` で呼ばれ、clipboard rejection と missing URL の扱いが見えにくい
  - copy success / unavailable / empty server URL の toast contract を focused test で固定する

- [ ] P2 app foreground window show/focus error policy を整理する
  - 対象: `src-tauri/src/lib.rs`
  - second instance / foreground handling で `let _ = window.show(); let _ = window.set_focus();` と error を捨てており、packaged app の復帰失敗を追跡しにくい
  - expected unsupported と unexpected error を分けて log するか、manual verification に残すか決める

- [ ] P2 dev intent runtime option cache invalidation を補強する
  - 対象: `src/dev/intent.ts`, `src/dev/use-resolved-dev-intent.ts`
  - runtime dev options の promise/error cache が失敗後に stale になった時、dev intent を直しても再読込まで復旧しない可能性がある
  - failure cache clear / retry trigger / dev-only warning の contract を test で固定する

- [ ] P2 seed dev database open handle diagnostics を補強する
  - 対象: `scripts/seed-dev-db-from-prod.ts`
  - DB open handle 検出で process 名や handle path が不十分な場合、ユーザーがどの app を閉じるべきか判断しにくい
  - lsof unavailable / process list permission denied / WAL only open の error message を script test で固定する

- [ ] P2 windows dispatch env/path failure diagnostics を補強する
  - 対象: `scripts/windows-command-dispatch.ts`, `scripts/lib/windows-dispatch.ts`, `scripts/tauri-cli-dispatch.ts`
  - Windows/WSL dispatch は path conversion と process spawn failure が混ざりやすく、CI で拾えないローカル問題になりやすい
  - missing executable、path with spaces、spawn EACCES の message と exit code contract を script test で固定する

## 次の並列バッチ候補

- [ ] P3 TypeScript feature-local `.types.ts` split 候補を追加する
  - feature-local 候補: `src/components/reader/feed-tree.types.ts`、`sidebar.types.ts`、`sidebar-feed-section.types.ts`、`article-list.types.ts`、`browser-view.types.ts`、`command-palette.types.ts`、`add-feed-dialog.types.ts`、`rename-feed-dialog.types.ts`、`src/components/settings/settings-page.types.ts`、`settings-nav.types.ts`、`settings-modal.types.ts`、`account-detail/types.ts`
  - Props / Params / Result が同じ file に混在している箇所を、view contract / controller contract / hook-local contract の小バッチに分けて整理する
  - runtime behavior は変えず、feature 内 consumer が多い型の責務分割と name clarity だけを扱う

- [ ] P3 TypeScript local-only exported Props/Params/Result 候補を追加する
  - local-only 候補: `src/components/settings/add-account/form-view.types.ts`、`src/components/reader/account-switcher.types.ts`、`article-view.types.ts`、`sidebar-sync.types.ts`、`sidebar-controller.types.ts`、`sidebar-runtime.types.ts`、`sidebar-sources.types.ts`、`sidebar-tag-items.types.ts`、`article-actions.types.ts`
  - exported `*Props` / `Use*Params` / `Use*Result` の consumer が 1 runtime component / 1 hook group / story-only に閉じるものを owner file へ戻せるか確認する
  - public contract 候補とは分け、localized type の export 削減だけを扱う

- [ ] P2 TypeScript schema-derived DTO boundary 候補を追加する
  - schema-derived 候補: `AccountDto` / `ArticleDto` / `FeedDto` / `FolderDto` / `TagDto` / `MuteKeywordDto` / `PreferencesDto` / `BrowserWebviewState` を import する reader/settings/lib/store types と、手書き `SyncProgressEventDto`
  - DTO alias や view model が `z.output` / `z.infer` / `api/tauri-commands` の source of truth と重複していないか確認し、UI 専用 shape は `*ViewModel` / `*UiState` として意図を明確にする
  - IPC / localStorage / app-config schema の validation 変更とは分け、type source-of-truth と DTO/UI state boundary だけを扱う

- [ ] P3 react-doctor dead code type surface 候補を追加する
  - `knip/types` / `knip/exports` の unused type/export を feature ごとに棚卸しする
  - `article-list.types.ts` / `browser-view.types.ts` / `command-palette.types.ts` など広い contract は一括削除せず参照範囲ごとに分ける
  - public wrapper API と Storybook helper export は allowlist 化し、実 dead code だけを削除する

- [ ] P3 react-doctor many boolean props decomposition 候補を追加する
  - `react-doctor/no-many-boolean-props` の対象 component を action group / named variant / discriminated props へ分割できるか確認する
  - 対象候補: `ArticleToolbarMoreMenu` / `sidebar-header-view` / `command-palette-resource-groups` / `sidebar-content-sections` / `command-palette-results`
  - toolbar taxonomy や command palette grouping 再設計とは分け、boolean prop surface の読みやすさと誤用防止だけを扱う

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する

- [ ] P3 参照範囲が広い settings 配置候補を別バッチで見直す
  - `settings-nav.types.ts` は settings rail contract として `SettingsNavView` / `AccountsNavView` / Storybook specimen / view tests にまたがるため、settings nav 境界が増えた時に再評価する
  - `settings-page.types.ts` は public page/control contract に絞る。control union が肥大化した時は page/control contract 自体の分割を検討する
  - `settings-modal.types.ts` は modal view contract に絞る。新しい settings surface が増えて content routing props が再び肥大化した時に分離する

- [ ] P3 参照範囲が広い root-level type を別バッチで分割する
  - reader selection は `src/lib/reader/reader-selection.types.ts` を source of truth にする。新しい `UiSelection` alias は増やさない
  - さらに state type を分割する場合は、`src/stores/ui-store.ts` 自体を slice 化できる段階で実施する。store action / selector / dev scenario への参照が広いため別バッチにする

- [ ] P3 小粒 cleanup 候補を別バッチで見直す
  - UI class variant の追加テストは shared component の semantic token / role contract に限定する。hover 全量や visual snapshot は固定しない
  - pure helper の追加テストは、article list selection / navigation / grouping / mark-all-read count など挙動の契約として価値があるものだけ残す
  - view-level props の `export type` は hook / Storybook / tests の contract として使うものだけ残す。外部 import がない helper props は触るファイルごとに local type へ戻す
  - reader の残りは browser geometry など参照範囲が広い単位で見直す
  - `src/components/ui/` の primitive wrapper props は shadcn/Base UI wrapper API として扱う。外部 import がなくても、公開 wrapper contract の方針を決めるまでは一括 local 化しない
  - shared component の `.types.ts` は、複数ファイルで共有する contract だけ残す。`dialog.types.ts` の `ConfirmDialogVariant` のように store / view にまたがるものは、呼び出し境界が変わる時に見直す
  - Browser geometry の数値固定や picker 専用 chip variant の網羅は参照範囲が広く、実機/呼び出し側 layout 影響を見てから別バッチで扱う

- [ ] P3 subscriptions index view contract 整理候補を別バッチで見直す
  - `subscriptions-index-page-view.tsx` / list pane / detail pane / overview summary の props を、view file local と shared page contract に分ける
  - `src/lib/subscriptions/subscriptions-index.types.ts` は list row / summary card / detail metrics の共有モデルとして扱い、UI props と混ぜない
  - keep / defer / delete の decision flow は状態更新と toast にまたがるため、型整理とは別バッチにする

- [ ] P2 app shell / keyboard boundary 整理候補を別バッチで見直す
  - global keyboard handling に reader pane 固有の分岐が増えていないか、pane helper へ戻せるものを棚卸しする
  - focus return / selected sidebar target / selected article row の復帰処理は、reader focus helper と hook の責務境界を先に整理する
  - shortcut の表示ラベル変更や i18n copy 変更は、挙動整理と同じバッチに混ぜない

- [ ] P3 store slice boundary 整理候補を別バッチで見直す
  - `ui-store.ts` の reader selection / layout state / settings modal / toast / sync progress / account setup session を、参照範囲ごとに slice 化できるか確認する
  - `preferences-store.ts` は schema と永続化 contract があるため、UI store 分割とは同じバッチに混ぜない
  - store selector の import 先が多いため、まずは type alias / action group の棚卸しだけ行い、挙動変更は避ける

- [ ] P2 subscriptions index state hook 整理候補を別バッチで見直す
  - `use-subscriptions-index-state.ts` の selected row / summary filter / kept-deferred state / return state を、page state と list state に分けられるか確認する
  - `SubscriptionsWorkspaceReturnState` は navigation return contract なので、内部 state 整理とは別扱いにする
  - keep / defer / delete 後の選択維持は UX 挙動に直結するため、型整理より先に existing tests を確認する

- [ ] P3 subscriptions component props local 化候補を別バッチで見直す
  - `subscriptions-index-page-view.tsx`、`subscriptions-list-pane.tsx`、`subscription-detail-pane.tsx`、`subscriptions-overview-summary.tsx` の view props を component-local に寄せられるか確認する
  - `subscriptions-index.types.ts` の row / summary / detail model は lib 共有 contract として残し、component props と混ぜない
  - Storybook stories と component tests の fixture 型が参照している場合は、fixture helper 側へ型境界を寄せる

- [ ] P3 Storybook UI reference 分割候補を別バッチで見直す
  - `ui-reference-canvas-specimens.tsx` が大きくなっているため、foundations / controls / workspace / settings / navigation の specimen 群へ分割できるか確認する
  - visual specimen の copy や className 変更はデザイン差分になるため、まずは export / import 境界だけを整理する
  - `storybook-explorer-organization.test.ts` が期待する構成を先に確認し、story title / canvas 名を変えない

- [ ] P2 shared workspace layout contract 整理候補を別バッチで見直す
  - `workspace-pane-layout.ts` と `app-layout.tsx` の pane sizing / shell boundary / responsive constraints を、shared layout contract と app shell usage に分けられるか確認する
  - layout token や CSS class の変更は visual impact があるため、まずは型・helper配置と tests の責務整理に限定する
  - app shell の overlay / debug HUD / modal collision とは別バッチにする

- [ ] P1 Tauri command/schema contract 整理候補を別バッチで見直す
  - `src/api/tauri-commands.ts` と `src/api/schemas/*` の command response validation を、command group 単位で棚卸しする
  - Rust command DTO と frontend schema のズレを検出する contract test を優先し、UI 側の fallback copy 変更とは混ぜない
  - database / account / feed / browser webview command は失敗時の戻り値契約が違うため、worker scope を分ける

- [ ] P1 Tauri menu / shortcut contract 整理候補を別バッチで見直す
  - `src-tauri/src/menu.rs` / `menu_i18n.rs` と frontend shortcut handling の action id 対応を一覧化する
  - menu label の i18n と frontend shortcut 表示は別レイヤーなので、まずは action id と emitted event の contract test を優先する
  - native menu の checked state と UI preference state の同期は挙動影響があるため、型・テスト整理とは分ける

- [ ] P1 Rust DB repository test 候補を別バッチで追加する
  - sqlite account / feed / folder / article / tag / sync state repository の境界値を、migration 適用済み DB fixture で固定する
  - WAL / SHM や app data path の運用検証とは分け、repository method の入出力契約に限定する
  - 既存 integration test が広い場合は、repository ごとの小さい fixture helper を先に作る

- [ ] P2 dev mock / scenario runtime 整理候補を別バッチで見直す
  - `src/dev/mock-data.ts` / `mocks.ts` / scenario registry の fixture を、reader / settings / browser / subscriptions の利用面ごとに分けられるか確認する
  - command palette dev scenario と browser geometry scenario は実行環境依存が違うため、同じ worker に混ぜない
  - mock data の表示文言変更は Storybook / tests に波及するため、まずは fixture boundary の整理に限定する

- [ ] P1 updater / release readiness 検証候補を別バッチで見直す
  - `.github/workflows/release.yml`、`src-tauri/tauri.conf.json`、`updater_commands.rs` の updater 設定・署名・fallback を確認する
  - local test で固定できる設定検証と、実 release artifact が必要な検証を分ける
  - release note / manual verification docs への反映は、実際の release 作業とは別コミットにする

- [ ] P2 locale / copy contract 整理候補を別バッチで見直す
  - reader / settings / native menu / updater の表示文言が、同じ概念に対して異なるキー名や表現を使っていないか棚卸しする
  - `ja-locales` / `ui-language` 系 tests に、キー存在だけでなく reader/preview/external browser の意味差分を固定する assertion を追加する
  - copy 変更は UI regression になりやすいため、型整理や layout 変更とは混ぜない

- [ ] P0 provider / sync flow boundary 整理候補を別バッチで見直す
  - `sync_flow.rs` / `sync_scheduler.rs` / provider traits / greader provider の責務を、provider adapter と app sync orchestration に分けて棚卸しする
  - pending mutation / sync state / account sync status はデータ整合性に関わるため、UI sync feedback の型整理とは混ぜない
  - network error / auth error / rate limit など失敗種別は domain error contract の test を先に固定する

- [ ] P1 feed content privacy hardening 候補を別バッチで設計する
  - `docs/feed-content-privacy.md` の方針に沿って、reader mode remote image / frame / sanitizer version の実測観点を整理する
  - CSP や sanitizer を一括で締めず、provider compatibility と Web Preview 影響を分けて検証する
  - privacy mode や tracking pixel 対策を入れる場合は、settings UI と Rust sanitizer の境界を別々に扱う

- [ ] P1 runtime utility contract 整理候補を別バッチで見直す
  - clipboard / window events / badge / always-on-top / window chrome の runtime wrapper を、Tauri runtime あり/なしの fallback contract として棚卸しする
  - dev/browser tests で固定できる fallback と packaged app manual verification が必要な挙動を分ける
  - capability JSON の permission 変更は runtime wrapper 整理とは別コミットにする

- [ ] P2 scripts dispatch contract 整理候補を別バッチで見直す
  - `tauri-cli-dispatch.ts` / `windows-command-dispatch.ts` / `windows-dispatch.ts` の WSL/Windows path/env handling を test fixture と実行 contract に分ける
  - seed dev DB script は安全確認・backup・process check を優先し、dispatch helper の refactor と混ぜない
  - CI で拾える dry-run test とローカル実機検証が必要な path conversion を分ける

- [ ] P2 GitHub workflow / issue template 整理候補を別バッチで見直す
  - `.github/workflows/*` と issue templates の label / release-readiness / manual-verification 表現を、運用ラベルの source of truth に揃える
  - labeler config と PR insights の自動付与は既存運用に影響するため、CI workflow 変更とは別バッチにする
  - release workflow の artifact matrix と updater signing は、docs 更新だけでなく実 release dry-run の観点を残す

- [ ] P2 reader context menu action 整理候補を別バッチで見直す
  - article item / article list background / feed / folder / smart view / account の context menu action を、action id と呼び出し hook の対応表として棚卸しする
  - mark all read / old unread read / open in browser / copy link は scope 判定が違うため、UI props 整理とは混ぜず action contract test を優先する
  - Base UI context menu の className や visual token 変更は別バッチにし、まずは既存 menu item の enabled/disabled 条件を固定する

- [ ] P2 reader focus navigation contract test 候補を別バッチで追加する
  - sidebar -> list -> article pane -> browser overlay の focus return を、keyboard event と selected target の契約として小さい test に分ける
  - `reader-focus` helper、article list keydown handler、sidebar controller の責務を混ぜず、復帰先ごとに fixture を作る
  - scroll / requestAnimationFrame / setTimeout の実装詳細は直接固定せず、最終的な active element と selected state を assertion にする

- [ ] P2 dev scenario runtime error surface 整理候補を別バッチで見直す
  - `src/dev/intent.ts` / `src/dev/scenario-runtime.ts` / scenario runner の error union と fallback message を、dev build 専用 contract として棚卸しする
  - command palette から scenario を実行する flow は UI toast と recent history に影響するため、runtime loader の型整理とは別 worker にする
  - dynamic import path や `import.meta.env.DEV` の分岐は bundler 依存があるため、unit test と dev app smoke を分ける

- [ ] P1 native menu checked state 同期候補を別バッチで検証する
  - `src-tauri/src/menu.rs` の check menu item toggle と frontend preference state が、view filter / sort unread / group by feed でズレないか確認する
  - menu action emit の contract test と、実 native menu の checked 表示確認を分ける
  - i18n label や shortcut 表示変更は locale/copy batch に残し、ここでは state sync と event ordering だけを見る

- [ ] P1 Rust domain error mapping test 候補を別バッチで追加する
  - `src-tauri/src/domain/error.rs` の reqwest / sqlite / provider error mapping を、ユーザー向け actionable message と internal kind の境界で固定する
  - DNS / timeout / auth / rate limit / malformed response を provider sync flow と混ぜず、domain error の pure test として追加する
  - copy の文面変更は locale/copy 扱いにし、ここでは error category と recovery guidance の有無を確認する

- [ ] P1 tag / mute settings contract 整理候補を別バッチで見直す
  - tag settings、reader tag list、article tag picker、mute settings の command/schema/hook/view contract を、tag と mute で分けて棚卸しする
  - `tag-color-picker` や tag chip の visual token 変更は避け、まずは create/rename/delete と count 更新のデータ契約を固定する
  - mute keyword scope と article filtering は reader 表示に直結するため、settings form props local 化とは別バッチにする

- [ ] P0 credentials / keyring verification 候補を別バッチで整理する
  - `src-tauri/src/infra/keyring_store.rs` と account detail credentials editor の保存/更新/削除/restart 復元を、native keyring と dev credentials で分けて検証する
  - `.env` や実 credential 値は扱わず、存在確認・失敗種別・fallback 表示の contract test と packaged manual verification に分ける
  - FreshRSS connection verification と keyring 保存はユーザー影響が違うため、provider login flow の refactor とは混ぜない

- [ ] P1 browser webview history / shortcut contract 候補を別バッチで見直す
  - `src/lib/browser/webview-history.ts` と `src-tauri/src/browser_webview.rs` の back/forward/reload/open external availability を、frontend helper と native webview state で分けて棚卸しする
  - browser overlay shortcut は article shortcut と衝突しやすいため、`use-browser-overlay-shortcuts.ts` の event ownership を別に確認する
  - geometry/layout 数値は既存の browser geometry 候補に残し、ここでは history stack と action availability のみ扱う

- [ ] P1 sanitizer / article content migration 候補を別バッチで検証する
  - `src-tauri/src/infra/sanitizer.rs`、`sanitizer_version`、`article_content_text` migration の関係を、保存済み記事と新規同期記事で分けて確認する
  - privacy hardening とは別に、既存記事の再 sanitize 条件、検索用 text extraction、malformed HTML の fallback を test で固定する
  - CSP や remote image policy は privacy batch に残し、ここでは content normalization と migration compatibility に限定する

- [ ] P1 feed discovery / add feed pipeline 候補を別バッチで検証する
  - `src-tauri/src/infra/feed_discovery.rs`、`opml_commands.rs`、add feed dialog actions の URL normalization / discovered feed option / folder assignment を分けて確認する
  - discovery failure と submit failure は表示 copy と retry 導線が違うため、dialog view props 整理とは混ぜない
  - 実 network が必要な確認は manual verification に回し、parser/DTO/command response は fixture test で固定する

- [ ] P1 reader query / article scope matrix 整理候補を別バッチで見直す
  - `src/lib/reader/reader-query.ts` と `docs/reader-article-scope-matrix.md` の feed/folder/tag/recent/starred/unread scope が実装とズレていないか棚卸しする
  - article list sources / search / grouping / footer mode control は参照範囲が広いため、scope resolver の pure helper test を先に追加する
  - viewMode の clamp や recently viewed history 更新は UX 挙動に直結するため、UI props local 化とは混ぜない

- [ ] P3 Storybook fixture runtime 整理候補を別バッチで見直す
  - `src/components/storybook/story-tauri-runtime.ts`、`story-query-client-provider.tsx`、UI reference canvas の mock runtime を、component isolation と app-like scenario で分ける
  - story title / canvas taxonomy は既存 tests が見ているため、rename ではなく fixture provider の責務整理に限定する
  - Tauri runtime mock と dev scenario mock data は用途が違うため、同じ worker に混ぜない

- [ ] P1 platform abstraction contract 整理候補を別バッチで見直す
  - `src-tauri/src/platform/mod.rs`、`src/stores/platform-store.ts`、`src/constants/platform.ts` の OS 判定と capability 表現を、native と frontend で分けて棚卸しする
  - macOS / Windows / Linux の表示差は UI copy や shortcut label に波及するため、platform kind の source of truth を先に固定する
  - Tauri capability JSON や packaged app の permission 変更は runtime utility batch に残し、ここでは platform DTO と store contract に限定する

- [ ] P2 logging / debug trace contract 候補を別バッチで追加する
  - `src-tauri/src/commands/log_commands.rs`、`src/lib/debug-input-trace` 系、Debug HUD の trace 表示を、production log と dev-only trace で分ける
  - key input trace / browser geometry diagnostics / sync error logs は用途が違うため、同じ debug UI に詰め込まず source ごとに contract を固定する
  - file logging の保存先や rotation は packaged app 影響があるため、UI 表示整理とは別の manual verification にする

- [ ] P1 dialog / confirm flow contract 整理候補を別バッチで見直す
  - `app-confirm-dialog.tsx`、`confirm-dialog-view.tsx`、destructive dialog、feed/tag delete dialogs の variant / copy / action result contract を棚卸しする
  - shared dialog props と feature-specific submit state を混ぜず、confirm variant と destructive footer の contract test を先に補強する
  - modal stacking や Debug HUD collision は overlay 実機検証に残し、ここでは close/cancel/confirm の state transition に限定する

- [ ] P1 screen snapshot / first-screen readiness 候補を別バッチで検証する
  - `use-screen-snapshot.ts`、startup account/feed selection、SQLite first screen snapshot の復元条件を、startup read model と UI fallback で分けて確認する
  - app launch 直後の loading skeleton、last selected account、recent article history は UX 影響が大きいため、fixture test と app smoke を分ける
  - DB migration や sync-on-startup と同時に変えると原因が追いにくいため、first-screen readiness の契約だけを先に固定する

- [ ] P2 workspace pane / mobile recovery layout 候補を別バッチで見直す
  - `workspace-pane-layout.ts`、`app-layout.tsx`、mobile pane recovery の pane sizing / focus target / back affordance を棚卸しする
  - desktop 3-pane layout と mobile recovery は責務が違うため、responsive class 変更より先に layout state の contract test を追加する
  - browser overlay geometry と Debug HUD overlay は別バッチに残し、ここでは reader pane と settings modal の shell boundary に限定する

- [ ] P1 share / clipboard action contract 候補を別バッチで見直す
  - `src-tauri/src/commands/share_commands.rs`、`src/lib/runtime/clipboard.ts`、article share menu の copy/open action を、native command と frontend fallback で分けて棚卸しする
  - clipboard unavailable / permission denied / invalid URL はユーザー表示が違うため、toast copy 変更ではなく action result category の test を先に固定する
  - native share menu の表示や shortcut 変更は menu/copy batch に残し、ここでは copy link / open external / readonly field copy の実行契約に限定する

- [ ] P2 article retention / cleanup candidate 候補を別バッチで追加する
  - `src/lib/articles/article-retention.ts` と subscription review candidates の stale/no unread/no stars 判定を、retention policy と cleanup recommendation で分ける
  - feed cleanup page の decision flow は subscriptions index と重なるため、まずは pure helper の boundary test に限定する
  - 実データ削除や bulk action は destructive flow に関わるため、confirm dialog batch と同時に変更しない

- [ ] P1 feed tree drag/drop interaction contract 候補を別バッチで見直す
  - `feed-tree-drag-session.ts`、drop target、hover target、folder flow の drag outcome を、pointer session と repository update action で分けて棚卸しする
  - drag overlay motion や visual token は motion/browser 実機検証に残し、ここでは valid/invalid drop target と folder assignment result を固定する
  - touch/mobile drag は desktop pointer drag と前提が違うため、mobile recovery layout とは別の manual verification にする

- [ ] P1 provider normalizer / account DTO contract 候補を別バッチで検証する
  - `src-tauri/src/infra/provider/normalizer.rs`、provider traits、account DTO schema の display name / icon URL / capability flags を対応表で確認する
  - FreshRSS / GReader / local provider は認証・検索対応・delta sync の前提が違うため、provider ごとに fixture を分ける
  - account settings UI の表示 copy 変更は含めず、provider response normalization と frontend schema compatibility に限定する

- [ ] P2 sidebar startup folder expansion 候補を別バッチで検証する
  - `use-sidebar-startup-folder-expansion.ts`、last selected account/feed/folder、folder selection feed filter の初期展開条件を整理する
  - startup sync や first-screen snapshot と同時に変えると原因が追いにくいため、sidebar tree state の pure/helper test を先に追加する
  - user-triggered folder toggle と startup restore は UX 意味が違うため、state transition を分けて固定する

- [ ] P0 account setup lock / session contract 候補を別バッチで見直す
  - `account-setup-session.types.ts`、add account controller、accounts nav の setup session lock を、wizard flow と settings navigation で分けて棚卸しする
  - duplicate submit / navigation away / failed credential verification はデータ破損につながるため、UI copy より先に state machine の境界を固定する
  - service picker の visual や provider icon 変更は含めず、setup session ownership と cancel/retry contract に限定する

- [ ] P2 mute settings reducer transition contract 候補を別バッチで追加する
  - `src/components/settings/mute-settings.tsx` 周辺で add / edit / delete modal state transition と draft reset の契約を focused test で固定する
  - mute SQL/Rust match parity、auto mark preference guard、settings copy は別スコープに残す
