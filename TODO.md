# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
- 同じカテゴリ内は原則同時に走らせない。並列化する場合は `対象:` の write scope が重ならないことを確認する
- Rust DB/provider、reader UI/hooks、schema/storage、E2E/tooling は競合しやすいので別カテゴリを優先して組み合わせる

### Sync / App Runtime

- [ ] P2 sync command の selected account / all account branch を frontend manual sync と揃える
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src/hooks/use-sidebar-sync.ts`, `src/components/reader/sidebar-sync-button.tsx`
  - manual sync が selected account と all accounts のどちらを叩くか、disabled account / missing credentials / sync_on_wake off account をどう扱うかが frontend と Rust でずれやすい
  - selected account missing、disabled account、credential missing、partial failure、warning aggregation、progress event の integration test を追加する

- [ ] P2 sync progress payload の snake_case / camelCase contract を schema へ寄せる
  - 対象: `src/stores/ui-store.ts`, `src/__tests__/stores/ui-store.test.ts`, `src-tauri/src/commands/sync_commands.rs`
  - test で `ts-expect-error` を使って Rust/Tauri snake_case payload と UI camelCase state の違いを固定しており、schema なしだと payload drift に気づきにくい
  - runtime event schema、store adapter、invalid payload diagnostics、missing account id、unknown phase の contract test を追加する

- [ ] P3 integration test helper の `with_locked_db` を async boundary で使えない形にする
  - 対象: `src-tauri/tests/integration_test.rs`, `src-tauri/src/commands/sync_providers.rs`
  - lock helper が sync closure を受ける形でも、将来 async closure 化されると DB lock を await 越しに保持する事故が起きやすい
  - helper naming、lint/comment、drop-before-await fixture、read/write helper 分割の方針を固定する

- [ ] P1 sync-on-wake の visibilitychange listener を account snapshot / stale promise で固定する
  - 対象: `src/App.tsx`, `src/hooks/use-sidebar-sync.ts`, `src/lib/sync/startup-sync-storage.ts`
  - `visibilitychange` から sync-on-wake を fire-and-forget で起動しており、account list 更新や app unmount 後の late rejection が current UI state とずれやすい
  - hidden->visible 連打、account削除後の復帰、sync中の再復帰、late reject、listener cleanup の app test を追加する

### App Shell / Command Palette / Dev Intent

- [ ] P2 app shell lazy preload retry timer を route/session generation で guard する
  - 対象: `src/components/app-shell.tsx`, `src/__tests__/components/app-shell.test.tsx`
  - settings modal preload の失敗後に retry timer を持つため、modal close、component unmount、別 lazy chunk failure 後に古い retry が走る可能性がある
  - preload failure、retry success、unmount before retry、settings close/open、multiple lazy boundary failure の test を追加する

- [ ] P2 SettingsModalBoundary / LazyChunkBoundary error recovery を user action と telemetry に分ける
  - 対象: `src/components/app-shell.tsx`, `src/components/settings/settings-modal-view.tsx`
  - lazy chunk error は console.error と closeSettings に寄っており、user が再オープンできる状態か、diagnostics へ残すべき状態かが曖昧になっている
  - render throw、dynamic import reject、retry after close、settings state reset、toast/diagnostics 方針を固定する

- [ ] P2 Debug HUD copy failure を clipboard runtime category と統合する
  - 対象: `src/components/app-shell.tsx`, `src/lib/runtime/clipboard.ts`, `src/components/debug/*`
  - Debug HUD copy は独自 onError と console.error を持つため、article copy / share command と error category がずれると diagnostics 調査が分断される
  - invalid payload、large trace、clipboard unavailable、permission denied、sensitive target redaction の component test を追加する

- [ ] P2 command history localStorage normalization を resource existence と同期する
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`, `src/components/reader/hooks/command-palette/use-command-palette-data.ts`, `src/__tests__/hooks/use-command-history.test.ts`
  - command history は malformed JSON や巨大 payload を cleanup するが、feed/tag/article が削除済みになった履歴 entry の扱いは data hook 側に寄りやすい
  - deleted feed/tag/article、unknown action id、duplicate entries、oversized history、storage write failure の contract を追加する

- [ ] P2 dev scenario runner の fire-and-forget window resize / preview state を cancellation-aware にする
  - 対象: `src/dev/scenarios/helpers.ts`, `src/dev/use-dev-intent.ts`, `src/dev/scenarios/runner.ts`
  - dev scenario は `void applyDevWindowSize` や delayed preview state を持ち、scenario切替や app unmount 後に古い state を適用しやすい
  - scenario generation、window resize failure、delayed preview cancel、runner action error、toast dedupe の dev test を追加する

- [ ] P2 quality-baseline script の JSON extraction を tool version / malformed output で固定する
  - 対象: `scripts/quality-baseline.ts`, `mise.toml`, `TODO.md`
  - React Doctor / Knip の output から JSON を抜く script は tool output 形式変更に弱く、baseline drift 判定自体が壊れる可能性がある
  - malformed JSON、missing summary、version parse failure、full scan informational drift、diff scan hard failure の script test を追加する

- [ ] P2 similarity-report threshold validation を CLI help / mise task と同期する
  - 対象: `scripts/similarity-report.ts`, `mise.toml`, `TODO.md`
  - similarity threshold は script 内 allowlist と運用上の推奨値がずれると、別エージェントが低品質な類似候補を大量に積みやすい
  - allowed threshold、invalid threshold message、default threshold、report path、TODO追加時の優先度分類を固定する

### Reader UI / Account Settings

- [ ] P2 add feed dialog invalidation list を query key helper へ寄せる
  - 対象: `src/__tests__/hooks/use-add-feed-dialog-actions.test.tsx`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/lib/query/query-invalidation.ts`
  - add feed 後に複数 query key を個別 invalidation しており、新しい reader query が増えると片方だけ stale になりやすい
  - feeds/search/articles/tag counts/account summaries の invalidation helper を作り、failure aggregation と toast の順序を固定する

- [ ] P2 delete feed callback failure を mutation result と user-visible failure に分ける
  - 対象: `src/hooks/use-delete-feed.ts`, `src/__tests__/hooks/use-delete-feed.test.tsx`, `src/components/reader/feed-context-menu.tsx`
  - delete 自体の成功後に optional callback が throw した場合、mutation failure と UI cleanup failure のどちらとして扱うかが曖昧になっている
  - onSuccess throw、onError throw、invalidation reject、delete reject、dialog close callback の result contract を固定する

- [ ] P2 account detail query cache patch を optimistic update / server refetch の owner で分ける
  - 対象: `src/components/settings/account-detail/query-cache.ts`, `src/__tests__/components/account-detail-query-cache.test.ts`, `src/components/settings/hooks/account-detail/*`
  - account detail の cache patch helper は accounts list と selected account detail を触るため、optimistic update と server refetch の順序がずれると detail view だけ古い表示になりやすい
  - missing cache、append account、replace account、credentials update、delete account、refetch failure の contract を追加する

- [ ] P2 account detail credentials editor の cache invalidation / focus restore を stale account guard する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`, `src/__tests__/hooks/use-account-detail-credentials-editor.test.tsx`
  - credentials update 中に account switch / modal close が起きると、旧 account の success toast や focus restore が現在 detail に混ざる可能性がある
  - account switch during submit、modal close、server validation error、query invalidation reject、focus ref null の hook test を追加する

- [ ] P2 article auto-mark read timer を view mode / account switch / mutation callback ordering で固定する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`, `src/__tests__/hooks/use-article-auto-mark.test.tsx`
  - delayed auto-mark は timer、mutation callbacks、view mode を跨ぐため、article切替や account切替後に古い mutation callback が rollback を上書きしやすい
  - stale view mode、article switch、account switch、timer unavailable、onError ordering、multiple pending timers の test を追加する

- [ ] P2 browser overlay shortcuts listener ordering を keyboard global handler と parity 化する
  - 対象: `src/__tests__/hooks/use-browser-overlay-shortcuts.test.tsx`, `src/hooks/use-keyboard.ts`, `src/lib/actions.ts`
  - browser overlay close shortcut と global keyboard actions が別 listener で動くため、overlay中に背後の reader action が先に処理される可能性がある
  - capture/bubble ordering、defaultPrevented、Escape、Cmd+W、contenteditable target、listener cleanup の test を追加する

- [ ] P2 startup storage setup と command history storage setup の failure once policy を揃える
  - 対象: `tests/setup.ts`, `src/lib/sync/startup-sync-storage.ts`, `src/components/reader/hooks/command-palette/use-command-history.ts`
  - startup sync と command history はどちらも localStorage unavailable を warn するが、once cache / cleanup / test reset の挙動が別々になっている
  - getter throw、setItem throw、removeItem throw、warn once reset、test isolation の helperを共通化する

- [ ] P3 reader fixture helper の throw message を fixture id / owner file 付きにする
  - 対象: `tests/helpers/reader-fixtures.ts`, `tests/helpers/fixtures.ts`, `src/__tests__/components/*`
  - reader fixture helper は missing sample を throw するが、fixture id と owner が不足すると、大量 test のどの前提が壊れたか追いにくい
  - missing feed/article、read/unread/starred sample、account scoped sample、fixture owner label の error message を揃える

### Dev / Tooling / E2E / Test Helpers

- [ ] P2 Tauri dev Vite manager の process owner check を command line / cwd lookup failure で固定する
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - stale process 判定で command line と cwd を並列取得しており、片方だけ失敗した時に自 repo の Vite か foreign process か誤判定しやすい
  - commandLine failure、cwd failure、permission denied、deleted cwd、pnpm wrapper、foreign vite の safe failure test を追加する

- [ ] P2 Tauri dev Vite manager の port wait timeout message を process state snapshot 付きにする
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - port wait loop は timeout 後に失敗するが、どの process が port を握ったままか、SIGTERM 後に状態が変わったかが message から追いにくい
  - before/after process list、pid/cwd/command redaction、timeout interval、foreign process 保護の diagnostics test を追加する

- [ ] P2 Windows dispatch path conversion failure を tauri-cli / windows-command で同じ error shape にする
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/tauri-cli-dispatch.ts`, `scripts/windows-command-dispatch.ts`
  - WSL path conversion failure と spawn failure の message が entrypoint ごとに分かれており、CI/手元で同じ失敗でも原因比較がしづらい
  - cwd conversion failure、missing command、spawn ENOENT、stderr redaction、env passthrough の script test を追加する

- [ ] P2 story-tauri-runtime と dev mocks の global descriptor install/restore を共通化する
  - 対象: `src/components/storybook/story-tauri-runtime.ts`, `src/dev/mocks.ts`, `tests/helpers/tauri-runtime.ts`
  - `window.__TAURI_INTERNALS__` や dev mock globals の Object.defineProperty が Storybook/dev/test に分散しており、restore漏れや descriptor 差で runtime 判定が壊れやすい
  - install/restore helper、existing descriptor preservation、readonly descriptor、partial mock、double install の test を追加する

- [ ] P2 resolved dev intent loader の late result を current intent generation で guard する
  - 対象: `src/dev/use-resolved-dev-intent.ts`, `src/dev/use-dev-intent.ts`, `src/dev/intent.ts`
  - runtime dev options load が fire-and-forget で走るため、URL intent や env intent が切り替わった後に古い load result が現在 state へ混ざる可能性がある
  - rapid intent change、load failure、unmount、delayed scenario run、toast dedupe の hook test を追加する

- [ ] P2 dev intent parser の Result.unwrap usage を malformed runtime option の failure surface にする
  - 対象: `src/dev/intent.ts`, `src/dev/use-resolved-dev-intent.ts`, `src/__tests__/dev/intent.test.ts`
  - dev intent parser は Result.unwrap を複数使っており、parse済み前提が崩れた時に dev-only console warning なのか scenario skip なのか分かりにくい
  - malformed JSON、unknown scenario、invalid window size、runtime options unavailable、partial option の Result surface を固定する

- [ ] P2 Storybook index payload parser の URL id extraction を malformed iframe URL で固定する
  - 対象: `e2e/storybook/storybook-index-payload.ts`, `src/__tests__/components/storybook-explorer-organization.test.ts`
  - Storybook index helper は iframe URL の id query を必須にしており、Storybook 側の payload形式変更で organization test が壊れた時に原因が分かりにくい
  - missing id、empty id、duplicate id、encoded id、non-string story fields、Storybook version drift の helper test を追加する

- [ ] P2 E2E runtime error guard が expected console.error と real regression を分けられるようにする
  - 対象: `e2e/helpers/runtime-error-guard.spec.ts`, `e2e/app.spec.ts`, `tests/helpers/app-error.ts`
  - pageerror / console.error を拾う guard は有用だが、意図的 error fixture と本物の runtime regression が混ざると E2E failure の triage が遅れる
  - allowlist scope、test-local expected error、unhandled rejection、console.warn扱い、screenshot添付の policy を追加する

- [ ] P2 measurable box helper の zero-size diagnostics を locator / viewport 情報付きにする
  - 対象: `e2e/helpers/measurable-box.ts`, `e2e/storybook/update-toast.spec.ts`, `e2e/app.spec.ts`
  - measurable box assertion は UI overlap / invisible state を検出する一方、failure message が対象 locator や viewport を持たないと再現に時間がかかる
  - locator label、viewport、boundingBox null、zero width/height、detached element の diagnostics を追加する

- [ ] P2 Tauri mocks の unhandled command failure を schema coverage と接続する
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/tauri-mocks.test.ts`, `src/api/schemas/commands.ts`
  - mock command 未実装時は `Unhandled Tauri mock command` で落ちるが、schema coverage / Rust command registry と同期しないと test helper だけ古くなる
  - missing mock、extra mock、schema missing、null response command、Result error response の contract test を追加する

- [ ] P2 app-error test helper を user-visible / retryable / diagnostics categories へ広げる
  - 対象: `tests/helpers/app-error.ts`, `src/lib/ui-errors.ts`, `src/api/tauri-commands.ts`
  - helper は UserVisible / Retryable だけを期待しており、diagnostics-only や validation category が増えると各 test が ad hoc assertion になりやすい
  - user-visible、retryable、diagnostics-only、validation、runtime-unavailable の helperを揃える

- [ ] P2 deferred test helper の unhandled rejection prevention を cleanup contract にする
  - 対象: `tests/helpers/deferred.ts`, `src/__tests__/hooks/*`, `src/__tests__/components/*`
  - deferred helper は catch を付けて unhandled rejection を避けるが、未 resolve/reject のまま test が終わると leak を見落としやすい
  - pending deferred detection、afterEach cleanup、resolve after unmount、reject after unmount の helper test を追加する

- [ ] P2 async flush helper を microtask / macrotask / raf で名前を分ける
  - 対象: `tests/helpers/async-flush.ts`, `src/__tests__/**/*.test.tsx`
  - `flushAsync` が setTimeout(0) ベースだと、microtask を待ちたいだけの test と timer/RAF を待つ test が混ざって flake 原因になる
  - `flushMicrotasks`、`flushMacrotask`、`flushRaf`、fake timer compatible helper の使い分けを整える

- [ ] P3 release repo contract test の TOML parser を multiline / quoted value に強くする
  - 対象: `tests/release-repo-contract.test.ts`, `mise.toml`, `.github/workflows/*`
  - release contract test が簡易文字列抽出に寄ると、mise task や workflow の書式変更だけで false positive / false negative が出やすい
  - multiline task、quoted string、missing pnpm cache、workflow name変更、Node version drift の fixture test を追加する

- [ ] P3 fixture negative type tests を compile-time smoke gate として切り出す
  - 対象: `tests/helpers/fixtures.test.ts`, `tests/helpers/render-story.test.tsx`, `tsconfig.json`
  - `ts-expect-error` を runtime test 内に置くと、型 contract なのか runtime behavior なのか読み取りにくい
  - type-only smoke test、runtime fixture test、legacy escape の配置を分け、不要になった suppression を検出しやすくする

### Rust Provider / DB / Scheduler

- [ ] P1 account delete cascade と credentials/keyring cleanup の transaction 境界を固定する
  - 対象: `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/commands/account_commands.rs`, `src-tauri/src/infra/keyring_store.rs`
  - account delete は feeds/articles/folders/sync_state/pending mutations と OS keyring をまたぐため、DB transaction と外部 secret cleanup の失敗順序が曖昧だと復旧不能な半端状態になりやすい
  - feed/article/pending/sync_state 付き account 削除、keyring delete failure、missing account、再実行時 idempotency の integration test を追加する

- [ ] P2 sqlite account の unknown provider/status row を全体 failure にしない quarantine 方針を決める
  - 対象: `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/commands/account_commands.rs`, `src/components/settings/accounts-nav-view.tsx`
  - provider kind / verification status の未知値で `find_all` が落ちると、1件の破損 row が account 一覧全体を壊す可能性がある
  - unknown provider/status を含む一覧取得、detail 取得、削除または repair 導線、diagnostics 表示の contract test を追加する

- [ ] P2 sync_state scope key の raw/feed/local_feed collision を prefix policy で固定する
  - 対象: `src-tauri/src/repository/sync_state.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`, `src-tauri/src/commands/sync_providers.rs`
  - `feed:` prefix や raw scope key、local feed URL を同じ string column に入れているため、provider 由来 ID が prefix 風になると誤分類しやすい
  - `feed:` で始まる remote id、colon を含む local URL、raw key、account scoped isolation の round-trip test を追加する

- [ ] P2 sync_state retry metadata と feed/local validator metadata の owner を分ける
  - 対象: `src-tauri/src/repository/sync_state.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`, `src-tauri/src/service/sync_scheduler.rs`
  - 同じ sync_state row に scheduler retry、remote state、local validator を保存するため、upsert が別 owner の metadata を上書きしない保証が必要
  - rowid stability、scheduler retry 保存後の feed state 更新、成功時 reset、local validator 維持の regression test を追加する

- [ ] P2 scheduler interval change と active backoff の優先順位を固定する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src/components/settings/account-detail`
  - account sync interval を短縮/延長したとき、既存の backoff や `next_sync_at` を維持するか再計算するかが曖昧だと、設定変更直後の同期タイミングが読めなくなる
  - interval shorter/longer、disabled account、backoff 中、deleted account prune の unit/integration test を追加する

- [ ] P2 scheduler load failure の synthetic account warning を UI contract と揃える
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src/components/reader/hooks`, `src/stores`
  - scheduler warning は `account_id=scheduler` のような synthetic payload になり得るため、frontend が実 account として account detail へ遷移しない保証が必要
  - runtime warning 表示、クリック不可/詳細不可、toast/log 表示、同一 warning の重複抑制をテストする

- [ ] P2 invalid `next_retry_at` cleanup の save failure が retry loop にならないよう固定する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`
  - invalid timestamp を検出して cleanup する処理が storage failure で毎回同じ warning を出すと、scheduler loop が noise と負荷を増やす
  - invalid timestamp、cleanup save failure、warning dedupe、次回 sync 許可/抑止の contract test を追加する

- [ ] P2 local feed validator scope key を URL normalization / redirect policy と揃える
  - 対象: `src-tauri/src/repository/sync_state.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/http_client.rs`
  - local feed validator が feed URL string を key にすると、trailing slash、scheme、redirect 後 URL、query order の違いで validator が失われやすい
  - normalized URL、redirect final URL、query ordering、http/https 差、manual URL edit 後の validator 継承をテストする

- [ ] P2 tag name duplicate / case sensitivity の DB と frontend contract を揃える
  - 対象: `src-tauri/src/repository/tag.rs`, `src-tauri/src/commands/tag_commands.rs`, `src/hooks/use-tags.ts`
  - tag create/rename で whitespace trim や case-insensitive duplicate の扱いがずれると、UI 上は同名に見える tag が複数できる
  - create/rename の trim、case collision、color update、article assignment、delete 後 recreate の contract test を追加する

- [ ] P2 folder `sort_order` の concurrent create/delete gap を DB constraint と UI order で固定する
  - 対象: `src-tauri/src/infra/db/sqlite_folder.rs`, `src-tauri/src/commands/feed_commands.rs`, `src/components/reader/feed-tree`
  - folder create/delete/move が並ぶと `sort_order` の gap や duplicate が発生し、feed tree の順序が環境依存になりやすい
  - concurrent create、delete then create、move folder、account scoped order、OPML import 後の reorder test を追加する

- [ ] P2 unread count repair の source of truth を article/feed/sync 境界で一本化する
  - 対象: `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/commands/sync_providers.rs`
  - mark read、sync repair、feed delete、pending mutation replay が別々に count を更新すると、sidebar と article list の unread count がずれやすい
  - single article read、bulk mark read、sync reconcile、feed delete、pending mutation failure 後の count repair test を追加する

- [ ] P2 migration schema_version と restored database recovery を upgrade/downgrade contract にする
  - 対象: `src-tauri/src/infra/db/migration.rs`, `src-tauri/src/infra/db/connection.rs`, `src-tauri/tests`
  - future schema version、途中失敗、backup cleanup、downgrade 起動時の挙動が曖昧だと release rollback 時にデータ破損扱いになりやすい
  - future version、failed migration restore、backup file cleanup、downgrade error message、再実行 idempotency の integration test を追加する

- [ ] P2 preference repository の unknown key retention と frontend cleanup policy を揃える
  - 対象: `src-tauri/src/infra/db/sqlite_preference.rs`, `src/schemas/preferences.ts`, `src/components/settings`
  - frontend schema にない preference key を backend が保持するのか cleanup するのか決めないと、古い設定や実験フラグが UI 保存時に消える可能性がある
  - unknown key round-trip、known key update、schema migration、settings save 後の retention/cleanup contract test を追加する

- [ ] P3 `DomainError` retryable classification を provider boundary と scheduler backoff で snapshot 化する
  - 対象: `src-tauri/src/domain/error.rs`, `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/commands/sync_providers.rs`
  - network/rate-limit/auth/sqlite/schema error の retryable 判定が provider と scheduler でずれると、再試行すべき失敗が止まるか、止めるべき失敗が繰り返される
  - auth nonretryable、network retryable、rate-limit retry-after、sqlite nonretryable、malformed provider payload の snapshot test を追加する

- [ ] P3 repository fixture builder を account/feed/article/tag ごとに最小化する
  - 対象: `src-tauri/tests`, `src-tauri/src/infra/db/*_test.rs`
  - DB test fixture が ad hoc に増えると、account id や remote id、sort_order、timestamps の前提がテストごとに揺れて regression の原因を追いにくい
  - account/feed/article/tag/pending mutation の最小 fixture builder と、明示的に壊れた row を作る corruption helper を分ける

### Query / Store / Browser Runtime

- [ ] P1 query invalidation fire-and-forget の failure surface を user action 別に固定する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/use-delete-feed.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - `invalidateQueryKeysLogOnly` は failure を console/diagnostics へ寄せるため、delete/add/sync の成功 toast 後に stale cache が残っても user-visible failure になりにくい
  - delete feed、add feed、sync completed、tag update、article mutation の invalidation failure を action owner ごとに log-only / toast / retryable に分類する

- [ ] P2 query key account normalization を `null` / blank / deleted account で統一する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/create-query.ts`, `src/hooks/use-feeds.ts`, `src/hooks/use-articles.ts`
  - query key helper と各 hook が `null`、空文字、trim 済み account id を別々に扱うと、account switch 後に stale query が残りやすい
  - blank account id、deleted account id、subscriptions index account key、search query key、all account query の parity test を追加する

- [ ] P2 global action dispatcher の fire-and-forget error を action category 別 diagnostics に揃える
  - 対象: `src/lib/actions.ts`, `src/lib/runtime/diagnostics.ts`, `src/__tests__/lib/actions.test.ts`
  - `executeAction` は updater/browser/sync/window 操作を `void` で起動する箇所が多く、console.error だけだと native menu 起点の失敗が後から追いにくい
  - `sync-all`、`reload-webview`、`mouse-back`、`check-for-updates`、`toggle-fullscreen` の failure category と toast 有無を固定する

- [ ] P2 pending browser close action queue の overwrite / rapid key repeat policy を固定する
  - 対象: `src/lib/actions.ts`, `src/stores/ui-store.ts`, `src/components/reader/hooks/browser/use-browser-view-runtime.ts`
  - browser close in-flight 中の prev/next article/feed は単一 pending action に上書きされるため、rapid key repeat で user intent がどれだけ保持されるか曖昧になっている
  - first-wins / last-wins、flush order、close failure、overlay reopen、debug trace の unit test を追加する

- [ ] P2 manual sync cooldown を wall-clock drift / trigger failure / subscriber cleanup で固定する
  - 対象: `src/lib/sync/manual-sync.ts`, `src/hooks/use-sidebar-sync.ts`, `src/__tests__/lib/manual-sync.test.ts`
  - cooldown は module-level timer と listener set を持つため、OS sleep、clock rollback、subscriber throw、test reset 漏れで UI の sync button state がずれやすい
  - clock rollback、sleep 復帰、Retryable failure、UserVisible failure、listener throw、unsubscribe during emit の test を追加する

- [ ] P2 updater download session と toast action の stale session guard を強化する
  - 対象: `src/hooks/use-updater.ts`, `src/api/schemas/update-info.ts`, `src/__tests__/hooks/use-updater.test.tsx`
  - update download は module-level `downloadInFlight` と `activeDownloadSessionId` に依存するため、古い progress/ready event や manual retry が現在 toast を上書きしやすい
  - stale session progress、ready before progress、download failure then retry、restart failure、listener dispose 後 event の hook test を追加する

- [ ] P2 updater startup check と manual check の shared in-flight result を caller 別 feedback に分ける
  - 対象: `src/hooks/use-updater.ts`, `src/lib/actions.ts`, `src/__tests__/hooks/use-updater.test.tsx`
  - startup check は silent failure、manual check は toast failure だが、同じ `checkInFlight` を共有するため、どちらの caller が結果を受け取るかで feedback が揺れやすい
  - startup+manual concurrent、manual+manual concurrent、startup failure、manual cancellation、runtime unavailable の test を追加する

- [ ] P2 reader focus retry generation を account/article switch と unmount cleanup で検証する
  - 対象: `src/lib/reader-focus.ts`, `src/components/reader/hooks/article-list/use-article-list-navigation.ts`, `src/__tests__/lib/reader-focus.test.ts`
  - focus retry は module-level generation と timeout を使うため、article switch や account switch 後に古い retry が別 row を focus する可能性がある
  - selected article deleted、account switch、sidebar smart view switch、unmount cleanup、requestAnimationFrame throw の test を追加する

- [ ] P2 window event binding cleanup を partial registration failure / duplicate binding で固定する
  - 対象: `src/lib/window/window-events.ts`, `src/hooks/use-keyboard.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - 複数 event listener をまとめて登録する helper は途中失敗時に cleanup するが、duplicate binding や remove failure の挙動が contract 化されていない
  - addEventListener throw、removeEventListener throw、duplicate listener、capture option mismatch、cleanup twice の test を追加する

- [ ] P2 browser webview bounds sync の listener-ready timeout と ResizeObserver storm を latest-only にする
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - listener ready 待ち、resize event、ResizeObserver が並ぶと、古い URL の resize が現在 URL の native webview に適用される可能性がある
  - listener timeout、rapid resize、URL switch during wait、ResizeObserver unavailable、cleanup after reject の hook test を追加する

- [ ] P2 browser webview focus-after-create failure を state applied / surface failure に分ける
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-sync.ts`, `src/components/reader/browser-webview-state.ts`
  - create 成功後に focus だけ失敗した場合、browser state は適用済みなのに surface failure を出すため、retry/close の UX が不明瞭になりやすい
  - create success + focus failure、missing webview after focus、state apply skipped、pending bounds flush failure の contract test を追加する

- [ ] P2 subscriptions index の review clock interval を page visibility / fake timer contract にする
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/subscriptions/subscription-review-candidates.ts`
  - 1時間 interval で review status を更新するため、長時間 sleep 復帰や background tab で stale review labels が残りやすい
  - sleep 復帰、visibilitychange、fake timer、unmount cleanup、timezone/day boundary の component test を追加する

- [ ] P2 subscriptions index delete dialog の selected account/feed drift を mutation result と揃える
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/hooks/use-delete-feed.ts`
  - delete dialog を開いた後に account switch や feed list refetch が入ると、dialog target と current rows の整合性が崩れやすい
  - account switch while dialog open、feed deleted by refetch、delete pending中の close、mutation success後の selected row restore をテストする

- [ ] P2 subscriptions index return state の account scope と scroll restore を schema 化する
  - 対象: `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions-index/use-subscriptions-index-state.ts`, `src/stores/ui-store.ts`
  - return state は account id、selected feed、expanded groups、scrollTop を含むため、別 account に復帰した時の discard/restore ルールがずれやすい
  - account mismatch、deleted feed、collapsed group、negative scrollTop、large scrollTop、empty kept/deferred ids の test を追加する

- [ ] P2 UI store toast timer と persistent toast の競合を update/dialog toast で固定する
  - 対象: `src/stores/ui-store.ts`, `src/components/app-shell.tsx`, `src/hooks/use-updater.ts`
  - toast は module-level timer を持つため、persistent update toast と通常 toast が連続すると auto dismiss timer が古い toast を消す可能性がある
  - persistent toast後の通常 toast、通常 toast後のpersistent toast、clearToast、action click、store reset の test を追加する

- [ ] P2 UI store `handleAccountDeleted` の settings/account setup/browser state cleanup を contract 化する
  - 対象: `src/stores/ui-store.ts`, `src/components/settings`, `src/components/reader/hooks/browser`
  - account delete 時に selected account、settings detail、account setup session、browser state を同時に更新するため、どれかだけ古い account を参照しやすい
  - selected account delete、settings account delete、setup session account delete、browser open account delete、remaining account fallback の store test を追加する

- [ ] P2 preferences store の latest-only persist failure と optimistic UI rollback 方針を明文化する
  - 対象: `src/stores/preferences-store.ts`, `src/schemas/preferences.ts`, `src/__tests__/stores/preferences-store.test.ts`
  - preference save は optimistic UI を維持しつつ latest failure のみ toast するため、古い失敗を無視する方針と rollback しない方針を contract test で固定する必要がある
  - rapid same-key update、older failure ignored、latest failure toast、sync success after failure、unknown key passthrough の test を追加する

- [ ] P2 theme view transition cleanup を reduced-motion / thrown transition / late finished で固定する
  - 対象: `src/stores/preferences-store.ts`, `src/__tests__/lib/theme-appearance-state.test.ts`
  - `document.startViewTransition` と root class mutation は React 外の副作用なので、throw や late `finished` で transition class が残ると全画面表示に影響する
  - reduced motion、startViewTransition throw、finished reject、rapid theme switch、system theme listener cleanup の test を追加する

- [ ] P2 language preference apply failure を i18n runtime unavailable と settings toast 方針で固定する
  - 対象: `src/stores/preferences-store.ts`, `src/lib/ui/ui-language.ts`, `src/components/settings`
  - `i18n.changeLanguage` は fire-and-forget で失敗を console に寄せるため、保存成功だが UI language 未適用の状態が user に見えにくい
  - navigator.language throw、changeLanguage reject、unsupported language、backend save success/apply failure、reload後 fallback の test を追加する

- [ ] P3 query invalidation target matrix を repo contract test で drift 検出する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/__tests__/lib/query-invalidation.test.ts`, `src/__tests__/config/repo-contracts.test.ts`
  - query root が増えた時に invalidation target へ入れ忘れると、機能追加時の stale cache が後から発覚しやすい
  - `QUERY_KEY_ROOTS` と feed/article/sync completed invalidation matrix の snapshot を作り、意図的に除外する key は理由付き allowlist にする

- [ ] P3 global store module-level runtime state の reset helper coverage を棚卸しする
  - 対象: `src/stores/ui-store.ts`, `src/stores/preferences-store.ts`, `src/lib/sync/manual-sync.ts`, `src/hooks/use-updater.ts`
  - module-level timer / in-flight promise / listener set が複数あり、test reset helper の漏れが別 test の flake として出やすい
  - toast timer、theme listener、preferences load promise、manual sync timer、update in-flight/download session の reset coverage を一覧化する

### Reader Content / Feed Discovery / Security

- [ ] P1 `ArticleContentView` の sanitized HTML brand 境界を runtime schema と repo contract で固定する
  - 対象: `src/components/reader/article-content-view.tsx`, `src/lib/content/html.ts`, `src/api/schemas/article.ts`, `src/__tests__/components/article-content-view.test.tsx`
  - `dangerouslySetInnerHTML` は `SanitizedArticleHtml` brand に依存しており、DTO 以外の string helper が広がると sanitizer boundary を迂回しやすい
  - `fromSanitizedArticleHtmlDto` 経由のみを原則にし、legacy test helper、mock data、article DTO schema、repo contract で unsafe string 流入を検出する

- [ ] P1 Rust sanitizer version bump と saved article repair の release gate を作る
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - sanitizer policy を変えても `SANITIZER_VERSION` bump や repair path を忘れると、保存済み article が古い HTML policy のまま表示される
  - allowed tag/attribute 変更、version bump 漏れ、repair batch limit、repair failure retry、partial repair 後の起動の integration test を追加する

- [ ] P1 reader content privacy policy の frontend post-process を sanitizer contract と同期する
  - 対象: `src/lib/content/html.ts`, `src-tauri/src/infra/sanitizer.rs`, `src/__tests__/lib/html.test.ts`
  - Rust sanitizer 後に React 側で `referrerpolicy` や `rel` を付け直しているため、片側だけ変更されると link/image privacy contract が崩れやすい
  - `a[href]`、`img[src]`、`picture/source`、malformed HTML、DOMParser unavailable、already-set rel/referrerpolicy の parity test を追加する

- [ ] P1 feed discovery SSRF guard を DNS rebinding / redirect / base tag で再検証する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/commands/feed_commands.rs`, `src/__tests__/components/add-feed-dialog.test.tsx`
  - discovery は initial URL と redirect URL の private host を検証するが、DNS rebinding、same-origin `<base>`、protocol-relative feed URL の扱いが security boundary になっている
  - public-to-private DNS、HTTPS->HTTP downgrade、same-origin base、cross-origin base ignore、protocol-relative URL、IPv6/private range の test を追加する

- [ ] P1 OPML import URL validation を discovery URL validation と同じ private host policy に寄せる
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/opml.rs`
  - OPML import と feed discovery が別々に private host 判定を持つため、一方だけ IPv6/localhost/encoded host の扱いが抜ける可能性がある
  - localhost、127.0.0.1、IPv6 loopback、unique local、link-local、protocol-relative、punycode host の shared validation fixture を追加する

- [ ] P2 feed discovery body limit と content-type fallback の error category を user-visible に整理する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/commands/feed_commands.rs`, `src/components/reader/add-feed-dialog.tsx`
  - response body size や unsupported content-type が `Network` として返るため、入力 validation なのか transient network error なのか UI message が揺れやすい
  - content-length over limit、chunked over limit、empty content-type、HTML not feed、JSON feed、unsupported PDF/image の error mapping test を追加する

- [ ] P2 feed discovery simple HTML parser を malformed tag / encoded attribute で contract 化する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`
  - `<link>` 抽出は simple string parser なので、attribute quote、entity decode、`>` を含む値、duplicate attributes、upper-case tag で false negative/positive が出やすい
  - single/double/unquoted attribute、encoded `&amp;`、duplicate href、malformed close、uppercase LINK、`rel` token ordering の parser fixture を追加する

- [ ] P2 external URL schema の `mailto:` と native opener の redaction/validation contract を固定する
  - 対象: `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`, `src/components/reader/article-browser-actions.ts`
  - external opener は `mailto:` を許可し、browser webview/Reading List は http(s) のみなので、action ごとの URL policy が混ざると意図しない scheme を native に渡しやすい
  - `mailto:`、encoded newline、tab、uppercase scheme、userinfo URL、query token redaction、plugin opener error の test を追加する

- [ ] P2 `safeInvoke` response validation detail の secret redaction を nested issue と URL path で固定する
  - 対象: `src/api/tauri-commands.ts`, `src/__tests__/api/tauri-commands.test.ts`, `src/__tests__/api/command-args-validation.test.ts`
  - Zod issue detail を user-visible error に変換するため、path/message に URL token や credential-like value が入ると error toast に漏れる可能性がある
  - nested path、multiple issue truncation、URL userinfo、query token、Bearer/Basic header-like string、non-Error throwing value の redaction test を追加する

- [ ] P2 command args schema と Rust command validation の max length parity を contract 化する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/share_commands.rs`, `tests/tauri-command-return-contract.test.ts`
  - account/feed/folder/tag/clipboard/preference の上限値が TS と Rust に分散しており、片側だけ変えると frontend では通るが backend で落ちる入力が増える
  - `ACCOUNT_NAME_MAX_CHARS`、`FEED_TITLE_MAX_CHARS`、`FOLDER_NAME_MAX_CHARS`、`TAG_NAME_MAX_CHARS`、clipboard max、preference bytes の parity test を追加する

- [ ] P2 `stripHtmlTags` regex fallback を malformed entity / huge HTML で性能・安全性検証する
  - 対象: `src/lib/content/html.ts`, `src/__tests__/lib/html.test.ts`
  - DOMParser unavailable 時の regex fallback は tests/runtime fallback 用だが、巨大 HTML や未閉じタグで過剰に遅くなると diagnostics や preview 生成で詰まる
  - huge text、unterminated comment、unterminated script、malformed numeric entity、invalid code point、nested tags の performance-oriented test を追加する

- [ ] P2 duplicate leading label strip が media/link-only article を削らない contract を広げる
  - 対象: `src/lib/content/html.ts`, `src/components/reader/article-content-view.tsx`, `src/__tests__/lib/article-display.test.ts`
  - feed name と同じ先頭 label を削る処理は DOMParser に依存し、画像/link/video を含む先頭 block を誤って削ると本文の主 content が消える
  - link-only、image-only、picture/video、feed label + real content、全角区切り、DOMParser unavailable の fixture を追加する

- [ ] P2 article thumbnail URL normalization を sanitizer media URL policy と合わせる
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/article-content-view.tsx`, `src/__tests__/lib/article-view.test.ts`
  - content HTML 内 media は sanitizer が http(s) absolute のみ許可する一方、thumbnail は別 helper で normalize されるため、relative/data/private URL policy がずれやすい
  - relative URL、data URL、javascript URL、uppercase HTTP、userinfo URL、empty/whitespace URL の display contract を追加する

- [ ] P2 dev file credential store の lock/temp/permission failure を corruption recovery として固定する
  - 対象: `src-tauri/src/infra/keyring_store.rs`, `src-tauri/src/commands/account_commands.rs`, `src/__tests__/components/debug-settings.test.tsx`
  - dev credential JSON は file lock と temp rename を使うため、lock timeout、partial temp、permission failure、oversized JSON の復旧方針が重要になる
  - lock timeout、stale temp file、oversized store、invalid JSON、non-string value、chmod failure、rename failure の Rust test を追加する

- [ ] P2 seed-dev-db-from-prod の backup/staging cleanup を crash-safe contract にする
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - production DB copy は staging、backup、destination cleanup、install の順序に依存するため、途中失敗時の backup 残存と dev DB 復旧可能性を固定しておきたい
  - staging copy failure、backup copy failure、destination rm failure、install copy failure、staging cleanup failure、symlink race の script test を追加する

- [ ] P2 seed-dev-db-from-prod の running process / open handle detection を false positive/negative で固定する
  - 対象: `scripts/seed-dev-db-from-prod.ts`
  - app 起動中や DB handle open 中の copy を避ける guard は `pgrep` / `tasklist` / `lsof` に依存するため、platform ごとの失敗を安全側に倒す必要がある
  - pgrep permission error、process not found、tasklist localized output、lsof timeout、WAL/SHM handle、foreign process name collision の test を追加する

- [ ] P2 log directory opener の privacy checklist と diagnostics redaction を support workflow へ接続する
  - 対象: `src-tauri/src/commands/log_commands.rs`, `src/lib/runtime/diagnostics.ts`, `src/components/settings/debug-settings.tsx`
  - log dir を開く操作は user が app.log を共有する導線になるため、account/feed/article URL や local path の redaction policy が UI に見えないと事故りやすい
  - open failure、permission failure、privacy checklist 表示、URL/user path redaction、backup DB warning の component/Rust contract を追加する

- [ ] P2 runtime diagnostics redaction を structured detail / Error object / once key で強化する
  - 対象: `src/lib/runtime/diagnostics.ts`, `src/__tests__/lib/runtime/diagnostics.test.ts`
  - diagnostics は string、Error、message record を redaction するが、structured object の nested secret や once key 生成前後の redaction 差で漏れや重複が起きやすい
  - nested object、array detail、Error cause、Bearer/Basic、URL userinfo、redacted once key collision の test を追加する

- [ ] P2 `DomainError` URL redaction を punctuation / unicode / multiline token で固定する
  - 対象: `src-tauri/src/domain/error.rs`, `src-tauri/src/commands/dto.rs`
  - network error redaction は whitespace token 単位なので、括弧や句読点、複数 URL、unicode path、改行を含む provider error で secret が残らないか確認が必要
  - trailing punctuation、quoted URL、multiline URL、unicode path、multiple query params、fragment token、userinfo の Rust test を追加する

- [ ] P2 feed export OPML の XML escaping / stable ordering を import round-trip で固定する
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/opml.rs`
  - OPML export は account/feed/folder title と URL を XML に戻すため、特殊文字や同名 folder/feed の ordering が変わると import round-trip が不安定になる
  - `&<>"'` を含む title、空 site_url、同名 feed、folder sort_order tie、deleted folder reference、export->import round-trip の test を追加する

- [ ] P3 feed discovery User-Agent / timeout constants を provider HTTP defaults と重複しないよう整理する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/http_defaults.rs`
  - discovery client が独自 User-Agent と timeout を持つため、provider fetch と挙動がずれて問い合わせ先から別クライアント扱いされる可能性がある
  - shared defaults 化、timeout override、redirect limit、body limit、test fixture の owner を決める

- [ ] P3 content sanitizer fixtures を web-platform-ish corpus として追加する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/__tests__/lib/html.test.ts`, `tests/fixtures`
  - sanitizer の個別 unit test は増えているが、実 feed 由来の壊れた HTML / media / tracking link の corpus がないと regression を検出しづらい
  - malformed publisher HTML、tracking link、responsive image、video/source、code block、Japanese text、emoji/entity の fixture corpus を用意する

### Release / Native / Keyboard / I18n / A11y

- [ ] P1 Tauri capability の external opener permission scope を URL schema と同期する
  - 対象: `src-tauri/capabilities/default.json`, `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`
  - `opener:allow-open-url` と `browser-webview` が同じ default capability にいるため、URL validation と permission scope がずれると外部 opener surface が広がりやすい
  - `http:`、`https:`、`mailto:`、`file:`、custom scheme、encoded newline、userinfo URL の allow/deny contract と capability snapshot を追加する

- [ ] P1 CSP の `img-src http:` を reader privacy policy として明文化する
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - 記事画像のために `http:` image load を許すなら、mixed content / referrer / tracking image の扱いを sanitizer と frontend post-process で揃える必要がある
  - http image allowed/blocked 方針、`referrerpolicy`、tracking pixel、upgrade-insecure の扱い、CSP drift の repo contract test を追加する

- [ ] P1 updater release config が実 release workflow で必ず使われる gate を作る
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`, `.github/workflows/release.yml`, `tests/release-repo-contract.test.ts`
  - release override で updater artifact を有効化しているため、workflow が dev config だけで build すると latest.json / signature artifact が欠落しやすい
  - release command、updater endpoint、pubkey、artifact true、signed latest.json 生成、manual verification doc の contract を追加する

- [ ] P2 bundle identifier / version / updater endpoint の drift を release repo contract にする
  - 対象: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`
  - app identifier や version が package/Cargo/Tauri config でずれると updater、data dir、crash/support 手順が別アプリ扱いになりやすい
  - version parity、identifier stability、productName、GitHub release endpoint、pubkey placeholder 禁止を test で固定する

- [ ] P2 `browser-webview` capability の command surface を最小権限 snapshot にする
  - 対象: `src-tauri/capabilities/default.json`, `src/components/reader/hooks/browser`, `tests/release-repo-contract.test.ts`
  - browser webview が main webview と同じ permission 群を持つと、将来 browser 側 script や navigation surface が増えた時に影響範囲を判断しづらい
  - webview 別 capability、window commands、clipboard/opener permission、browser geometry command の必要最小権限を snapshot 化する

- [ ] P2 native menu action id と frontend `AppAction` の parity test を追加する
  - 対象: `src-tauri/src/menu.rs`, `src/lib/app-actions.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - native menu 経由の action と keyboard/global action が別定義なので、片方だけ rename/追加されると menu click が no-op になりやすい
  - menu id、resolved frontend action、unknown action payload、disabled runtime action、shortcut definition の parity test を追加する

- [ ] P2 native menu shortcut hint と user customizable shortcut の表示方針を固定する
  - 対象: `src-tauri/src/menu.rs`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`
  - menu label に default shortcut hint が含まれる一方、settings 側で shortcut を変更できるため、表示と実動作がずれる可能性がある
  - default-only 表示にするか runtime rebuild するか決め、custom shortcut 設定後の menu hint / keyboard action parity を検証する

- [ ] P2 native menu checked state と frontend preference migration の互換性を contract 化する
  - 対象: `src-tauri/src/menu.rs`, `src/schemas/preferences.ts`, `src/stores/preferences-store.ts`
  - sort/view/filter の menu checked state は preference payload に依存するため、旧 key や unknown value が混ざると UI と native menu の選択状態がずれやすい
  - old key migration、unknown sort、unchecked fallback、preference save failure、native menu rebuild の parity test を追加する

- [ ] P2 menu event payload diagnostics の redaction / truncation を固定する
  - 対象: `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`, `src/__tests__/hooks/use-menu-events.test.tsx`
  - menu event payload は `String(payload)` で diagnostics に載るため、長大 payload や URL/token を含む custom object が debug trace に漏れる可能性がある
  - throwing `toString`、long string、URL query token、object payload、unknown action、once key の redaction test を追加する

- [ ] P2 custom keyboard shortcut collision detection を settings save 前に入れる
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/schemas/preferences.ts`, `src/components/settings/shortcuts-settings.tsx`
  - 同じ key/modifier を複数 action に割り当てられると、global handler の探索順に依存して user intent と違う action が発火しやすい
  - duplicate shortcut、reserved shortcut、empty shortcut、platform modifier、reset-to-default の validation / UI contract を追加する

- [ ] P2 keyboard shortcut の platform modifier 表示と native accelerator 表記を同期する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src-tauri/src/menu.rs`, `src/components/settings/shortcuts-settings.tsx`
  - frontend は `⌘` などの表示、native menu は `CmdOrCtrl` などの accelerator 表記を使うため、macOS/Windows/Linux で説明と実動作がずれやすい
  - mac/win/linux display、CmdOrCtrl parsing、Option/Alt、Shift case、menu label hint の snapshot を追加する

- [ ] P2 global keyboard handler の modal/top-layer block 判定を store state 依存から contract 化する
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/settings`, `src/components/reader/command-palette.tsx`
  - settings/confirm/command palette の store flag だけで block すると、nested popover や future dialog が開いた時に背後の reader action が動く可能性がある
  - modal stack、popover open、confirm dialog、tag picker、Escape propagation、top-layer fallback の component test を追加する

- [ ] P2 IME composition 中の global keyboard / account pane shortcut 抑止を統一する
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - 一部 handler は `isComposing` を見るが global keyboard path は target 判定中心なので、日本語入力中に Vim-like shortcut が発火する risk がある
  - compositionstart/end、keydown `isComposing`、account pane route、sidebar route、contenteditable/input/textarea の test を追加する

- [ ] P2 i18n interpolation variables の locale 間 parity test を追加する
  - 対象: `src/lib/i18n-resources.ts`, `src/locales/en`, `src/locales/ja`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - key parity はあるが `{{count}}` 以外の interpolation variable が locale 間でずれると、片方の言語だけ runtime 表示が壊れやすい
  - `{{name}}`、`{{count}}`、nested namespace、unused variable、missing variable、escaped variable の parity check を追加する

- [ ] P2 component の `t()` usage と locale resource key の静的 drift 検出を追加する
  - 対象: `src/components`, `src/hooks`, `src/locales`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - resource key 同士は揃っていても、component 側の namespace/key typo は runtime で key 文字列表示になるまで検出しづらい
  - literal key usage scan、namespace prefix、dynamic key allowlist、test fixture key、missing key failure を contract 化する

- [ ] P2 Rust native menu i18n と frontend locale copy の意味 drift を検出する
  - 対象: `src-tauri/src/menu_i18n.rs`, `src/locales/en`, `src/locales/ja`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - native menu label は Rust 側、settings/shortcut help は frontend 側にあり、同じ action の日本語/英語表現が別々にずれやすい
  - menu action label、shortcut label、sync/settings/browser action copy、locale fallback の review snapshot を追加する

- [ ] P2 Storybook / test i18n setup が missing key を fail-fast にできる範囲を決める
  - 対象: `tests/helpers/i18n-setup.ts`, `.storybook`, `src/__tests__/components`
  - Storybook や component test で missing key が key 文字列のまま通ると、locale regression を視覚確認まで見逃しやすい
  - strict i18n wrapper、expected missing key allowlist、story smoke、test-local namespace setup の方針を追加する

- [ ] P2 dialog / popover の aria-hidden / inert stack contract を追加する
  - 対象: `src/components/ui/dialog.tsx`, `src/components/settings`, `src/components/reader/command-palette.tsx`
  - settings modal、confirm dialog、command palette、tag picker が重なると、背後要素の tab stop や screen reader exposure が復活する可能性がある
  - nested dialog、popover inside dialog、Escape ordering、focus trap、aria-hidden/inert、restore focus の a11y test を追加する

- [ ] P2 destructive confirm dialog の pending state / focus restore / thrown callback を固定する
  - 対象: `src/components/app-confirm-dialog.tsx`, `src/stores/ui-store.ts`, `src/hooks/use-delete-feed.ts`
  - confirm callback が async failure や throw を起こした時、dialog close、focus restore、toast 表示の owner が曖昧になりやすい
  - confirm throw、reject、double click、Escape during pending、target removed、focus ref null の component test を追加する

- [ ] P2 feed tree / account switcher / tag list の roving focus 境界を hidden/disabled row で固定する
  - 対象: `src/components/reader/feed-tree`, `src/components/reader/sidebar-account-switcher.tsx`, `src/components/reader/article-tag-picker-view.tsx`
  - keyboard navigation が hidden/disabled/deleted row を跨ぐと、focus と selected state が別 row を指す flake が起きやすい
  - hidden row、disabled account、deleted tag、collapsed folder、virtual row absence、Home/End/Arrow navigation の test を追加する

- [ ] P2 mobile single-pane layout の hidden pane tab order / focus restore を E2E contract にする
  - 対象: `e2e/app.spec.ts`, `src/components/app-shell.tsx`, `src/stores/ui-store.ts`
  - mobile single-pane で sidebar/settings/article/account pane を切り替える時、hidden pane に tab stop が残ると keyboard/a11y 操作が壊れる
  - pane switch、account setup、settings close、browser overlay close、back navigation、tab order snapshot の E2E を追加する

- [ ] P2 release workflow permission / action pinning の drift gate を増やす
  - 対象: `.github/workflows`, `tests/release-repo-contract.test.ts`
  - release/update artifact を扱う workflow は権限と action pinning の drift が supply-chain risk になりやすく、通常 lint だけでは検出しづらい
  - `permissions` minimum、third-party action SHA pinning、upload artifact scope、release token scope、cache key drift の contract を追加する

- [ ] P2 release artifact manual verification に updater signature / app identifier check を追加する
  - 対象: `docs/release-manual-verification.md`, `.codex/skills/release/SKILL.md`, `src-tauri/tauri.release.conf.json`
  - DMG 起動確認だけだと updater signature、bundle identifier、latest.json endpoint の不一致を見逃しやすい
  - latest.json signature、bundle id、codesign team、quarantine behavior、first launch log、update check smoke を release checklist に追加する

- [ ] P3 Japanese long-label screenshot smoke を settings / article toolbar / account detail に追加する
  - 対象: `e2e/storybook`, `src/locales/ja`, `src/components/settings`, `src/components/reader/article-toolbar-view.tsx`
  - 日本語 copy は英語より幅を取りやすく、compact toolbar や settings row で overflow / overlap を起こしても unit test では見えにくい
  - ja locale、narrow viewport、large text、button label overflow、account detail section、toolbar actions の screenshot smoke を追加する

- [ ] P3 visual regression smoke の対象を dense UI / a11y state に限定して追加する
  - 対象: `e2e/storybook`, `src/components/reader`, `src/components/settings`
  - 全画面 snapshot を増やすと保守が重いが、dense UI の overlap や hidden focus ring は通常の DOM assertion では検出しづらい
  - feed tree dense state、settings modal error state、command palette empty/result state、browser overlay error state、toast stack の小さな screenshot smoke を追加する

### Database / Updater / Window

- [ ] P1 Rust `u64` DTO を TS `number` で受ける schema の safe integer policy を決める
  - 対象: `src/api/schemas/database-info.ts`, `src/api/schemas/common.ts`, `src/api/schemas/*`, `src-tauri/src/commands/*`
  - DB size、count、timestamp usec など Rust 側が `u64` の値を frontend で `number` として扱うと、`Number.MAX_SAFE_INTEGER` 超過時に丸められる
  - safe integer 上限、string 化する DTO、BigInt を使わない範囲、Zod `safe()`、Rust test fixture の parity を整理する

- [ ] P1 database info DTO の `shm_size_bytes` / `total_size_bytes` parity を Rust/TS で固定する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/infra/db/connection.rs`, `src/api/schemas/database-info.ts`
  - Rust DTO は `shm_size_bytes` を 0 にしているが TS schema は `total = db + wal + shm` を要求するため、将来 SHM 計測を足した時に片側だけ変わりやすい
  - db/wal/shm missing、WAL enabled/disabled、file stat failure、total mismatch、large file size の command/schema contract test を追加する

- [ ] P1 database maintenance と updater install が共有する `syncing` flag の user-facing state を統一する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/commands/updater_commands.rs`, `src-tauri/src/commands/sync_commands.rs`, `src/hooks/use-updater.ts`
  - vacuum、sync、update install が同じ AtomicBool を使うため、UI には sync 中なのか maintenance/update 中なのか区別できない busy error が出やすい
  - vacuum中sync、sync中vacuum、install中sync、restart guard、busy message category、settings button disabled state の integration test を追加する

- [ ] P2 vacuum 実行後の WAL checkpoint / file size reporting を platform 差で固定する
  - 対象: `src-tauri/src/infra/db/connection.rs`, `src-tauri/src/commands/database_commands.rs`, `src/components/settings/debug-settings.tsx`
  - WAL mode のまま vacuum すると file size の見え方が platform / open connection に依存し、debug settings の DB size 表示が misleading になりやすい
  - WAL checkpoint 前後、VACUUM failure、reader connection open、Windows file lock、size refresh timing の Rust/component test を追加する

- [ ] P2 startup reconcile の article content / unread count repair を migration cost として計測する
  - 対象: `src-tauri/src/infra/db/connection.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`
  - DB open 後に content_text と unread_count を repair するため、大きい DB では起動時間や first window 表示に影響しやすい
  - large article set、empty content_text、mute keyword tableあり/なし、updated rows log、timeout/telemetry、batch化方針を追加する

- [ ] P2 updater semantic version policy を build metadata / malformed semver で固定する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/api/schemas/update-info.ts`, `src/__tests__/hooks/use-updater.test.ts`
  - semantic parse に失敗した場合は文字列比較へ落ちるため、`1.2.10` 風以外の version や build metadata で downgrade 判定が揺れやすい
  - `1.2.3+build`、`v1.2.3`、`1.2`、`1.2.3.4`、leading zero、malformed latest.json の policy test を追加する

- [ ] P2 updater pending handle clear と manual check/download の race を contract 化する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`, `src/__tests__/hooks/use-updater.test.ts`
  - check 開始時に pending update を clear するため、manual check と download が近接すると cached handle が消える/古くなる race が起きやすい
  - check中download、download中check、stale pending metadata、no update after cached update、retry after failure の Rust/frontend test を追加する

- [ ] P2 update event emit failure の log-only 方針を frontend session recovery と合わせる
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`, `src/lib/runtime/diagnostics.ts`
  - progress/ready event emit は log-only なので、listener dispose や window close で event が落ちても frontend が download state を回復できる必要がある
  - progress emit failure、ready emit failure、listener disposed、app restart before ready、session id mismatch、manual status refresh の test を追加する

- [ ] P2 restart app command の sync/update guard と user confirmation を整理する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/lib/actions.ts`, `src/hooks/use-updater.ts`, `src/components/app-confirm-dialog.tsx`
  - `restart_app` は sync/update guard を取るが、frontend 側の pending mutation / unsaved settings / browser open の確認と切り離れている
  - update ready restart、manual restart action、settings dirty state、sync running、install running、restart failure の UX contract を追加する

- [ ] P2 window runtime error normalization が object detail を潰しすぎないよう diagnostics contract を追加する
  - 対象: `src/lib/window/windows.ts`, `src/lib/actions.ts`, `src/lib/runtime/diagnostics.ts`
  - Tauri window API の object error は `Unknown window error` に丸められるため、runtime unavailable / permission denied / platform unsupported の区別が消えやすい
  - Error object、message getter throw、DOMException-like object、string error、permission error、unsupported platform の redacted diagnostics test を追加する

- [ ] P2 always-on-top / fullscreen window state の preference と runtime drift を検出する
  - 対象: `src/lib/window/windows.ts`, `src/hooks/use-window-always-on-top.ts`, `src/stores/preferences-store.ts`
  - preference 保存と native window state 適用が別々に失敗すると、settings 表示と実 window state がずれる可能性がある
  - set failure、get failure、startup apply、manual toggle、fullscreen conflict、runtime unavailable の hook/store test を追加する

- [ ] P2 window icon path の packaging / platform fallback を release smoke に入れる
  - 対象: `src/lib/window/windows.ts`, `src-tauri/tauri.conf.json`, `src-tauri/icons`, `tests/release-repo-contract.test.ts`
  - `setWindowIcon` は path 文字列を native に渡すため、packaged app と dev app で icon path 解決が違うと no-op/失敗になりやすい
  - dev path、packaged resource path、missing icon、Windows/macOS/Linux behavior、fallback log の release smoke を追加する

### Article List / Schema / Mute / Tags / Share

- [ ] P2 article list data hook の `sourcePlan` object dependency を stable key 化する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/components/reader/hooks/article-list/use-article-list-sources.ts`, `src/lib/articles/article-list.ts`
  - `sourcePlan` object 全体を dependency に含める memo があり、plan object の再生成で heavy filter/grouping が必要以上に走る risk がある
  - stable source key、query/filter dependency、recent order flag、folder/tag/search切替、large article fixture の render count test を追加する

- [ ] P2 article list retained article ids の lifetime / size cap を account switch で固定する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/components/reader/hooks/article-list/use-article-list-view-state.ts`, `src/lib/articles/article-list.ts`
  - retained ids は selection 維持に効く一方、account/feed/tag 切替後に古い id が残ると invisible article や memory growth の原因になりやすい
  - account switch、feed delete、tag delete、search clear、max retained ids、selected article deleted の test を追加する

- [ ] P2 article grouping の timezone / invalid date / stable order contract を強化する
  - 対象: `src/lib/articles/article-list.ts`, `src/__tests__/lib/article-list.test.ts`, `src/components/reader/article-list-body.tsx`
  - group by day/feed は published_at の date parsing と sort order に依存するため、invalid date や timezone boundary で見出し順が揺れやすい
  - invalid date、UTC/JST day boundary、same timestamp tie-breaker、missing feed name、locale date label の unit/component test を追加する

- [ ] P2 search result source order と unread sort の組み合わせを explicit policy にする
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/__tests__/lib/article-list.test.ts`
  - search results は source order を保持したい一方、unread sort や retained id が入ると search ranking と reader ordering が競合しやすい
  - search ranking preserved、unread sort enabled、retained selected article、missing search result article、folder scoped search の test を追加する

- [ ] P2 schema barrel export と per-schema test の追加漏れを repo contract で検出する
  - 対象: `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`, `src/__tests__/api/schemas`
  - 新しい schema file を足しても barrel export や schema-specific test を忘れると、runtime validation はあるが public import surface が揺れやすい
  - schema file inventory、barrel export、test file presence、intentional internal schema allowlist の repo contract を追加する

- [ ] P2 command schema registry と Rust command registry の missing/extra を双方向に検出する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/mod.rs`, `src/__tests__/api/command-args-validation.test.ts`
  - Tauri command の追加時に TS args schema か mock handler を忘れると、frontend call まで drift が見えない
  - Rust command list抽出、TS registry、mock registry、no-args command allowlist、deprecated command の parity test を追加する

- [ ] P2 generated schema / target artifact が repo scan に混ざらない tooling boundary を整える
  - 対象: `.gitignore`, `.ignore`, `mise.toml`, `scripts/quality-baseline.ts`
  - `src-tauri/target` や generated doc が local scan に混ざると、rg/quality script/agent audit の noise が増えて本来の risk を見落としやすい
  - tracked/untracked artifact inventory、rg ignore、quality baseline ignore、CI cleanup、generated schema source-of-truth を整理する

- [ ] P2 preferences API schema と app schema の duplicate source-of-truth を縮める
  - 対象: `src/api/schemas/preferences.ts`, `src/schemas/preferences.ts`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - command DTO schema と app preference schema が別ファイルにあるため、option追加時に DTO は通るが store/UI validation が落ちる drift が起きやすい
  - schema-derived type、default preference parity、unknown key、legacy value migration、settings option fixture の contract を追加する

- [ ] P2 platform info schema の OS/arch/runtime unavailable fallback を feature flags と連動させる
  - 対象: `src/api/schemas/platform-info.ts`, `src/lib/runtime/platform.ts`, `src/components/settings/debug-settings.tsx`
  - platform info が未知 OS/arch や runtime unavailable の時、browser embed、shortcut display、release support copy がばらばらに fallback しやすい
  - unknown OS、unknown arch、Tauri unavailable、mock parity、feature flag fallback、debug display の component test を追加する

- [ ] P2 webview history の max length / duplicate URL normalization を browser close queue と合わせる
  - 対象: `src/lib/browser/webview-history.ts`, `src/lib/actions.ts`, `src/components/reader/hooks/browser`
  - browser history と pending close action が別 state なので、rapid navigation や close/reopen で back/forward availability が stale になりやすい
  - duplicate URL、hash-only change、max length overflow、close during navigation、reopen same URL、history reset の test を追加する

- [ ] P2 browser webview command schema の geometry integer rounding を DPI/zoom で固定する
  - 対象: `src/api/schemas/browser-webview.ts`, `src/api/schemas/commands.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`
  - DOMRect は fractional pixel を返すが native webview bounds は integer に寄りやすく、DPI/zoom で 1px gap や overlap が出やすい
  - fractional rect、devicePixelRatio、zoom change、negative zero、min size、round/floor/ceil policy の contract test を追加する

- [ ] P2 feed integrity cleanup の dry-run / destructive run 差を UI warning と同期する
  - 対象: `src/api/schemas/feed-integrity.ts`, `src-tauri/src/commands/feed_commands.rs`, `src/components/settings/debug-settings.tsx`
  - orphan cleanup は destructive になり得るため、dry-run 結果と実 cleanup 結果が一致しない場合の user warning が必要になる
  - dry-run count、cleanup count mismatch、concurrent feed delete、DB busy、partial cleanup failure、undo不可 copy の contract を追加する

- [ ] P3 command/action naming の `sync-all` / `sync_all` / menu id 表記揺れを整理する
  - 対象: `src/lib/app-actions.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src-tauri/src/menu.rs`, `TODO.md`
  - kebab-case、snake_case、Rust menu id が混ざると search/grep 時に owner を見落としやすく、TODO や test 名も揺れやすい
  - action naming guide、conversion helper、test name convention、legacy alias allowlist を CLAUDE/rules か repo contract に追加する

- [ ] P3 article list hook type surface を controller params/result と pure helper types に分割する
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/hooks/article-list/*`, `src/lib/articles/article-list.ts`
  - article list の hook params/results と view props/helper types が近い場所に集まり、次の local props cleanup で衝突しやすい
  - controller contract、view-local props、pure helper input/output、test helper fixture type の配置方針を TODO から実装計画へ落とす

- [ ] P1 mute keyword の ASCII-only matching contract を UI copy / validation と同期する
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src/components/settings/mute-settings-view.tsx`, `src/api/schemas/mute-keyword.ts`
  - Rust 側は SQLite `lower()` と同じ ASCII-only 方針だが、UI が日本語/全角/Unicode case folding も効くように見えると user expectation と実挙動がずれる
  - ASCII case、全角英数、濁点、emoji、Turkish I、半角/全角スペース、UI help copy の contract を追加する

- [ ] P1 mute auto-mark-read の既存 article 一括更新を account scope / transaction cost で固定する
  - 対象: `src-tauri/src/commands/mute_keyword_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src/hooks/use-mute-keywords.ts`
  - keyword 作成・scope 変更・設定有効化時に全 account の既存 muted unread を mark read するため、大量記事や account 切替時に予想外の unread count 変化が起きやすい
  - selected account、all account、large dataset、partial failure、unread count repair、toast copy、query invalidation の integration test を追加する

- [ ] P2 mute keyword duplicate 判定を DB unique constraint / app validation / schema で一本化する
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/migrations/V12__mute_keywords.sql`, `src/components/settings/mute-settings.tsx`
  - repository は trim + ASCII lowercase + scope で duplicate 判定するが、DB constraint と UI validation が同じ粒度でなければ race や import で重複 row が入りやすい
  - trim差、case差、scope差、concurrent create、corrupt duplicate row、unique constraint message の contract test を追加する

- [ ] P2 mute keyword SQL clause builder の expression injection safety を repo contract にする
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/db/sqlite_tag.rs`
  - `build_mute_keyword_match_clause` は SQL expression 文字列を受け取るため、呼び出し元が user input を渡すと SQL injection boundary になり得る
  - allowed caller inventory、literal expression only、future caller lint、malformed expression fixture、query plan regression の contract を追加する

- [ ] P2 mute keyword invalid scope row を list failure にするか quarantine するか決める
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/commands/mute_keyword_commands.rs`, `src/components/settings/mute-settings.tsx`
  - DB に未知 scope が入ると `row_to_mute_keyword` で一覧全体が落ちるため、1件の破損 row が settings 全体の操作を妨げる可能性がある
  - unknown scope、delete broken row、repair UI、diagnostics-only warning、list partial success の方針を固定する

- [ ] P2 mute keyword invalidation が article/tag count/search result まで届くか matrix 化する
  - 対象: `src/hooks/use-mute-keywords.ts`, `src/lib/query/query-invalidation.ts`, `src/__tests__/hooks/use-mute-keywords.test.tsx`
  - mute keyword は visible article list、unread count、tag counts、search results に影響するが invalidation が log-only なので漏れが stale UI になりやすい
  - create/update/delete、auto-mark on/off、search active、tag view、folder view、old unread view の invalidation matrix を追加する

- [ ] P2 tag color validation の TS/Rust/schema/UI palette parity を固定する
  - 対象: `src-tauri/src/commands/tag_commands.rs`, `src/api/schemas/tag.ts`, `src/components/shared/tag-color-picker.tsx`
  - Rust は `#RRGGBB` を lowercase 保存し、TS schema は null/hex を許すため、empty string や uppercase、palette 外 color の扱いが UI と DB でずれやすい
  - uppercase、empty string、null、invalid length、palette外hex、rename時 color clear の contract test を追加する

- [ ] P2 tag rename duplicate 判定と `find_by_name COLLATE NOCASE` の Unicode 方針を明文化する
  - 対象: `src-tauri/src/commands/tag_commands.rs`, `src-tauri/src/infra/db/sqlite_tag.rs`, `src/components/settings/tags-settings.tsx`
  - tag duplicate は case-insensitive だが SQLite NOCASE は ASCII 寄りなので、日本語/全角/Unicode case の同一視範囲が user に伝わりにくい
  - ASCII case、全角英数、accent、Turkish I、trim、same-name rename、UI validation copy の test を追加する

- [ ] P2 tag article target validation と delete race を transaction boundary で固定する
  - 対象: `src-tauri/src/commands/tag_commands.rs`, `src-tauri/src/infra/db/sqlite_tag.rs`, `src/hooks/use-tags.ts`
  - article/tag existence を reader connection で確認した後に writer で insert/delete するため、確認後に tag/article が消える race では error shape が揺れやすい
  - article deleted after validation、tag deleted after validation、foreign key failure、double tag、double untag、idempotency の test を追加する

- [ ] P2 delete tag 後の selected state / article tag picker state cleanup を stale tag guard する
  - 対象: `src/hooks/use-tags.ts`, `src/components/reader/article-tag-picker-view.tsx`, `src/stores/ui-store.ts`
  - tag 削除時に selection は all に戻すが、tag picker や article tag chips 側に stale tag id が残ると次の assignment が失敗しやすい
  - selected tag delete、picker open中delete、article tags refetch、delete mutation failure、undo不可 toast の component/hook test を追加する

- [ ] P2 tag count query の account scope と muted article exclusion を reader filter と揃える
  - 対象: `src-tauri/src/infra/db/sqlite_tag.rs`, `src/hooks/use-tags.ts`, `src/components/reader/sidebar-tag-section.tsx`
  - tag count は account scope を受けるが mute keyword exclusion や read filter と意味がずれると sidebar count と article list が一致しなくなる
  - account all/selected、muted article、read/unread mode、deleted feed、orphan article_tag、count overflow の contract test を追加する

- [ ] P2 Reading List AppleScript URL validation と frontend `normalizeHttpCommandUrl` の差分をなくす
  - 対象: `src-tauri/src/commands/share_commands.rs`, `src/components/reader/article-browser-actions.ts`, `src/api/schemas/commands.ts`
  - Rust は `split_once("://")` で URL を判定し、frontend は URL normalize を使うため、credentials、spaces、unicode host、fragment/newline の扱いがずれやすい
  - username/password、space、tab、encoded newline、unicode host、long URL、uppercase scheme の parity test を追加する

- [ ] P2 Reading List AppleScript stderr / URL token redaction を diagnostics policy に接続する
  - 対象: `src-tauri/src/commands/share_commands.rs`, `src/lib/runtime/diagnostics.ts`, `src/components/reader/article-share-menu.tsx`
  - osascript 失敗時の stderr は log に載るため、URL query token や local path を含む provider URL が log へ残る可能性がある
  - stderr URL token、osascript not found、Safari unavailable、permission denied、long stderr truncation、user-visible message redaction の test を追加する

- [ ] P2 clipboard max length と share mailto max length の source-of-truth を揃える
  - 対象: `src-tauri/src/commands/share_commands.rs`, `src/lib/runtime/clipboard.ts`, `src/components/reader/article-share-menu.tsx`, `src/api/schemas/commands.ts`
  - clipboard は 2048 chars、mailto body は 2000 chars など上限が分散しており、article URL/title がどこで truncate/reject されるか分かりにくい
  - URL length、title length、emoji char count、surrogate pair、mailto encoded length、Rust/TS max parity の test を追加する

- [ ] P2 share via email の `mailto:` body が article URL unavailable の時も opener policy と一致するか固定する
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`
  - menu trigger は `article.url` がないと disabled だが mailto builder は fallback body を持つため、将来 trigger条件が変わると URLなし mailto が送られる可能性がある
  - no URL article、empty title、long title、mailto encode、openExternalUrl reject、toast category の component test を追加する

- [ ] P2 article external browser error category と clipboard error category の taxonomy を共通化する
  - 対象: `src/components/reader/article-browser-actions.ts`, `src/lib/runtime/clipboard.ts`, `src/lib/ui-errors.ts`
  - runtime unavailable / permission denied / invalid url / invalid text の分類が複数箇所にあり、copy/open/reading list で同じ error が違う toast になりやすい
  - shared classifier、category locale key、unknown command、plugin unavailable、permission denied、validation failure の parity test を追加する

- [ ] P2 `open_in_browser` background mode の macOS-only fallback と platform info contract を固定する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/api/schemas/platform-info.ts`, `src/components/settings/reading-settings-view.tsx`
  - background open は platform capability に依存するため、unsupported OS で preference が true の時に foreground open へ落ちることを UI と test で明確にする
  - macOS background success/failure、Windows/Linux fallback、platform info unknown、preference true/false、stderr redaction の Rust/frontend test を追加する

- [ ] P2 browser embed support header parser の CSP case/quote handling を fixture 化する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/__tests__/components/article-browser-actions.test.ts`
  - `frame-ancestors` 判定は header string parsing に依存するため、case、quoted source、multiple CSP、report-only header の扱いがずれると embed availability が誤表示になる
  - `Frame-Ancestors`、multiple directives、`'none'`、`*`、report-only、invalid header bytes、redirect response の test を追加する

- [ ] P2 article list pagination offset limit と UI infinite loading の failure handling を揃える
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/hooks/use-articles.ts`, `src/components/reader/hooks/article-list`
  - Rust は offset 10,000 / limit 200 を上限にするため、長期利用 DB の infinite scroll が上限に当たった時の UI 表示を決めておく必要がある
  - offset max、limit max、server reject、load more disabled、search/tag/folder view、old unread view の contract test を追加する

- [ ] P2 old unread bulk action の pending mutation support 判定を provider capability と同期する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/components/reader/hooks/feed-actions/use-old-unread-read-action.ts`
  - FreshRSS feed remote id が `feed/` の時だけ remote mutation 対象になるため、provider capability が増えた時に bulk mark read の同期対象漏れが起きやすい
  - local account、FreshRSS feed/ remote、FreshRSS non-feed remote、future provider、pending mutation dedupe、partial failure の test を追加する

- [ ] P2 article selection not-found state を browser-only fallback と account switch で固定する
  - 対象: `src/components/reader/hooks/article/use-article-view-selection.ts`, `src/components/reader/article-view-state.tsx`, `src/stores/ui-store.ts`
  - selectedArticleId が filteredArticles から消えた時に not-found / browser-only / empty summary が分岐するため、account/feed/tag/search 切替で一瞬誤 state が出やすい
  - account switch、feed delete、tag filter、browser mode with stale article、retained ids、refetch loading の component test を追加する

- [ ] P2 article view summary の latest article / feed count を muted/search/filter state と分離する
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/hooks/article/use-article-view-selection.ts`, `src/__tests__/lib/article-view.test.ts`
  - empty state summary は filteredArticles 由来なので、mute/search/filter 適用後に feed/folder/tag 全体 summary なのか visible summary なのか意味が曖昧になりやすい
  - muted article、search active、read filter、folder empty、tag empty、latest invalid date、summary label copy の test を追加する

- [ ] P2 article remote image URL policy と mail/share URL policy の差を明文化する
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/article-share-menu.tsx`, `src/components/reader/article-content-view.tsx`
  - remote image は https only、share/open は http(s)、mailto は mailto を使うため、URL policy が機能ごとに違う理由を test と copy に残さないと修正時に混ざりやすい
  - https image、http article URL、protocol-relative image、credential URL、mailto share、invalid URL toast の policy test を追加する

- [ ] P2 shared form controls の disabled/loading aria contract を destructive actions と同期する
  - 対象: `src/components/shared/form-action-buttons.tsx`, `src/components/shared/destructive-dialog-footer.tsx`, `src/components/shared/decision-button.tsx`
  - loading 中の destructive action button が aria-disabled / disabled / focusable のどれになるか統一しないと keyboard 操作で二重 submit しやすい
  - pending submit、double click、Enter key、Escape key、aria-busy、focus restore、tooltip label の shared component test を追加する

- [ ] P3 story export registry と shared component stories の required coverage を repo contract にする
  - 対象: `tests/helpers/storybook-story-export-registry.ts`, `src/components/shared/*.stories.tsx`, `src/__tests__/components/shared-stories.test.tsx`
  - shared component を追加しても story/test registry へ載せ忘れると、visual/a11y smoke の対象から漏れやすい
  - shared component inventory、story presence、required states、intentional no-story allowlist、renamed story id の contract を追加する

- [ ] P3 settings fixture と schema option fixture の owner を一本化する
  - 対象: `tests/helpers/settings-fixtures.ts`, `src/__tests__/components/settings-preference-option-schema-parity.test.tsx`, `src/schemas/preferences.ts`
  - settings option の fixture が test helper と schema test に分散すると、新しい preference 追加時に片方だけ更新されやすい
  - option id、default value、UI label、schema enum、legacy key、fixture owner の repo contract を追加する

- [ ] P3 migration file numbering / feature ownership を generated changelog で検出する
  - 対象: `src-tauri/migrations`, `tests/release-repo-contract.test.ts`
  - migration が増えるほど番号衝突、説明不足、feature owner 不明が起きやすく、DB rollback/backup 判断が遅れる
  - sequential numbering、duplicate version、description suffix、destructive migration marker、fixture DB upgrade smoke を追加する

### Feed / Folder / Storage / Settings Data

- [ ] P1 folder create の duplicate name / sort_order race を transaction contract にする
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`, `src/components/reader/feed-folder-flow.ts`
  - folder 作成は既存 folder list から duplicate と next sort_order を計算するため、同時作成や account switch で duplicate name / sort_order gap が入りやすい
  - concurrent create、same name different case、account deleted during create、max sort_order、transaction rollback、UI retry の test を追加する

- [ ] P1 feed folder optimistic update の rollback を multi-query / account switch で固定する
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/feed-tree`
  - feed folder 移動は全 feeds query を optimistic に書き換えるため、account 切替や refetch と重なると別 account の feed まで rollback される risk がある
  - multiple account feeds queries、account switch during mutate、folder deleted、feed deleted、rollback after refetch、success invalidation failure の test を追加する

- [ ] P2 update_feed_folder target validation の reader/writer connection race を整理する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - feed/folder 所属確認を reader connection で行った後に writer で更新するため、確認後に feed/folder/account が消えた場合の error 分類が揺れやすい
  - feed deleted after validation、folder deleted after validation、folder moved account、foreign key failure、classification fallback の Rust test を追加する

- [ ] P2 folder delete renumber と feed tree expanded state pruning を同じ account scope で固定する
  - 対象: `src-tauri/src/infra/db/sqlite_folder.rs`, `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/stores/ui-store.ts`
  - folder delete 後に DB sort_order は renumber されるが、localStorage の expanded folder ids や UI selection が stale folder を保持しやすい
  - deleted folder expanded、other account folder preserved、renumber rollback、selection fallback、restore_previous storage prune の test を追加する

- [ ] P2 folder name normalization の Unicode / whitespace 方針を tag/feed と揃える
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/domain/folder.rs`, `src/components/reader/folder-select-view.tsx`
  - folder name は trim + case-insensitive duplicate だが、Unicode whitespace や全角 case の扱いが tag/feed title と揃っていないと設定 UI で期待がずれる
  - full-width spaces、newline、emoji、accent、Turkish I、100文字境界、UI validation copy の test を追加する

- [ ] P2 createFolderIfNeeded の duplicate create retry / selectedFolderId drift を fixed point にする
  - 対象: `src/components/reader/feed-folder-flow.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/components/reader/add-feed-dialog.tsx`
  - add feed flow で folder 作成と feed 作成が連続するため、folder 作成成功後に feed 作成が失敗した時の再実行で duplicate folder を作りやすい
  - create folder success + add feed failure、retry same name、selectedFolderId changed、account switch、folder create validation error の flow test を追加する

- [ ] P2 storage key cleanup policy を settings data reset / private data export と接続する
  - 対象: `src/constants/storage.ts`, `src/schemas/storage.ts`, `src/components/settings/data-settings.tsx`
  - storage key の owner/cleanup policy はあるが、user clearable keys をどこで消すかが UI と結びついていないと command history や sidebar state が残り続ける
  - user-clearable cleanup、mirror-retained保持、startup-window-expiring cleanup、legacy alias cleanup、settings reset action の contract を追加する

- [ ] P2 sidebar expanded folders storage の oversized JSON cleanup failure を diagnostics 化する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/schemas/storage.ts`, `src/constants/storage.ts`
  - oversized / malformed storage は remove されるが remove/setItem failure は黙殺されるため、復旧不能な storage corruption が続いても見えにくい
  - getItem throw、removeItem throw、setItem quota、oversized payload、version mismatch、diagnostics once warning の test を追加する

- [ ] P2 sidebar expanded folders storage の account insertion order / pruning priority を明文化する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/schemas/storage.ts`
  - expanded folders storage は current account を先頭にして account 数上限で切るため、長期利用時にどの account の state が失われるかが実装依存になりやすい
  - LRU/current-first policy、100 account cap、500 folder cap、deleted account prune、same account overwrite の unit test を追加する

- [ ] P2 JSON parse helper の throwing/null boundary を CLAUDE rules と test で固定する
  - 対象: `src/schemas/parse.ts`, `src/schemas/storage.ts`, `src/api/tauri-commands.ts`, `CLAUDE.md`
  - `parseJsonWithSchema` と `parseJsonWithSchemaOrNull` が共存しており、runtime boundary で throwing helper を使うと unhandled exception になりやすい
  - localStorage recovery、IPC response validation、test fixture strict parse、invalid schema、malformed JSON、rule doc の usage matrix を追加する

- [ ] P2 date/time helper の invalid date fallback を UI copy ごとに整理する
  - 対象: `src/lib/datetime.ts`, `src/lib/articles/article-view.ts`, `src/lib/subscriptions/subscription-review-candidates.ts`
  - invalid date は `null`、元文字列、dash のいずれかに fallback しており、画面ごとに「壊れた日付を見せる/隠す」が揺れやすい
  - article date、subscription stale days、debug timestamp、settings sync time、invalid Date object、empty string、timezone boundary の policy test を追加する

- [ ] P2 `compareDateInputsAsc` の invalid date tie handling を sort helper から明示する
  - 対象: `src/lib/datetime.ts`, `src/lib/articles/article-list.ts`, `src/__tests__/lib/article-list.test.ts`
  - invalid date があると compare が 0 を返すため、sort が input order 依存になり、同じ dataset でも fetch order で UI 順が変わる可能性がある
  - invalid-left/right、both invalid、tie-breaker id/fetched_at、stable sort、large list の unit test を追加する

- [ ] P2 locale fallback の `Intl.DateTimeFormat.supportedLocalesOf` failure を i18n state と同期する
  - 対象: `src/lib/datetime.ts`, `src/lib/articles/article-view.ts`, `src/stores/preferences-store.ts`
  - locale helper は invalid locale を undefined/en-US へ落とすが、i18n language と日付 locale が別々に fallback すると UI が混在言語になりやすい
  - invalid locale、ja-JP、en-US、unsupported locale、language change failure、date formatter exception の contract test を追加する

- [ ] P2 feed website href の invalid URL fallback を opener validation と近づける
  - 対象: `src/lib/feed/feed.ts`, `src/components/shared/feed-detail-panel.tsx`, `src/components/reader/article-browser-actions.ts`
  - feed website action は site_url/feed_url を trim して返すだけなので、invalid URL は opener 側で落ちるまで UI 上は clickable に見える
  - invalid site_url valid feed_url、both invalid、mailto/feed URL、javascript URL、credential URL、host label fallback の component test を追加する

- [ ] P2 feed host label に invalid URL 文字列をそのまま出す方針を privacy review する
  - 対象: `src/lib/feed/feed.ts`, `src/components/shared/feed-favicon.tsx`, `src/components/shared/feed-detail-card.tsx`
  - host extraction が全 URL invalid の時に invalid value を label として返すため、長い URL や token 付き URL が UI に出る可能性がある
  - query token、userinfo、long invalid URL、newline、unicode host、redacted fallback label の policy test を追加する

- [ ] P2 data settings database size request revision と vacuum result の latest-only policy を明文化する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/components/settings/data-settings-view.tsx`
  - DB info fetch と vacuum result が同じ revision で競合するため、古い fetch が vacuum 後の size を上書きしない一方で、vacuum中の refresh UX が分かりにくい
  - initial fetch slow、vacuum before fetch returns、vacuum failure、unmount、reopen settings、latest-only toast の component test を追加する

- [ ] P2 data settings vacuum saved size 表示の negative / huge / stale value を固定する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/__tests__/components/use-data-settings-controller.test.ts`
  - saved size は `sizeBefore - after` から算出するため、WAL増加や stale `sizeBefore` で負値・巨大値になった時の表示方針が必要
  - negative saved、unknown sizeBefore、huge size、nonfinite size、formatBytes boundary、toast copy の test を追加する

- [ ] P2 data settings action 排他を settings-wide loading state と同期する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/components/settings/settings-loading-action-button.tsx`, `src/components/settings/data-settings-view.tsx`
  - vacuum と open log dir は相互排他だが、settings 全体の loading indicator や他 tab action とは独立しているため二重操作が残りやすい
  - vacuum中log dir、log dir中vacuum、settings close、settings tab switch、global loading state、button aria-busy の test を追加する

- [ ] P2 subscription review duplicate feed summary の last-wins policy を explicit にする
  - 対象: `src/lib/subscriptions/subscription-review-candidates.ts`, `src/__tests__/lib/subscription-review-candidates.test.ts`
  - feedArticleSummaries を Map に詰めるため duplicate feed_id は後勝ちになり、backend duplication や stale query merge 時に review reason が変わる
  - duplicate summary、missing summary、negative counts、nonfinite counts、deleted feed summary、diagnostics or deterministic sort の policy test を追加する

- [ ] P2 subscription review stale day calculation を future dates / DST / timezone で固定する
  - 対象: `src/lib/subscriptions/subscription-review-candidates.ts`, `src/lib/datetime.ts`
  - staleDays は local date-fns difference に依存し future date を 0 clamp するため、provider clock skew や timezone boundary で review candidate が変わりやすい
  - future latest_article_at、DST boundary、UTC/JST boundary、invalid date、exact 90 days、now injection の unit test を追加する

- [ ] P2 subscriptions return state の `expandedGroups` key namespace を filter/account と衝突しないようにする
  - 対象: `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions-index/use-subscriptions-index-state.ts`
  - return state の expandedGroups は plain record なので、filter名や folder/feed id が衝突すると別 view の開閉 state が混ざる可能性がある
  - account scoped key、filter scoped key、deleted group、malformed persisted return state、large group record の test を追加する

- [ ] P2 subscriptions return state scrollTop を layout generation / viewport height と結びつける
  - 対象: `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - return state の scrollTop は number だけなので、viewport サイズや filter 結果が変わると過大 scroll に復帰して空白/見失いが起きやすい
  - negative scroll、huge scroll、filter changed、account changed、viewport changed、target row deleted の restore test を追加する

- [ ] P2 settings action button の disabled-only feedback を destructive/data actions で補う
  - 対象: `src/components/settings/shared/settings-action-button.tsx`, `src/components/settings/data-settings-view.tsx`, `src/components/settings/account-detail/danger-zone-view.tsx`
  - destructive/data action が disabled の時に理由が UI に出ないと、sync/vacuum/update 中の操作不可が failure と誤認されやすい
  - disabled reason label、aria-describedby、busy state、tooltip/inline note、keyboard focus behavior の component test を追加する

- [ ] P3 storage constants の byte/entry caps を schema fixture と docs で棚卸しする
  - 対象: `src/constants/storage.ts`, `src/schemas/storage.ts`, `src/__tests__/constants/storage.test.ts`
  - storage cap が増えるほど「entry count」「entry length」「raw JSON bytes」のどれを守るか分かりにくくなり、cleanup の期待値が揺れやすい
  - command history cap、sidebar accounts cap、folders per account cap、raw JSON cap、legacy key cap の fixture table を追加する

- [ ] P3 data-size format constants と UI copy の binary/decimal unit 方針を固定する
  - 対象: `src/constants/data-size.ts`, `src/components/settings/hooks/use-data-settings-controller.ts`, `src/locales/*/settings.json`
  - `1024` ベースで `KB/MB` 表示しているため、KiB/MiB ではなく KB/MB と出す方針を決めないと support/debug copy が揺れる
  - 999B、1024B、1MiB、fraction digits、ja/en unit copy、negative/nonfinite の snapshot を追加する

### GReader / Sync Flow / Account Setup

- [ ] P1 GReader auth token / server URL redaction を error/log/debug 表示で固定する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/domain/error.rs`, `src/components/settings/account-connection-summary.tsx`
  - auth token は Debug で redacted されるが、HTTP/auth error message、server URL、ClientLogin response body が別経路で log/toast に出る可能性がある
  - auth failure、invalid header token、server URL userinfo、query token、response body token、debug settings/log dir copy の redaction test を追加する

- [ ] P1 GReader pagination continuation loop の incomplete sync recovery を sync_state と接続する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/repository/sync_state.rs`
  - continuation が繰り返す・page limit に到達する場合に Network error で止まるが、次回 sync で cursor を進める/戻す方針が曖昧だと feed が永久に stale になりやすい
  - repeated continuation、max pages、max stream ids、partial ids、cursor保存/破棄、次回 retry warning の integration test を追加する

- [ ] P1 GReader item timestamp usec の overflow / negative / future clock を cursor policy にする
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`
  - `timestampUsec` / updated / published から cursor を作るため、provider の異常値で since cursor が壊れると以降の delta sync が欠落しやすい
  - negative usec、i64 max近辺、future timestamp、missing timestamp、published fallback、cursor rollback の contract test を追加する

- [ ] P2 GReader label remote id normalization と folder duplicate policy を folder sync と揃える
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - label id を percent decode して display label に寄せるため、slash を含む label、同名 label、encoded Unicode で remote folder id と local folder が衝突しやすい
  - encoded slash、invalid percent、empty label、duplicate labels、Unicode label、existing local folder name collision の sync test を追加する

- [ ] P2 GReader unread count map の negative/duplicate entry policy を feed count repair と同期する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`
  - unread count response は HashMap 後勝ちで、negative count も i32 として入るため、provider 異常値で sidebar count が壊れる可能性がある
  - duplicate unread count、negative count、missing feed id、large count、unknown stream id、DB repair後の count parity test を追加する

- [ ] P2 GReader item mapping の missing origin / fallback stream id を skipped_entries diagnostics と同期する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src/lib/sync/sync-result-feedback.ts`
  - item に origin がない場合 fallback stream id がないと entry を捨てるため、provider payload 変化で記事欠落しても user には成功に見えやすい
  - missing origin、fallback stream idあり/なし、missing title/content/url、skipped_entries warning、sync result copy の test を追加する

- [ ] P2 provider metadata URL normalizer と frontend URL policy の差分を providerごとに fixture 化する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/lib/feed/feed.ts`, `src/components/shared/feed-favicon.tsx`
  - provider 側で site/icon/article URL を normalize し、frontend でも host/open policy を持つため、片側だけ URL を受け入れる状態が増えやすい
  - http/https、protocol-relative、relative URL、userinfo、unicode host、tracking query、icon URL の parity fixture を追加する

- [ ] P2 pending mutation invalid stored type を account sync 全体 failure にするか quarantine するか決める
  - 対象: `src-tauri/src/infra/db/sqlite_pending_mutation.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/commands/sync_providers.rs`
  - 1件の未知 mutation_type で `find_by_account` が落ちると、その account の全 sync が止まり、UI からは credential/network failure と区別しづらい
  - unknown type row、delete broken mutation、skip with warning、diagnostics、account detail repair action の方針を固定する

- [ ] P2 pending mutation push の per-mutation delete timing を remote partial failure で固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/repository/pending_mutation.rs`, `src-tauri/src/infra/provider/traits.rs`
  - pending mutation は1件ずつ push 成功後に削除するため、途中 failure で前半だけ remote 適用済みになるが、UI には partial push 状態が見えにくい
  - first success second failure、delete failure after push、duplicate retry、remote id missing、axis別 partial success の integration test を追加する

- [ ] P2 pending mutation created_at ordering を invalid date / same timestamp で deterministic にする
  - 対象: `src-tauri/src/infra/db/sqlite_pending_mutation.rs`, `src-tauri/src/repository/pending_mutation.rs`
  - `ORDER BY created_at` だけだと same timestamp や malformed timestamp で push order が DB 実装依存になり、read/star の最終状態が揺れやすい
  - same created_at、invalid created_at、id tie-breaker、legacy row、replacement insert の ordering test を追加する

- [ ] P2 pending mutation replacement SQL の dynamic placeholders を empty replacement set で守る
  - 対象: `src-tauri/src/infra/db/sqlite_pending_mutation.rs`, `src-tauri/src/repository/pending_mutation.rs`
  - replacement type list が将来空になる mutation type を足すと `IN ()` SQL になり得るため、新しい mutation axis 追加時の footgun になる
  - every mutation type replacement set、future mutation fixture、empty replacement guard、SQL string snapshot の unit test を追加する

- [ ] P2 sync_flow sanitizer repair batch が毎回同じ 500 件で詰まらない ordering を固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/sanitizer.rs`
  - outdated sanitized articles を 500 件だけ repair するため、失敗行や ordering が固定されないと毎回同じ記事で止まり続ける可能性がある
  - deterministic order、repair failure skip/stop、batch progress、version bump後複数起動、large DB の integration test を追加する

- [ ] P2 sync_flow Step 6 unread count recalc が sync 前 feeds snapshot に限定される影響を検証する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/commands/sync_providers.rs`
  - Step 4 前に取得した feeds に対して unread count を recalculation するため、sync 中に追加/削除された feed の count repair が漏れる可能性がある
  - remote subscription added、feed deleted during sync、folder move during sync、local feed added、post-sync feed list refresh の test を追加する

- [ ] P2 article search normalization と backend search SQL の Unicode/length parity を固定する
  - 対象: `src/hooks/use-articles.ts`, `src/components/reader/hooks/article-list/use-article-list-search.ts`, `src-tauri/src/commands/article_commands.rs`
  - frontend は NFKC + whitespace collapse + 128文字 cap を持つが、backend search 側の normalization と違うと日本語/全角検索で結果が揺れやすい
  - full-width text、combining mark、emoji、multiple spaces、128文字超、backend raw query cap の parity test を追加する

- [ ] P2 article search focus retry を search close / account switch / unmount で leak-free にする
  - 対象: `src/components/reader/hooks/article-list/use-article-list-search.ts`, `src/__tests__/components/use-article-list-search.test.tsx`
  - focus retry は RAF と timeout を併用するため、search close や account switch 後に古い focus が復活すると keyboard flow が乱れる
  - close before RAF、account switch before timeout、unmount cleanup、requestAnimationFrame unavailable、focus throws の test を追加する

- [ ] P2 article cache optimistic patch が account id 推定に失敗した時の fallback を明文化する
  - 対象: `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/hooks/article`
  - cached article の account id を feeds/accountArticles/starredArticles から推定するため、cache miss や stale feed cache では account scoped invalidation が漏れやすい
  - missing feed cache、article in multiple scoped queries、deleted feed、stale accountArticles、fallback all-account invalidation の test を追加する

- [ ] P2 article read/star mutation の optimistic insertIfMissing policy を mode/filter と同期する
  - 対象: `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/article-list-body.tsx`
  - read/star mutation が missing article を cache に挿入する場合、unread/starred/recent/search の query mode に合わない item が混ざる可能性がある
  - unread mode read=true、starred mode unstar、recent query insert、search query insert、tag query insert の cache contract を追加する

- [ ] P2 account setup session と credential store の partial create rollback を明文化する
  - 対象: `src-tauri/src/commands/account_commands.rs`, `src-tauri/src/infra/keyring_store.rs`, `src/lib/account/account-setup-session.types.ts`
  - account row 作成、credential 保存、connection verification の順序で failure すると account だけ残る/credential だけ残る半端状態になりやすい
  - DB insert success + keyring failure、keyring success + verification failure、retry create、delete orphan credential、setup session resume の integration test を追加する

- [ ] P2 account credential update の old credential retention / rollback 方針を keyring error で固定する
  - 対象: `src-tauri/src/commands/account_commands.rs`, `src-tauri/src/infra/keyring_store.rs`, `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`
  - credential update 失敗時に旧 credential を保持するのか消すのかが曖昧だと、次回 sync が auth failure になりやすい
  - update token failure、update password failure、test connection failure、old credential restore、cache/toast consistency の test を追加する

- [ ] P2 account selection fallback と query enabled state を deleted/disabled account で固定する
  - 対象: `src/lib/account/account-selection.ts`, `src/stores/ui-store.ts`, `src/hooks/use-accounts.ts`, `src/hooks/create-query.ts`
  - selected account が削除/disabled になった時に query enabled と selection fallback がずれると、deleted account の feeds/articles query が走り続ける
  - selected deleted、selected disabled、all accounts fallback、no accounts、account setup session active の hook/store test を追加する

- [ ] P2 sync progress event account id と account selection の stale mapping を UI adapter で検証する
  - 対象: `src/lib/sync/sync-progress-event.types.ts`, `src/stores/ui-store.ts`, `src/components/reader/sidebar-sync-feedback.ts`
  - sync progress は account id を含むが、進行中に account が rename/delete されると sidebar feedback が orphan progress を表示し続ける可能性がある
  - account rename、account delete、unknown account id、all-account sync、partial failure、progress completion cleanup の test を追加する

- [ ] P2 sync result feedback の warnings/errors aggregation を account/action owner 別に整理する
  - 対象: `src/lib/sync/sync-result-feedback.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src/api/schemas/sync-result.ts`
  - sync result の warnings/errors が account 単位と feed 単位で混ざると、toast が長くなり原因 account を特定しにくい
  - multiple accounts、same warning dedupe、feed-level error、credential error、scheduler warning、toast truncation の test を追加する

- [ ] P3 provider capability matrix を account kind 追加時の required tests として固定する
  - 対象: `src-tauri/src/domain/provider.rs`, `src-tauri/src/infra/provider/traits.rs`, `src/components/settings/add-account/services.ts`
  - provider kind が増えると remote state/folders/delta sync/background browser 等の capability 影響が広く、追加時に漏れが出やすい
  - capability snapshot、service picker option、credential fields、sync path selection、pending mutation support、settings copy の repo contract を追加する

- [ ] P3 sync/provider test fixture の HTTP response builder を status/header/body 別に標準化する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/tests`
  - provider tests が ad hoc response を作ると、rate-limit/auth/network/schema error の比較が難しくなる
  - status fixture、header fixture、JSON malformed fixture、pagination fixture、token redaction fixture の builder を用意する

### Browser WebView / Runtime Diagnostics

- [ ] P1 browser webview timeout fallback と late page-load finish の generation guard を強化する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src-tauri/src/browser_webview.rs`, `src/components/reader/hooks/browser`
  - timeout で tracker を clear した後に古い page-load Finished が来ると、closed/fallback 済み webview の state event が復活する可能性がある
  - timeout trigger、late Started/Finished、same URL reload、new URL before timeout、fallback emit failure、closed event ordering の Rust/frontend test を追加する

- [ ] P1 browser webview initialization script の user preference injection safety を contract 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/schemas/preferences.ts`, `src/components/settings/shortcuts-settings.tsx`
  - shortcut preference から initialization script の JSON/string を組み立てるため、quote/newline/control char が script boundary を壊さない保証が必要
  - shortcut with quote、newline、backslash、unicode、invalid binding、script JSON escaping、bridge installed sentinel の test を追加する

- [ ] P2 browser webview placeholder URL path の Windows-only navigation state を parity 化する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src-tauri/src/browser_webview.rs`, `src/components/reader/browser-webview-state.ts`
  - Windows では initial URL に `about:blank` を使うため、current_url と snapshot.url の比較が他 platform と違い、navigate skip/duplicate history が起きやすい
  - placeholder initial URL、navigate same target、about:blank page-load ignore、history back/forward、platform mock parity の test を追加する

- [ ] P2 browser webview tracker history の reload/back/forward 判定を redirect URL で固定する
  - 対象: `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/browser/webview-history.ts`
  - start URL と finish URL が redirect で違う場合、pending_navigation と history_index が想定外に書き換わり back/forward availability が壊れやすい
  - redirect on new navigation、redirect on back、redirect on reload、same URL with fragment、canonicalized URL の tracker test を追加する

- [ ] P2 browser webview focus restore failure を close flow / pending action queue と同期する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/actions.ts`, `src/components/reader/hooks/browser/use-browser-view-runtime.ts`
  - close 時に host window focus restore が失敗しても close を継続するため、pending next/prev action が keyboard focus 不在のまま流れる可能性がある
  - focus host failure、webview close failure、pending action flush、Windows grace window、main webview missing の integration test を追加する

- [ ] P2 browser preview bridge message の URL equality を redirect/canonical URL で再検証する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/reader/hooks/browser`
  - bridge message は action と URL が snapshot と一致する時だけ受けるため、redirect 後 URL や percent encoding 差で shortcut が効かなくなる可能性がある
  - redirected URL、trailing slash、percent encoding、hash change、unsupported action、stale URL の bridge test を追加する

- [ ] P2 browser preview focus override script の site compatibility / security boundary を検証する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/components/settings/reading-settings-view.tsx`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - focus override は embedded page の visibility/focus APIs を差し替えるため、サイト側の media playback/analytics/keyboard handling を壊す可能性がある
  - keep focus on/off、visibilitychange listener、non-configurable property、site script error、setting copy、disable fallback の test/実機検証 TODO にする

- [ ] P2 browser webview diagnostics payload の coordinate privacy / size cap を固定する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/runtime/diagnostics.ts`, `src/components/settings/debug-settings.tsx`
  - diagnostics は bounds/scale/native bounds を event/log に出すため、巨大値や画面構成情報を support log へ載せる範囲を決める必要がある
  - huge coordinate、negative coordinate、multi-monitor scale、native bounds unavailable、payload truncation、diagnostics toggle の test を追加する

- [ ] P2 Tauri listener group の partial subscription failure を listener owner ごとに surface する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `src/components/reader/hooks/browser`, `src/hooks/use-updater.ts`
  - `Promise.all` は individual catch で ready に進むため、一部 event listener だけ登録失敗しても UI は動作可能に見えて stale state になりやすい
  - one subscription fail、all fail、disposed before resolve、cleanup throw、runtime unavailable、owner label diagnostics の test を追加する

- [ ] P2 Tauri listener failure once flag の runtime recovery / test isolation を統一する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `tests/helpers/tauri-runtime.ts`, `src/__tests__/lib/tauri-event-listeners.test.ts`
  - listener failure は once event で通知されるため、runtime が復旧した後や test 間で flag が残ると本来の warning を見落としやすい
  - reset helper、runtime becomes available、runtime becomes unavailable、multiple listener groups、afterEach cleanup の contract を追加する

- [ ] P2 safeInvoke response validation redaction を command name / args detail と切り分ける
  - 対象: `src/api/tauri-commands.ts`, `src/lib/ui-errors.ts`, `src/__tests__/api/tauri-commands.test.ts`
  - response validation error は Zod issue detail を含むため、schema path と runtime value のどこまでを user/log に出すか明確にしないと data leak と調査不能の両方が起きる
  - command name、args validation、response validation、nested path、URL token、omitted issues、console vs toast detail の test を追加する

- [ ] P2 safeInvoke args validation が `args` undefined の時に schema を bypass する方針を contract 化する
  - 対象: `src/api/tauri-commands.ts`, `src/api/schemas/commands.ts`, `src/__tests__/api/command-args-validation.test.ts`
  - `options.args && args ? ... : args` のため、schema 付き command に undefined args を渡すと validation を通らず invoke へ進む可能性がある
  - schema required args + undefined、empty object、optional args command、no-args command、runtime invoke error の test を追加する

- [ ] P2 URL redaction regex の http token 境界を markdown/log punctuation で強化する
  - 対象: `src/api/tauri-commands.ts`, `src/lib/runtime/diagnostics.ts`, `src-tauri/src/domain/error.rs`
  - URL-like token redaction が whitespace 区切りに寄ると、Markdown link、括弧、句読点、複数 URL で query token が残る可能性がある
  - markdown URL、parentheses、Japanese punctuation、multiple URLs、fragment/query/userinfo、invalid URL の parity test を追加する

- [ ] P2 platform store in-flight load が stale result で newer recovery を上書きしないよう generation 化する
  - 対象: `src/stores/platform-store.ts`, `src/lib/window/window-chrome.ts`, `src/__tests__/stores/platform-store.test.ts`
  - platform load は in-flight promise を共有するため、runtime unavailable 後の recovery や mock切替で古い default platform が新しい platform を上書きする可能性がある
  - unavailable then available、available then unavailable、mock toggle、parallel load、reset helper の store test を追加する

- [ ] P2 desktop overlay titlebar fallback の userAgentData / navigator.platform drift を UI layout contract にする
  - 対象: `src/lib/window/window-chrome.ts`, `src/components/app-shell.tsx`, `src/components/storybook/viewport-fixtures.ts`
  - platform kind unknown の間に macOS 判定を navigator で補うため、Chrome UA reduction や test mock の差で titlebar inset が1 frameずれやすい
  - userAgentData platform、navigator.platform missing、unknown platform in Tauri、web mock、mac/win/linux screenshot smoke の test を追加する

- [ ] P2 app stacking z-index constants の modal/toast/browser overlay collision を contract 化する
  - 対象: `src/lib/window/window-chrome.ts`, `src/components/app-shell.tsx`, `src/components/shared/app-toast-view.tsx`
  - browser overlay z-40、dialog/command palette z-50、toast z-100 が定数化されているが、Debug HUD や future popover が入ると collision しやすい
  - browser overlay + settings modal、command palette + toast、debug hud + dialog、native titlebar drag region、popover z-index の visual smoke を追加する

- [ ] P2 dev runtime mocks と real Tauri runtime 判定の mutually exclusive contract を作る
  - 対象: `src/lib/window/window-chrome.ts`, `src/dev/mocks.ts`, `tests/helpers/tauri-runtime.ts`, `src/components/storybook/story-tauri-runtime.ts`
  - `__DEV_BROWSER_MOCKS__` / `__ULTRA_RSS_BROWSER_MOCKS__` / `__TAURI_INTERNALS__` の組み合わせで runtime 判定が変わるため、Storybook/dev/test で混在すると実 command を叩く risk がある
  - both mocks true、mock + tauri internals、real tauri only、cleanup restore、storybook decorator の contract test を追加する

- [ ] P2 Storybook query client runtime provider が Tauri mock failure を test isolation で漏らさないようにする
  - 対象: `src/components/storybook/story-query-client-provider.tsx`, `src/components/storybook/story-tauri-runtime.ts`, `tests/helpers/tauri-mocks.ts`
  - story ごとの query client と Tauri mock が共有状態を持つと、前 story の failed command/cache が次の story に残り visual smoke が flaky になる
  - story unmount、query cache clear、mock command reset、failed invoke、parallel stories の test を追加する

- [ ] P2 runtime error guard の browser webview fallback events を expected failure と区別する
  - 対象: `e2e/helpers/runtime-error-guard.ts`, `e2e/app.spec.ts`, `src/components/reader/hooks/browser`
  - browser fallback は意図的に console warn/error を出す場面があるため、E2E guard が本物の regression と expected fallback を混同しやすい
  - expected fallback scope、unexpected pageerror、console warn allowlist、attached diagnostics payload、screenshot timing の E2E policy を追加する

- [ ] P2 tauri dev config と release config の capability/window drift を schema test で固定する
  - 対象: `src-tauri/tauri.dev.conf.json`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`, `src/__tests__/schemas/tauri-config-identifiers.test.ts`
  - dev/release config が増えると window label、capability、security、updater 設定が片方だけ変わり、dev で動くが release で壊れる状態になりやすい
  - main window label、browser webview label、CSP、capability path、updater active、identifier parity の test を追加する

- [ ] P3 browser webview command tests の platform matrix を generated fixtures へ寄せる
  - 対象: `src/__tests__/api/browser-webview-command-contract.test.ts`, `src/__tests__/components/browser-webview-sync-helpers.test.ts`, `tests/helpers/navigator-platform.ts`
  - Windows/macOS/unknown platform の fixture が散ると placeholder URL、bounds unit、titlebar inset の test が抜けやすい
  - platform fixture builder、bounds unit cases、placeholder URL cases、navigator mock cleanup、DPI fixture を追加する

- [ ] P3 diagnostics event names / payload schema を central registry 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/lib/runtime/diagnostics.ts`, `src/api/schemas/browser-webview.ts`
  - diagnostics/fallback/state event name が Rust/frontend に分散しており、rename 時に listener と emitter が片方だけ変わる risk がある
  - event name registry、payload schema parity、unknown event allowlist、test helper emit fixture の配置を決める
