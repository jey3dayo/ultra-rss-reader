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

- [ ] P2 Rust app startup filesystem failure diagnostics を補強する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/build.rs`
  - app data dir 作成 / DB init / log cleanup で `expect` / `panic` / silent remove failure が混在しており、packaged startup failure の user-facing message が揺れやすい
  - app data permission denied、DB open failure、log cleanup permission denied の message と recovery guidance を native test / manual verification に分ける

- [ ] P1 child webview command invoke 権限を検証する
  - 対象: `src-tauri/capabilities/default.json`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`
  - embedded webview bridge が native command を invoke する経路は capability / window label / webview label の前提が壊れると packaged app だけで失敗しやすい
  - main webview と child webview の permission 差を整理し、close bridge / back-forward mouse bridge の invoke 可否を manual verification に残す

- [ ] P2 browser diagnostics preference 即時反映 contract を固定する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/preference_commands.rs`
  - native browser diagnostics flag が startup preference だけを読む場合、settings で Debug HUD を切り替えても native emit が即時追従しない可能性がある
  - preference update event / app restart required / frontend-only HUD のどれを正にするか決め、debug diagnostics の manual verification に残す

- [ ] P1 Tauri unstable feature を release build で許可する条件を棚卸しする
  - 対象: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/browser_webview.rs`
  - `tauri` に `unstable` feature が入っているため、release artifact で使ってよい API 面積と将来の breaking risk が明文化されていない
  - unstable API の使用箇所、必要理由、代替可能性、release smoke で見るべき挙動を一覧化し、不要なら feature を外す

- [ ] P2 Tauri CSP の external img/frame 許可面積を feed content / browser webview 境界で整理する
  - 対象: `src-tauri/tauri.conf.json`, `docs/feed-content-privacy.md`, `src/components/reader/article-content-view.tsx`
  - CSP で `img-src` / `frame-src` が `http:` / `https:` を広く許可している場合、feed content と browser webview の責務境界が security config 上で見えにくい
  - reader thumbnail、sanitized article body、Web Preview、child webview の許可面積を threat model と manual verification に分ける

- [ ] P3 feed content privacy hardening の実測タスクを docs checklist と接続する
  - 対象: `docs/feed-content-privacy.md`, `TODO.md`
  - privacy hardening の大枠 TODO だけだと、reader thumbnail、sanitized body remote media、Web Preview の実測観点が混ざりやすい
  - `docs/feed-content-privacy.md` の checklist と TODO の実行単位を対応させ、manual verification を reader thumbnail / sanitized body / Web Preview に分割する

- [ ] P1 manual full sync の並列設計と single DB mutex の噛み合わせを検証する
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/commands/mod.rs`
  - account sync は `join_all` で並列化される一方、DB は `Mutex<DbManager>` で直列化されるため、長い write 中に他 account や UI read が詰まりやすい
  - 複数 account sync 中に list/count command が返る時間を測り、並列度制限、DB operation queue、read path の busy/error policy を固定する

- [ ] P1 sanitizer で許可した media/source/link attribute の privacy policy を固定する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - sanitizer が `source` の `srcset` / `sizes` / `media` などを許可するため、将来 article body rendering が media を増やした時に remote request 面積が広がりやすい
  - reader body で実際に描画される tag/attribute と CSP/privacy doc を照合し、media tag を残す/落とす/手動検証へ分ける

- [ ] P2 local feed sync の article upsert と sync_state 保存を atomic にする
  - 対象: `src-tauri/src/commands/sync_providers.rs`
  - articles/count は保存済みだが validator `sync_state` 保存だけ失敗すると、次回同じ feed を再取得し、逆方向の不整合も将来 refactor で入りやすい
  - `sync_state` table failure test で記事保存済み時の state 方針を固定し、article upsert、mute auto-read、count、state を service transaction へまとめる

- [ ] P2 provider article URL の credential / fragment / control char normalization を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-toolbar-view.tsx`
  - feed item の article URL は open/copy/browser preview に流れるため、`https://user:pass@host`、fragment token、control char をどこで落とすか未固定だと privacy と UI 表示が揺れる
  - normalizer、ArticleDtoSchema、open/copy action のどこで sanitize するか決め、credential-in-URL と invalid URL の fixture を追加する

- [ ] P3 browser overlay close 後の focus return 優先順位を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts`
  - 元の toolbar button 等を記憶していても、選択 article row があれば先にそこへ focus するため、キーボード操作では「閉じたら元の操作ボタンへ戻る」期待とズレやすい
  - open-in-browser button から overlay open/close した時の focus return test を追加し、article row 優先か previous target 優先かを明文化する

- [ ] P2 article view history cleanup / retention policy を決める
  - 対象: `src-tauri/migrations/V17__article_view_history.sql`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/commands/article_commands.rs`
  - viewed history が増え続ける場合、recent view や DB size に効き、削除 feed/account との cascade/no-op も将来 migration で揺れやすい
  - retention days、max rows、account/feed delete cascade、clear history command の count contract を Rust test にする

- [ ] P1 feed folder drag/drop の optimistic rollback を latest-only にする
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/components/reader/hooks/sidebar/use-sidebar-controller-actions.ts`
  - feed を folder A -> B -> C と連続移動した時、古い mutation failure が後から来ると `previousFeedsQueries` で最新の folder state を巻き戻し得る
  - deferred promise で逆順 settle する hook test を追加し、feedId ごとの mutation generation または現在値比較 rollback にする

- [ ] P1 debug input trace が typed key や target text を記録しすぎないようにする
  - 対象: `src/components/app-shell.tsx`, `src/lib/debug-input-trace.ts`, `src/components/settings/debug-settings.tsx`
  - Debug HUD の raw keyboard/pointer trace は入力欄や URL/credential field の target description を扱うため、debug log 上に sensitive interaction が残る可能性がある
  - password/server URL/input/textarea/contenteditable では key value を redact し、trace retention と copy/export 可否を test にする

- [ ] P1 log directory を開く導線の privacy checklist を追加する
  - 対象: `src-tauri/src/commands/log_commands.rs`, `src-tauri/src/lib.rs`, `docs/feed-content-privacy.md`
  - log dir はユーザーが直接開けるため、sync error、browser diagnostics、debug trace に URL query や account data が残ると support 共有時に漏えいしやすい
  - log redaction 対象、retention、manual support 手順を checklist 化し、代表ログに secret-like string が出ない test を追加する

- [ ] P2 app root visibilitychange sync trigger の throttle / cleanup を固定する
  - 対象: `src/App.tsx`, `src/lib/sync/startup-sync-storage.ts`, `src-tauri/src/service/sync_scheduler.rs`
  - visibilitychange や wake/startup sync が重なると、foreground 復帰時に manual sync、automatic sync、startup sync の開始条件が競合しやすい
  - hidden -> visible 連打、sleep wake、startup throttle metadata corruption の sync trigger contract を frontend/store/Rust service で固定する

- [ ] P3 manual sync cooldown listener error aggregation を diagnostics に接続する
  - 対象: `src/lib/sync/manual-sync.ts`
  - cooldown listener が throw しても console error に集約されるだけなので、UI 更新が止まった時にどの subscriber が壊れたか分かりにくい
  - listener id を持つか diagnostics-only に留めるか決め、複数 listener failure の report format を unit test にする

- [ ] P1 destructive action confirmation の対象 snapshot と二重実行 policy を統一する
  - 対象: `src/components/app-confirm-dialog.tsx`, `src/hooks/use-delete-feed.ts`, `src/components/reader/article-list.tsx`, `src/components/settings/mute-settings.tsx`
  - confirm dialog が開いた後に selection や list order が変わると、confirm message と実行対象がズレる destructive action が混ざりやすい
  - feed delete、mark all read、mute keyword delete、account delete の confirm payload を snapshot 化し、confirm 中 loading/disable と double click の contract test を追加する

- [ ] P2 tag mutation の duplicate name / stale article assignment policy を固定する
  - 対象: `src/hooks/use-tags.ts`, `src/components/reader/article-tag-chips.tsx`, `src/components/reader/tag-context-menu.tsx`
  - tag create/rename/assign が複数 UI から実行できるため、duplicate name や article deletion 後の assign/unassign が stale success として見えやすい
  - duplicate name normalization、deleted article/tag、invalidation failure の user-visible message と rollback 方針を hook/component test で固定する

- [ ] P2 feed favicon remote image failure / mixed content policy を固定する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/components/reader/article-list-item.tsx`, `src/components/reader/feed-tree-row.tsx`
  - favicon/thumbnail と本文 sanitizer は別境界なので、http image、tracking query、broken image、SVG data をどこで許可/拒否するかがズレやすい
  - image src scheme、fallback icon、onError retryなし、privacy-sensitive query stripping の方針を component/helper test にする

- [ ] P3 TODO priority taxonomy を CLAUDE.md / TODO.md で同期する
  - 対象: `CLAUDE.md`, `TODO.md`
  - TODO が大量化しているため、P1/P2/P3 の意味が agent ごとに揺れると、重要度の低い cleanup とデータ破壊系リスクが同じ扱いになりやすい
  - P1 は data loss/security/stale destructive action、P2 は runtime boundary/contract drift、P3 は observability/polish のように短い分類を明記する

- [ ] P1 browser webview bounds sync の resize storm と stale native command backlog を抑える
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src-tauri/src/commands/browser_webview_commands.rs`
  - ResizeObserver と window resize が毎回 async sync を投げるため、連続 resize で古い `resize` command が後から届き、WebView bounds が過去の矩形へ戻る可能性がある
  - request generation、latest-only resize、throttle/debounce、native side idempotence を hook/native test と実機計測に分ける

- [ ] P1 startup/update/manual sync の foreground 復帰時 concurrency を system test 化する
  - 対象: `src/App.tsx`, `src/hooks/use-updater.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src-tauri/src/service/sync_scheduler.rs`
  - foreground 復帰時に wake sync、startup throttle、manual sync、updater install gate が近いタイミングで動くため、UI では idle に見えて native 側だけ busy になりやすい
  - app wake、manual sync click、update-ready、scheduler tick を組み合わせた integration test / manual verification checklist を作る

- [ ] P2 Tauri dev server manager が他 repo の Vite process を止める条件を厳格化する
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - port owner 判定が command line の Vite 文字列中心なので、同じ port を使う別 repo の Vite を停止してしまう可能性がある
  - cwd/project root/package name を判定に含めるか user confirmation に逃がし、same repo / other repo / unknown command line の test を追加する

- [ ] P1 local feed 追加の duplicate URL race と rollback cleanup を固定する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - `add_local_feed` は fetch 後に DB 保存するため、同じ URL の並行追加や初期 sync 失敗 rollback で duplicate feed / orphan article / UI selected feed が残りやすい
  - duplicate URL concurrent add、sync failure rollback、unread count recalculation failure、rollback failure warning を Rust command と dialog test で固定する

- [ ] P1 purge_old_articles が開いている記事・tag・history を破壊しない contract を作る
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src/components/reader/article-view.tsx`
  - background sync 後の purge が read article を削除するため、現在開いている read article、tag assignment、recent history、browser preview の参照が消えるタイミングが曖昧
  - selected article が purge 対象、starred/tagged/read history 付き article、account keep_read_items_days 変更直後の behavior を Rust/frontend test にする

- [ ] P1 destructive command の missing target policy を delete/feed/tag/account で揃える
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/tag_commands.rs`, `src-tauri/src/commands/account_commands.rs`
  - `delete_feed` は missing を error にする一方、`delete_tag` は missing no-op になっており、confirm 後の stale target を成功扱いにするかが操作ごとにズレる
  - delete feed/tag/account/mute keyword の missing target、already deleted、cross-account target の policy を command/component test で統一する

- [ ] P2 GReader remote folder removal が local folder assignment を残す条件を固定する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/service/sync_flow.rs`
  - remote subscription から folder が消えた時に existing local folder を保持する helper があり、remote 側の folder removal を反映するのか local override とみなすのか曖昧
  - remote folder present/missing/empty、local manual move 後 sync、remote deleted folder の conflict policy を provider sync test にする

- [ ] P2 update_feed_display_settings の `inherit` / default preference 解決を account/feed context で固定する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src/components/reader/feed-context-menu.tsx`, `src/components/reader/hooks/article-list/use-article-list-header-actions.ts`
  - feed の reader/web preview mode と account/default preference が別経路で解決されるため、`inherit` 表示と実際の article/browser behavior がズレやすい
  - default変更後、feed override解除、folder/context menu からの変更、cache invalidation の contract test を追加する

- [ ] P2 dev mocks の mutation side effect と real DB cascade の差分を検出する
  - 対象: `src/dev/mocks.ts`, `src/dev/mock-data.ts`, `src-tauri/src/infra/db`
  - dev mock の delete_feed/delete_tag/update_folder は配列操作中心で、real DB cascade や foreign key error とズレると Storybook/dev だけ成功する操作が増える
  - delete feed cascading articles/tags/history、delete tag cascade、folder move missing target の dev mock parity test を追加する

- [ ] P2 mute settings auto-mark optimistic rollback を latest-only にする
  - 対象: `src/components/settings/mute-settings.tsx`, `src/hooks/use-mute-keywords.ts`
  - auto-mark toggle は store を先に書き換えて失敗時に previous value を戻すため、ON -> OFF 連続操作で古い failure が最新設定を巻き戻す可能性がある
  - deferred mutation で ON failure / OFF success を逆順 settle させる component test を追加し、revision guard または current value compare rollback にする

- [ ] P3 backup/log file path を user-facing diagnostics に出す時の redaction policy を統一する
  - 対象: `src-tauri/src/infra/db/backup.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/log_commands.rs`
  - startup DB error は database path を出す一方、log dir command は generic message に閉じており、support/debug のためにどこまで local path を出すかが境界ごとに揺れている
  - user-visible path、diagnostics-only path、privacy-sensitive username redaction の基準を CLAUDE/rules か contract test にする

- [ ] P1 GReader push mutation の partial remote success を idempotent にする
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - remote mutation を順番に POST するため、途中 failure の retry で既に成功した read/star/unstar が再送され、local pending state と remote state の対応が曖昧になりやすい
  - per-mutation ack、remote idempotency、retry dedupe、partial failure diagnostics の policy を決め、2件目 failure と retry の Rust test を追加する

- [ ] P2 GReader stream id pull の cardinality / memory cap を決める
  - 対象: `src-tauri/src/infra/provider/greader.rs`
  - read/starred stream id は 1 page 10000 件を最大 100 page 集め得るため、大規模 account で memory と sync duration が跳ねやすい
  - page cap、total id cap、dedupe timing、partial sync warning、timeout の Rust test を追加する

- [ ] P2 GReader quickadd 後 subscription matching を remote id substring 依存から外す
  - 対象: `src-tauri/src/infra/provider/greader.rs`
  - quickadd 後の subscription 探索が `url` 等価または `remote_id.contains(url)` に依存しており、URL normalization 差や substring collision で別 feed を選ぶ可能性がある
  - quickadd response id、canonical URL、feed URL list、ambiguous match error のどれを正にするか決め、collision fixture を追加する

- [ ] P2 GReader label remote id の percent decode / path separator contract を固定する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src/lib/folders`, `src/api/schemas/commands.ts`
  - remote label id を percent decode して folder name / remote id へ戻すため、invalid UTF-8、slash、blank label、case collision の扱いが曖昧だと folder sync が壊れやすい
  - invalid percent encoding、`/` を含む label、duplicate label、system label ignore の Rust test を追加する

- [ ] P2 generic sync_flow の remote subscription 保存が duplicate FeedId を作らないようにする
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`
  - generic provider sync は remote subscription ごとに `FeedId::new()` で保存するため、同じ remote feed が再取得された場合の upsert key が provider 実装に依存しやすい
  - provider_account_id + remote_id unique、feed_url fallback、legacy duplicate merge、deleted/recreated feed の Rust test を追加する

- [ ] P2 provider normalizer の site_url / icon_url scheme policy を frontend opener と揃える
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/components/reader/article-browser-actions.ts`, `src/api/schemas/commands.ts`
  - feed metadata 由来の site_url / icon_url が unsupported scheme、userinfo、private host、very long URL を含む場合の保存・表示・open policy が provider 側だけでは見えにくい
  - scheme allowlist、private host display、credential redaction、max length、open failure の backend/frontend test を追加する

- [ ] P3 provider HTTP defaults を source of truth 化する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/infra/http.rs`
  - timeout、user-agent、redirect policy、max body size が discovery/local provider で個別定義されると、新しい provider 追加時に security boundary が揺れやすい
  - shared config、per-provider override、test fixture default、dev override の方針を決め、HTTP client construction test を追加する

- [ ] P1 sync-on-wake の rejected promise を app boundary で必ず捕捉する
  - 対象: `src/App.tsx`, `src/api/tauri-commands.ts`, `src/lib/sync/manual-sync.ts`
  - visibilitychange から `void runSyncOnWakeRef.current()` を呼ぶため、`listAccounts` や `syncAccount` が throw/reject した場合に unhandled rejection になり、UI には何も出ず wake sync が失敗する可能性がある
  - listAccounts throw、1 account reject、Promise.all fail-fast、success+failure mixed、次回 wake retry の component test を追加する

- [ ] P1 article search の FTS/LIKE 全件 materialize を bounded pagination にする
  - 対象: `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/commands/article_commands.rs`
  - search は FTS と LIKE の全 hit を Vec に集めてから dedupe/sort/pagination するため、大量記事や短い query で memory と latency が急増しやすい
  - top-N merge、per-query cap、timeout、short query rejection、large account fixture の Rust benchmark/contract test を追加する

- [ ] P1 macOS background browser open の child process failure を user-visible にする
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/components/reader/article-browser-actions.ts`
  - background open は `open -g` を spawn してすぐ成功扱いにするため、`open` command の終了失敗や LaunchServices error が toast/diagnostics に残らない
  - spawn failure、non-zero exit、stderr redaction、foreground fallback、unsupported platform の Rust command test / manual verification を追加する

- [ ] P2 startup sync throttle を account scope / clock skew / storage tamper 込みで固定する
  - 対象: `src/lib/sync/startup-sync-storage.ts`, `src/App.tsx`, `src/constants/ui-runtime.ts`
  - startup sync throttle は localStorage の単一 timestamp で全 account を抑制するため、account switch、時計戻り、future timestamp tamper、storage migration failure 時の再実行範囲が分かりにくい
  - account-scoped key、future timestamp cleanup、legacy key migration、private mode storage unavailable の unit/component test を追加する

- [ ] P2 sync-on-wake の per-account failure を Promise.all fail-fast から集約 diagnostics にする
  - 対象: `src/App.tsx`, `src/hooks/use-feeds.ts`, `src/lib/query/query-invalidation.ts`
  - 複数 account を並列 sync する時、1 account の throw/reject が他 account の結果待ちや warning 集約を壊すと、どの account が成功/失敗したか見えにくい
  - `Promise.allSettled`、per-account warning、partial success invalidation、sync_on_wake off account skip の component test を追加する

- [ ] P2 Tauri dev Vite manager が SIGTERM で止まらない process を扱えるようにする
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - stale Vite を SIGTERM した後は port が空くまで待つだけなので、process が signal を無視すると dev server 起動が timeout し、次の対処が手動 kill になりやすい
  - graceful timeout、SIGKILL fallback opt-in、foreign process には絶対 kill しない guard、timeout message の test を追加する

- [ ] P2 Tauri dev Vite manager の port owner 判定を package cwd / command args まで見る
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - command line が `pnpm exec vite` なら同 repo の dev server とみなすため、別 repo の同名 command や wrapper 経由 Vite を誤停止しない保証が弱い
  - cwd extraction、script path、configured port、package root marker、unknown owner の safe failure test を追加する

- [ ] P2 tauri-cli-dispatch の forwarded env を spawn spec と child env で一致させる
  - 対象: `scripts/tauri-cli-dispatch.ts`, `scripts/lib/windows-dispatch.ts`, `src/__tests__/scripts/tauri-cli-dispatch.test.ts`
  - WSL 経由の spawn spec は env override を作る一方、local spawn では `process.env` をそのまま渡すため、Windows interop と local 実行で secret filtering / path conversion の境界がズレやすい
  - forwarded env allowlist、secret-like value redaction、local vs WSL parity、spawn error diagnostics の script test を追加する

- [ ] P3 matchMedia listener fallback の duplicate registration / cleanup drift を fixture 化する
  - 対象: `src/lib/runtime/match-media-listener.ts`, `src/stores/preferences-store.ts`, `src/hooks/use-app-icon-theme.ts`
  - modern `addEventListener` が throw して legacy `addListener` へ fallback する WebView では、cleanup 側の API 差で duplicate listener が残っても検出しにくい
  - addEventListener throw、removeEventListener throw、legacy add/remove、listener double-fire の unit test を追加する

- [ ] P3 native menu action id と frontend action registry の drift を snapshot で検出する
  - 対象: `src-tauri/src/menu.rs`, `src/lib/actions.ts`, `src/hooks/use-menu-events.ts`
  - menu id、action id、keyboard shortcut hint が Rust と TS に分散しており、片側だけ追加されると native menu 経由だけ no-op になりやすい
  - action id list snapshot、unknown menu action diagnostics、shortcut hint parity、locale label existence の test を追加する

- [ ] P1 React Doctor の `role-has-required-aria-props` error を test harness から潰す
  - 対象: `src/__tests__/hooks/use-article-tag-picker-popover.test.tsx`, `src/components/reader/hooks/article/use-article-tag-picker-popover.ts`
  - test 内の `role="option"` に `aria-selected` がなく、React Doctor が error 扱いしているため、実 component 側の listbox contract も同じ抜けを見落としやすい
  - test harness と実 view の option selected state、roving focus、screen reader label を揃え、React Doctor 再実行で error 0 を確認する

- [ ] P1 React Doctor の mutation invalidation warning を実バグ / false positive に分類する
  - 対象: `src/hooks/use-articles.ts`, `src/hooks/use-delete-feed.ts`, `src/hooks/use-tags.ts`, `src/hooks/create-mutation.ts`
  - `useMutation` の cache update warning が 6 件あり、local patch だけで足りる mutation と query invalidation が必要な mutationが混在している
  - setRead/toggleStar/recordView/deleteFeed/tagArticle の onSuccess 後 cache state を hook test で固定し、false positive は helper contract へ逃がす

- [ ] P2 React Doctor score を local gate として drift 検出する
  - 対象: `package.json`, `mise.toml`, `CLAUDE.md`, `TODO.md`
  - 現状 full scan は 86/100 で、今後の React 変更が score を下げても `mise run check` だけでは気づけない可能性がある
  - `npx -y react-doctor@latest . --verbose --diff` の実行タイミング、score threshold、known warning baseline、CI に入れる/入れない境界を決める

- [ ] P2 React Doctor の unused type / unused export を機械削除できる単位へ分ける
  - 対象: `src/stores/ui-store.ts`, `src/api/tauri-commands.ts`, `src/constants/*`, `src/components/**`, `tests/helpers/*`
  - unused type 67 件、unused export 58 件が出ており、公開 contract と dead surface が混ざると型配置整理や import 移動のたびに判断コストが増える
  - public API、test helper、storybook/dev-only、real dead code に分類し、worker 単位で削除または contract test へ明示する

- [ ] P2 runtime hook の sequential await warning を latest-only queue と両立して整理する
  - 対象: `src/hooks/use-badge.ts`, `src/hooks/use-app-icon-theme.ts`, `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`
  - React Doctor は sequential await を警告しているが、badge/icon は最新 request だけ適用する queue と絡むため、単純な `Promise.all` 化で ordering を壊しやすい
  - independent な await だけ並列化し、latest-only queue が必要な箇所はコメントと test で sequential contract を固定する

- [ ] P2 article tag picker outside-click を pointer / touch / portal owner document で固定する
  - 対象: `src/components/reader/hooks/article/use-article-tag-picker-popover.ts`, `src/components/reader/article-tag-picker-view.tsx`
  - outside close が `mousedown` の document listener だけに依存しており、touch/pointer、portal、iframe/WebView ownerDocument 差で閉じない・閉じすぎる挙動が出やすい
  - pointerdown/touchstart、ownerDocument cleanup failure、inside click、trigger click、Escape close の component test を追加する

- [ ] P2 article reader body の anchor listener を delegation 化する候補を検証する
  - 対象: `src/components/reader/article-reader-body.tsx`, `src/components/reader/article-content-view.tsx`
  - sanitized HTML 内の全 anchor へ個別 listener を張るため、長文記事や頻繁な article 切替で listener attach/detach のコストと stale anchor cleanup が増えやすい
  - container-level click delegation、nested element click、modifier key、relative URL、article切替時 cleanup の component test を追加する

- [ ] P2 settings add account form の preventDefault warning を Tauri form contract として整理する
  - 対象: `src/components/settings/add-account/form-view.tsx`, `src/components/settings/add-account/account-config-form-view.tsx`
  - React Doctor は form `preventDefault` を progressive enhancement warning として出すが、Tauri app では native command submit が正なので、button/form semantics の意図を明文化しないと毎回 noise になる
  - `type=submit` / `onSubmit` / Enter key / disabled submitting / no-JS 非対応方針を component test と suppression policy へ整理する

- [ ] P3 React 19 deprecated API warning を context wrapper 単位で移行判断する
  - 対象: `src/components/settings/shared/settings-content-layout.tsx`, `src/components/settings/**`
  - React Doctor は `useContext` を React 19 の `use()` 移行候補として検出しているが、現時点で全体方針がないまま局所移行すると style が揺れる
  - React 19 API adoption policy、compiler有無、library compatibility、context read test を整理し、移行するなら settings shared から小さく始める

- [ ] P3 React Doctor の `.toSorted()` / combine-iterations 指摘を test/dev と production で分けて処理する
  - 対象: `src/__tests__/**`, `tests/helpers/**`, `src/dev/**`, `src/lib/**`
  - `.toSorted()` 29 件、combine iterations 59 件は test/dev noise と production hot path が混在しており、一括置換すると Node/WebView target や readability を崩しやすい
  - runtime target、polyfill不要性、production-only優先、test helper bulk rewrite の順でバッチ化する

- [ ] P3 React Doctor scan 結果の baseline 保存場所を決める
  - 対象: `TODO.md`, `CLAUDE.md`, `.claude/rules/*`, `mise.toml`
  - full diagnostics は temp path に出るだけなので、known issue と新規 regression の差分を別エージェントが追いにくい
  - baseline を TODO に積むか rule/gate に昇格するか決め、score、error count、warning category、scan command を短い記録として残す

- [ ] P1 React Doctor diff scan の changed-file warning を先に潰す
  - 対象: `src/__tests__/hooks/use-browser-webview-events.test.tsx`
  - `npx -y react-doctor@latest . --verbose --diff` は 99/100 だが、未コミット差分内に `.map().filter()` の `js-combine-iterations` warning が 1 件残っている
  - 既存負債より先に current diff を clean にし、focused test と React Doctor diff scan で新規 warning 0 を確認する

- [ ] P2 React Doctor full scan と diff scan の gate 役割を分ける
  - 対象: `mise.toml`, `CLAUDE.md`, `TODO.md`
  - full scan は 86/100 で既存 warning 274 件、diff scan は 99/100 で 1 件なので、同じ threshold にすると小変更が既存負債に巻き込まれる
  - diff scan は新規 regression gate、full scan は baseline 改善 task として扱い、error count、warning count、score の記録粒度を決める

- [ ] P2 React Doctor / Knip の tool version と baseline drift を固定する
  - 対象: `package.json`, `pnpm-lock.yaml`, `mise.toml`, `TODO.md`
  - `npx -y react-doctor@latest` は tool 更新で warning 数や rule 名が動くため、別エージェントの TODO 追加と実装修正が同じ物差しで比較しにくい
  - React Doctor version pin、Knip version / config、baseline更新手順、latest試験の別枠運用を決める

- [ ] P2 React Doctor unused type を settings view contract 単位で整理する
  - 対象: `src/components/settings/accounts-nav-view.tsx`, `src/components/settings/settings-nav-view.tsx`, `src/components/settings/actions-settings-view.tsx`, `src/components/settings/mute-settings-view.tsx`, `src/components/settings/settings-preference.types.ts`, `src/components/settings/add-account/services.types.ts`
  - unused type warning が settings view と add-account contract に散っており、view-local props と public settings contract が混ざったまま残りやすい
  - local type 化、export削除、view contractとして残す型の命名を分け、settings-nav/page/modal 再設計バッチとは衝突しない単位で進める

- [ ] P2 React Doctor unused type を reader / query helper 単位で整理する
  - 対象: `src/components/reader/article-toolbar-view.tsx`, `src/components/reader/feed-tree-view.tsx`, `src/components/reader/rename-feed-dialog-view.tsx`, `src/components/reader/article-tag-picker.types.ts`, `src/components/reader/sidebar-sources.types.ts`, `src/lib/reader/reader-query.ts`, `src/lib/query/query-invalidation.ts`
  - reader 側の unused type は view-local props、query helper contract、hook result が混在しており、一括削除すると public surface を壊しやすい
  - component-local props は colocate、query/helper の export は参照元を確認し、barrel / contract test で必要なものだけ残す

- [ ] P2 React Doctor unused export を test helper / Storybook / runtime helper に分類する
  - 対象: `tests/helpers/i18n-setup.ts`, `tests/helpers/fixtures.ts`, `e2e/storybook/storybook-index-payload.ts`, `src/components/settings/shared/settings-action-button.tsx`, `src/components/shared/icon-toolbar-control.tsx`, `src/hooks/use-updater.ts`, `src/components/reader/hooks/browser/use-browser-url-effect.ts`
  - unused export 58 件は public API、test fixture、Storybook helper、実 dead code が混ざっており、機械削除だけだと外部 entrypoint を壊す可能性がある
  - entrypoint として必要な export は contract test へ明示し、不要な helper export はファイル内 private 化または削除する

- [ ] P2 React Doctor async-await-in-loop を test contract と runtime hook で分けて処理する
  - 対象: `src/__tests__/api/tauri-commands.test.ts`, `src/__tests__/api/browser-webview-command-contract.test.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`, `src/hooks/use-badge.ts`, `src/hooks/use-app-icon-theme.ts`, `scripts/tauri-dev-vite-manager.ts`
  - sequential await warning 25 件は order-dependent contract test と独立処理の performance issue が混在している
  - order が必要な test は理由を明示し、独立 command / fixture setup は `Promise.all` / `Promise.allSettled` 化して flake と実行時間を下げる

- [ ] P2 seed-dev-db script の independent await を Promise.all 化できるか検証する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - React Doctor の `async-parallel` が script 内の 3 sequential await を検出しており、dev data refresh が不要に遅くなる可能性がある
  - DB connection、backup/read、transform、write の依存関係を明確にし、独立処理だけ並列化して error diagnostics を維持する

- [ ] P3 Tailwind redundant size axes を design primitive から小さく潰す
  - 対象: `src/components/reader/account-switcher-view.tsx`, `src/components/shared/nav-row-button.stories.tsx`
  - React Doctor の `design-no-redundant-size-axes` が `w-4 h-4` を検出しており、Tailwind v3.4+ なら `size-4` に寄せられる
  - production component を先に直し、Storybook は visual diff 影響がない範囲で同じ表記へ揃える

- [ ] P3 React Compiler 未導入状態の採用判断メモを作る
  - 対象: `CLAUDE.md`, `.claude/rules/*`, `TODO.md`, `vite.config.ts`
  - React Doctor は React 19.2.6 を検出している一方で React Compiler は未検出なので、今後の memoization / effect cleanup の判断基準が compiler 有無で揺れやすい
  - すぐ導入するかではなく、compiler adoption preflight、unsupported pattern scan、performance gate、opt-in/opt-out 方針を task 化する

- [ ] P2 storage schema の chained transform を single-pass helper へ寄せる
  - 対象: `src/schemas/storage.ts`, `src/__tests__/schemas/storage-schema-contract.test.ts`
  - React Doctor の `js-combine-iterations` が production schema の同一行を重複検出しており、key/value normalization が増えるほど parse 時の中間配列が増えやすい
  - schema strictness を変えず、unknown key、blank value、duplicate storage entry、malformed persisted value の contract test を維持して single-pass 化する

- [ ] P2 dev mocks の repeated array chain を fixture builder 単位で整理する
  - 対象: `src/dev/mocks.ts`, `src/__tests__/dev/dev-mock-data.test.ts`
  - React Doctor の `js-combine-iterations` が dev mocks に集中しており、mock dataset 追加のたびに Storybook/dev scenario 起動コストが増えやすい
  - feed/article/tag/account index を builder 初期化時に作り、fixture順序、duplicate id、unread/starred count、tag assignment の test を維持する

- [ ] P2 Storybook explorer organization test の sort / filter chain を helper 化する
  - 対象: `src/__tests__/components/storybook-explorer-organization.test.ts`, `e2e/storybook/storybook-index-payload.ts`
  - React Doctor が Storybook organization test に `js-combine-iterations` と `js-tosorted-immutable` を検出しており、story 数が増えるほど validation が重くなる
  - story id index、category grouping helper、stable sort helper、duplicate story diagnostics を追加して Storybook contract を保つ

- [ ] P2 browser overlay chrome test の fixture extraction を single-pass 化する
  - 対象: `src/__tests__/components/browser-overlay-chrome.test.tsx`, `src/components/reader/browser-overlay-chrome.tsx`
  - React Doctor の `js-combine-iterations` が browser overlay test に出ており、URL/action/toolbar fixture の検証が複数回走査されている可能性がある
  - toolbar action lookup、disabled state、external open action、copy URL action、loading state の fixture helper を作り、test の意図を崩さず整理する

- [ ] P2 article-view test の repeated extraction を reader fixture helper へ寄せる
  - 対象: `src/__tests__/components/article-view.test.tsx`, `src/__tests__/lib/article-list.test.ts`, `tests/helpers/fixtures.ts`
  - React Doctor の `js-combine-iterations` が article view/list test に出ており、article fixture から group/item を抽出する処理が散っている可能性がある
  - selected article、empty group、read/unread/starred、tag filtered list の helper を共有し、test readability と assertion diagnostics を維持する

- [ ] P2 reader-focus / article-view helper の unused export を focus contract から棚卸しする
  - 対象: `src/lib/reader-focus.ts`, `src/lib/articles/article-view.ts`, `src/components/reader/article-content-view.tsx`, `src/components/reader/article-list-view.tsx`
  - React Doctor / Knip が reader focus と article view helper の unused export を検出しており、focus restore と article display helper の境界が曖昧になっている
  - public focus helper、component-local helper、test-only helper、dead helper を分類し、focus restore / browser open / article switch の contract test と合わせて削る

- [ ] P2 command-palette-history の unused export を runtime persistence contract と照合する
  - 対象: `src/components/reader/command-palette-history.ts`, `src/components/reader/hooks/command-palette/*`, `src/__tests__/components/command-palette.test.tsx`
  - React Doctor / Knip が command palette history export を unused として検出しており、履歴保存の public helper なのか過去実装の名残なのか判断しにくい
  - max history、duplicate command、storage unavailable、malformed persisted history の test を確認し、使わない export は削除する

- [ ] P2 browser-view-presentation の unused export を overlay presentation contract と揃える
  - 対象: `src/components/reader/browser-view-presentation.ts`, `src/components/reader/browser-overlay-stage.tsx`, `src/components/reader/browser-view.types.ts`
  - React Doctor / Knip が browser presentation helper の unused export を検出しており、geometry/presentation/controller の型境界を再び太らせる原因になりやすい
  - presentation helper の参照元を確認し、view-local へ寄せるものと browser controller contract に残すものを分ける

- [ ] P2 old-unread-context-menu-items の unused export を削除候補として安全確認する
  - 対象: `src/components/reader/old-unread-context-menu-items.tsx`, `src/components/reader/article-list-row.tsx`, `src/components/reader/feed-tree-row.tsx`
  - React Doctor / Knip が old unread context menu item export を unused として検出しており、旧 UI の残骸が import 候補として残っている可能性がある
  - context menu story/test、unread action parity、command palette action parity を確認し、参照がなければ削除または archive コメントなしで消す

- [ ] P2 e2e app sequential await を test isolation と並列化可否で分類する
  - 対象: `e2e/app.spec.ts`, `src/__tests__/dev/scenario-runtime.test.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - React Doctor の `server-sequential-independent-await` が e2e と hook test に出ており、独立 setup を直列実行していると Playwright / Vitest の待ち時間が増える
  - browser state 共有、fixture isolation、user event ordering、screenshot timing に依存しない await だけ並列化する

- [ ] P3 `.toSorted()` 移行前に Node / WebView target の ES2023 support を明文化する
  - 対象: `tsconfig.json`, `vite.config.ts`, `src-tauri/tauri.conf.json`, `CLAUDE.md`
  - React Doctor は `.toSorted()` を推奨するが、test Node、Vite build target、Tauri WebView の support 前提を固定しないまま置換すると runtime 差が出る
  - production code、test-only code、dev script の target を分け、必要なら `.toSorted()` は test/dev から先に適用する

- [ ] P3 React Doctor warning category の suppression policy を rule 化する
  - 対象: `CLAUDE.md`, `.claude/rules/*`, `TODO.md`
  - `no-prevent-default` のように Tauri app では意図的な warning と、mutation invalidation のような実バグ候補が同じ TODO に積まれると優先度がぼやける
  - suppress / false-positive / accepted-risk / must-fix の分類、コメントを書く場所、再スキャン時の更新手順を決める

- [ ] P2 reader-type-surface test の import scan を type surface helper へ切り出す
  - 対象: `src/__tests__/components/reader-type-surface.test.ts`, `src/components/reader/*.types.ts`
  - React Doctor が `js-combine-iterations` と `.toSorted()` warning を reader type surface test に検出しており、type placement 追加のたびに同じ import list を複数回走査している可能性がある
  - type file list、view-local props blacklist、public contract allowlist、sorted diagnostics を helper 化し、CLAUDE.md の Type Surface Policy と同じ語彙で失敗するようにする

- [ ] P2 use-article-list-sources test の source extraction を single-pass 化する
  - 対象: `src/__tests__/components/use-article-list-sources.test.tsx`, `src/components/reader/hooks/article-list/use-article-list-sources.ts`
  - React Doctor の `js-combine-iterations` が article list source test に出ており、feed/folder/account source の抽出 assertion が重複走査になっている可能性がある
  - account filtered sources、folder grouping、unread count、empty source、sort order の fixture helper を作り、assertion message を読みやすく保つ

- [ ] P2 sidebar test の async loop を user-event ordering と fixture setup に分離する
  - 対象: `src/__tests__/components/sidebar.test.tsx`, `src/components/reader/sidebar-view.tsx`
  - React Doctor の `async-await-in-loop` が sidebar test に出ており、連続 user event の意図的逐次実行と独立 fixture setup が混ざっている可能性がある
  - keyboard navigation / pointer interaction は逐次維持し、独立 render setup や mock response setup は並列化できるか確認する

- [ ] P2 UI reference specimen registry test の sort helper を design registry と共有する
  - 対象: `src/__tests__/components/ui-reference-specimen-registry.test.ts`, `src/__tests__/components/design-ui-primitives.test.tsx`
  - React Doctor が UI reference / design primitive test に `.toSorted()` warning を検出しており、primitive registry の並び順検証が各 test に分散している
  - component id sort、category sort、duplicate id diagnostics、missing visual specimen の helper を共有し、design rule failure を読みやすくする

- [ ] P2 shared UI component の unused export を story / production entrypoint で分類する
  - 対象: `src/components/shared/icon-toolbar-control.tsx`, `src/components/settings/shared/settings-action-button.tsx`, `src/components/shared/nav-row-button.stories.tsx`
  - React Doctor / Knip が shared UI component export を unused として検出しており、Storybook-only wrapper と production reusable API の境界が曖昧になっている
  - production import、story import、test import、dead export に分類し、残す public wrapper は Storybook specimen か design contract へ明示する

- [ ] P2 reader feed helper exports を row/folder/sidebar contract で棚卸しする
  - 対象: `src/components/reader/folder-section.tsx`, `src/components/reader/sidebar-feed-tree-helpers.ts`, `src/components/reader/feed-edit-submit.ts`, `src/components/reader/feed-query-cache.ts`
  - React Doctor / Knip が feed tree 周辺の unused type/export を検出しており、row view、folder section、sidebar helper、query cache helper の境界が再び混ざりやすい
  - component-local helper、hook/controller helper、query cache helper、test-only helper に分け、unused export は削除する

- [ ] P2 subscriptions index helper exports を page/controller contract に絞る
  - 対象: `src/lib/subscriptions/subscriptions-index.ts`, `src/components/subscriptions-index/subscriptions-list-pane.tsx`, `src/lib/subscriptions/subscriptions-workspace.types.ts`
  - React Doctor / Knip が subscriptions index 周辺の unused export/type を検出しており、page view props と workspace controller contract が混ざる原因になる
  - list pane view-local props、workspace state type、candidate helper、test fixture export を分類し、必要な public surface だけ残す

- [ ] P2 account setup session types を add-account flow contract として残すか決める
  - 対象: `src/lib/account/account-setup-session.types.ts`, `src/components/settings/add-account-form.tsx`, `src/components/settings/add-account/service-picker.tsx`
  - React Doctor / Knip が account setup session type を unused として検出しており、add-account flow の controller contract と過去の session model が混在している可能性がある
  - service select、config submit、setup cancel、retry、account detail navigation の参照を確認し、不要なら削除、必要なら add-account contract test へ明示する

- [ ] P2 create-mutation の invalidation warning を generic helper policy として整理する
  - 対象: `src/hooks/create-mutation.ts`, `src/hooks/use-articles.ts`, `src/hooks/use-tags.ts`, `src/hooks/use-delete-feed.ts`
  - React Doctor が generic mutation helper 自体にも `query-mutation-missing-invalidation` を出しており、helper 側で invalidation を要求するのか caller 側 contract にするのか曖昧になっている
  - helper options に `onSuccess` / `invalidate` / `setQueryData` のどれを必須化するか決め、false positive なら suppression policy へ逃がす

- [ ] P3 test-only `.toSorted()` 一括移行バッチを node-target gate 後に作る
  - 対象: `src/__tests__/**/*.test.ts`, `src/__tests__/**/*.test.tsx`, `tests/helpers/*`
  - React Doctor の `.toSorted()` warning 29 件の大半は test-only なので、runtime target 確認後に production 変更と分けて一括処理できる
  - test helper bulk rewrite、Node 24 support、snapshot order stability、readability regression の review checklist を用意する

- [ ] P2 use-articles の unused export と mutation invalidation を同じバッチで棚卸しする
  - 対象: `src/hooks/use-articles.ts`, `src/hooks/create-mutation.ts`, `src/__tests__/hooks/use-articles.test.tsx`
  - React Doctor / Knip が `use-articles` に unused export と mutation invalidation warning の両方を出しており、公開 hook API と cache update 責務が同時に膨らんでいる
  - external import、test-only helper、mutation helper、query key helperを分類し、cache update が必要な public mutation だけを残す

- [ ] P2 browser URL effect helper の unused export を browser controller contract と合わせる
  - 対象: `src/components/reader/hooks/browser/use-browser-url-effect.ts`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/components/reader/browser-view.types.ts`
  - React Doctor / Knip が browser URL effect helper を unused export として検出しており、browserUrl state と native webview navigation event の責務境界が見えにくい
  - open URL、redirect、native close、navigation failure、stale browserUrl cleanup の参照を確認し、view/controller の public export だけ残す

- [ ] P2 use-updater hook の unused export を updater schema migration と一緒に整理する
  - 対象: `src/hooks/use-updater.ts`, `src/api/schemas/update-info.ts`, `src/__tests__/hooks/use-updater.test.ts`
  - React Doctor / Knip が updater hook/schema 周辺に unused export/type を検出しており、別エージェントの updater schema 差分と衝突しやすい
  - hook result、test fixture、schema parse helper、Tauri command wrapper を分類し、public API と fixture を別名で明確にする

- [ ] P2 seed-dev-db script の exported helper を CLI boundary と test boundary に分ける
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - React Doctor / Knip が seed script の unused export と async parallel warning を検出しており、CLI 実行用関数と unit test 用 helper が同じ surface に出ている
  - CLI main、pure transform、DB adapter、test fixture helper を分離し、export は test が使う pure helper に限定する

- [ ] P2 article-display helper の unused type を sanitized article view contract と揃える
  - 対象: `src/lib/articles/article-display.ts`, `src/lib/articles/article-view.ts`, `src/components/reader/article-content-view.tsx`
  - React Doctor / Knip が article display 周辺の unused type/export を検出しており、backend article DTO、sanitized HTML、view model の境界が曖昧になりやすい
  - empty body、sanitized title、external link、relative URL、feed label stripping の view model contract を確認し、不要な display type を削る

- [ ] P2 article-list-header unused type を header action contract と colocate する
  - 対象: `src/components/reader/article-list-header.tsx`, `src/components/reader/article-list-header-search.tsx`, `src/components/reader/hooks/article-list/use-article-list-header-actions.ts`
  - React Doctor / Knip が article list header の unused type を検出しており、header props、search props、action hook params が分散している
  - view-local props は component 内へ寄せ、hook params/result と keyboard/search focus contract だけを public type として残す

- [ ] P2 add-account form の unused type を form view / controller / service config へ分割する
  - 対象: `src/components/settings/add-account-form.tsx`, `src/components/settings/add-account/form-view.tsx`, `src/components/settings/add-account/account-config-form.tsx`
  - React Doctor / Knip が add-account form 周辺の unused type を検出しており、form view props と service setup controller contract が同じ層に残りやすい
  - submit payload、validation state、service config view props、navigation callback、cancel/retry contract を分ける

- [ ] P2 service-picker unused type を add-account service catalog contract と合わせる
  - 対象: `src/components/settings/add-account/service-picker.tsx`, `src/components/settings/add-account/services.ts`, `src/components/settings/add-account/services.types.ts`
  - React Doctor / Knip が service picker / service types に unused type を検出しており、service catalog、picker view model、account config schema が過剰に公開されている可能性がある
  - picker-only props は local、catalog entry は service module、config schema type は account-config form 側に寄せる

- [ ] P2 settings preference type の unused surface を preference schema と view props に分ける
  - 対象: `src/components/settings/settings-preference.types.ts`, `src/schemas/preferences.ts`, `src/components/settings/general-settings-view.tsx`
  - React Doctor / Knip が settings preference type と schema に unused type/export を検出しており、schema-derived type と view option type が重複しやすい
  - schema-derived type、view option model、form field props、test fixture type を分類し、schema boundary policy に沿って残す

- [ ] P2 settings nav/action/mute view の unused type を nav/page/modal contract 再設計前に棚卸しする
  - 対象: `src/components/settings/settings-nav-view.tsx`, `src/components/settings/actions-settings-view.tsx`, `src/components/settings/mute-settings-view.tsx`, `src/components/settings/accounts-nav-view.tsx`
  - React Doctor / Knip が settings view 群に unused type を検出しており、nav/page/modal contract を動かす前に dead type が混ざると移動差分が膨らむ
  - view-local props、navigation item model、action row model、mute keyword row model を分け、再設計バッチへ持ち込む type を減らす

- [ ] P2 browser / storage / events constants の unused type を runtime boundary constants として整理する
  - 対象: `src/constants/browser.ts`, `src/constants/storage.ts`, `src/constants/events.ts`, `src/lib/runtime/*`
  - React Doctor / Knip が runtime constants の unused type/export を検出しており、browser event name、storage key、Tauri event key の source of truth が散りやすい
  - public runtime event、private storage key、test fixture key、deprecated alias を分類し、残す constants は contract test へ明示する

- [ ] P2 motion constants unused export を transition token contract と照合する
  - 対象: `src/constants/motion.ts`, `src/components/reader/*`, `src/components/settings/*`, `src/__tests__/components/design-ui-primitives.test.tsx`
  - React Doctor / Knip が motion constants に unused export を検出しており、過去の transition token が残ると motion rule の判断がぶれる
  - production usage、Storybook specimen、test-only selector、dead token を分類し、使わない motion token は削除する

- [ ] P2 clipboard runtime helper の unused type と async test loop を同時に整理する
  - 対象: `src/lib/runtime/clipboard.ts`, `src/__tests__/lib/clipboard.test.ts`, `src/components/reader/article-browser-actions.ts`
  - 最新 React Doctor full scan で `src/lib/runtime/clipboard.ts` が unused type に入り、`clipboard.test.ts:203` に async loop warning も増えている
  - Clipboard API / fallback / permission error / large text の runtime contract を確認し、必要な型だけ残し、独立 test case setup は並列化する

- [ ] P2 reader-query helper の unused type を query key / query option contract に分ける
  - 対象: `src/lib/reader/reader-query.ts`, `src/hooks/use-articles.ts`, `src/components/reader/hooks/article-list/*`
  - React Doctor / Knip が reader query helper の unused type を検出しており、query key factory、query option builder、view model helper の境界が曖昧になっている
  - article list、article detail、feed landing、tag filtered query の参照を確認し、public query contract だけを残す

- [ ] P2 account pane navigation type を settings detail / reader focus boundary として整理する
  - 対象: `src/lib/account/account-pane-navigation.ts`, `src/components/settings/account-detail/*`, `src/lib/reader-focus.ts`
  - React Doctor / Knip が account pane navigation helper の unused type を検出しており、settings account detail と reader focus restore の境界が見えにくい
  - account id selection、missing account、add-account complete、detail close、reader return focus の navigation contract を固定する

- [ ] P2 sidebar-sources type surface を account/feed/tag source model に分割する
  - 対象: `src/components/reader/sidebar-sources.types.ts`, `src/components/reader/sidebar-view.tsx`, `src/components/reader/feed-tree-view.tsx`
  - React Doctor / Knip が sidebar source types に unused type を検出しており、account source、smart view、feed tree source、tag source の model が広がりやすい
  - external contract と view-local props を分け、sidebar source model は row rendering / command palette / unread count の参照元だけ残す

- [ ] P2 article toolbar view unused type を action strip / shortcut contract として整理する
  - 対象: `src/components/reader/article-toolbar-view.tsx`, `src/components/reader/article-toolbar.types.ts`, `src/components/reader/hooks/article/use-article-toolbar-controls.ts`
  - React Doctor / Knip が article toolbar view の unused type を検出しており、view-local props と shortcut/action contract が再び混ざる可能性がある
  - action strip props は local、shortcut label/action id は hook contract、article state derived props は controller result に分ける

- [ ] P2 feed-tree-view unused type を drag/drop hook contract と view props に分離する
  - 対象: `src/components/reader/feed-tree-view.tsx`, `src/components/reader/feed-tree.types.ts`, `src/components/reader/hooks/feed-tree/*`
  - React Doctor / Knip が feed tree view の unused type を検出しており、drag hook params、row props、folder section props の境界がまた太りやすい
  - view-local props は component 内、drag/drop shared state は hook types、row props は public contract として維持する

- [ ] P2 rename-feed-dialog-view unused type を dialog state / view props に分ける
  - 対象: `src/components/reader/rename-feed-dialog-view.tsx`, `src/components/reader/rename-feed-dialog.types.ts`, `src/components/reader/hooks/feed-dialogs/*`
  - React Doctor / Knip が rename feed dialog view の unused type を検出しており、view props local 化後も controller/state type が残っている可能性がある
  - dialog open state、submit params、URL field model、folder select contract、view-only props を整理する

- [ ] P2 feed-edit-submit / feed-query-cache unused type を feed mutation helper contract として整理する
  - 対象: `src/components/reader/feed-edit-submit.ts`, `src/components/reader/feed-query-cache.ts`, `src/hooks/use-delete-feed.ts`, `src/components/reader/hooks/feed-dialogs/*`
  - React Doctor / Knip が feed edit submit と feed query cache の unused type を検出しており、mutation submit payload と cache update helper が分離できていない可能性がある
  - add/rename/delete feed の submit result、optimistic update、rollback、query cache patch の owner を決める

- [ ] P2 settings-content-layout の React 19 `useContext` warning を小さく実証する
  - 対象: `src/components/settings/shared/settings-content-layout.tsx`, `src/components/settings/shared/*`, `src/__tests__/components/settings*.test.tsx`
  - React Doctor が `useContext` -> `use()` の React 19 warning を出しているが、全体移行前に shared settings layout で互換性を確認する必要がある
  - context read、conditional render、test environment、React Compiler 未導入状態の挙動を確認し、採用しない場合は suppression policy に残す

- [ ] P3 account-switcher / nav-row story の `size-*` 表記を design cleanup として分離する
  - 対象: `src/components/reader/account-switcher-view.tsx`, `src/components/shared/nav-row-button.stories.tsx`
  - React Doctor の `design-no-redundant-size-axes` は小さいが、production component と Storybook story が混在しているため、UI cleanup と story cleanup を分けた方が差分が読みやすい
  - production は visual regression 優先、Storybook は specimen consistency 優先で `w-N h-N` から `size-N` へ寄せる

- [ ] P2 browser-webview-events diff warning を current-diff blocker として再掲しない運用にする
  - 対象: `src/__tests__/hooks/use-browser-webview-events.test.tsx`, `TODO.md`, `mise.toml`
  - React Doctor diff scan は毎回 `use-browser-webview-events.test.tsx:315` の 1 件だけを返しており、TODO 追加のたびに同じ P1 が再発見されている
  - current diff blocker として担当者を決め、修正後は React Doctor diff scan で 0 warning を確認し、以後の TODO 追加では再掲しない

- [ ] P1 article content の `SanitizedArticleHtml` brand を runtime boundary として固定する
  - 対象: `src/components/reader/article-content-view.tsx`, `src/lib/content/html.ts`, `src-tauri/src/infra/sanitizer.rs`
  - `SanitizedArticleHtml` は型 brand だけで runtime では通常の string なので、未 sanitize HTML が `fromSanitizedArticleHtml` 経由で混入しても検出しにくい
  - backend sanitizer 済み DTO、frontend test fixture、view-local helper の境界を分け、raw HTML を渡す test helper には明示名を付ける

- [ ] P2 article-list-item presentation helper の export を test-only / production API に分ける
  - 対象: `src/components/reader/article-list-item.tsx`, `src/__tests__/components/article-list-item.test.tsx`, `src/lib/articles/article-view.ts`
  - `resolveArticleListItemPresentation` が component file から export されており、test 目的の pure helper と production component API の境界が曖昧になりやすい
  - view model helper と component props を分け、read/starred/selected/thumbnail/muted 表示の contract test を維持する

- [ ] P2 feed favicon fallback の layout shift / broken image contract を固定する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/components/reader/article-list-item.tsx`, `src/components/reader/feed-tree-row.tsx`
  - remote favicon failure 時の fallback、grayscale、size variant、title initials の扱いが崩れると reader row と feed tree でアイコン幅や alt 表示が揺れやすい
  - broken URL、empty title、long CJK title、grayscale unread/read、size variant の component test を追加する

- [ ] P2 `ts-expect-error` を negative contract test と legacy escape に分類する
  - 対象: `tests/helpers/fixtures.test.ts`, `tests/helpers/render-story.test.tsx`, `src/__tests__/components/*surface*.test.tsx`, `src/__tests__/components/settings-nav-view.test.tsx`
  - `ts-expect-error` が runtime boundary fixture と design surface negative test に混在しており、型改善後に残った不要 suppression を見逃しやすい
  - negative type contract と legacy escape を分類し、残すものは理由と対象型を短く統一する

- [ ] P2 `as unknown as` event / observer casts を typed test factory に寄せる
  - 対象: `src/__tests__/hooks/use-account-detail-name-editor.test.tsx`, `src/__tests__/hooks/use-scroll-overflow-state.test.tsx`, `src/__tests__/hooks/use-command-palette-data.test.tsx`
  - DOM event や Observer callback を `as unknown as` で作っており、必要プロパティ不足でも test が型上通ってしまう
  - keyboard event factory、ResizeObserver factory、MutationObserver factory、hook result fixture を作り、cast 箇所を集約する

- [ ] P2 test の `window.__TAURI_INTERNALS__` 注入を story/runtime helper に一本化する
  - 対象: `tests/helpers/tauri-runtime.ts`, `src/components/storybook/story-tauri-runtime.ts`, `src/__tests__/components/*runtime*.test.tsx`, `src/__tests__/dev/dev-mocks.test.ts`
  - Tauri internals の Object.defineProperty が test/story/dev mock に分散しており、descriptor restore や mock shape がずれると runtime 判定だけが壊れやすい
  - install/restore helper、readonly descriptor、missing invoke、partial internals、Storybook decorator parity の test を追加する

- [ ] P2 navigator platform stub を window chrome / app shell test helper に集約する
  - 対象: `src/lib/window/window-chrome.ts`, `src/__tests__/app.test.tsx`, `src/__tests__/components/app-shell.test.tsx`, `src/__tests__/components/design-shared-components.test.tsx`
  - `window.navigator.platform` の descriptor mutation が複数 test にあり、restore漏れや `userAgentData.platform` との優先順位差を見落としやすい
  - platform stub helper、userAgentData優先、Mac overlay、Windows/Linux fallback、restore failure の test を追加する

- [ ] P2 sidebar startup folder expansion localStorage schema を account/folder identity contract にする
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/__tests__/hooks/use-sidebar-startup-folder-expansion.test.tsx`, `src/constants/storage.ts`
  - expanded folders は localStorage JSON に account -> folder ids を保存するため、account削除、folder削除、巨大JSON、invalid shape、storage write failure で stale expansion が残りやすい
  - missing account pruning、missing folder pruning、oversized payload cleanup、write failure UI維持、migration version の test を追加する

- [ ] P3 requestAnimationFrame / setTimeout flush helper を UI tests で共通化する
  - 対象: `src/__tests__/components/article-view.test.tsx`, `src/__tests__/components/sidebar.test.tsx`, `src/__tests__/hooks/use-updater.test.ts`, `src/__tests__/hooks/use-app-icon-theme.test.tsx`
  - `await new Promise((resolve) => setTimeout(resolve, 0))` が複数 test にあり、fake timer / real timer の混在で flake の原因になりやすい
  - `flushTimers` / `flushMicrotasks` / `flushRaf` helper を分け、real timer 前提の test を明示する

- [ ] P1 Rust DB mutex poison を user-visible recovery と diagnostics に分類する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/commands/*`, `src-tauri/src/infra/db/*`
  - DB access は `Mutex<DbManager>` 経由が多く、panic 後の poisoned mutex がそのまま command failure / panic のどちらで表面化するかが見えにくい
  - lock failure message、restart guidance、safe read-only fallback、panic-injected test、user-facing error redaction を固定する

- [ ] P1 app startup の `expect` / `panic` surface を migration failure と通常 IO failure で分ける
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/infra/db/connection.rs`, `src-tauri/src/infra/db/migration.rs`
  - app data dir 作成、DB 初期化、window titlebar 設定などで `expect` / `panic` が混在しており、migration recovery と通常 IO failure の案内がずれやすい
  - migration failure、permission denied、disk full、titlebar unsupported、app data dir missing の startup diagnostics を追加する

- [ ] P2 startup main webview focus restore の async spawn を lifecycle-aware にする
  - 対象: `src-tauri/src/lib.rs`, `src/components/app-shell.tsx`, `src/hooks/use-screen-snapshot.ts`
  - startup focus restore は `tauri::async_runtime::spawn` + sleep 後に main window/webview を探すため、window close や slow startup で stale focus warning が出やすい
  - app handle drop、main window missing、webview missing、permission denied、retry不要条件の Rust test / manual verification を追加する

- [ ] P2 native menu emit failure を frontend action diagnostics と同じ分類にする
  - 対象: `src-tauri/src/menu.rs`, `src/hooks/use-menu-events.ts`, `src/lib/actions.ts`
  - menu action emit failure は Rust 側 tracing に閉じるため、frontend action registry 側の unknown/no-op diagnostics と集約されない
  - emit failure、unknown menu id、window missing、listener missing、frontend handler throw の parity test を追加する

- [ ] P2 live FreshRSS tests の env prerequisite を ignored/manual test contract に分ける
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `CLAUDE.md`
  - `FRESHRSS_URL` / `FRESHRSS_USER` / `FRESHRSS_PASS` を `expect` する live test があり、通常 CI と手元検証の境界が曖昧だと secret 依存 test が混ざりやすい
  - ignored test marker、manual live command、secret redaction、missing env skip message、recorded fixture fallback を整理する

- [ ] P2 keyring integration tests の credential cleanup を account id collision に強くする
  - 対象: `src-tauri/tests/integration_test.rs`, `src-tauri/src/infra/keyring_store.rs`, `src-tauri/src/commands/account_commands.rs`
  - integration test は keyring password を実際に set/delete するため、固定 account id や panic 中断で credential が残ると次回 test / 手元環境に影響する
  - unique test account id、drop cleanup、panic cleanup、missing keyring、delete failure warning の方針を固定する

- [ ] P2 sync provider test fixture の DB lock scope を helper 化する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/tests/integration_test.rs`
  - sync provider tests は `db.lock().unwrap()` と repo setup が大量にあり、lock scope が長くなると async boundary へ持ち込みやすい
  - setup helper、read/write lock scope、drop before await、poison handling、fixture account/feed/article 作成を共通化する

- [ ] P2 pending mutation remote id cleanup を sync_flow / repository / integration test で一本化する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/repository/pending_mutation.rs`, `src-tauri/tests/integration_test.rs`
  - pending mutation cleanup は deleted ids、read/starred push、remote_entry_id を跨ぐため、片方の flow だけ cleanup されると重複 push / stale delete が残りやすい
  - partial push success、provider reject、post-write DB failure、duplicate remote id、account scoped cleanup の integration test を追加する

- [ ] P2 browser bridge injected JS の mouse button handling を frontend mouse navigation と parity 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/hooks/use-mouse-navigation.ts`, `src/__tests__/hooks/use-mouse-navigation.test.tsx`
  - child webview injected bridge も mouse back/forward を扱い、frontend window handler と defaultPrevented / modifier / target 条件がずれる可能性がある
  - button 3/4、mousedown/up ordering、preventDefault 済み event、input/contenteditable、bridge invoke failure の parity test を追加する

- [ ] P2 native browser bridge close command の beforeunload / page script failure を分類する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/components/reader/hooks/browser/use-browser-webview-cleanup.ts`, `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - injected `closeBrowserPreview` は page script / invoke / close sequencing に依存するため、beforeunload や page error で frontend overlay state と native webview がずれやすい
  - page script throw、invoke reject、double close、native already closed、frontend close event missing の diagnostics を追加する

- [ ] P3 Rust test unwrap policy を production boundary と fixture boundary に分ける
  - 対象: `src-tauri/src/**/*.rs`, `src-tauri/tests/**/*.rs`, `CLAUDE.md`
  - Rust tests には `unwrap` / `expect` が多く、fixture setup と production behavior assertion が混ざると panic message が調査しづらい
  - fixture-only unwrap 許容、production boundary は error assertion、panic message naming、helper `expect_ok` の採用可否を決める

- [ ] P1 global mouse side-button navigation が modal / overlay 背後を操作しないようにする
  - 対象: `src/hooks/use-mouse-navigation.ts`, `src/components/app-shell.tsx`, `src/lib/actions.ts`
  - mouse back/forward は window capture で常時拾うため、settings modal、confirm dialog、command palette、browser overlay 操作中に背後の reader navigation を実行する可能性がある
  - modal stack、browser overlay active、context menu open、contenteditable target、defaultPrevented 済み event の component test を追加する

- [ ] P1 browser overlay root の pointer-events が stale URL で app 全体を塞がないようにする
  - 対象: `src/components/app-shell.tsx`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/stores/ui-store.ts`
  - `browserUrl` が残っている間は overlay root が画面全体で pointer-events を受けるため、native webview close/error event 欠落時に reader/settings 操作ができない stuck state になりやすい
  - native close missing、browserUrl stale、overlay root click-through、Escape close、settings open 中の pointer routing を component/e2e test にする

- [ ] P2 DOMParser fallback の HTML text extraction を sanitizer / search contract と揃える
  - 対象: `src/lib/content/html.ts`, `src-tauri/src/infra/sanitizer.rs`, `src/lib/articles/article-view.ts`
  - browser では DOMParser、非 DOM 環境では regex fallback で text extraction するため、malformed HTML、entity、script/style、CDATA、nested block の結果が環境でズレやすい
  - DOMParserあり/なし、malformed tag、numeric entity、style/script partial tag、CJK whitespace の unit test を追加する

- [ ] P2 normalizeArticleBodyHtml の leading label removal が本文を削りすぎないようにする
  - 対象: `src/lib/content/html.ts`, `src/components/reader/article-content-view.tsx`
  - feed name と同じ先頭 text node を削る処理は、記事本文が偶然 feed/title label から始まる時に意味のある本文を消す可能性がある
  - label-only wrapper、リンク/画像を含む先頭 node、同名タイトル本文、DOMParser unavailable、empty after removal の fixture を追加する

- [ ] P2 WorkspaceHeader の desktop drag region と interactive controls の hit test を固定する
  - 対象: `src/components/shared/workspace-header.tsx`, `src/lib/window/window-chrome.ts`
  - overlay titlebar mode は drag-region と pointer-events-none/auto の重ね合わせで成立しているため、actions/back button/title text の z-index 変更でクリック不能または drag 不能になりやすい
  - mac overlay、browser preview、compact desktop、actions click、back click、empty header drag region の component/e2e test を追加する

- [ ] P2 Dialog / browser overlay / toast / command palette の z-index stack contract を作る
  - 対象: `src/components/ui/dialog.tsx`, `src/components/app-shell.tsx`, `src/components/shared/app-toast-view.tsx`, `src/components/ui/command.tsx`
  - dialog は z-50、browser overlay root は z-40、toast は z-[100] など局所定義で、複数 overlay が重なる時の表示・pointer・focus 優先順位が暗黙になっている
  - confirm over settings、command palette over browser overlay、toast over dialog、shortcuts modal over reader の stack snapshot/e2e test を追加する

- [ ] P2 FeedTree drag drop overlay が folder row controls を過剰に覆わないようにする
  - 対象: `src/components/reader/feed-tree-folder-section.tsx`, `src/components/reader/feed-tree-selectable-row.tsx`, `src/components/reader/hooks/feed-tree/*`
  - drag 中の absolute overlay button が folder row 全体を覆うため、toggle/context/menu/focus target と drop target の責務が重なり、keyboard と pointer の挙動が壊れやすい
  - drag active 中の toggle click、context menu open、keyboard focus、drop target aria-label、same folder drop の component test を追加する

- [ ] P2 AppLayout の inert / aria-hidden fallback を WebView support matrix で検証する
  - 対象: `src/components/app-layout.tsx`, `src/__tests__/app.test.tsx`, `e2e/app.spec.ts`
  - hidden pane は `inert` と `aria-hidden` に依存するため、WebView 互換や test environment 差で focusable descendant が残ると keyboard navigation が背後 paneへ入る
  - inert unsupported fallback、programmatic focus、Tab navigation、compact/mobile/wide layout、subscriptions workspace open の e2e test を追加する

- [ ] P2 Debug HUD copy が巨大 trace / sensitive target description を clipboard へ出しすぎないようにする
  - 対象: `src/components/app-shell.tsx`, `src/lib/debug/debug-input-trace.ts`, `src/components/reader/focus-debug-hud-view.tsx`
  - HUD は focus/pointer/key trace と browser geometry をまとめてコピーできるため、長時間 session の巨大 text や sensitive selector/URL 断片を support 共有に載せやすい
  - max trace rows、copy redaction、password/server URL target、geometry only copy、clipboard failure の component test を追加する

- [ ] P3 overlay / drag / inert の CSS token を scattered z-index から semantic layer へ寄せる
  - 対象: `src/components/app-shell.tsx`, `src/components/ui/dialog.tsx`, `src/components/shared/app-toast-view.tsx`, `src/components/shared/workspace-header.tsx`
  - z-index や pointer-events の数値が component 内に分散しており、overlay 追加のたびにどの layer が上に来るべきか review で判断する必要がある
  - semantic layer constants、CSS custom property、component snapshot、DESIGN/CLAUDE rule 化のどれで固定するか決める

- [ ] P2 dev/runtime error console policy を user-visible diagnostics と揃える
  - 対象: `src/dev/intent.ts`, `src/App.tsx`, `src/stores/platform-store.ts`, `src/hooks/use-app-icon-theme.ts`, `src/hooks/use-badge.ts`
  - runtime failure が `console.warn/error` だけで終わる箇所が多く、dev-only noise と packaged app の user-visible failure が混在している
  - dev-only console、production diagnostics、toast対象、once suppression、secret redaction の分類表と代表 hook test を追加する

- [ ] P2 Result.unwrap usage を async boundary ごとに failure surface 化する
  - 対象: `src/hooks/**`, `src/dev/**`, `tests/helpers/**`
  - `Result.unwrap` は成功前提を短く書ける一方、queryFn/dev scenario/test helper に混在しており、失敗時に user-visible error・console・test failure のどれにするかが呼び出し元ごとに曖昧
  - queryFn、mutationFn、dev-only loader、test helper に分類し、production path は explicit `Result.isFailure` で message redaction を固定する

- [ ] P3 schema parse helper の throwing / nullable 命名を callsite policy に落とす
  - 対象: `src/schemas/parse.ts`, `src/api/tauri-commands.ts`, `tests/helpers/tauri-mocks.ts`
  - `parseWithSchema` と `safeParseJsonWithSchema` の使い分けはコメント上は明確だが、callsite が増えると throwing boundary を UI path に持ち込みやすい
  - production runtime、test helper、storage recovery、config parse のどこで throw/null/Result を使うか CLAUDE rule または repo contract にする

- [ ] P1 similarity 93.62%: browser webview sync と add feed dialog actions の async lifecycle helper 抽出を検討する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-sync.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - 両者は request id / in-flight ref / Result unwrap / stale guard / failure surface が似ており、今後片側だけ latest-only や error redaction を直すと挙動差が出やすい
  - 共通化するなら責務は「async command lifecycle」までに限定し、browser bounds と feed discovery の business logic は混ぜず、late result / thrown command / Result failure の hook test を追加する

- [ ] P1 similarity 90.00%: add feed submit と feed landing の optimistic UI rollback pattern を統一する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/hooks/use-feed-landing.ts`
  - 両方とも optimistic UI change 後に async fetch/mutation を進め、失敗時に local UI state を戻すが、snapshot 範囲・toast・stale request の扱いが別実装になっている
  - shared rollback helper、snapshot owner、latest request id、cached fallback、stale failure toast の policy を決め、逆順 settle の focused test を追加する

- [ ] P2 similarity 90.60%: add feed discovery と sidebar visibility fallback の fallback decision を pure helper 化する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/components/reader/hooks/sidebar/use-sidebar-visibility-fallback.ts`
  - 構造は似ているが片方は network result、片方は preference-driven selection fallback なので、hook 内に decision tree が残るほど edge case の test が膨らみやすい
  - 共通 React hook にはせず、fallback decision を pure helper として分け、empty / single / multiple / hidden smart view / missing tag の table test を追加する

- [ ] P2 similarity 91.15%: localStorage recovery と overflow observer の storage/observer lifecycle を別々に整理する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/components/settings/hooks/use-scroll-overflow-state.ts`
  - similarity は高いが、片方は storage normalization、片方は DOM observer cleanup で責務が違うため、安易な共通 hook より lifecycle guard の重複削減ポイントを分けた方が安全
  - storage read/write helper と observer scheduling helper を別候補にし、quota/storage unavailable、ResizeObserver missing、MutationObserver noisy update の test を追加する

- [ ] P2 similarity 92%台: browser URL lifecycle hooks の common effect primitive を作る
  - 対象: `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts`, `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts`
  - 複数 hook が window event / timer / browserUrl current guard / cleanup を似た形で実装しており、cleanup failure や stale URL check が片側だけ抜けやすい
  - 既存 `useBrowserUrlEffect` を拡張するか small helper を追加し、URL change、unmount、cleanup throw、DEV-only event dispatch の hook test をまとめる

- [ ] P2 similarity 90.27%: autofocus と auto-mark-read timer は共通化せず timer guard pattern だけ明文化する
  - 対象: `src/components/reader/use-tag-dialog-autofocus.ts`, `src/components/reader/hooks/article/use-article-auto-mark.ts`
  - 両者は ref + timer cleanup が似ているが、focus/select と article mutation は意味が違うため共通 hook 化すると abort/rollback semantics が曖昧になりやすい
  - timer ref cleanup、generation check、unmount no-op、StrictMode double effect の helper rule/test を作り、actual common abstraction は避ける判断を TODO に残す

- [ ] P2 similarity 90.42%: browser overlay close と sidebar smart view builder の structural false positive を guard する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`, `src/lib/sidebar/sidebar-smart-views.ts`
  - similarity は高いが lifecycle close action と static view model builder で責務が異なり、機械的共通化すると domain boundary が崩れる
  - similarity TODO では false positive として記録し、共通化しない理由、今後見るべき重複単位、必要なら rule/comment を追加する

- [ ] P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する
  - 対象: `src/components/settings/account-detail/query-cache.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/hooks/use-updater.ts`
  - small cache updater が large hook と高類似判定されており、低トークン関数では AST shape だけの false positive が混ざる
  - similarity report を読む時の min-lines/min-tokens 閾値、cache helper は単独管理、large hook だけ調査対象にする rule を TODO/CLAUDE へ反映する

- [ ] P3 similarity 100%: deferred promise test helper を共通化する
  - 対象: `src/__tests__/hooks/use-account-detail-credentials-editor.test.tsx`, `src/__tests__/hooks/use-account-detail-name-editor.test.tsx`, `tests/helpers`
  - `createDeferred` return type literal が完全一致しており、async hook test が増えるたびに同じ helper が各 test file に増殖しやすい
  - `tests/helpers/deferred.ts` のような test-only helper に寄せ、resolve/reject typing、cleanup、unhandled rejection prevention の helper test を追加する

- [ ] P3 similarity 98.95%: dev scenario runner test の mock invocation order helper を共通化する
  - 対象: `src/__tests__/dev/scenarios/runner.test.ts`
  - mock invocation order parameter type がほぼ同一で、dev scenario runner の順序検証が増えると inline type literal が散りやすい
  - invocation order assertion helper を作り、first/next invocation、parallel scenario、failed scenario の readable test API にする

- [ ] P3 similarity scan baseline を TODO / report command として定期更新できるようにする
  - 対象: `package.json`, `mise.toml`, `TODO.md`
  - 今回の `similarity-ts --threshold 0.9 src/` は 32 function pairs、1 similar type pair、2 type literal pairs を検出しており、今後の改善で何が減ったか追跡しにくい
  - `report:similarity` タスク、threshold 0.95/0.9/0.87 の使い分け、false positive allowlist、TODO 化済み項目の baseline 記録を整備する

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
