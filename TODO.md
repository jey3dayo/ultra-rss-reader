# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
- 同じカテゴリ内は原則同時に走らせない。並列化する場合は `対象:` の write scope が重ならないことを確認する
- Rust DB/provider、reader UI/hooks、schema/storage、E2E/tooling は競合しやすいので別カテゴリを優先して組み合わせる
- domain shard は `security-privacy`, `provider-sync`, `release-native`, `db-recovery`, `query-cache`, `reader-state`, `settings-state`, `a11y-keyboard`, `quality-tooling` のいずれかに寄せる
- 各 TODO は priority、domain、work type、write scope、focused verification を読める形で残す
- Rust DB/provider と query/store は同時投入しない。reader state と a11y keyboard も同時投入しない。release/native と frontend-only tooling は並列可
- leaf task を親 tranche へ寄せる場合は、leaf 側に `superseded by: <parent>`、残す検証観点、削除理由、CHANGELOG へ移す条件を残してから削除判断する

### TODO intake stop rules

- 新しい risk TODO を追加する前に、既存の `P1-Q*` / `P2-*` tranche、domain shard、supersedes merge へ回収できるかを先に確認する
- 新規追加できる TODO は、owner domain、write scope、acceptance criteria、focused verification、defer 範囲を持つものだけにする
- 発見方法がない懸念は TODO 化しない。`code audit`、`focused test`、`manual native verification`、`implementation-time checklist`、CI/release gate のどれで見つけるかを明記する
- 既存 TODO と重なる場合は新しい項目を増やさず、該当 tranche の `supersedes` か検証条件へ統合する
- backlog が過密な domain は追加列挙を止め、first tranche 実装、重複 merge、parallel-safe shard 化のどれかへ切り替える

### Sync / App Runtime

### App Shell / Command Palette / Dev Intent

### Reader UI / Account Settings

### Dev / Tooling / E2E / Test Helpers

### Rust Provider / DB / Scheduler

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

- [ ] P3 Japanese long-label screenshot smoke を settings / article toolbar / account detail に追加する
  - 対象: `e2e/storybook`, `src/locales/ja`, `src/components/settings`, `src/components/reader/article-toolbar-view.tsx`
  - 日本語 copy は英語より幅を取りやすく、compact toolbar や settings row で overflow / overlap を起こしても unit test では見えにくい
  - ja locale、narrow viewport、large text、button label overflow、account detail section、toolbar actions の screenshot smoke を追加する

- [ ] P3 visual regression smoke の対象を dense UI / a11y state に限定して追加する
  - 対象: `e2e/storybook`, `src/components/reader`, `src/components/settings`
  - 全画面 snapshot を増やすと保守が重いが、dense UI の overlap や hidden focus ring は通常の DOM assertion では検出しづらい
  - feed tree dense state、settings modal error state、command palette empty/result state、browser overlay error state、toast stack の小さな screenshot smoke を追加する

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics

- [ ] P2 browser preview focus override script の site compatibility / security boundary を検証する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/components/settings/reading-settings-view.tsx`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - superseded by: `P2-A11Y1` top-layer/focus trap
  - focus override は embedded page の visibility/focus APIs を差し替えるため、サイト側の media playback/analytics/keyboard handling を壊す可能性がある
  - keep focus on/off、visibilitychange listener、non-configurable property、site script error、setting copy、disable fallback の test/実機検証 TODO にする

- [ ] P3 diagnostics event names / payload schema を central registry 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/lib/runtime/diagnostics.ts`, `src/api/schemas/browser-webview.ts`
  - superseded by: `P1-Q1d` runtime diagnostics redaction
  - diagnostics/fallback/state event name が Rust/frontend に分散しており、rename 時に listener と emitter が片方だけ変わる risk がある
  - event name registry、payload schema parity、unknown event allowlist、test helper emit fixture の配置を決める

- [ ] P2 OPML/import/export UI action の progress/cancel/large file policy を data settings へ追加する
  - 対象: `src/components/settings/data-settings.tsx`, `src-tauri/src/commands/opml_commands.rs`, `src/api/schemas/commands.ts`
  - large OPML import/export は同期 command として走るため、settings close や account switch 中に long-running operation の状態が見えにくい
  - large OPML、settings close during import、account switch、cancel不可 copy、success summary、partial duplicate skip summary の UX contract を追加する

- [ ] P3 preference command allowlist を generated table として settings docs/rules に反映する
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/schemas/preferences.ts`, `CLAUDE.md`
  - preference 追加時の手順が暗黙だと backend allowlist、frontend schema、settings UI、i18n、tests の更新漏れが繰り返される
  - add preference checklist、allowed key生成、schema default、locale key、settings option parity を rules 化する

- [ ] P2 native menu updater availability と menu enabled state を release config に接続する
  - 対象: `src-tauri/src/menu.rs`, `src-tauri/src/commands/updater_commands.rs`, `src/lib/actions.ts`
  - updater disabled build でも check update menu が常時有効だと、native menu が no-op / failure action を露出する可能性がある
  - updater enabled、updater disabled、menu item state、action failure toast、release config drift の test を追加する

- [ ] P2 invalid account row quarantine を diagnostics / recovery action へ出す
  - 対象: `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/commands/account_commands.rs`, `src/components/settings/accounts-nav-view.tsx`
  - superseded by: `P1-Q4c` runtime corruption
  - invalid row を warn で隠すと UI 上は account が消えたように見え、復旧導線や support log との接続が弱い
  - invalid kind、missing name、quarantine count、diagnostics event、settings recovery copy の contract test を追加する

- [ ] P2 account delete 後の selected account preference 保存失敗 surface を固定する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`, `src/stores/preferences-store.ts`, `src/stores/ui-store.ts`
  - 削除 account が `selected_account_id` の場合に preference 保存へ進むが、保存失敗時の fallback account と UI state の整合が未固定
  - selected account delete、setPref failure、fallback account missing、settings close、toast copy の component/store test を追加する

- [ ] P2 retained article snapshot の title/read/star 鮮度更新方針を固定する
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article/use-article-status-actions.ts`, `src/hooks/use-articles.ts`
  - retained article は missing source の snapshot を戻すため、mutation 後の title/read/star が source 再取得まで古いまま残る可能性がある
  - read mutation、star mutation、title update after sync、snapshot refresh、failed mutation rollback の test を追加する

- [ ] P3 article date/group fallback の invalid date 表示方針を明文化する
  - 対象: `src/lib/articles/article-list.ts`, `src/lib/articles/article-view.ts`, `src/lib/datetime.ts`
  - parse不能な `published_at` が raw group/表示へ流れると provider payload drift 時に UI 表示が不安定になる
  - invalid date、blank date、future date、timezone fallback、group label copy の helper/component test を追加する

- [ ] P2 browser webview navigation failure 後に bounds だけ適用済みになる挙動を固定する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - 既存 webview 更新は先に bounds を適用してから navigate するため、navigate 失敗時に URL state は戻っても bounds だけ変わる可能性がある
  - set_bounds success + navigate failure、bounds rollback/no rollback policy、surface issue、pending bounds flush の test を追加する

- [ ] P2 embedded browser log URL redaction を path token / signed URL まで広げる
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/runtime/diagnostics.ts`
  - query/userinfo/fragment は落としても path に token や signed URL 風の値が入ると timeout/fallback logs へ残る可能性がある
  - signed path token、UUID path、safe host only、multiline URL、redaction snapshot の Rust/TS test を追加する

- [ ] P2 feed integrity report を sync/maintenance 中に読んでよいか policy 化する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/components/settings/data-settings.tsx`
  - cleanup は maintenance guard を取るが report は reader lock だけで読み、sync 中の transient orphan count を UI に出すかが曖昧
  - sync in progress、vacuum in progress、cleanup in progress、stale report copy、retry action の contract を追加する

- [ ] P2 Windows dispatch の dev env alias forwarding を frontend dev intent と同期する
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/windows-command-dispatch.ts`, `src/dev/intent.ts`
  - Windows/WSL dispatch は一部 env だけ forward し、`VITE_ULTRA_RSS_DEV_*` alias や window size env が frontend dev intent とずれる可能性がある
  - primary alias、legacy alias、window width/height、blank env、WSL forwarding の script test を追加する

- [ ] P2 dispatch wrapper の signal forwarding を child process group / listener cleanup で固定する
  - 対象: `scripts/tauri-cli-dispatch.ts`, `scripts/windows-command-dispatch.ts`
  - `child.kill(signal)` と `process.on` だけでは shell/PowerShell 経由の孫プロセス残りや repeated invocation の listener 蓄積が起きやすい
  - SIGINT、SIGTERM、child exit before signal、listener removal、process group fallback の script test を追加する

- [ ] P2 stale macOS dev bundle cleanup failure で Tauri dev 起動全体を止めない policy にする
  - 対象: `scripts/tauri-cli-dispatch.ts`
  - stale bundle cleanup の `rm` failure が dev command 全体の failure になり、権限/ロックで古い app bundle を消せないだけで開発起動が止まる
  - cleanup permission denied、locked bundle、warning-only policy、explicit strict mode、dev start continuation の script test を追加する

- [ ] P2 `tests/helpers/tauri-mocks` の mutation commands を stateful fixture にする範囲を決める
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/fixtures.ts`
  - list 系が毎回 sample fixture を返し mutation 系は null を返すだけなので、mark/read/star 後の再取得や count 変化を helper が隠す可能性がある
  - mark read、toggle star、delete feed、tag mutation、fixture reset boundary の helper contract を追加する

- [ ] P3 unknown native menu id を diagnostics に出す
  - 対象: `src-tauri/src/menu.rs`, `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`
  - `resolve_menu_action` が `None` の場合 silent return するため、menu id rename や platform 差で click no-op になった原因を追いにくい
  - unknown menu id、known id、diagnostics once、redacted payload、release log level の Rust/TS contract を追加する

- [ ] P1 add feed の folder assignment failure を partial success として扱う
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/lib/feed-folder-flow.ts`, `src/lib/feed-query-cache.ts`
  - `addLocalFeed` 成功後に `updateFeedFolder` が失敗すると、feed は作られるが期待 folder に入らない状態で dialog が閉じ得る
  - add success + folder failure、refetch display、toast、retry/move action、query invalidation の contract test を追加する

- [ ] P2 Settings modal setup lock を store action boundary にも適用する
  - 対象: `src/components/settings/hooks/use-settings-modal-view-props.tsx`, `src/stores/ui-store.ts`, `src/lib/actions.ts`
  - view は close/nav をブロックするが、command palette/native menu/dev scenario など store action 経由の遷移は別経路になり得る
  - setup syncing、native menu、command palette、dev scenario、action no-op feedback の test を追加する

- [ ] P2 Settings modal `deletedAccountIds` と refetch account disappearance の整合を取る
  - 対象: `src/components/settings/settings-modal.tsx`, `src/hooks/use-accounts.ts`, `src/stores/ui-store.ts`
  - local deleted ids は明示削除時だけ更新されるため、sync/refetch で account が消えた path と挙動がずれる可能性がある
  - account disappears by refetch、close/reopen、saved selected account、add flow、snapshot の test を追加する

- [ ] P2 Subscriptions index search/sort return state inclusion policy を決める
  - 対象: `src/components/subscriptions/hooks/use-subscriptions-index-state.ts`, `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions/subscriptions-index-page.tsx`
  - hook 内に search/sort state がある一方で返却 state に含めないため、復帰・URL・navigation contract が曖昧
  - search restored/not restored、sort restored/not restored、account scope、scroll reset、back from detail の test を追加する

- [ ] P2 Subscriptions index missing folder id grouping policy を固定する
  - 対象: `src/lib/subscriptions/subscriptions-index.ts`, `src/components/subscriptions/subscriptions-index-page.tsx`
  - feed の `folder_id` が folders に存在しない場合、folderId と null name の組み合わせで no-folder 風 group が複数化し得る
  - deleted folder、folder query failure、stale feed folder_id、no-folder merge/separate、label の test を追加する

- [ ] P2 Subscriptions detail recent articles の tie-breaker を固定する
  - 対象: `src/lib/subscriptions/subscriptions-index.ts`, `src/__tests__/lib`
  - `published_at` が同一の場合 compare が 0 になり、preview order が入力順依存になる
  - same timestamp、id/title fallback、invalid date、stable sort、locale の test を追加する

- [ ] P2 add feed discovery close/reopen stale result generation guard を追加する
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/components/add-feed/hooks/use-add-feed-dialog-controller.ts`, `src/components/add-feed/add-feed-dialog-state.ts`
  - latest 判定が URL/lifecycle 寄りで、同じ URL を close/reopen した時に古い discovery result を受け入れる可能性がある
  - close pending、same URL reopen、different account、late success、late error の test を追加する

- [ ] P2 add feed submit pending 中の close/unmount post-processing policy を固定する
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/components/add-feed/add-feed-dialog-view.tsx`, `src/components/add-feed/add-feed-dialog.tsx`
  - view では cancel disabled だが、外部 close や parent unmount は起こり得るため completion dispatch/onOpenChange の扱いが未契約
  - submit pending unmount、parent close、late success/failure、toast duplication、loading cleanup の test を追加する

- [ ] P2 rename feed dialog folder update failure の saved 判定を見直す
  - 対象: `src/lib/feed-edit-submit.ts`, `src/components/rename-feed/hooks/use-rename-feed-dialog-controller.ts`, `src/components/rename-feed/rename-feed-dialog-view.tsx`
  - rename/display が成功して folder move だけ失敗した場合に、保存済み扱いと UI/toast の整合が崩れる可能性がある
  - folder-only failure、rename+folder failure、display+folder failure、close/stay policy、toast の test を追加する

- [ ] P2 folder select `__new__` sentinel collision を防ぐ
  - 対象: `src/components/feed-dialog/folder-select-view.tsx`, `src/components/feed-dialog/use-folder-selection.ts`, `src/components/feed-dialog/feed-dialog-form.types.ts`
  - sentinel が folder id と同じ value 空間にあり、backend id が `__new__` の場合に create/select が衝突する
  - folder id `__new__`、unknown selected folder、missing option、create disabled、backend id policy の test を追加する

- [ ] P2 selected folder deleted while dialog open の fallback/submit policy を決める
  - 対象: `src/components/feed-dialog/folder-select-view.tsx`, `src/lib/feed-folder-flow.ts`, `src/components/feed-dialog/use-folder-selection.ts`
  - 選択中 folder が refetch で消えた場合、missing selected value が stale id のまま submit され得る
  - folder deleted、refetch、stale submit、not found toast、auto reset の test を追加する

- [ ] P2 tag context menu delete confirm の pending guard/loading を追加する
  - 対象: `src/components/tags/delete-tag-dialog-view.tsx`, `src/components/tags/tag-context-menu.tsx`, `src/components/sidebar/sidebar-tag-section.tsx`
  - delete dialog に loading prop がなく、confirm handler 側の double-click guard が view contract に現れていない
  - double confirm、pending close、error retry、reader sidebar context menu、selected tag cleanup の test を追加する

- [ ] P2 settings tags edit/delete dialog の stale tag id guard を追加する
  - 対象: `src/components/settings/tags-settings.tsx`, `src/components/tags/rename-tag-dialog-view.tsx`, `src/components/tags/delete-tag-dialog-view.tsx`
  - dialog 開始時の tag DTO を保持するため、refetch で対象 tag が消えた場合の rename/delete path が未契約
  - dialog open then removed、rename/delete not-found、UI close/stay、toast、stale color/name の test を追加する

- [ ] P2 mute keyword add in-flight guard を disabled state 以外にも置く
  - 対象: `src/components/settings/mute-settings.tsx`, `src/components/settings/mute-settings-view.tsx`, `src/hooks/use-mute-keywords.tsx`
  - `handleAdd` に in-flight ref がなく、view disabled だけでは Enter spam や double click を完全には防げない
  - Enter spam、double click、slow mutation、duplicate backend failure、input reset の test を追加する

- [ ] P2 app-wide queryClient singleton lifecycle reset policy を決める
  - 対象: `src/lib/query/query-client.ts`, `src/App.tsx`, `src/stores/ui-store.ts`
  - account deletion/dev scenario/reset-like operation 時に cache retention/removal の責務が中央化されていない
  - account delete、dev reset、selected account change、persisted preferences、cache whitelist の test を追加する

- [ ] P2 runtime diagnostics policy の `toast` field execution path を実装または削除する
  - 対象: `src/lib/runtime/diagnostics.ts`, `src/stores/ui-store.ts`
  - policy に `toast: user-action-only` があるが logger は console 中心で、ユーザー通知される条件が実装 contract になっていない
  - user action diagnostics、background diagnostics、toast suppression、policy test、UI store dependency を追加する

- [ ] P2 command history storage warning を diagnostics/redaction に統合する
  - 対象: `src/hooks/use-command-history.ts`, `src/lib/runtime/diagnostics.ts`
  - DEV-only console warning が runtime diagnostics と分かれており、production behavior と redaction 方針が揺れやすい
  - localStorage unavailable、quota、malformed JSON、redaction、production behavior の test を追加する

- [ ] P3 SettingsPageView inline text action の aria-label required contract を決める
  - 対象: `src/components/settings/settings-page-view.tsx`, `src/components/settings/settings-page.types.ts`
  - inline input + button の関係で action aria label が必要になる場面があるが、type 上は optional のまま
  - missing aria、generated label、existing controls、TS type、a11y test を追加する

- [ ] P3 mute keyword scope select invalid value diagnostics を追加する
  - 対象: `src/components/settings/mute-settings-view.tsx`, `src/api/schemas/mute-keyword.ts`, `src/lib/runtime/diagnostics.ts`
  - unknown select value を UI 側で silent no-op にすると、schema drift や fixture 破損に気づきにくい
  - invalid payload、schema drift、warning once、UI no-op、test を追加する

- [ ] P3 createQuery composite key support policy を決める
  - 対象: `src/hooks/create-query.ts`, `src/lib/query/query-invalidation.ts`
  - helper が single string id 前提のため、account+mode+filter など composite key が必要な query が helper 外へ逃げやすい
  - composite key RFC、generated query、manual query exception、invalidation matrix、type tests を追加する

- [ ] P3 command history length cap の grapheme/UTF-8 policy を決める
  - 対象: `src/schemas/storage.ts`, `src/constants`
  - UTF-16 `slice` ベースの cap は surrogate pair や combining sequence を分割し得る
  - emoji、combining mark、UTF-8 bytes、display length、max entry の test を追加する

- [ ] P3 i18n supported locales と language preference enum の parity を固定する
  - 対象: `src/lib/i18n-resources.ts`, `src/schemas/preferences.ts`, `src/components/settings/hooks/use-general-settings-view-props.ts`
  - UI option は supported languages、schema は hard-coded enum のため、locale 追加時に保存値と fallback がずれやすい
  - add locale fixture、schema enum、settings option、resources、fallback の test を追加する

- [ ] P1 `keep_read_items_days` purge の実行契約を manual/startup/scheduler で揃える
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/service/sync_scheduler.rs`
  - purge が scheduler path 中心だと、manual sync 中心・scheduler 未解禁・startup only の利用で既読記事が溜まり続ける可能性がある
  - manual all sync後purge、startup sync後purge、scheduler disabled、keep_read_items_days=0、purge failure result の test を追加する

- [ ] P2 scheduler `retry_after_seconds` を error message parse から構造化 metadata へ寄せる
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/domain/error.rs`
  - backoff が `retry_after_seconds=` という message 断片に依存し、provider copy 変更や user-visible 文言混入で retry timing が壊れやすい
  - markerなし、複数marker、巨大値、数字以外suffix、偶然marker、structured retry metadata 優先の test を追加する

- [ ] P2 remote subscription URL fallback merge が別 remote feed を上書きしない契約を作る
  - 対象: `src-tauri/src/service/sync_flow.rs`
  - `find_by_remote_id` が外れた後に `find_by_url` で既存 feed を再利用するため、remote_id 変更や同 URL 別 subscription が混ざると意図しない merge になり得る
  - remote_id changed same URL、two remote subs same URL、existing local feed same URL、remote_id conflict、title/folder overwrite policy の test を追加する

- [ ] P2 remote subscription missing `folder_remote_id` 時の folder 保持/解除 policy を固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`
  - `folder_remote_id` が存在するのに folder 解決できない場合に `folder_id=None` へ落ちると、一時的な folder API 欠落で feed が root へ移動し得る
  - folder sync omitted、folder API failure後subscription sync、unknown folder_remote_id、existing folder保持、explicit remote folder removal の test を追加する

- [ ] P2 main-stage portal target missing 時の browser fallback geometry を固定する
  - 対象: `src/components/reader/browser-view.tsx`, `src/components/reader/browser-webview-sync-helpers.ts`
  - `scope="main-stage"` の portal root が無い時に inline 描画へ落ちると、main-stage geometry のまま content pane へ載って bounds がずれ得る
  - portal root missing、portal root late attach、content-pane fallback geometry、overlay root relative bounds の test を追加する

- [ ] P2 native browser `stateChanged` payload を requested URL/closed state で reject する
  - 対象: `src/components/reader/browser-webview-state.ts`, `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts`
  - stale `stateChanged` が close 後や URL 切替後に届くと、navigation/loading state が現在の reader 状態へ混入しやすい
  - close後 stateChanged ignore、URL切替後旧 payload ignore、can_go_back/can_go_forward stale update 抑止 の test を追加する

- [ ] P2 retry web preview の late reject/success を current URL に限定する
  - 対象: `src/components/reader/hooks/browser/use-browser-view-actions.ts`
  - `handleRetry` は fire-and-forget で、retry 中に overlay close/URL switch すると古い toast や surface issue が出る可能性がある
  - retry A 中に B へ切替、retry 中 close、late reject toast 抑止、latest retry だけ issue 表示 の test を追加する

- [ ] P2 browser overlay close motion の `matchMedia` / timer failure を固定する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - reduced motion 判定と close delay timer が runtime API に依存し、timer unavailable 時の close 完了順序が崩れやすい
  - matchMedia throws、setTimeout throws、clearTimeout throws、unmount during close delay、close completion の test を追加する

- [ ] P2 browser toolbar accepted-feedback timer の runtime failure/unmount cleanup を固定する
  - 対象: `src/components/reader/browser-overlay-chrome.tsx`
  - back/reload の spinner feedback が `window.setTimeout` 前提で、timer failure や unmount 時に active feedback が残る可能性がある
  - setTimeout throw、clearTimeout throw、action promise reject、unmount before timer、rapid back/reload の test を追加する

- [ ] P2 browser bounds の non-finite `scaleFactor` を reject する
  - 対象: `src/lib/browser/browser-webview.ts`
  - `scaleFactor` が NaN/Infinity/negative の場合、width/height 判定をすり抜けて native bounds に非有限値が流れる可能性がある
  - NaN/Infinity/negative/zero scaleFactor、devicePixelRatio malformed、fractional rect rounding、empty_bounds の test を追加する

- [ ] P2 iframe webview-history helper の document/runtime unavailable を contract 化する
  - 対象: `src/lib/browser/webview-history.ts`
  - browser preview helper が `document.querySelector` 前提で、Storybook/test/browser-only runtime の boundary failure が `Result` 以外へ漏れ得る
  - document undefined、querySelector throws、cross-origin history throws、contentWindow null、src setter throws の test を追加する

- [ ] P2 overlay viewport width の malformed `innerWidth` と resize cleanup を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-viewport-width.ts`, `src/lib/browser/browser-viewer-geometry.ts`
  - `innerWidth` が NaN/Infinity/negative の場合に geometry fallback へ倒さないと、chrome/stage layout が崩れ得る
  - NaN/Infinity/negative innerWidth、resize after unmount、listener bind failure、cleanup failure の test を追加する

- [ ] P2 shortcut runtime modifier policy を platform と同期する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/hooks/use-keyboard.ts`
  - resolver が `metaKey || ctrlKey` を同じ modifier と扱うため、macOS Ctrl/Cmd、Windows/Linux Meta/Ctrl の実動作と表示・native menu がずれやすい
  - mac Ctrl+K vs Cmd+K、Windows Ctrl+K vs Meta+K、custom shortcut modifier、native-menu-owned shortcut parity の test を追加する

- [ ] P2 sidebar feed drop target の folder ownership を contract 化する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-tree-props.ts`
  - drag/drop が stale render や test helper 経由で別 account folder/missing folder id を `moveFeedToFolder` へ渡せる可能性がある
  - missing folder id、same account folder、different account folder、folder list refetch 中、drop failure feedback の test を追加する

- [ ] P2 sidebar feed selection の open-first-article failure surface を決める
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`
  - `open_first_article_on_feed_selection` 有効時の `void openFeedLanding(feedId)` failure が hook 内で見えず、削除済み feed や記事 0 件の UX が揺れやすい
  - feed not found、no article、landing fetch reject、starred tree context、account switch 中 request owner の test を追加する

- [ ] P2 command palette article selection を account/feed freshness で guard する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/components/reader/hooks/command-palette/use-command-palette-data.ts`
  - palette 検索結果や recent article が account switch 直前のものだと、現在 account に存在しない feed/article を選び得る
  - account switch while palette open、stale search result、recent article missing feed、feed deleted by refetch、select no-op/toast policy の test を追加する

- [ ] P2 command palette dev scenario failure を stale palette session で抑止する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`
  - dev scenario reject が palette close 後でも toast されると、別 scenario や account switch 後に古い failure が現在操作の失敗に見える
  - scenario A reject after B starts、palette close/reopen、account switch、runtime unavailable、toast owner id の test を追加する

- [ ] P2 dev scenario async runners を run generation で latest-only にする
  - 対象: `src/dev/scenarios/runner.ts`, `src/dev/scenarios/helpers.ts`
  - feed-first/tag-view scenario が複数 IPC 後に UI state/query cache を更新するため、後続 scenario 開始後に古い完了が UI を上書きし得る
  - feed-first中にtag-view開始、account list delay、listFeeds reject、late query cache write、late selectFeed/selectTag suppression の test を追加する

- [ ] P2 dev scenario query cache seeding の partial failure policy を固定する
  - 対象: `src/dev/scenarios/helpers.ts`
  - accounts/feeds/articles/tags を順に query cache へ書くため、途中失敗時に半端な dev cache が残り次の scenario や reader 表示へ混入し得る
  - listFeeds failure after accounts cached、listArticles failure after feed cached、tag counts failure、failure toast、cache rollback/keep policy の test を追加する

- [ ] P2 command palette prefix search の IME/full-width prefix policy を決める
  - 対象: `src/components/reader/hooks/command-palette/use-command-search.ts`, `src/__tests__/hooks/use-command-search.test.ts`
  - prefix が ASCII `>`/`@`/`#` 前提のため、日本語入力中や全角記号、ゼロ幅文字で意図せず通常検索へ落ちる可能性がある
  - full-width prefix、zero-width space、leading newline/tab、IME composing input、prefix-only query の test を追加する

- [ ] P2 Tauri default mocks の pagination behavior を command schema と揃える
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/tauri-mocks.test.ts`, `src/api/schemas/commands.ts`
  - default mock が offset/limit を十分反映しないと、paging UI の test が default mock では false green になり得る
  - list_articles offset/limit、list_account_articles offset/limit、recent/search slicing、invalid pagination schema、custom handler precedence の test を追加する

- [ ] P3 OPML export の large account performance を snapshot/limit で見える化する
  - 対象: `src-tauri/src/commands/opml_commands.rs`
  - folder ごとに `remaining_feeds.remove(index)` する構造は大きい feed 数で O(n^2) 寄りになり、large OPML export の UI 固まりにつながりやすい
  - 1k/5k feeds export smoke、many folders、all orphan feeds、stable order、time budget/allocation regression guard を追加する

- [ ] P3 reader fixture seed に cross-account/folder/tag article coverage を増やす
  - 対象: `tests/helpers/reader-fixtures.ts`, `tests/helpers/fixtures.test.ts`
  - default sample articles が特定 feed に寄ると、shared mock 利用 test で foldered feed、second account、tag projection の抜けが起きやすい
  - foldered feed article、second account article、tagged article per tag、read/unread/starred distribution、default mock parity の test を追加する

- [ ] P3 `renderStory` coverage owner を一本化する
  - 対象: `tests/helpers/render-story.test.tsx`, `tests/helpers/fixtures.test.ts`, `tests/helpers/render-story.tsx`
  - helper 専用 test と fixtures test に契約が分散しており、helper 変更時に片方だけ更新されると意図が読み取りにくくなる
  - renderStory behavior 専用 suite 集約、fixtures test scope 分離、duplicate test inventory、export/import smoke を追加する

- [ ] P3 async flush helpers の fake timer / missing RAF policy を固定する
  - 対象: `tests/helpers/async-flush.ts`, `src/__tests__/hooks`
  - `flushMacrotask` は real timer、`flushRaf` は rAF 前提のため、fake timer 使用中や rAF 未定義環境で hang/throw しやすい
  - fake timers with `advanceTimersByTimeAsync`、RAF missing、RAF mocked sync/async、helper timeout diagnostics、Vitest cleanup の test を追加する

- [ ] P3 `createHookDataResult` の partial query result shape を明示する
  - 対象: `tests/helpers/typed-test-factories.ts`, `src/__tests__/hooks`
  - `{ data } as TResult` だけを返す helper は、hook が `isFetched`/`isPending`/`isError` を見るようになった時に runtime shape とずれたまま通り得る
  - data-only helper allowed use、query status required helper、isFetched dependent hook、loading/error variants、type-level helper split の test を追加する

- [ ] P2 preferences load と `setPref` optimistic update の race を latest-only にする
  - 対象: `src/stores/preferences-store.ts`, `src/schemas/preferences.ts`, `src/__tests__/stores`
  - `loadPreferences()` の取得中に user が設定を変更すると、遅れて返った backend prefs が optimistic state を上書きする可能性がある
  - load pending中setPref、same key update、different key update、backend stale response、persist failure、theme/language side effect の test を追加する

- [ ] P2 preferences load failure 後の fallback state と persisted mirror の整合を固定する
  - 対象: `src/stores/preferences-store.ts`, `src/constants/storage.ts`, `src/schemas/preferences.ts`
  - load failure 時に fallback side effect は適用するが `prefs` は空のまま loaded になり、UI 表示・theme mirror・次回 setPref の起点が揺れやすい
  - getPreferences reject、mirrored theme present、empty prefs loaded、first setPref after failure、reload recovery の test を追加する

- [ ] P2 language preference apply を request generation で latest-only にする
  - 対象: `src/stores/preferences-store.ts`, `src/lib/ui/ui-language.ts`, `src/lib/i18n.ts`
  - `i18n.changeLanguage()` は async なので、language を連続変更した時に古い promise の reject/log が最新操作の failure に見えやすい
  - ja->en rapid change、system->ja rapid change、old promise reject、navigator language change、latest-only diagnostics の test を追加する

- [ ] P2 shortcut reset-all と locked `open_settings` の bypassed custom value policy を決める
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/schemas/preferences.ts`
  - UI では `open_settings` が locked でも backend/import/dev tools 経由で custom 値が入ると、reset-all が locked action を戻すべきかが曖昧
  - bypassed custom open_settings、reset all、single reset disabled、conflict detection、legacy Cmd/Ctrl comma parity の test を追加する

- [ ] P2 shortcut conflict message の locale/platform 変更時 refresh を固定する
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/components/settings/hooks/use-shortcuts-settings-view-props.ts`
  - conflict message は保存時点の translated label / platform display を文字列で保持するため、言語や platform kind が変わると stale 表示になり得る
  - conflict then language change、platform kind change、recording restart、reset shortcut、message recompute policy の test を追加する

- [ ] P2 feed favicon external endpoint privacy policy を設定/ドキュメントと同期する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/lib/feed/feed.ts`, `DESIGN.md`
  - Google favicon endpoint に feed/site host を送るため、privacy-sensitive mode や offline/use-proxy 方針が未定だとユーザーの購読先が外部へ漏れ得る
  - favicon enabled/disabled policy、private host、localhost、grayscale option、offline fallback、docs/settings copy の task に分割する

- [ ] P2 `DevRuntimeOptionsSchema` の strictness / future option policy を決める
  - 対象: `src/api/schemas/platform-info.ts`, `src-tauri/src/commands/platform_commands.rs`
  - dev runtime options だけ余剰 key を許すと、Rust 側 dev-only option 追加や typo が silently accepted になり drift を検知しづらい
  - extra key rejection/allow policy、missing required key、null dimension、invalid dimension、future option drift の test を追加する

- [ ] P2 browser webview bounds schema に上限と coordinate policy を追加する
  - 対象: `src/api/schemas/commands.ts`, `src/lib/browser/browser-webview.ts`, `src-tauri/src/commands/browser_webview_commands.rs`
  - bounds が正数中心で上限がなく、極端な `width/height/x/y` が native webview geometry に流れ得る
  - huge bounds、negative x/y policy、zero size、NaN/Infinity、logical/physical unit omission の test を追加する

- [ ] P2 updater event payload `.passthrough()` の drift detection policy を決める
  - 対象: `src/api/schemas/update-info.ts`, `src/hooks/use-updater.ts`, `src-tauri/src/commands/updater_commands.rs`
  - updater event payload が余剰 key を許すため、Tauri event payload drift が UI 側で検知されず旧/新 fields が混在しやすい
  - extra key policy、percent < 0 / > 100、missing session_id、ready/progress payload parity の test を追加する

- [ ] P2 `SyncResultSchema` の total/succeeded/failed 整合を検証する
  - 対象: `src/api/schemas/sync-result.ts`, `src/lib/sync/sync-result-feedback.ts`, `src-tauri/src/commands/sync_commands.rs`
  - `synced: true` かつ failure あり、`succeeded > total` などの矛盾 DTO を UI が成功扱いする余地がある
  - succeeded > total、failed nonempty with synced true、total mismatch、warning retry fields consistency の test を追加する

- [ ] P2 `safeInvoke` unknown runtime error の UserVisible 化を分類する
  - 対象: `src/api/tauri-commands.ts`, `src/lib/runtime/diagnostics.ts`, `src/lib/ui-errors.ts`
  - Tauri unavailable、plugin missing、unknown thrown object がすべて UserVisible message になると diagnostics-only と操作失敗の切り分けが弱い
  - non-Error object、empty string、plugin missing、runtime unavailable mapping、redaction applied once の test を追加する

- [ ] P2 Storybook QueryClient provider の unmount cache cleanup を固定する
  - 対象: `src/components/storybook/story-query-client-provider.tsx`, `src/__tests__/components/story-query-client-provider.test.tsx`
  - Storybook 用 QueryClient が unmount 時に `clear()` されないと、Canvas remount や decorator nesting で cache/timer が残り得る
  - provider unmount clears query cache、mutation cache cleanup、two story renders isolated、retry disabled remains の test を追加する

- [ ] P2 `renderStory` の nested parameters merge を Storybook と揃える
  - 対象: `tests/helpers/render-story.tsx`, `tests/helpers/render-story.test.tsx`
  - args/parameters/globals の shallow merge が Storybook の nested parameters merge とずれ、a11y/viewport/layout test が実 Storybook と違う結果になり得る
  - nested `parameters.viewport` merge、decorator update preserving nested keys、story override vs meta defaults の test を追加する

- [ ] P2 dev mock mute keyword filter を backend body extraction と揃える
  - 対象: `src/dev/mocks.ts`, `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - dev mock が sanitized HTML 文字列をそのまま lower-case includes すると、backend の本文抽出/summary fallback とずれて browser preview だけ通る
  - HTML tag text、entity encoded text、summary fallback、title/body/title_and_body parity の test を追加する

- [ ] P2 dev scenario module validation を metadata shape まで広げる
  - 対象: `src/dev/scenario-runtime.ts`, `src/dev/scenarios/types.ts`, `src/dev/scenarios/registry.ts`
  - dev scenario module validation が function 有無中心だと、壊れた scenario metadata が command palette へ流れやすい
  - invalid scenario id、blank title、non-array keywords、throwing list、partial module の test を追加する

- [ ] P2 subscriptions workspace 中の article/feed navigation が背後の reader state を更新する方針を決める
  - 対象: `src/stores/ui-store.ts`, `src/components/app-layout.tsx`, `src/lib/actions.ts`
  - workspace open 中も store action は reader selection/content を更新でき、close 後に意図しない記事へ飛ぶ可能性がある
  - subscriptions open 中 navigate article/feed、command event、workspace close restore policy、native menu action の test を追加する

- [ ] P2 sidebar starred count map を adopted account snapshot と同期する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sources.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-tree.ts`
  - feeds/folders/counts は snapshot adoption される一方、`starredCountByFeedId` が raw starred articles 由来だと account switch/refetch 中に別 account count が載り得る
  - account switch中 stale starredArticles、adopted feed snapshot、starred smart view tree、count loading の test を追加する

- [ ] P2 sidebar selected account label と adopted feed tree の世代ずれを固定する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sources.ts`, `src/components/reader/sidebar-header-view.tsx`
  - selected account name は raw accounts、feed tree は adopted snapshot のため、accounts refetch 遅延で header と tree が別世代表示になり得る
  - accounts stale + feeds adopted、account rename during switch、selected account missing、fallback label の test を追加する

- [ ] P2 hidden pane focus manager の unmount restore contract を追加する
  - 対象: `src/components/app-layout.tsx`, `src/hooks/use-layout.ts`
  - hidden 時に tabindex を書き換えた subtree が subscriptions layout などで unmount される経路の focusability restore が薄い
  - mobile hidden pane -> subscriptions open/close、lazy child追加、tabindex restore、unmount cleanup の test を追加する

- [ ] P2 account pane focus request に generation/cleanup を追加する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-controller.ts`
  - `requestAnimationFrame`/`setTimeout` が account list/layout/account count 変更後も残ると、別 pane へ遅れて focus し得る
  - focus account list then layout switch、account deleted before timeout、unmount cleanup、RAF unavailable の test を追加する

- [ ] P2 sidebar visibility fallback が feed tree loading 中に `selectAll` へ倒れる契約を見直す
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`, `src/components/reader/hooks/sidebar/use-sidebar-visibility-fallback.ts`
  - `firstFeedId` が loading 中 `null` だと hidden smart/tag fallback が feed ではなく all を選び、load 完了後も戻らない可能性がある
  - hide tags/starred while feeds loading、first feed appears later、no feeds account、fallback reason の test を追加する

- [ ] P2 article search loading state が stale search results を現行 query と扱わないようにする
  - 対象: `src/components/reader/hooks/article-list/use-article-list-view-state.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`
  - `searchResults !== undefined` なら `isSearching` でも loading にならず、query change 直後に旧結果を現行 query の結果として表示し得る
  - query A result後 query B fetching、account switch中 search、empty result transition、selected cleanup の test を追加する

- [ ] P2 search mode の primary loading と source/search fetching の責務を分ける
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/components/reader/hooks/article-list/use-article-list-effects.ts`
  - search 表示中に source data と search data のどちらが現行か不明な瞬間があり、空状態や selected cleanup が早く走る可能性がある
  - source refetch + search fetching、selected article in old search result、query clear during refetch、empty state delay の test を追加する

- [ ] P3 stale remote folder retention を subscription sync の期待値として固定する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - remote folders は upsert 中心なので、provider から消えた folder が残る場合の feed assignment / UI 表示方針が曖昧
  - remote folder deleted、folder API temporarily empty、feed still references old folder、manual local folder、warning vs cleanup policy の test を追加する

- [ ] P3 `listArticles` / `listAccountArticles` overloaded positional args を object params へ寄せる候補を作る
  - 対象: `src/api/tauri-commands.ts`, `src/hooks`, `src/components/reader/hooks/article-list`
  - overloaded positional args は `listArticles(feedId, 20, 50)` と `listArticles(feedId, true, 20, 50)` の読み間違いを誘発しやすい
  - all overload shapes、boolean+offset/limit、numeric first arg、invalid negative offset、object-param migration plan の test を追加する

- [ ] P3 dev web preview geometry fixture と HTML artifact の contract を強める
  - 対象: `src/dev/web-preview-geometry.ts`, `dev-web-preview-geometry.html`, `src/__tests__/dev`
  - geometry fixture の path / rail CSS variable / colors が fixture 内だけにあり、実 HTML との contract が文字列 contains 以上に薄い
  - generated HTML path link parity、CSS variables applied once、rail labels present、nested origin URL resolution の test を追加する

- [ ] P3 Sidebar feed/tags section open state の remount persistence policy を決める
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-runtime.ts`, `src/components/app-layout.tsx`
  - section collapse state が hook-local のため、subscriptions workspace や layout remount でユーザーの閉じた状態が戻る
  - collapse feeds/tags -> workspace open/close、wide/mobile switch、sidebar unmount/remount、storage owner の test を追加する

- [ ] P2 `pnpm-lock.yaml` の transitive duplicate major を supply-chain TODO として棚卸しする
  - 対象: `pnpm-lock.yaml`, `package.json`, `scripts/quality-baseline.ts`
  - `lru-cache` や `signal-exit` など複数 major が残ると、依存更新時の CVE triage と bundle size 判断が属人化しやすい
  - duplicate major inventory、direct/transitive分類、known acceptable allowlist、lockfile drift report の script task を追加する

- [ ] P2 Tauri app identifier と dev/prod data directory の collision を repo contract にする
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/tauri.dev.conf.json`, `src-tauri/tauri.release.conf.json`, `scripts/seed-dev-db-from-prod.ts`
  - dev/prod identifier が近く、seed script や keyring service 名が依存するため、config drift がデータ破壊につながりやすい
  - dev identifier、release identifier、app name、keyring service、data dir resolver の test を追加する

- [ ] P2 Android/iOS icon assets の stale generated set を release smoke で検出する
  - 対象: `src-tauri/icons`, `src-tauri/tauri.conf.json`, `tests/release-repo-contract.test.ts`
  - desktop app でも mobile icon set が repo にあり、source icon 更新時に一部解像度だけ古いまま残ると package metadata が不整合になる
  - required icon list、missing density、stale timestamp/hash policy、unused icon cleanup、tauri icon command note の contract を追加する

- [ ] P2 CSS token と Storybook reference specimen の required token coverage を固定する
  - 対象: `src/styles/global.css`, `src/components/storybook`, `src/__tests__/components/ui-reference-specimen-registry.test.ts`
  - token 追加時に reference canvas へ specimen がないと、UI review で semantic token の実見た目を確認できない
  - new semantic token、removed token、state token、surface token、reference specimen mapping の test を追加する

- [ ] P2 Base UI wrapper の `data-slot` contract を primitive ごとに固定する
  - 対象: `src/components/ui`, `src/__tests__/components/ui-reference-settings-canvas.test.tsx`
  - UI reference tests が一部 slot を見るだけだと、wrapper refactor 時に `data-slot` が消えて design/debug tooling が壊れやすい
  - button/select/dialog/tooltip/scroll-area/skeleton slot、asChild、disabled/loading state の component contract を追加する

- [ ] P2 `DESIGN.md` / `.claude/rules` の UI rule と actual tokens の drift を検出する
  - 対象: `DESIGN.md`, `.claude/rules`, `src/styles/global.css`, `src/__tests__/config/repo-contracts.test.ts`
  - rules に残った古い radius/spacing/color 方針が実 CSS と違うと、別 agent が古い rule に従って UI を戻しやすい
  - radius scale、semantic color names、motion constants、forbidden palette notes、docs link の contract を追加する

- [ ] P2 `AGENTS.md` thin-router contract と CLAUDE.md rule links の drift を gate にする
  - 対象: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/README.md`, `src/__tests__/config/repo-contracts.test.ts`
  - agent guidance の入口が複数あるため、AGENTS.md が厚くなるか CLAUDE.md link が壊れると別 agent の作業基準が割れる
  - read order、thin router phrase、rules index link、missing linked rule、duplicate policy の repo contract を追加する

- [ ] P2 Markdown lint exclude glob と generated docs / target docs の追加漏れを検出する
  - 対象: `mise.toml`, `src/__tests__/config/repo-contracts.test.ts`, `src-tauri/target/doc`
  - target docs や generated markdown が増えた時に lint 対象へ混ざると、TODO追記や docs変更の検証が unrelated failure になりやすい
  - target doc exclude、generated docs exclude、new worktree exclude、markdownlint args、Windows run parity の contract を追加する

- [ ] P2 `parseJsonWithSchemaOrNull` 呼び出し元の silent fallback owner を棚卸しする
  - 対象: `src/schemas/parse.ts`, `src/schemas/storage.ts`, `src/stores/preferences-store.ts`
  - malformed JSON を null に潰す helper は便利だが、fallback owner が明確でないと data corruption を silent cleanup してしまう
  - storage cleanup owner、preference load owner、command history owner、diagnostics owner、throwing boundary との使い分け task を追加する

- [ ] P2 schema `.strict()` / `.passthrough()` の選択理由を schema ごとに repo contract 化する
  - 対象: `src/api/schemas`, `src/schemas`, `src/__tests__/api/schemas.test.ts`
  - DTO schema が strict と passthrough で混在しており、backend trusted / frontend guard の境界が schema 追加時に揺れやすい
  - command response strict、event payload passthrough、dev options strict、storage cleanup、unknown enum の schema policy test を追加する

- [ ] P2 `AppErrorSchema` の message length と newline/control char policy を backend と同期する
  - 対象: `src/api/schemas/error.ts`, `src-tauri/src/commands/dto.rs`, `src/lib/ui-errors.ts`
  - backend AppError message がそのまま toast/diagnostics に流れるため、長文・改行・control char の扱いを揃えないと UI 崩れや log injection になり得る
  - huge message、multiline、control char、URL token、user-visible vs diagnostics の Rust/TS contract を追加する

- [ ] P2 `CountResponseSchema` の safe integer / max cap を Rust count DTO と同期する
  - 対象: `src/api/schemas`, `src-tauri/src/commands/dto.rs`, `src/hooks/use-badge.ts`
  - count response を TS number で受けるため、Rust 側 usize/i64 の巨大値が safe integer を超える場合の UI 表示が未契約
  - max safe integer、negative impossible、overflow fixture、badge cap、toast copy の schema test を追加する

- [ ] P2 API schema barrel export の dead schema / missing schema を knip 以外で検出する
  - 対象: `src/api/schemas/index.ts`, `src/api/tauri-commands.ts`, `src/__tests__/api/schemas.test.ts`
  - schema 追加時に barrel export や command usage へ接続されないと、knip baseline 更新まで死蔵 schema に気づきにくい
  - exported unused schema、used unexported schema、command response without schema、deprecated schema allowlist の repo contract を追加する

- [ ] P2 type-surface contract を remaining `.types.ts` allowlist の ratchet gate にする
  - 対象: `tests/helpers/type-surface.ts`, `tests/type-surface-contract.test.ts`, reader/settings/subscriptions の `.types.ts`
  - type surface helper が入った後も allowlist が広いままだと、view-local props や hook-private params が再び shared `.types.ts` に戻りやすい
  - current allowlist snapshot、new exported Props/Params/Result rejection、intentional public contract annotation、TODO link required の repo contract を追加する

- [ ] P3 generated Tauri schema files を source edit しないルールを repo contract にする
  - 対象: `src-tauri/gen/schemas`, `CLAUDE.md`, `src/__tests__/config/repo-contracts.test.ts`
  - generated schema を人手で編集すると次回 generate で消えるが、agent が巨大 JSON を修正対象にしやすい
  - generated file banner、write-scope rule、schema regeneration command、diff review warning の docs/contract task を追加する

- [ ] P3 UI reference canvas の日本語/英語 dual-locale smoke を最小化して追加する
  - 対象: `src/components/storybook`, `src/__tests__/components/ui-reference-settings-canvas.test.tsx`
  - 現状の reference canvas は日本語長文や英語短文の片方に寄りがちで、locale 切替時の overflow を事前に見つけにくい
  - Japanese long labels、English labels、button min width、toolbar overflow、settings row height の focused smoke を追加する

- [ ] P3 `MemoryStorage` test shim と browser Storage spec の差分を明文化する
  - 対象: `tests/setup.ts`, `src/__tests__/helpers/test-setup-storage.test.ts`
  - test shim が browser Storage と完全一致しない場合、quota/security error や key ordering の test が false green になりやすい
  - property access、key ordering、quota unsupported、SecurityError fallback、clear/remove semantics の helper contract を追加する

- [ ] P3 `resolveLayout` の `contentMode` 未使用を compact empty pane contract として整理する
  - 対象: `src/hooks/use-layout.ts`, `src/stores/ui-store.ts`
  - `focusedPane === "content"` なら `contentMode: empty` でも content pane を維持するため、compact/mobile の空画面遷移が意図か事故か曖昧
  - compact focused content + contentMode empty/browser/reader、clearArticle、closeBrowser parity の test を追加する

- [ ] P3 account switcher focus restore の RAF unavailable fallback を追加する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-account-switcher.ts`
  - focus restore が `requestAnimationFrame` を直接呼ぶため、test/jsdom polyfill 欠落や unusual WebView で落ちる可能性がある
  - requestAnimationFrame missing、close with restoreFocus、unmount before frame、fallback sync focus の test を追加する

- [ ] P2 mailto subject/body truncation を grapheme-safe にする
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/__tests__/components/article-share-menu.test.tsx`
  - `slice(0, maxLength)` は surrogate pair や combining mark を分割し、メールクライアントに壊れた subject/body を渡し得る
  - emoji title、combining mark title、CJK long body、URL truncation、encoded mailto length の test を追加する

- [ ] P2 mailto open failure を share/copy runtime error taxonomy に寄せる
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/api/tauri-commands.ts`, `src/lib/ui-errors.ts`
  - mailto は `openExternalUrl` の error.message をそのまま toast するため、copy/open/reading-list と同じ runtime unavailable や invalid URL の分類がずれやすい
  - opener unavailable、invalid mailto、permission denied、runtime unavailable、redacted URL toast の test を追加する

- [ ] P2 old unread confirm 後の target deletion / scope drift を latest count と mutationで固定する
  - 対象: `src/components/reader/hooks/feed-actions/use-old-unread-read-action.ts`, `src-tauri/src/commands/article_commands.rs`
  - confirm 表示後に feed/folder/tag/account が削除または切替されると、再 count はしても mutation の target owner と UI feedback が曖昧
  - target deleted before confirm、scope changed、account switch、latest count not found、mutation error toast の test を追加する

- [ ] P2 old unread context menu presets を backend allowed range と同期する
  - 対象: `src/components/reader/old-unread-context-menu-items.tsx`, `src/api/schemas/commands.ts`, `src-tauri/src/commands/article_commands.rs`
  - UI preset は 7/30/90 固定だが backend days range と別定義なので、将来 preset 追加時に schema/Rust validation とずれやすい
  - preset inventory、0/negative days rejection、max days、localized label、schema/Rust parity の test を追加する

- [ ] P2 native menu async action failure を action boundary の toast/diagnostics に揃える
  - 対象: `src/lib/actions.ts`, `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`
  - menu 起点の fullscreen/browser navigation/update/sync が console.error 中心だと、ユーザー操作として失敗したのに feedback が出ない path が残る
  - fullscreen failure、browser back failure、update check failure、sync failure、toast vs diagnostics-only policy の test を追加する

- [ ] P2 browser close buffered action を consecutive action queue として固定する
  - 対象: `src/lib/actions.ts`, `src/stores/ui-store.ts`, `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - `pendingBrowserCloseAction` は単一 slot なので、close animation 中に next/prev/feed action が連打されると最後だけ残る設計が意図か曖昧
  - rapid next/prev、feed then article、Escape close、flush once、drop vs last-wins policy の test を追加する

- [ ] P2 OPML parser の root namespace / case sensitivity policy を固定する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - parser は raw element name `opml` / `outline` を見るため、namespace 付き OPML や case variant を拒否/許可する方針が fixture 化されていない
  - namespaced opml、uppercase OPML、outline namespace、body-less opml、root before XML decl noise の test を追加する

- [ ] P2 OPML parser の deep nesting / stack growth limit を決める
  - 対象: `src-tauri/src/infra/opml.rs`
  - outline stack は無制限に伸びるため、巨大/悪意ある OPML で memory/CPU を使い、import UI が固まる可能性がある
  - 100/1000 nested folders、max depth rejection、error copy、partial feed discard、streaming parser memory の test を追加する

- [ ] P2 OPML attribute decoding の invalid key/value lossy policy を固定する
  - 対象: `src-tauri/src/infra/opml.rs`
  - attribute key は lossy UTF-8、value は unescape error で fail するため、壊れた OPML の skip/fail boundary が分かりにくい
  - invalid UTF-8 attr key、invalid value entity、duplicate invalid attr、lossy key ignored、malformed XML error の test を追加する

- [ ] P2 OPML generator の replacement character policy を import round-trip と同期する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - XML 1.0 invalid char を U+FFFD に置換するため、export -> import で title/url が変わることを user-visible summary と test に残す必要がある
  - invalid title char、invalid folder char、invalid URL char、round-trip title changed、export warning/summary policy の test を追加する

- [ ] P2 Base UI menu item async onClick の rejection handling を shared menu policy にする
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/components/reader/*context-menu*.tsx`, `src/lib/runtime/diagnostics.ts`
  - async `onClick` が component ごとに try/catch されるため、Base UI 側で rejection が握り潰される path の user feedback が揺れやすい
  - copy rejection、reading list rejection、mailto rejection、context menu mutation rejection、diagnostics once の test を追加する

- [ ] P3 context menu `data-action-id` naming と analytics/debug trace を repo contract にする
  - 対象: `src/components/reader/*context-menu*.tsx`, `src/lib/debug/debug-input-trace.ts`
  - `data-action-id` が kebab/suffix/manual string に分散しており、debug HUD や tests で action を追う時に rename 漏れが出やすい
  - action id inventory、submenu day suffix、delete/rename ids、debug trace label、test selector stability の contract を追加する

- [ ] P3 OPML parser/generator corpus を checked-in fixture directory に分離する
  - 対象: `src-tauri/src/infra/opml.rs`, `tests/fixtures`, `docs/feed-content-privacy.md`
  - OPML variants が Rust unit 内 string に散ると、実 reader 由来の fixture 追加や privacy review がやりにくい
  - fixture directory、redacted real OPML、round-trip fixtures、invalid fixture naming、privacy checklist の task に分割する

- [ ] P2 article reader scroll position retention policy を決める
  - 対象: `src/components/reader/hooks/article`, `src/stores/ui-store.ts`
  - article 切替、feed 切替、browser overlay close、account switch で scroll を残すか戻すかが曖昧だと閲覧復帰が不安定になる
  - same article revisit、新規 article reset、browser close return、account switch、reduced motion の期待値を固定する

- [ ] P2 toast / live-region announcement queue を設計する
  - 対象: `src/components/app-shell.tsx`, `src/stores/ui-store.ts`
  - persistent toast、error toast、auto-dismiss toast が短時間で置換されると screen reader へ重要メッセージが届かない
  - rapid toasts、persistent toast then auto toast、close action、aria-live text、duplicate suppression を固定する

- [ ] P2 native titlebar drag region と interactive controls の overlap を検証する
  - 対象: `src/components/app-shell.tsx`, `src/components/reader/browser-overlay-chrome.tsx`, global CSS
  - compact layout や browser overlay 中に drag strip が toolbar/settings/browser controls を覆うとクリック不能になる
  - settings open、browser overlay、compact account pane、top toolbar controls、pointer-events の実機確認を追加する

- [ ] P2 app update restart prompt と dirty form / pending mutation の衝突を防ぐ
  - 対象: `src/hooks/use-updater.ts`, `src/components/settings`, `src/components/add-feed`
  - update restart が add feed、credential edit、settings setup sync の途中で走ると入力や mutation 結果を失う
  - add feed pending、credential draft dirty、settings setup sync、restart confirm、cancel flow の期待値を固定する

- [ ] P2 private data reset order を credentials / DB / localStorage / query cache で固定する
  - 対象: settings data reset flow、credential commands、query client
  - reset が途中失敗すると keyring、DB、localStorage、query cache のどれかだけ残り、次回起動で ghost state になる
  - keyring delete failure、DB cleanup failure、storage cleanup、query cache clear、app reload の contract を追加する

- [ ] P2 query retry default policy を command side effect と read query で分ける
  - 対象: `src/lib/query/query-client.ts`, `src/hooks/create-query.ts`, `src/api/tauri-commands.ts`
  - validation/auth/permission error まで retry すると toast 重複や副作用の再実行につながる
  - validation error no retry、network retry、auth no retry、permission no retry、diagnostics labeling を固定する

- [ ] P2 app boot root missing error を fallback UI と telemetry-free log に寄せる
  - 対象: `src/main.tsx`, `index.html`
  - root element drift 時に console error だけだと production blank screen の原因がユーザーに伝わらない
  - root missing、duplicate root、render throw、safe fallback text、no telemetry side effect の test を追加する

- [ ] P2 Rust provider test HTTP server の port isolation / shutdown contract を作る
  - 対象: `src-tauri/src/infra/provider/*` tests
  - fixed port や server shutdown 漏れがあると parallel test で flake し、provider boundary の regression を隠す
  - port `0` binding、parallel tests、shutdown、request timeout、panic cleanup の helper 化を行う

- [ ] P2 sanitizer dependency update contract を allowed tags / attrs snapshot で固定する
  - 対象: article sanitizer、`ammonia` dependency 周辺
  - sanitizer dependency 更新で allowed tags/attrs が変わると article 表示・privacy・search text が同時に変わる
  - allowed tags、allowed attrs、blocked protocol、style stripping、search text parity の fixture を追加する

- [ ] P2 bundled icon / asset provenance と third-party attribution を棚卸しする
  - 対象: `src-tauri/icons`, app assets, release docs
  - generated asset や外部 asset の source/license が不明なままだと release review で止まりやすい
  - source asset record、generated sizes、license note、release artifact contains expected icons の check に分ける

- [ ] P3 Tailwind arbitrary values inventory と token 化候補を整理する
  - 対象: `src/**/*.tsx`, CSS
  - arbitrary width/height/z-index/color が増えると design token と responsive constraints のレビューが効かなくなる
  - layout-critical、motion-critical、z-index、one-off allowed、token candidate に分類する

- [ ] P3 Storybook a11y addon violations を focused allowlist 付き gate にする
  - 対象: `.storybook`, storybook tests
  - addon を入れていても allowlist と focused story がないと、違反検知が noise になって CI gate へ上げられない
  - known violation allowlist、critical components、dialog stories、keyboard stories、CI smoke の単位に分ける

- [ ] P3 React test helpers の `MutationObserver` / `ResizeObserver` cleanup を共通化する
  - 対象: `src/__tests__`, test setup
  - observer mock の cleanup が test ごとに違うと、後続 test の resize/layout 判定が flake する
  - setup helper、afterEach cleanup、observer callback ordering、fake timers、StrictMode double invoke の確認を追加する

- [ ] P1 OS keyring orphan credential cleanup を account delete / rename / reset と同期する
  - 対象: `src-tauri/src/infra/keyring_store.rs`, account commands, settings data reset
  - account 削除や rename 後に古い credential entry が残ると、復元・debug・reset の時に ghost account として再浮上する
  - delete success、delete keyring failure、rename rollback、reset partial failure、orphan inventory の contract を追加する

- [ ] P1 article link opener の `rel` / URL redaction / private host policy を固定する
  - 対象: article content rendering、external opener、URL schemas
  - sanitized HTML 内の link が opener policy を迂回すると、token URL や private host を外部に開く可能性がある
  - `target=_blank`、`rel=noopener noreferrer`、credential URL、private host、malformed href、relative href の fixture を追加する

- [ ] P2 `robots` / provider block response を sync backoff と user action で分ける
  - 対象: local provider sync、`src-tauri/src/service/sync_scheduler.rs`, sync result UI
  - 403/429/451/503 を同じ failure として扱うと、backoff・toast・manual retry の意味がずれる
  - 403 forbidden、429 retry-after、451 unavailable legal、503 temporary、manual retry allowed の期待値を固定する

- [ ] P2 feed item GUID collision policy を account/feed boundary で固定する
  - 対象: article repository、local provider normalizer、sync flow
  - 異なる feed で同じ GUID、空 GUID、URL 変更があると article merge や unread/star が壊れる
  - same GUID different feed、empty GUID fallback、URL-only identity、title-only feed、feed URL changed の contract を追加する

- [ ] P2 article canonical URL と feed entry link の normalization policy を決める
  - 対象: provider normalizer、article schemas、external opener
  - tracking query、fragment、relative link、HTML entity decode の扱いが未固定だと dedupe と opener がずれる
  - query retention、fragment retention、relative link base、HTML entity decode、invalid URL fallback を固定する

- [ ] P2 sync scheduler system sleep / clock jump recovery を contract 化する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, startup/sync-on-wake
  - macOS sleep や手動時刻変更後に next_sync/backoff が過去・未来へ飛ぶと sync が止まるか連打される
  - sleep resume、clock backward、clock forward、backoff expired during sleep、manual sync after resume を固定する

- [ ] P2 app local time / UTC persistence の boundary を DB fields ごとに棚卸しする
  - 対象: domain models、SQLite repositories、date helpers
  - DB persisted date が UTC なのか local string なのか混在すると sort、sync、review stale day が環境依存になる
  - `created_at`、`updated_at`、`published_at`、`last_sync_at`、`next_retry_at` の timezone contract を書く

- [ ] P2 clipboard copy payload の size cap / permission denied / newline policy を固定する
  - 対象: `src/lib/runtime/clipboard.ts`, `copy_to_clipboard` command, share actions
  - 巨大 text、改行混在、権限拒否、runtime unavailable を generic failure にすると復旧と redaction が難しい
  - size cap、CRLF normalization、permission denied、runtime unavailable、redacted diagnostics を追加する

- [ ] P2 filesystem path normalization を log/backup/export/settings で共通化する
  - 対象: log commands、database backup/export commands、Tauri path helpers
  - symlink、non-UTF8 path、reserved name、case-insensitive collision の扱いが command ごとに違うと platform bug になる
  - symlink、non-UTF8、Windows reserved name、case collision、path redaction の matrix を作る

- [ ] P2 atomic file write policy を export / backup / dev credential store で揃える
  - 対象: OPML export、DB backup、dev credential file store
  - 途中失敗で target file を半端に残すと、次回 import/restore/debug で正常ファイルとして扱われる
  - temp file、fsync、rename failure、existing file collision、cleanup failure の contract を追加する

- [ ] P2 React StrictMode double invoke で native command wrapper が二重実行されないか棚卸しする
  - 対象: hooks that invoke Tauri commands in effects、query/mutation wrappers
  - effect mount 時の command 実行が StrictMode で二重になり、sync/check/update/open が重複する可能性がある
  - startup sync、updater check、platform info、log dir opener、browser webview create の inventory を作る

- [ ] P2 React Query cache persistence しない前提を reload/boot contract として固定する
  - 対象: query client、startup loaders、settings/account state
  - reload 後に query cache が空になる前提が implicit だと、future persistence 導入時に stale account/feed が混ざる
  - reload empty cache、startup refetch、account deleted、offline boot、query key versioning の contract を追加する

- [ ] P2 locale pluralization / count formatting を unread/feed/article count で固定する
  - 対象: `src/locales/*`, reader/sidebar/settings count labels
  - interpolation parity だけでは 0/1/2/large count、日本語/英語の複数形、桁区切りが検出できない
  - zero、one、many、large number、negative fallback、locale switch の copy test を追加する

- [ ] P2 article content image loading policy を privacy / performance として固定する
  - 対象: article renderer、sanitizer、browser/external opener policy
  - remote image を即読みするか、lazy/load block するかが曖昧だと IP leak と巨大画像 performance 問題になる
  - `loading=lazy`、referrer policy、blocked private image URL、broken image、huge dimensions の fixture を追加する

- [ ] P2 mock data に実在ドメインを使う場合の network isolation policy を決める
  - 対象: `src/dev/mock-data.ts`, dev mocks, storybook
  - mock URL が実在ドメインだと、画像・favicon・browser open が accidental network access になる
  - example domain、real domain allowlist、favicon mock、external opener stub、storybook isolation の方針を固定する

- [ ] P2 Tauri permission/capability の generated allowlist を command ownership ごとに分割する
  - 対象: Tauri capabilities、command registry、release contract
  - 1 つの capability snapshot だけだと、reader/browser/settings/debug のどの機能が権限を必要とするか追えない
  - browser、settings、debug/log、database、updater、share command group に分けて drift test を追加する

- [ ] P3 dependency license inventory を pnpm/Cargo 両方で生成可能にする
  - 対象: `package.json`, `src-tauri/Cargo.toml`, release docs
  - JS/Rust の片方だけ license 棚卸しすると、release review や store 配布で抜ける
  - pnpm licenses、cargo licenses、unknown license、dual license、generated report location の task に分ける

- [ ] P3 markdownlint 対象 file count / ignore pattern drift を repo contract にする
  - 対象: markdownlint config、`TODO.md`, docs, generated dirs
  - generated markdown や temporary docs が lint 対象に混ざると、TODO 追加だけで unrelated lint が落ちる
  - target file count、ignore dirs、generated docs、skill docs、root markdown の check を追加する

- [ ] P3 dev scenario fixture freshness を UI route / command schema と同期する
  - 対象: `src/dev/scenarios`, dev mocks, command schemas
  - scenario は便利だが、command schema や route rename から遅れるとデバッグ時だけ壊れる
  - scenario id registry、command coverage、route existence、mock data owner、screenshot smoke の task に分ける

- [ ] P1 XML entity expansion / external entity policy を feed parser boundary で固定する
  - 対象: `src-tauri/src/infra/provider/local.rs`, feed parser dependency, parser fixtures
  - RSS/Atom/OPML の XML parsing が entity expansion や external entity をどう扱うか未固定だと、巨大展開・外部参照・parse hang の原因になる
  - nested entity、external entity、DOCTYPE、large text node、parser timeout/size cap の fixture を追加する

- [ ] P1 IDNA / punycode / IPv6 zone identifier の private host 判定を URL schema 全体で固定する
  - 対象: URL schema、feed discovery、OPML import、external opener
  - `xn--` host、Unicode host、IPv6 zone id、mixed-case host が command ごとに違うと SSRF guard と opener policy がずれる
  - IDNA host、Unicode host、IPv6 zone id、localhost alias、percent-encoded host、trailing dot の contract を追加する

- [ ] P1 release build で `DEV_CREDENTIALS` / dev mock / debug scenario が有効化されない gate を作る
  - 対象: `scripts/lib/windows-dispatch.ts`, `src/dev`, Tauri release config
  - dev credential や dev scenario が release artifact に到達すると credential handling と privacy boundary が壊れる
  - release env、dev config、debug scenario import、mock runtime install、artifact smoke の check を追加する

- [ ] P2 article/feed/folder/tag/account name の Unicode bidi / confusable display policy を決める
  - 対象: domain validation、settings forms、reader/sidebar display
  - RTL override、zero-width、confusable 文字が入ると feed name や action target が spoof され、delete/rename 確認で誤認しやすい
  - bidi control、zero-width joiner、NFKC confusable、trim display、confirmation label の policy を追加する

- [ ] P2 batch read/star/mute mutations の transaction chunking policy を決める
  - 対象: article commands、repository mutation methods、reader bulk actions
  - 大量記事を一括更新する時に 1 transaction/分割/partial success の方針が曖昧だと UI と DB がずれる
  - large batch、chunk failure、partial rollback、query invalidation、progress feedback の task に分ける

- [ ] P2 migration transactional DDL / partial migration failure recovery を明文化する
  - 対象: `src-tauri/src/infra/db/migration.rs`, migration files
  - SQLite DDL と data migration の途中失敗後に再起動しても安全かが曖昧だと、復旧不能な半端 schema が残る
  - DDL failure、data copy failure、schema_version unchanged、backup rollback、retry migration の fixture を追加する

- [ ] P2 background sync battery / CPU guard を repeated failure と many-account で固定する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, sync settings, diagnostics
  - 多数 account が失敗し続けると backoff があっても wake/check/log が増えて desktop app の常駐負荷になる
  - many accounts、continuous auth failure、network offline、scheduler sleep、log rate limit の contract を追加する

- [ ] P2 offline/online signal と native network error classification の関係を決める
  - 対象: frontend runtime boundary、sync trigger UI、domain network error
  - `navigator.onLine` と Rust HTTP error が食い違うと、manual sync button や toast が誤った復旧案を出す
  - online false、online true but DNS failure、captive portal、manual retry、sync scheduler の期待値を固定する

- [ ] P2 CSP dev/prod drift を script/style/connect/font で release gate 化する
  - 対象: Tauri config、Vite dev config、release smoke
  - dev HMR 用 CSP と production CSP がずれると、release だけ blank screen または不要に広い permission になる
  - script-src、style-src、connect-src、font-src、dev HMR exception、release artifact CSP の check を追加する

- [ ] P2 article HTML table / code block / pre layout overflow を reader visual contract にする
  - 対象: article content view CSS、sanitized HTML fixtures
  - wide table、long code line、preformatted text が pane 外へ出ると reader/browser overlay/control と重なる
  - wide table、long URL、long code line、mobile width、copy/select behavior の visual fixture を追加する

- [ ] P2 image/fallback favicon cache eviction を account/feed deletion と同期する
  - 対象: favicon/image cache helpers、feed deletion flow、storage cleanup
  - feed 削除後に favicon/image failure cache が残ると、同じ URL 再追加時に古い失敗状態を引き継ぐ
  - feed delete、feed URL change、account delete、cache TTL、manual refresh の contract を追加する

- [ ] P2 locale resource lazy load failure を app boot / settings language switch で固定する
  - 対象: i18n setup、settings language actions、app shell fallback
  - locale JSON load/parse failure 時に raw key 表示、blank UI、old locale 維持のどれにするか未固定だと復旧しにくい
  - missing locale file、invalid JSON、switch failure、old locale retention、diagnostics once の test を追加する

- [ ] P2 platform permission denied を file/dialog/keyring/clipboard ごとに user action copy へ落とす
  - 対象: Tauri command wrappers、runtime error taxonomy、settings/debug UI
  - permission denied を generic error にすると、macOS privacy settings や Windows policy の復旧案が出せない
  - file access denied、dialog denied、keyring denied、clipboard denied、action-specific copy の matrix を作る

- [ ] P2 updater downloaded artifact cleanup を cancel / failed install / app restart で固定する
  - 対象: updater hook、updater commands、release docs
  - download 済み artifact が cancel や failed install 後に残ると、次回 check/install が stale artifact を使う可能性がある
  - cancel、download failure、install failure、restart before install、cleanup diagnostics の contract を追加する

- [ ] P2 Tauri event listener leak を route transition / settings modal / browser overlay で計測する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, app shell hooks, browser overlay hooks
  - route/modal/overlay の開閉で listener が積み上がると、sync progress や browser event が重複処理される
  - route transition、settings open/close、browser open/close、account switch、StrictMode の listener count test を追加する

- [ ] P2 command palette action execution を stale selection / closed palette / modal open で固定する
  - 対象: command palette controller/actions、global action dispatcher
  - palette close と action 実行の間に selection や modal state が変わると、意図しない account/feed/action が走る
  - stale selection、palette closed before resolve、modal already open、async action failure、focus restore の contract を追加する

- [ ] P3 dependency update smoke を React Query / Zustand / Tauri / Vite の breaking behavior ごとに分類する
  - 対象: `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.lock`, quality baseline
  - lockfile 更新で runtime behavior が変わる dependency と pure dev dependency を同じ扱いにすると review が粗くなる
  - query caching、store equality、Tauri API、Vite dev server、test runner の smoke task に分ける

- [ ] P3 generated fixture / snapshot size budget を repo contract にする
  - 対象: tests fixtures、storybook snapshots、report outputs
  - fixture や report が肥大化すると lint/check が遅くなり、TODO 追加や small refactor の feedback loop が悪化する
  - max fixture size、snapshot count、report artifact ignore、large corpus directory、review exception の policy を追加する

- [ ] P1 app shutdown 中の background sync / DB write / browser webview cleanup を drain する contract を作る
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/service/sync_scheduler.rs`, browser webview tracker, DB commands
  - window close や restart 中に sync/DB write/webview close が走ると、WAL・query cache・native webview state が中途半端に残る
  - close requested、restart app、sync in-flight、DB write in-flight、browser webview open、timeout forced exit の contract を追加する

- [ ] P1 startup database init panic を recoverable startup error UI へ寄せる
  - 対象: `src-tauri/src/lib.rs`, DB init, startup fallback UI
  - `panic!` で起動失敗するとログを読めないユーザーに復旧手順が届かず、migration/permission/disk full の切り分けができない
  - migration error、permission denied、disk full、backup exists、redacted path、support copy の期待値を固定する

- [ ] P1 release build に debug-only MCP bridge plugin が混入しない repo contract を追加する
  - 対象: `src-tauri/src/lib.rs`, Tauri release config, release smoke
  - debug 専用 plugin が release artifact に入ると、不要な local port や inspection surface を配布してしまう
  - debug build includes bridge、release build excludes bridge、capability diff、open port smoke、artifact symbol/config check を追加する

- [ ] P1 Tauri command blocking DB work を `spawn_blocking` / async boundary で分類する
  - 対象: `src-tauri/src/commands`, repository access, `AppState` DB mutex
  - async command 内で重い SQLite 処理を直接実行すると、runtime worker を詰まらせて sync・updater・webview events が遅延する
  - list/search/export/vacuum/import/repair command の blocking classification と focused benchmark を追加する

- [ ] P2 main window close confirmation と dirty/pending state registry を native close event へ接続する
  - 対象: `src-tauri/src/lib.rs`, app shell dirty-state registry, settings/add-feed flows
  - OS の close button は frontend navigation guard を通らないため、dirty form や pending mutation を落とす可能性がある
  - native close requested、dirty settings、add feed pending、sync pending、restart requested、force close の flow を固定する

- [ ] P2 window size/position restore を multi-monitor / disconnected monitor / negative coordinates で固定する
  - 対象: Tauri window config, platform store, startup focus restore
  - 外部 monitor を外した後の保存位置や negative coordinate を復元すると、window が画面外に出る
  - disconnected monitor、negative x/y、DPI change、maximized state、fullscreen state、safe fallback center の contract を追加する

- [ ] P2 native file dialog extension / overwrite confirmation policy を import/export/backup で揃える
  - 対象: OPML import/export、DB backup/restore UI、Tauri dialog usage
  - open/save dialog の拡張子・既存 file overwrite・cancel handling がばらつくと、ユーザーデータを誤上書きしやすい
  - `.opml`/`.xml` filter、existing file overwrite、cancel result、directory selected、extension auto-append の policy を追加する

- [ ] P2 app data directory rename / bundle identifier migration path を明文化する
  - 対象: `src-tauri/tauri*.conf.json`, startup data dir, release docs
  - bundle identifier を変えると OS app data dir が変わり、既存 DB/credentials/log が見えなくなる
  - old identifier detection、DB migration prompt、credential migration impossible copy、log path note、rollback の contract を追加する

- [ ] P2 `AppState` mutex poisoning を command surface 全体で同じ error に揃える
  - 対象: `commands::*`, `AppState`, DB/browser tracker mutex access
  - 一部 command だけ poisoned mutex を panic/unwrap すると、単一 command failure が app 全体 failure に広がる
  - DB mutex、browser tracker mutex、pending update mutex、syncing flag、diagnostics category の matrix を作る

- [ ] P2 recent article history limit と persistent storage / DB history の役割を整理する
  - 対象: `src-tauri/src/domain/constants.rs`, `record_article_view`, reader history UI
  - hardcoded 50 件の意味が未明確だと、履歴 UI や storage cleanup で期待がずれる
  - max count、duplicate article revisit、account delete、feed delete、clear history、migration の contract を追加する

- [ ] P2 release app first-run permission prompts を manual verification checklist に入れる
  - 対象: `docs/release-manual-verification.md`, packaged app smoke
  - file dialog、keyring、clipboard、network などの初回 permission prompt を見ないと、配布後の初回 UX が確認できない
  - first keyring access、first file dialog、first clipboard copy、first network sync、denied permission の checklist を追加する

- [ ] P2 OS sleep中の updater download / file export / DB backup を cancellation-aware にする
  - 対象: updater hook、export/backup commands、runtime lifecycle
  - laptop sleep で long-running file/network operation が中断すると、partial artifact や stale progress が残る
  - sleep during download、sleep during export、sleep during backup、resume cleanup、progress reset の contract を追加する

- [ ] P2 Windows hidden console policy と crash visibility の両立を検証する
  - 対象: `src-tauri/src/main.rs`, Windows release smoke, logging
  - release で console window を消す設定は必要だが、startup panic 時の recovery surface が log/UI にないと完全に無音で落ちる
  - hidden console、startup panic、log written、message box/fallback UI、exit code の manual check を追加する

- [ ] P2 production log timezone strategy を UTC/local のどちらにするか support docs と同期する
  - 対象: `src-tauri/src/lib.rs`, log docs, support workflow
  - release log が local time だと timezone をまたぐ報告で sync/update 時刻の突合が難しくなる
  - local timezone、UTC alternative、DST boundary、log filename/time display、support copy の policy を決める

- [ ] P3 Windows dispatch env allowlist を dev credential 以外の future env 追加に備えて schema 化する
  - 対象: `scripts/lib/windows-dispatch.ts`, dev scripts
  - env forwarding が ad hoc だと、future secret env を WSL->Windows へ漏らすか、必要 env を渡し忘れる
  - allowlist schema、secret denylist、path env、dev-only env、test fixture の task に分ける

- [ ] P3 release/debug feature flag inventory を generated report にする
  - 対象: `cfg(debug_assertions)`, `DEV_*` env, dev modules, Tauri configs
  - debug/release 分岐が増えると、どの機能がどの build に入るかレビューしにくい
  - Rust cfg、Vite env、dev module import、Tauri dev config、release artifact expected absence を一覧化する

- [ ] P1 file drop / drag-and-drop import surface を URL validation と同じ security boundary にする
  - 対象: Tauri window events、OPML import UI、file path handling
  - OS の file drop が dialog flow を迂回すると、拡張子・サイズ・symlink・private path の validation を抜ける可能性がある
  - dropped OPML、dropped directory、symlink file、huge file、multiple files、cancel/ignore feedback の contract を追加する

- [ ] P1 single-instance / second-launch behavior を sync/update/dirty state と接続する
  - 対象: Tauri app lifecycle、window focus restore、update restart、dirty-state registry
  - 2 回目起動時に既存 window を focus するだけか、URL/action を渡すかが未固定だと、sync 中や dirty form 中に state が壊れる
  - second launch、hidden/minimized window、dirty settings、sync in-flight、update pending、focus failure の contract を追加する

- [ ] P1 stale update install と DB migration version の compatibility gate を作る
  - 対象: updater flow、DB migration、release metadata
  - 古い downloaded update を後で install すると、現在 DB schema と想定 migration path がずれる可能性がある
  - downloaded version age、current app newer、DB schema newer、install blocked、redownload required の contract を追加する

- [ ] P2 sync result warning cap と aggregation order を many-feed failure で固定する
  - 対象: sync result DTO、frontend sync feedback、diagnostics
  - 数百 feed の失敗を全部 toast/log に出すと UI と log が埋まり、逆に cap すると重要エラーが落ちる
  - warning cap、first error priority、auth vs parse order、per-feed summary、details drilldown の contract を追加する

- [ ] P2 sync warning public copy から provider remote entry id を外す
  - 対象: `src-tauri/src/commands/sync_providers.rs`, sync warning DTO、sidebar/account sync warning tests
  - pending mutation retry warning が remote_entry_id を user-facing message に含むと、provider 固有 ID や URL-like id が toast/sidebar に露出し、diagnostics redaction と責務がずれる
  - retry pending、dropped mutation、provider id with URL/token-like text、diagnostics detail vs public copy、sidebar warning rendering の contract を追加する

- [ ] P2 sync feedback の blank account name fallback を user-facing copy と diagnostics detail に分ける
  - 対象: `src/lib/sync/sync-result-feedback.ts`, `src/__tests__/lib/sync-result-feedback.test.ts`, sidebar/account sync warning UI
  - account_name が blank の時に account_id を表示名として使うと、内部 ID が toast/sidebar に出る一方、support diagnostics では account_id が必要になる
  - blank account name、deleted account、unknown scheduler owner、public unknown-account copy、diagnostics account_id retention の contract を追加する

- [ ] P2 sync feedback action owner label を i18n / public copy source に寄せる
  - 対象: `src/lib/sync/sync-result-feedback.ts`, reader/sidebar i18n、sync feedback tests
  - action owner label が `credentials` / `feed` / `scheduler` の hardcoded English だと、locale 変更や user-facing copy policy とずれやすい
  - ja/en owner label、unknown owner fallback、account owner no suffix、snapshot copy、translator key coverage の test を追加する

- [ ] P2 dropped pending mutation を user-visible sync warning / diagnostics summary に接続する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, sync result warning aggregation、pending mutation repository tests
  - non-GReader feed entry 向け pending mutation は現在 cleanup されるが、warn log だけだと local action が remote に反映されなかった事実を UI で追えない
  - non-provider-managed feed entry、missing article target、delete failure、summary count、manual resync guidance の contract を追加する

- [ ] P2 article tag relation uniqueness を DB constraint / frontend optimistic state で固定する
  - 対象: tag repository、article tag picker、tests
  - 同じ article/tag relation が二重登録されると count、picker chips、remove 操作が壊れる
  - duplicate tag_article、optimistic duplicate、untag one of duplicates、count query、DB unique constraint の contract を追加する

- [ ] P2 window drag region と file drop region の pointer event priority を検証する
  - 対象: app shell CSS、native titlebar overlay、drag/drop handlers
  - titlebar drag、browser overlay、file drop overlay が同じ上部領域を使うと、クリック/ドラッグ/drop の優先順位が壊れる
  - titlebar drag、toolbar click、file hover、drop cancel、browser overlay open の visual/manual check を追加する

- [ ] P2 long-running operation progress event monotonicity を import/export/sync/update で揃える
  - 対象: sync progress events、OPML import/export UI、updater events
  - progress が戻る、100% 後に error、session id なしで別操作に混ざると UI が信用できなくなる
  - monotonic percent、session id、100 then error、cancel, restart after failure の contract を追加する

- [ ] P2 memory pressure / OOM risk を large feed import と article render で smoke 化する
  - 対象: local provider parser、OPML import、article content view
  - 巨大 feed や巨大 HTML を parse/render した時に body cap だけでは JS/Rust memory pressure を検出できない
  - large feed entries、large article HTML、many images、large OPML、render abort/fallback の smoke を追加する

- [ ] P2 test suite parallelism と shared global state の isolation policy を明文化する
  - 対象: Vitest setup、Rust tests、global diagnostics/reset helpers
  - parallel test が localStorage、window globals、OnceLock、env vars を共有すると flake が増える
  - env var isolation、OnceLock reset、localStorage reset、fake timers、Rust test threads の policy を追加する

- [ ] P2 Rust integration tests の filesystem temp dir cleanup failure を diagnostics 化する
  - 対象: `src-tauri/tests`, temp DB/keyring fixtures
  - temp dir cleanup が失敗しても見えないと、次回 test や disk usage に影響する
  - temp dir owner、Windows open handle、cleanup failure warning、test retry、artifact retention の task に分ける

- [ ] P2 app action telemetry-free audit log を local diagnostics として持つか決める
  - 対象: app action dispatcher、diagnostics reporter、debug HUD
  - action failure の再現には sequence が必要だが、telemetry なし方針なら local-only・redacted・size-capped の設計が必要
  - local-only log、redaction、size cap、action id、account/feed omission、support copy の decision を追加する

- [ ] P2 user-facing error copy の support code / diagnostics id 方針を決める
  - 対象: `AppError` schema、toasts、dialogs、runtime diagnostics
  - 詳細を隠すほど問い合わせ時の特定が難しくなるため、secret を出さずに照合できる短い code/id が必要か判断する
  - stable error code、diagnostics id、copy in ja/en、log correlation、no secret detail の policy を追加する

- [ ] P3 repository method naming と SQL operation kind の suffix を整理する
  - 対象: `src-tauri/src/repository`, `src-tauri/src/infra/db`
  - `list/find/get/count/save/update` の境界が揺れると、transaction/read-write classification と test naming が追いにくい
  - read-only、write、upsert、bulk、maintenance、raw SQL owner の naming inventory を作る

- [ ] P3 fixture domain names を RFC reserved domains へ寄せる移行計画を作る
  - 対象: `src/dev/mock-data.ts`, tests fixtures, docs screenshots
  - 実在ドメイン fixture が多いと accidental network access と権利/表示変更の影響を受ける
  - `example.com`、`example.jp`、`.test`、allowed real domains、screenshot text の migration plan を作る

- [ ] P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する
  - 対象: `TODO.md`, similarity report, task triage scripts
  - TODO が増え続けると同じ risk を別名で積みやすくなり、優先度判断が鈍る
  - normalized heading、priority bucket、file target overlap、similarity threshold、completed task pruning の report を追加する

- [ ] P1 release rollback / downgrade install を DB schema compatibility として禁止または明示復旧にする
  - 対象: updater flow、release metadata、DB migration
  - 新しい DB schema を触った後に古い app を起動すると、migration downgrade 非対応で data loss や起動不能になる
  - app downgrade detection、schema newer than app、rollback blocked copy、manual restore path、support message の contract を追加する

- [ ] P1 provider response trust boundary を `trusted backend` / `untrusted feed` で型と sanitizer に分ける
  - 対象: provider DTO、article sanitizer、schema-boundary rule
  - FreshRSS/GReader API response と任意 RSS/Atom response を同じ trust level で扱うと、validation/sanitization の責務が曖昧になる
  - trusted API DTO、untrusted feed HTML、provider metadata、error payload、schema strictness の decision を書く

- [ ] P1 credential-bearing URL を persistence boundary で reject する
  - 対象: feed URL、server URL、article URL、history、OPML export
  - `https://user:pass@example.com/feed` のような URL が DB/OPML/history に保存されると、redaction 以前に漏洩面が増える
  - feed add、OPML import、article link、browser history、debug dump、export の reject/redact policy を固定する

- [ ] P1 app log / diagnostics の maximum total size と emergency truncation を固定する
  - 対象: log plugin setup、runtime diagnostics、support dump
  - 連続 failure で log/diagnostics が肥大化すると disk pressure と support copy failure が起きる
  - total log cap、per-event cap、diagnostics ring buffer、truncation marker、copy failure fallback の contract を追加する

- [ ] P2 OS accessibility settings の high contrast / forced colors / increased contrast を design token と同期する
  - 対象: `DESIGN.md`, CSS tokens, app shell, settings/reader views
  - dark/light と reduced-motion だけだと、OS high contrast や forced colors で操作要素の境界が消える
  - forced colors、prefers-contrast、focus ring、selected row、disabled state、browser overlay の visual check を追加する

- [ ] P2 zoom / text scaling 200% で dense reader/settings controls の overflow を検証する
  - 対象: reader article list、settings forms、command palette、dialogs
  - desktop webview の zoom/text scaling で固定高さ row や toolbar button が重なると、accessibility と操作性が落ちる
  - 125/150/200% zoom、large font、narrow width、toolbar icons、form labels の visual smoke を追加する

- [ ] P2 reduced data / low power mode 相当の remote image・background sync 方針を決める
  - 対象: article image loading、sync scheduler、settings
  - OS や user preference で低通信/省電力を求める場合、remote images と background sync をどう抑えるか未固定
  - remote image load、favicon fetch、automatic sync、manual override、settings copy の decision を追加する

- [ ] P2 privacy-preserving feed favicon fetch の referer / user-agent / cache policy を固定する
  - 対象: favicon helpers、feed metadata display、HTTP defaults
  - favicon 取得が article/feed fetch と別経路になると、referer・user-agent・private host guard がずれる
  - no referer、user-agent、private host reject、cache TTL、failure cache、manual refresh の contract を追加する

- [ ] P2 imported OPML account ownership を cross-account duplicate / move flow で固定する
  - 対象: OPML import、feed repository、settings account selection
  - 別 account に同じ feed URL を import する時の duplicate 判定と folder ownership が曖昧だと feed が欠落する
  - same URL different account、same URL same account、folder same name different account、account switch during import、export scope の contract を追加する

- [ ] P2 provider account kind 追加時の migration checklist を template 化する
  - 対象: provider traits、account settings、schema/tests
  - 新 provider を足す時に credential、capability、sync cursor、folder/tag semantics の漏れが出やすい
  - credential model、folder model、tag model、read/star support、cursor support、test fixture checklist を追加する

- [ ] P2 reader search ranking / snippet policy を FTS query syntax と user copy で固定する
  - 対象: FTS search SQL、reader search UI、locale copy
  - FTS syntax error、phrase query、prefix query、snippet escaping の方針が未固定だと search UX が壊れる
  - quote query、special operators、prefix query、empty result, snippet escaped HTML、ranking tie の contract を追加する

- [ ] P2 native notification を導入する場合の permission / privacy / quiet hours policy を先に決める
  - 対象: future notification feature、sync result feedback、settings
  - sync/update/error を native notification に出す場合、feed title や account 名が lock screen に出る可能性がある
  - permission prompt、lock screen privacy、quiet hours、account name redaction、disable setting の decision を追加する

- [ ] P2 system tray / background resident mode を導入する前の lifecycle contract を作る
  - 対象: future tray feature、sync scheduler、window close behavior
  - close で終了する app と tray 常駐 app では shutdown drain、sync scheduler、dirty form guard が変わる
  - close hides window、quit exits app、sync while hidden、update restart、dirty state prompt の decision を追加する

- [ ] P2 custom protocol / deep link を導入する場合の URL schema と single-instance routing を先に決める
  - 対象: future protocol feature、app action dispatcher、single-instance handling
  - external URL から app action を起動できるようにすると、private host/open settings/import などの validation が必要になる
  - protocol allowlist、action mapping、single-instance route、malformed link、security prompt の decision を追加する

- [ ] P2 browser webview state と article reader state の same-origin assumptions を明文化する
  - 対象: browser webview tracker、article content view、URL/open policies
  - embedded browser は remote origin、article content は sanitized local DOM という前提が崩れると focus/script/security boundary が曖昧になる
  - remote origin、local sanitized content、focus bridge、history tracking、script injection allowed surface の contract を追加する

- [ ] P2 storage quota exhausted 時の cascading failure を preferences/sidebar/history/debug で検証する
  - 対象: localStorage-backed helpers、preferences store、runtime diagnostics
  - quota exceeded が一箇所で起きた後に warning storage も書けず、同じ failure が連鎖する可能性がある
  - preferences save、sidebar expanded folders、command history、diagnostics warning-once、recovery UI の contract を追加する

- [ ] P2 frontend schema parse failure の fallback data が UI action を enable しない contract を作る
  - 対象: `src/schemas`, Tauri command wrappers, view models
  - parse failure 時に empty fallback を使うと、本来 disabled にすべき destructive action が enabled になる可能性がある
  - account list parse failure、feed list parse failure、preference parse failure、empty fallback、disabled action の test を追加する

- [ ] P2 Rust test `cfg(test)` と production-only code path の coverage gap を inventory 化する
  - 対象: `src-tauri/src/lib.rs`, `cfg(not(test))` blocks, integration tests
  - plugin setup、startup lifecycle、log setup などが `cfg(not(test))` で外れると unit test だけでは release regression を拾えない
  - plugin setup、log setup、focus restore、scheduler start、cleanup logs、release smoke owner の inventory を作る

- [ ] P3 TODO priority aging policy を作る
  - 対象: `TODO.md`, `.claude/rules/quality-policy.md`
  - P1/P2 が増え続けると、古い高優先度が埋もれて実際の優先度を失う
  - created batch marker、last reviewed date、stale P1 escalation、P3 archive、completed-to-CHANGELOG の運用を決める

- [ ] P3 risk TODO を implementation / contract test / manual verification / rule update へ自動分類する
  - 対象: `TODO.md`, task triage tooling
  - risk 指摘が多いほど「何から実装するか」が見えにくくなるため、作業種別で並列投入しやすくする
  - heading parser、target path extraction、priority extraction、work type classifier、worker batch export の script を追加する

- [ ] P1 backup/export file の privacy level と encryption decision を明文化する
  - 対象: DB backup、OPML export、support dump、docs
  - DB backup や support dump は article/feed/account metadata を含むため、OPML と同じ感覚で共有されると privacy leak になる
  - DB backup、OPML export、diagnostics dump、log zip、encryption required/optional、warning copy の policy を追加する

- [ ] P1 uninstall / reinstall / app data removal の data retention contract を作る
  - 対象: installer/uninstaller docs、app data dir、credentials/keyring
  - app を削除しても DB/log/keyring が残るかどうかが未固定だと、privacy と復旧の期待がずれる
  - macOS app delete、Windows uninstall、reinstall same version、reinstall newer version、manual data removal の checklist を追加する

- [ ] P2 Tauri/macOS sandbox entitlements と file/network/keychain access の将来方針を整理する
  - 対象: Tauri config、release packaging、keyring/file/network commands
  - sandbox や store 配布を考えると、現状の file dialog・keyring・network access が entitlements と合うか早めに分けておく必要がある
  - network client、keychain/keyring、user-selected files、app data dir、external opener の entitlement matrix を作る

- [ ] P2 per-domain sync politeness / concurrency cap を local RSS provider で固定する
  - 対象: local provider sync、sync scheduler、HTTP defaults
  - 同じ host の feed を多数購読していると、manual/all sync で短時間に大量 request を投げる可能性がある
  - same-host concurrency、global concurrency、manual sync override、backoff sharing、user-agent contact docs の policy を追加する

- [ ] P2 provider redirect chain の auth header stripping を same-origin / cross-origin で固定する
  - 対象: GReader/FreshRSS HTTP client、local provider HTTP client
  - redirect 先に Authorization header が残ると、provider credential が別 origin に送られる
  - same-origin redirect、cross-origin redirect、scheme downgrade、userinfo URL、diagnostics redaction の contract を追加する

- [ ] P2 DNS cache / repeated private host resolution の time-of-check/time-of-use policy を決める
  - 対象: private host guard、feed discovery、local provider fetch
  - validation 時と実 fetch 時で DNS 結果が変わると、private host guard が bypass される
  - resolve before fetch、redirect re-resolve、TTL/caching、DNS failure retry、rebinding fixture の policy を追加する

- [ ] P2 local DB encryption at rest を採用しない/する decision record を作る
  - 対象: DB storage、credential storage、privacy docs
  - keyring は credential を守るが、DB には feed/article/history が残るため、暗号化しない理由または将来方針を明文化する必要がある
  - threat model、OS disk encryption reliance、portable backup、search performance、migration cost の decision を追加する

- [ ] P2 OPML export に privacy summary comment を入れる/入れない decision を作る
  - 対象: OPML generator、export docs
  - OPML は共有されやすいが購読傾向や folder 名を含むため、生成物に注意書きを入れるか決めておく
  - comment included/omitted、round-trip compatibility、reader import tolerance、locale copy、user warning の decision を追加する

- [ ] P2 pointer target minimum size を compact toolbar / tree row / tag chip で棚卸しする
  - 対象: reader toolbar、feed tree、tag chips、settings action buttons
  - compact UI でクリック target が小さすぎると、desktop でも誤操作が増える
  - icon button size、row action affordance、tag chip remove、dense sidebar、touch trackpad tolerance の matrix を作る

- [ ] P2 destructive action undo unavailable warning を delete account/feed/tag/history で揃える
  - 対象: destructive dialogs、settings/subscriptions/tag flows
  - rollback 不能な削除で copy がばらつくと、ユーザーが recoverable と誤解する
  - delete account、delete feed、delete tag、clear history、cleanup orphans、backup recommendation の copy contract を追加する

- [ ] P2 user-created names の maximum display width と tooltip policy を dense list で決める
  - 対象: feed tree、account switcher、tag chips、settings lists
  - 長い feed/account/tag 名が layout を押し広げるか、省略されすぎると action target の識別が難しくなる
  - max width、ellipsis、tooltip/title、middle truncation、bidi-safe display の policy を追加する

- [ ] P2 command/action id の public persistence boundary を preference/history/debug で分類する
  - 対象: app action ids、shortcut preferences、command history、debug traces
  - action id を rename すると preference/history/debug が壊れるため、永続化される id と内部 id を分ける必要がある
  - persisted ids、internal-only ids、migration map、debug label、removed action の contract を追加する

- [ ] P2 stale query cache after app version upgrade を schema version / query key version で検出する
  - 対象: React Query keys、startup boot、schema migrations
  - reload 前後や future persistence 導入時に古い query shape が残ると、view model parse が壊れる
  - app version bump、schema version bump、query key version、cache clear、fallback disabled UI の policy を追加する

- [ ] P2 test fixture real date values を frozen clock / relative date policy へ寄せる
  - 対象: tests fixtures、reader/subscription review tests、Rust fixtures
  - 実日付 fixture が現在日に近づくと stale day、grouping、review warning の期待値が時間で変わる
  - frozen clock、relative date builder、timezone fixture、future date、DST boundary の migration plan を作る

- [ ] P3 dependency update review を runtime / dev-only / build-only / transitive risk に分類する
  - 対象: `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.lock`
  - dependency 更新を一律に見ると、runtime security と test-only churn の優先度が混ざる
  - runtime dependency、dev tool、build tool、transitive duplicate、security advisory の review checklist を作る

- [ ] P3 local developer machine state を check に混ぜない reproducibility audit を行う
  - 対象: `mise.toml`, scripts, test setup, release scripts
  - local app running、ports occupied、existing DB、env vars、global pnpm store が check 成否に影響すると第三者再現性が落ちる
  - port state、app process、env vars、home directory files、global cache、timezone/locale の audit を追加する

- [ ] P3 TODO.md から issue / worker prompt を生成する export format を決める
  - 対象: `TODO.md`, task triage tooling, subagent workflow
  - TODO が増えた後に手作業で worker へ渡すと、優先度・検証・スコープが落ちやすい
  - markdown section parser、P1/P2 filter、target files、test plan inference、worker prompt template の task を追加する

- [ ] P1 update/install failure 後の app binary / DB schema / pending update state の三者整合を固定する
  - 対象: updater hook、updater commands、DB migration、startup boot
  - binary は旧版のまま DB だけ migration 済み、または pending update state だけ残ると復旧不能に見える
  - install failure、restart failure、schema migrated、pending update cleared、manual redownload の contract を追加する

- [ ] P1 support dump 生成前に user consent / redaction preview を必須にするか決める
  - 対象: Debug HUD、diagnostics export、support workflow
  - redaction があっても dump の中身をユーザーが確認できないと、購読傾向や環境情報を意図せず共有する可能性がある
  - preview screen、copy summary、redacted fields list、cancel flow、large dump truncation の decision を追加する

- [ ] P1 feed fetch abuse prevention を manual sync / auto sync / discovery で分ける
  - 対象: local provider HTTP client、feed discovery、sync scheduler
  - discovery と sync が同じ host に集中すると、ユーザー操作でも provider 側から abuse と見なされる可能性がある
  - per-host rate、manual burst、auto sync batch、discovery retry、429/403 suppression の contract を追加する

- [ ] P1 corrupted preference row が startup/menu/settings を連鎖的に壊さない quarantine policy を作る
  - 対象: preference repository、startup menu prefs、settings store
  - 1 行の不正 preference で menu rebuild や settings 全体が fallback すると、ユーザーが修復できない
  - unknown key、invalid value、oversized value、menu fallback、settings quarantine/reset の contract を追加する

- [ ] P2 installer upgrade 前後の app data backup recommendation を user-facing flow にする
  - 対象: release notes、manual verification、settings data export
  - data migration を含む release で事前 backup 導線がないと、失敗時にユーザーが戻れない
  - migration release、backup prompt、skip copy、backup failure、restore docs link の policy を追加する

- [ ] P2 app settings export/import を導入する前の schema version / secret exclusion policy を作る
  - 対象: preferences schema、settings data page、credential store
  - 設定 export に credentials や environment-specific paths が混ざると privacy leak と import 事故につながる
  - schema version、credential excluded、local paths excluded、unknown keys、downgrade import の decision を追加する

- [ ] P2 feed parser error sample を support-safe に保存するか決める
  - 対象: local provider parser、diagnostics、support dump
  - parse failure の再現には response sample が有効だが、記事本文や private feed content を保存すると privacy risk になる
  - no sample、redacted prefix、hash only、content-type/status only、user opt-in の decision を追加する

- [ ] P2 provider credential verification request の side effect を account create/update と分離する
  - 対象: account setup、test connection commands、provider HTTP client
  - 接続確認が remote server 側で session/cookie/last-login を更新する場合、保存前の試行が side effect になる
  - verify before save、verify after save、cookie discarded、rate limit、failed verify logging の contract を追加する

- [ ] P2 external browser open queue を rapid clicks / double shortcuts で idempotent にする
  - 対象: `open_in_browser`, app actions, keyboard/menu handlers
  - 同じ article を連打すると複数 browser tab や duplicate Reading List action が出て、ユーザー操作の副作用が大きい
  - double click、key repeat、menu+shortcut race、same URL dedupe window、failure retry の policy を追加する

- [ ] P2 long article virtualization を導入する前の selection/search highlight contract を作る
  - 対象: article content view、search highlight、reader scroll restoration
  - 将来 virtualization を入れると scroll restore、text selection、search highlight、image loading の前提が変わる
  - selection preservation、find-in-article、scroll anchor、image lazy load、print/share future scope の decision を追加する

- [ ] P2 app-level recovery action を error category ごとに整理する
  - 対象: `AppError`, toasts/dialogs, settings debug actions
  - すべての失敗が「再試行」だけだと、permission denied、auth failure、corrupt DB、network offline の復旧が混ざる
  - retry、open settings、open log dir、restore backup、reset local state、contact support の action matrix を作る

- [ ] P2 stale support/debug logs を private data reset と uninstall docs に接続する
  - 対象: log dir、settings data reset、docs
  - DB/credentials を消しても古い logs/support dumps が残ると privacy reset として不完全になる
  - private data reset、manual log deletion、support dump deletion、uninstall docs、failure warning の contract を追加する

- [ ] P2 provider-specific max feed count / article count assumptions を account settings に出すか決める
  - 対象: provider traits、sync scheduler、settings account detail
  - 大量 feed/account で性能が落ちる場合、暗黙 limit のままだと user support が難しい
  - max feeds guidance、max articles guidance、warning threshold、performance diagnostics、no hard limit copy の decision を追加する

- [ ] P3 Rust/TS cross-language enum drift を generated table で見える化する
  - 対象: domain enums、API schemas、frontend constants
  - provider kind、sync status、display mode、error category などの enum が増えると手動 parity test だけでは漏れる
  - Rust enum list、TS schema list、locale labels、unknown fallback、dead variant の report を追加する

- [ ] P3 repository SQL strings を migration-defined table/column inventory と照合する tooling を作る
  - 対象: `src-tauri/src/infra/db`, migrations, repo contract tests
  - column rename や migration 追加後に raw SQL string が古いままでも compiler が拾えない
  - table names、column names、index names、raw SQL parser limits、intentional dynamic SQL allowlist の report を追加する

- [ ] P3 TODO risk register を domain owner 別に shard する計画を作る
  - 対象: `TODO.md`, future task files
  - 1 ファイルに全 risk が積み上がると、reader/settings/release/provider の担当ごとの実行単位が見えにくい
  - reader、settings、provider、release、quality、security/privacy の shard policy と移行手順を決める

- [ ] P1 remote feed content 由来の filename/path suggestion を絶対に使わない contract を作る
  - 対象: OPML export、backup/export dialogs、article share future scope
  - feed title や article title を file name suggestion に使うと、path separator/control char/RTL spoof で危険な保存名になる
  - feed title、account name、article title、control chars、path separators、safe default filename の policy を追加する

- [ ] P2 account recovery flow を credential reset / server URL fix / cache clear の三系統に分ける
  - 対象: account detail settings、sync error UI、diagnostics
  - すべての account failure を「認証情報更新」に寄せると、server URL typo や stale cache の復旧が遠回りになる
  - credential reset、server URL edit、test connection、sync_state clear、pending mutation quarantine の flow を整理する

- [ ] P2 provider-side deleted feed / folder の local retention policy を account kind ごとに固定する
  - 対象: GReader/FreshRSS sync、local repository、subscriptions UI
  - remote で消えた feed/folder を local に残すか消すかが曖昧だと、復活・削除・OPML export の期待値が揺れる
  - remote deleted feed、remote deleted folder、local starred article、pending mutation、manual resubscribe の contract を追加する

- [ ] P2 sync scheduler fairness を many-account / one-slow-account で固定する
  - 対象: sync scheduler、provider fetch loop
  - 1 つの遅い account が他 account の sync を遅らせると、全体の鮮度が落ちる
  - one slow account、many small accounts、manual sync priority、timeout, fairness order の contract を追加する

- [ ] P2 partial sync success の freshness indicator を feed/account/article list で揃える
  - 対象: sync result UI、account detail、sidebar/feed list
  - 一部 feed だけ成功した時に account 全体を fresh と見せると、ユーザーが未更新 feed に気づけない
  - all success、partial success、all failed、stale feed count、last successful feed sync の display policy を追加する

- [ ] P2 support/debug copy に stable app/environment fingerprint を secretなしで含めるか決める
  - 対象: diagnostics dump、support workflow、runtime platform info
  - OS/version/app build がないと問い合わせ再現が難しいが、hostname/path/user名を含めると privacy risk になる
  - app version、commit hash、OS family、arch、locale、timezone offset、excluded hostname の decision を追加する

- [ ] P2 offline-first stale content banner を account/feed/article view で出すか決める
  - 対象: reader UI、sync status、network error taxonomy
  - network failure 中でも古い記事は読めるため、error toast だけでは stale content を見ていることが分かりにくい
  - offline detected、last sync age、manual sync failed、per-feed stale、banner dismiss の policy を追加する

- [ ] P2 keyboard-only recovery actions を error dialog/toast/settings debug で検証する
  - 対象: error surfaces、settings debug actions、toasts
  - 復旧導線が mouse 前提だと、キーボード操作ユーザーが backup restore/open log/retry に到達できない
  - retry button、open settings、open log dir、restore backup、dismiss toast、focus restore の E2E check を追加する

- [ ] P2 screen reader labels for destructive dialogs に対象名と不可逆性を必ず含める
  - 対象: delete account/feed/tag/history dialogs
  - 見出しや本文に対象名があっても、button label だけでは screen reader の action が曖昧になる
  - accessible name、target name、irreversible warning、loading state、failure retry の contract を追加する

- [ ] P2 import/export progress cancellation の confirmation timing を固定する
  - 対象: OPML import/export、DB backup/restore、settings data future flow
  - cancel を押した瞬間に partial file/partial DB state が残る場合、確認なし cancel は危険になる
  - safe cancel、unsafe cancel confirm、partial file cleanup、transaction rollback、post-cancel summary の contract を追加する

- [ ] P2 feed discovery result trust level を UI 表示と add action で分ける
  - 対象: feed discovery、add feed dialog、URL validation
  - discovery で見つかった title/url をそのまま trusted と扱うと、spoofed title や mixed-content URL を add してしまう
  - discovered title display、final URL validation、private URL reject、duplicate URL, user confirmation の contract を追加する

- [ ] P2 malformed provider account config を settings 表示可能な quarantine state にする
  - 対象: account repository、settings account detail、sync scheduler
  - account row が壊れた時に list failure で settings に入れないと、ユーザーが削除/修復できない
  - invalid provider kind、invalid server URL、missing credential ref、settings read-only view、delete/quarantine action の contract を追加する

- [ ] P2 internal dev mock data が product metrics / screenshots に混ざらないよう source label を出す
  - 対象: dev mocks、debug HUD、screenshots/storybook
  - mock data と実データが画面上で区別できないと、レビューやドキュメントで誤解される
  - dev data label、storybook badge、debug HUD source、screenshot naming、release build absence の contract を追加する

- [ ] P3 flaky test quarantine policy を TODO / issue / skip annotation で統一する
  - 対象: tests、quality policy、CI
  - flake を場当たり的に skip すると、未解決リスクが TODO と CI のどちらにも残らない
  - skip annotation format、TODO link、owner、expiry date、retry evidence、unskip gate の policy を追加する

- [ ] P3 risk TODO の acceptance criteria template を定型化する
  - 対象: `TODO.md`, future task generator
  - TODO が多くなるほど「完了条件」が曖昧な項目が増え、実装 worker が scope を広げすぎる
  - 対象、問題、分割、focused test、manual verification、defer 明記の template を作る

- [ ] P1 error fallback が destructive action を隠さず disabled にする共通 contract を作る
  - 対象: settings data actions、account/feed/tag destructive dialogs、query parse fallback
  - エラー時に空配列や default state へ倒すと、対象不明の delete/reset が enabled になる危険がある
  - account load failure、feed load failure、tag load failure、settings parse failure、disabled action reason の test を追加する

- [ ] P2 empty state が permission/auth/network/schema failure を同じ「空」として見せないようにする
  - 対象: reader lists、subscriptions index、settings account views
  - failure を empty と表示すると、ユーザーがデータ消失と誤解するか、復旧 action を見つけられない
  - true empty、auth failure、network failure、schema parse failure、permission denied の copy/state matrix を作る

- [ ] P2 stale warning/banner の dismiss persistence を account/feed/session scope で決める
  - 対象: stale content banner、sync warnings、settings diagnostics
  - 一度閉じた warning が別 account/feed でも消えると重要な failure を見落とし、逆に毎回出ると無視される
  - session dismiss、account scoped dismiss、feed scoped dismiss、new error reopens、manual reset の contract を追加する

- [ ] P2 provider API version / server product detection を capability と diagnostics に接続する
  - 対象: GReader/FreshRSS provider、test connection、account detail
  - FreshRSS 互換 API の実装差がある場合、capability を server version/product から分けないと sync failure が増える
  - product header、version endpoint、missing capability、unknown server、diagnostics label の contract を追加する

- [ ] P2 auth token expiry / refresh semantics を provider ごとに明文化する
  - 対象: GReader/FreshRSS auth flow、credential store、sync scheduler
  - token/session が期限切れになる provider で再ログイン/credential reuse/backoff の方針が未固定だと auth storm になる
  - token expired、refresh success、refresh failure、credential invalid、manual reauth required の contract を追加する

- [ ] P2 provider clock skew と server timestamp を sync cursor/backoff で扱う方針を決める
  - 対象: GReader cursor、sync_state、scheduler backoff
  - server 時刻が client より進む/遅れると future cursor や retry_at が不自然になり、sync が止まる可能性がある
  - server future timestamp、server past timestamp、client clock skew、cursor clamp、diagnostics warning の test を追加する

- [ ] P2 remote delete vs local optimistic mutation conflict を provider capability ごとに固定する
  - 対象: pending mutation replay、sync flow、article cache
  - remote で article/feed が消えた後に local read/star/tag mutation を replay すると、404/skip/rollback の方針が必要になる
  - remote article missing、remote feed missing、mutation replay 404、local cache rollback、user warning の contract を追加する

- [ ] P2 account/feed/tag rename の optimistic UI と backend normalization 差分を固定する
  - 対象: rename account/feed/tag flows、repository validation、query cache
  - frontend 表示名と backend normalized name が違う場合、保存直後にちらつきや duplicate 判定ずれが起きる
  - trim、case fold、Unicode normalization、duplicate after normalization、optimistic rollback の contract を追加する

- [ ] P2 article action undo を導入しない場合の accidental action recovery copy を揃える
  - 対象: mark read/star/tag/mute actions、reader toolbar、context menu
  - 既読・スター・タグ操作は軽いが、undo がないと誤操作時の戻し方が UI surface ごとに違う
  - mark read reversal、star toggle、tag remove/add、bulk mark read、toast copy の policy を追加する

- [ ] P2 context menu target drift を right-click position / keyboard context menu で固定する
  - 対象: article list、feed tree、tag list context menus
  - context menu を開いた後に selection/refetch が変わると、表示対象と実行対象がずれる
  - pointer target snapshot、keyboard context target、refetch while open、target deleted、action disabled の contract を追加する

- [ ] P2 tooltip / title attribute に secret or full URL を出さない privacy contract を作る
  - 対象: feed URL display、account detail、debug/settings tooltips
  - visible text を redaction しても tooltip/title に full URL や path が残ると漏れる
  - feed URL tooltip、server URL tooltip、log path tooltip、article URL tooltip、copy action の redaction test を追加する

- [ ] P2 stale closure in settings save handlers を form revision で guard する
  - 対象: settings forms、account credentials editor、shortcut settings
  - 保存 promise が返る前に別 field を編集すると、古い success/failure が新しい draft state を上書きする可能性がある
  - edit while saving、save success stale、save failure stale、retry latest draft、dirty state の contract を追加する

- [ ] P2 large account switch の query cancellation / stale render budget を計測する
  - 対象: account switcher、reader query hooks、article list/feed tree rendering
  - 記事・feed が多い account 間で切替えると、旧 account の query result や render work が残りやすい
  - old query cancel、new account skeleton、stale result reject、render duration budget、memory budget の smoke を追加する

- [ ] P2 search query syntax help を backend FTS escaping policy と同期する
  - 対象: reader search UI、FTS query builder、locale copy
  - ユーザーが quote/operator を入力した時の扱いが不明だと、検索失敗を bug と誤解する
  - literal search、phrase search、operator escaped、syntax error copy、help text の contract を追加する

- [ ] P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する
  - 対象: `TODO.md`, task triage tooling
  - 目視だけでは P1/P2 の並列投入順を保ちにくい
  - priority parse、target parse、domain bucket、dependency hint、JSON export の script を追加する

- [ ] P3 risk TODO の重複 close / merge workflow を決める
  - 対象: `TODO.md`, CHANGELOG, future issue export
  - 類似タスクを統合する時に片方を消すだけだと、過去の判断理由や検証観点が失われる
  - merge marker、superseded by、completed by、CHANGELOG move、issue link の運用を決める
