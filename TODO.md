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

## 次の並列バッチ候補

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

- [ ] DB migration recovery runbook 候補を別バッチで整理する
  - Windows file lock、backup/restore failure、WAL/SHM 残存時の migration recovery path を、手順と検証観点に分けて TODO 化する
  - repository test と実 app data recovery はリスクが違うため、fixture DB test と manual verification を別々に扱う
  - ユーザーデータに触れるため、実装に入る前に backup location / rollback condition / log collection の checklist を固定する

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

- [ ] Article list header controls layout contract 候補を別バッチで追加する
  - `src/components/reader/hooks/article-list/use-article-list-header-controls.tsx` で wide は toggle、compact/mobile は open、compact のみ `sidebarButtonText` を持つ契約を固定する
  - feed 未選択時に feed mode control を出さないことを、hook/component-light test で確認する
  - article scope matrix / search reset / footer mode / visual density の調整は混ぜない

- [ ] Browser webview cleanup unmount contract 候補を別バッチで追加する
  - `src/components/reader/hooks/browser/use-browser-webview-cleanup.ts` で unmount 時に `closeBrowserWebview()` が一度だけ呼ばれる契約を固定する
  - failure は console error に留め、UI state を直接触らないことを mocked Tauri command で確認する
  - event listener cleanup / requested-url merge / native WebView payload / runtime unavailable handling は別バッチにする

- [ ] feed discovery relative link base URL contract 候補を別バッチで追加する
  - `src-tauri/src/infra/feed_discovery.rs` で HTML `<link rel="alternate" href="/feed.xml">` が最終ページ URL を base に解決される契約を fixture test で固定する
  - redirect SSRF hardening、duplicate title display、add feed dialog UI は同じバッチに混ぜない

- [ ] feed discovery content-type fallback contract 候補を別バッチで追加する
  - `src-tauri/src/infra/feed_discovery.rs` で RSS / Atom / XML body が misleading または missing content-type の時にどう扱われるかを明示的な契約にする
  - JSON Feed body parsing、provider HTTP policy、UI error copy は別スコープに残す

- [ ] embed support HEAD-to-GET fallback contract 候補を別バッチで追加する
  - `src-tauri/src/commands/article_commands.rs` の `check_browser_embed_support` で、HEAD を拒否して GET は許可する server の扱いを contract test 化する
  - browser surface issue UI、webview load timeout、CSP interpretation の変更は混ぜない

- [ ] old unread days validation upper-bound contract 候補を別バッチで追加する
  - `src-tauri/src/commands/article_commands.rs` の `validate_older_than_days` で zero / negative / 過大値の reject 条件を一貫して固定する
  - old unread submenu UI、mark-all-read confirmation、bulk mutation execution は別バッチにする

- [ ] createQuery disabled id guard contract 候補を別バッチで追加する
  - `src/hooks/create-query.ts` で `id=null` の generated query が `enabled=false` になり fetcher を呼ばない契約を固定する
  - queryFn が id なしで直接呼ばれた時は `Query id is required` 系の error になることを、小さい wrapper test で確認する
  - query key invalidation、React Query retry/staleTime、caller hook 固有の fallback は同じバッチに混ぜない

- [ ] createMutation invalidation data contract 候補を別バッチで追加する
  - `src/hooks/create-mutation.ts` で mutation success 時だけ `invalidate(queryClient,args,data)` が unwrapped data 付きで呼ばれる契約を固定する
  - failure result や thrown error の時に invalidation が走らないことを、mocked Result と query client で確認する
  - toast projection、optimistic update、mutation 別の query key 設計は別バッチにする

- [ ] query invalidation option matrix contract 候補を別バッチで追加する
  - `src/lib/query/query-invalidation.ts` の `invalidateFeedQueries` / `invalidateArticleQueries` が default と option override で期待 query key を invalidate する契約を固定する
  - account / feed / article / tag / subscription の利用面へ広げる前に、pure helper として key matrix を小さく test 化する
  - cache stale policy、React Query observer 挙動、個別 mutation hook の成功処理は混ぜない

- [ ] copyable text field read-only focus selection contract 候補を別バッチで追加する
  - `src/components/shared/copyable-text-field.tsx` で readOnly input は focus 時に text を select し、editable input は強制 select しない契約を固定する
  - 渡された `onFocus` が readOnly / editable のどちらでも呼ばれることを component test に含める
  - clipboard runtime、credential field 固有の mask、visual token 調整は同じバッチに混ぜない

- [ ] copyable text field copy button disabled contract 候補を別バッチで追加する
  - `src/components/shared/copyable-text-field.tsx` で `copyLabel` と `onCopy` が揃う時だけ copy button を表示する契約を固定する
  - field disabled または value empty の時に copy button が disabled になることを component test で確認する
  - tooltip 実装、clipboard error toast、readonly wrapper 側の layout は別バッチにする

- [ ] copyValueToClipboard empty value no-op contract 候補を別バッチで追加する
  - `src/lib/runtime/clipboard.ts` で empty value の時に `copyToClipboard` / success callback / error callback を呼ばず return する契約を固定する
  - clipboard unavailable fallback は既存 runtime utility 候補に残し、ここでは no-op branch だけを pure helper として固定する
  - article share menu、settings credentials copy、toast copy 文言は同じバッチに混ぜない

- [ ] platform store single-flight retry contract 候補を別バッチで追加する
  - `src/stores/platform-store.ts` で concurrent `loadPlatformInfo()` が同じ in-flight promise を共有する契約を固定する
  - 初回 failure 後に `loaded=true` / `loadError=true` となり、次回呼び出しで retry できることを store test に追加する
  - platform capability DTO parity、Tauri capability JSON、packaged app 実機確認は別スコープにする

- [ ] UI store toast timer replacement contract 候補を別バッチで追加する
  - `src/stores/ui-store.ts` で二つ目の non-persistent toast 表示時に前 toast timer を clear し、latest toast だけが auto dismiss される契約を固定する
  - persistent toast は dismiss timer を予約しないことを fake timer で確認する
  - app-toast-view の表示、toast copy、sync progress update は同じバッチに混ぜない

- [ ] UI store close browser focus fallback contract 候補を別バッチで追加する
  - `src/stores/ui-store.ts` の `closeBrowser()` が selected article ありなら reader/content、なしなら empty/list に `contentMode` と `focusedPane` を戻す契約を固定する
  - navigation state と browser close in-flight flag が close 後に reset されることを store test で確認する
  - DOM focus return、browser overlay close hook、native WebView cleanup は別バッチにする

- [ ] window wrapper non-Error rejection normalization contract 候補を別バッチで追加する
  - `src/lib/window/windows.ts` で dynamic import や Tauri API が non-Error を reject した時も `Error` として Result failure に正規化される契約を固定する
  - always-on-top hook や fullscreen menu action からではなく、window wrapper helper の小さい unit test に限定する
  - runtime permission、capability JSON、native window behavior の変更は混ぜない

- [ ] form action buttons loading label contract 候補を別バッチで追加する
  - `src/components/shared/form-action-buttons.tsx` で `loading=true` かつ `submittingLabel` ありの時だけ submit label が切り替わる契約を固定する
  - submit/cancel button の default type が `button` で、明示 `submitType` / `cancelType` が尊重されることを component test に含める
  - dialog 固有の submit state、DB save behavior、visual variant 調整は同じバッチに混ぜない

- [ ] NavRowButton trailing motion number contract 候補を別バッチで追加する
  - `src/components/shared/nav-row-button.tsx` で string / number trailing は `MotionNumber` 経由、ReactNode trailing はそのまま描画される契約を固定する
  - default button type が `button` であることも shared nav row の regression test に含める
  - sidebar row density、motion constants、feed unread count semantics は別バッチにする

- [ ] Tauri listener group dispose idempotency contract 候補を別バッチで追加する
  - `src/lib/runtime/tauri-event-listeners.ts` で `dispose()` を複数回呼んでも cleanup が一度だけ実行される契約を固定する
  - 成功 subscription と失敗 subscription が混在しても `ready` が resolve することを unit test で確認する
  - event payload の型整理、browser/webview event hook 側の購読整理は同じバッチに混ぜない

- [ ] preferences store system theme listener cleanup contract 候補を別バッチで追加する
  - `src/stores/preferences-store.ts` で theme を `system` から `light` / `dark` に切り替えた時に前の `matchMedia("change")` listener が remove される契約を固定する
  - listener cleanup 後の system change で theme が再適用されないことを store test で確認する
  - view transition の見た目、theme copy、localStorage bootstrap 方針は別バッチにする

- [ ] ui-store confirm dialog stale callback cleanup contract 候補を別バッチで追加する
  - `src/stores/ui-store.ts` で `showConfirm` の再表示時に message / actionLabel / variant / icon / onConfirm が置き換わる契約を固定する
  - `closeConfirm` 後に `onConfirm` と icon が null に戻ることを store test で確認する
  - dialog UI class、確認文言、destructive dialog component 側の pending 挙動は同じバッチに混ぜない

- [ ] dev runtime option env parsing contract 候補を別バッチで追加する
  - `src-tauri/src/commands/platform_commands.rs` で `VITE_DEV_INTENT` が空白なら alias へ fallback する契約を固定する
  - width / height は trim 後の正整数だけ採用し、`0` / negative / non-numeric は `None` にする unit test を追加する
  - dev scenario runtime、window geometry UI、dev mock data の分割は別バッチにする

- [ ] Reading List URL scheme case-insensitive contract 候補を別バッチで追加する
  - `src-tauri/src/commands/share_commands.rs` で `HTTP://` / `HTTPS://` のような uppercase scheme を Reading List URL として扱うか明示する
  - 許可する場合は `is_reading_list_url` と `reading_list_script` の unit test で固定する
  - Safari 実行確認、Reading List UI、共有アクション設定、AppleScript 実行エラー文言は同じバッチに混ぜない

- [ ] bulk article mutation feed count dedupe contract 候補を別バッチで追加する
  - `src-tauri/src/commands/article_commands.rs` の bulk mark operations 後に、affected feed の unread count recalculation が重複しない契約を固定する
  - pending mutation queue、UI cache invalidation、provider sync は同じ変更に混ぜない

- [ ] settings modal deleted account snapshot contract 候補を別バッチで追加する
  - `src/components/settings/settings-modal.tsx` で deleted account IDs と accounts snapshot により、削除済み account detail が stale rendering しない契約を固定する
  - account delete keyring cleanup、account nav sorting、settings modal type split は別バッチにする

- [ ] settings scroll overflow observer cleanup contract 候補を別バッチで追加する
  - `src/components/settings/hooks/use-scroll-overflow-state.ts` で ResizeObserver / MutationObserver が viewport 変更・dependency 変更・unmount 時に disconnect される契約を固定する
  - settings content fade helper、layout dimensions、visual scroll behavior は同じバッチに混ぜない

- [ ] mute settings reducer transition contract 候補を別バッチで追加する
  - `src/components/settings/mute-settings.tsx` 周辺で add / edit / delete modal state transition と draft reset の契約を focused test で固定する
  - mute SQL/Rust match parity、auto mark preference guard、settings copy は別スコープに残す

- [ ] test helper fixture referential integrity guard 候補を別バッチで追加する
  - `tests/helpers/fixtures.ts` と fixture test で sample article / feed / account / tag の cross-reference と required fields の整合性を固定する
  - mock response schema validation、dev mock state reset、fixture display copy は同じバッチに混ぜない

- [ ] Tauri mock argument coercion strictness contract 候補を別バッチで追加する
  - `tests/helpers/tauri-mocks.ts` と `tests/helpers/tauri-types.ts` 周辺で、代表 command の mock handler が invalid args を暗黙 coercion しない契約を固定する
  - mock response schema validation、real command schema changes、mock data copy は別バッチにする

- [ ] reader query / article scope matrix 整理候補を別バッチで見直す
  - `src/lib/reader/reader-query.ts` と `docs/reader-article-scope-matrix.md` の feed/folder/tag/recent/starred/unread scope が実装とズレていないか棚卸しする
  - article list sources / search / grouping / footer mode control は参照範囲が広いため、scope resolver の pure helper test を先に追加する
  - viewMode の clamp や recently viewed history 更新は UX 挙動に直結するため、UI props local 化とは混ぜない

- [ ] Storybook fixture runtime 整理候補を別バッチで見直す
  - `src/components/storybook/story-tauri-runtime.ts`、`story-query-client-provider.tsx`、UI reference canvas の mock runtime を、component isolation と app-like scenario で分ける
  - story title / canvas taxonomy は既存 tests が見ているため、rename ではなく fixture provider の責務整理に限定する
  - Tauri runtime mock と dev scenario mock data は用途が違うため、同じ worker に混ぜない

- [ ] manual sync feedback contract 候補を別バッチで追加する
  - `src/lib/sync/manual-sync.ts`、`sync-result-feedback.ts`、sidebar sync feedback の success/partial/error 表示を command result contract として固定する
  - account sync status rows と global sync progress は参照範囲が違うため、settings account detail の整理とは別に扱う
  - provider error copy は locale/copy batch に残し、ここでは sync result category と toast/sidebar state の対応だけを見る

- [ ] preferences migration / default value contract 候補を別バッチで検証する
  - `src/schemas/preferences.ts`、`preferences-store.ts`、preferences migrations の default value と stored value migration を対応表で確認する
  - reader preview defaults、startup sync、shortcut prefs、icon/badge prefs は利用面が違うため、preference key group ごとに worker scope を分ける
  - UI 設定画面の copy や control layout 変更は含めず、schema parse と persisted value compatibility の test に限定する

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

- [ ] schema parse / storage helper contract 候補を別バッチで追加する
  - `src/schemas/parse.ts`、`src/schemas/storage.ts`、API schemas の parse failure handling を、typed result と fallback default の境界で整理する
  - preferences schema、Tauri command schema、local storage schema は失敗時の recovery が違うため、schema group ごとに worker scope を分ける
  - 表示 copy や toast 変更は含めず、parse error kind と caller fallback の契約 test に限定する

- [ ] share / clipboard action contract 候補を別バッチで見直す
  - `src-tauri/src/commands/share_commands.rs`、`src/lib/runtime/clipboard.ts`、article share menu の copy/open action を、native command と frontend fallback で分けて棚卸しする
  - clipboard unavailable / permission denied / invalid URL はユーザー表示が違うため、toast copy 変更ではなく action result category の test を先に固定する
  - native share menu の表示や shortcut 変更は menu/copy batch に残し、ここでは copy link / open external / readonly field copy の実行契約に限定する

- [ ] feed display mode precedence 候補を別バッチで検証する
  - feed-level display mode、folder inherited mode、reader preview default preference の優先順位を `feed.ts` / hooks / migrations の対応表で確認する
  - feed selection auto-open と preview mode change は UX 影響が大きいため、display mode resolver の pure helper test を先に追加する
  - settings copy や toolbar visual 変更は含めず、stored value と resolved mode の compatibility に限定する

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

- [ ] reader toolbar / inline action semantics 候補を別バッチで見直す
  - `article-toolbar-view.tsx`、`reader-inline-action-button.tsx`、article share menu の action role / disabled / aria label を棚卸しする
  - icon visual や toolbar density の変更は UI polish に残し、ここでは action availability と shortcut hint の contract を固定する
  - browser action と article status action は hook 境界が違うため、同じ props local 化バッチに混ぜない

- [ ] sidebar startup folder expansion 候補を別バッチで検証する
  - `use-sidebar-startup-folder-expansion.ts`、last selected account/feed/folder、folder selection feed filter の初期展開条件を整理する
  - startup sync や first-screen snapshot と同時に変えると原因が追いにくいため、sidebar tree state の pure/helper test を先に追加する
  - user-triggered folder toggle と startup restore は UX 意味が違うため、state transition を分けて固定する

- [ ] account setup lock / session contract 候補を別バッチで見直す
  - `account-setup-session.types.ts`、add account controller、accounts nav の setup session lock を、wizard flow と settings navigation で分けて棚卸しする
  - duplicate submit / navigation away / failed credential verification はデータ破損につながるため、UI copy より先に state machine の境界を固定する
  - service picker の visual や provider icon 変更は含めず、setup session ownership と cancel/retry contract に限定する

- [ ] i18next namespace / locale key contract 候補を別バッチで追加する
  - `src/types/i18next.d.ts`、`src/lib/i18n.ts`、reader/settings/sidebar/subscriptions locale files の namespace と key presence を棚卸しする
  - copy 文面の改善ではなく、missing key、namespace drift、test fixture の型補完を検出する contract test に限定する
  - platform-specific shortcut label や native menu label は既存の menu/copy 候補に残し、web UI locale key の整合だけを見る

- [ ] theme bootstrap / appearance state 候補を別バッチで検証する
  - `theme-bootstrap-script`、appearance settings、app icon theme の初期 theme 解決を、before React hydration と store state で分けて確認する
  - system theme / persisted theme / dev scenario の優先順位は startup UX に影響するため、DOM class と store value の契約 test を先に固定する
  - icon asset や color palette 変更は含めず、theme source と fallback の compatibility に限定する

- [ ] progress / loading surface contract 候補を別バッチで見直す
  - `settings-loading-action-button.tsx`、`indeterminate-progress.tsx`、skeleton surfaces の loading / pending / disabled 表現を棚卸しする
  - sync progress、settings save、feed discovery は待機時間と retry 導線が違うため、shared loading component の props 整理とは分ける
  - animation token や visual polish は含めず、aria busy / disabled / label fallback の contract test を優先する

- [ ] exception palette / semantic tone contract 候補を別バッチで追加する
  - `exception-palettes.ts`、semantic tone token tests、article state icon / status chip の tone mapping を対応表で確認する
  - danger / warning / success / neutral の意味が feature ごとにズレないよう、visual snapshot ではなく semantic role と token name の test に限定する
  - destructive dialog や error toast の copy は dialog/copy batch に残し、ここでは tone taxonomy だけを見る

- [ ] GitHub issue template / label taxonomy 候補を別バッチで整理する
  - `.github/ISSUE_TEMPLATE/*`、`.github/labeler.yml`、`pr-insights-labeler` の labels / risk / size / manual-verification 表現を対応表にする
  - workflow 変更は CI 影響があるため、まず issue template の選択肢と label source of truth の整合だけを確認する
  - release-readiness や manual-verification の運用 copy は release checklist と混ぜず、GitHub metadata contract に限定する

- [ ] release manual verification checklist 候補を別バッチで更新する
  - `docs/release-manual-verification.md` の keyring / updater / packaged startup / live provider 確認観点を、現行 release workflow と照合する
  - 実 release 作業や artifact signing は含めず、チェックリストが CI と手動検証のどちらで担保されるかを明確にする
  - FreshRSS live verification や native keyring は secret を扱うため、値ではなく手順・合格条件・失敗時ログの確認に限定する

- [ ] reader keyboard docs alignment 候補を別バッチで見直す
  - `docs/reader-keyboard-navigation.md` と `keyboard-shortcuts.ts` / `use-keyboard.ts` / pane-specific key handlers の対応を棚卸しする
  - shortcut label や i18n copy の変更は含めず、documented ownership と実装の event ownership がズレていないかを確認する
  - browser overlay、article list、sidebar の keyboard contract は参照範囲が広いため、pane ごとに worker scope を分ける

- [ ] database command / integrity schema 候補を別バッチで検証する
  - `src-tauri/src/commands/database_commands.rs`、`database-info.ts`、`feed-integrity.ts` の DTO と frontend schema がズレていないか棚卸しする
  - DB path / size / integrity result は environment 依存があるため、schema fixture と manual verification を分ける
  - migration recovery や dev seed DB とは混ぜず、read-only command response contract の test に限定する

- [ ] feed edit / folder assignment flow 候補を別バッチで見直す
  - `feed-edit-submit.ts`、rename feed dialog、folder select controller、`use-update-feed-folder.ts` の submit state と cache invalidation を整理する
  - rename / unsubscribe / folder move は確認導線と rollback 条件が違うため、dialog view props 整理とは分ける
  - repository update や sync provider 反映は別バッチに残し、frontend submit contract と query invalidation を先に固定する

- [ ] shared button / control surface governance 候補を別バッチで見直す
  - `button.tsx`、`control-chip-button.tsx`、`icon-toolbar-control.tsx`、`reader-inline-action-button.tsx` の role / size / disabled / tooltip 前提を棚卸しする
  - visual token や hover class の全面変更は避け、公開 wrapper API と feature-local button の境界を先に整理する
  - settings / reader / subscriptions で使う control surface は密度が違うため、component family ごとに worker scope を分ける

- [ ] reader preview role / language contract 候補を別バッチで検証する
  - reader preview / standard preview / web preview の role language が、`reader.json`、article view state、browser overlay state で一貫しているか確認する
  - label copy 変更ではなく、preview mode と user-visible state token の対応を test fixture で固定する
  - display mode precedence や browser WebView history とは混ぜず、reader mode naming と accessibility label の契約だけを見る

- [ ] web preview geometry dev fixture 候補を別バッチで整理する
  - `src/dev/web-preview-geometry.ts`、dev geometry page tests、browser debug geometry helpers を、fixture generation と diagnostics rendering で分ける
  - 実 WebView bounds の変更は browser geometry 実機検証に残し、ここでは dev fixture の input/output contract を固定する
  - geometry scenario の copy や visual specimen は Storybook fixture runtime と混ぜず、debug utility の契約に限定する

- [ ] feed discovery redirect SSRF hardening 候補を別バッチで追加する
  - `src-tauri/src/infra/feed_discovery.rs` で初回 URL だけでなく redirect 先 URL も private / loopback / unsupported scheme を拒否する
  - `reqwest` redirect policy または final URL 検査を入れ、失敗時は validation error として返す contract を固定する
  - mock server で localhost/private redirect、protocol-relative feed link、相対 feed link の case を分ける

- [ ] migration manifest drift guard 候補を別バッチで追加する
  - `src-tauri/migrations/V*.sql` と `infra/db/migration.rs` 側の埋め込み順序・latest version がズレない test を追加する
  - migration file name の連番、欠番、重複、`LATEST_VERSION` の一致を検査する
  - SQL 内容の意味までは固定せず、追加 migration 時の登録漏れだけを CI で拾う

- [ ] command palette results a11y / Storybook 候補を別バッチで補強する
  - `command-palette-results.tsx` / action group / resource group を recent / action / feed / tag / article / dev scenario / no results の表示状態に分ける
  - `cmdk` の list / item / shortcut / empty state の accessible name と選択挙動を focused test で固定する
  - dev scenario 実行や command history 永続化は既存 scope に残し、表示と操作 semantics だけ扱う

- [ ] add feed dialog form a11y 候補を別バッチで整理する
  - URL input、folder select、discovered feed options の label / description / error association を棚卸しする
  - loading / empty / multiple discovered feeds / submit disabled の UI 状態を story または focused test に分ける
  - feed discovery の URL normalization や network parser とは分離し、dialog view の操作契約だけに限定する

- [ ] Storybook / Playwright smoke gate 候補を別バッチで整理する
  - `pnpm test:storybook:e2e`、`pnpm build-storybook`、`mise test:e2e` の現状を棚卸しする
  - CI 常時実行、manual workflow、release 前手動確認のどこに置くかを分ける
  - Storybook fixture runtime 整理とは混ぜず、実行ゲートと失敗時ログだけに限定する

- [ ] sync scheduler backoff visibility 候補を別バッチで検証する
  - `sync_scheduler.rs` の backoff / retry_at / warning DTO と frontend account sync status 表示の対応を棚卸しする
  - retry scheduled / retry pending / credential failure はユーザー対応が違うため、status category と表示行を分けて test する
  - sync flow 本体や provider error mapping とは混ぜず、scheduler state と UI status projection に限定する

- [ ] Tauri event listener lifecycle 候補を別バッチで追加する
  - `src/lib/runtime/tauri-event-listeners.ts` と sidebar sync / menu events / browser events の attach / cleanup contract を棚卸しする
  - duplicate listener、unmount 後 event、runtime unavailable fallback を focused test で固定する
  - window event helper や native command schema 整理とは分け、listener lifecycle だけを扱う

- [ ] unread badge / account unread count contract 候補を別バッチで見直す
  - `use-account-unread-count.ts`、badge runtime、sidebar smart unread count の source を対応表で確認する
  - all account / selected account / inbox-only badge の意味がズレないよう、count source と badge update trigger を test で固定する
  - app icon / OS badge 実機検証とは分け、frontend count projection と runtime call boundary に限定する

- [ ] sidebar section visibility / density contract 候補を別バッチで追加する
  - sidebar section visibility、density setting、smart view contextual filters の stored state と view props を棚卸しする
  - collapsed section / hidden tags / dense rows / empty folder の組み合わせを pure helper と component test に分ける
  - mobile layout や drag/drop とは混ぜず、sidebar section visibility と density projection だけを見る

- [ ] window always-on-top / chrome runtime 候補を別バッチで検証する
  - `use-window-always-on-top.ts`、`window-chrome.ts`、platform capabilities の runtime available/unavailable fallback を確認する
  - native window chrome と settings toggle の状態同期は OS 差があるため、hook unit test と packaged manual verification を分ける
  - platform abstraction DTO や capability JSON 変更は別バッチに残し、always-on-top action contract に限定する

- [ ] article list search / empty state semantics 候補を別バッチで補強する
  - article list search、header search input、empty state、footer filter control の no result / loading / filtered out 状態を整理する
  - source scope resolver や reader query contract とは分け、user-visible empty reason と clear action の semantics を test で固定する
  - search debounce 実装詳細は固定せず、最終表示状態と focus/clear behavior に限定する

- [ ] pending mutation queue recovery 候補を別バッチで検証する
  - `src-tauri/src/repository/pending_mutation.rs` / `sqlite_pending_mutation.rs` と sync retry の queue state を、remote mutation と local DB mutation で分けて棚卸しする
  - retry pending / conflict / permanent failure の分類は user-visible sync feedback に直結するため、DTO と repository state の contract test を先に固定する
  - provider sync flow や scheduler backoff とは混ぜず、pending mutation queue の persistence / dequeue / failure projection に限定する

- [ ] content HTML helper / sanitizer boundary 候補を別バッチで追加する
  - `src/lib/content/html.ts` と `src-tauri/src/infra/sanitizer.rs` の frontend display helper / backend sanitize policy を、入力 HTML と保存済み content で分ける
  - malformed HTML、empty content、script/style removal、text extraction は privacy hardening と混ぜず、normalization contract として固定する
  - remote image / CSP / tracking pixel policy は既存 privacy batch に残し、ここでは helper boundary と fallback rendering だけを見る

- [ ] toast / UI error projection contract 候補を別バッチで見直す
  - `src/lib/ui/toast.types.ts`、`src/lib/ui/errors.ts`、feature-specific toast helpers の error kind / severity / action label を棚卸しする
  - account setup、feed discovery、sync result、clipboard failure は retry action が違うため、toast copy ではなく projection contract を先に固定する
  - dialog state や semantic tone taxonomy とは分け、toast payload と caller fallback の対応だけを扱う

- [ ] data settings export / backup UX 候補を別バッチで整理する
  - data settings、database info command、dev seed DB、release/manual verification の backup / export / restore 表現を、user-facing operation と dev-only operation で分ける
  - user data を触る操作は rollback condition と file path visibility が重要なので、実装前に confirmation copy と manual verification を固定する
  - DB migration recovery や dev seed command とは混ぜず、data settings surface の action availability と safety checklist に限定する

- [ ] provider icon / favicon fallback contract 候補を別バッチで追加する
  - `provider-icons.tsx`、`feed-favicon.tsx`、feed/account DTO の icon URL / binary icon / fallback icon を対応表で確認する
  - missing icon、invalid URL、grayscale preference、provider brand icon は visual asset 変更ではなく fallback decision の test に限定する
  - app icon theme や provider capability command とは混ぜず、feed/account row の icon projection だけを見る

- [ ] incident runbook / diagnostic log bridge 候補を別バッチで更新する
  - `docs/incident-runbook.md`、`log_commands.rs`、release manual verification の failure investigation path を、keyring / DB / sync / WebView ごとに分ける
  - log file path や secret masking の扱いを明示し、実ログ収集手順と app UI debug action を混ぜない
  - docs link audit とは別に、incident response で必要な diagnostic source と escalation criteria に限定する

- [ ] article auto mark retry contract 候補を別バッチで追加する
  - `use-article-auto-mark.ts` の delayed mark / immediate mark / retry after error の状態遷移を fake timer 付き hook test で固定する
  - article selection、pending mutation queue、toast 表示とは混ぜず、自動既読 hook の scheduling と onError fallback だけを見る
  - retention policy や unread count projection は別バッチに残し、mark-read command 呼び出し条件に限定する

- [ ] Web Preview transient override 候補を別バッチで検証する
  - `use-article-browser-overlay-display.ts` の keyboard navigation 時の preview override と通常記事遷移時の reset 条件を棚卸しする
  - WebView geometry、history、browser overlay UI とは混ぜず、記事切替と preview open state の contract test に限定する
  - feed display mode precedence は既存 scope に残し、temporary override の lifetime だけを固定する

- [ ] release workflow permission / secret preflight 候補を別バッチで追加する
  - `.github/workflows/release.yml` と release workflow rule の permissions、tag trigger、Tauri signing secret requiredness を棚卸しする
  - draft release 作成前に fail-fast できる preflight を検討し、artifact naming や updater signing 方式変更とは混ぜない
  - GitHub Actions の workflow contract と local release docs の対応だけを扱う

- [ ] release version consistency dry-run 候補を別バッチで追加する
  - `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、release command の version / tag / changelog insertion を対応表で固定する
  - 実 tag 作成、GitHub Release 作成、release note 本文生成とは混ぜず、dry-run validation と failure message に限定する
  - manual verification checklist とは別に、release 前の機械的 version consistency gate として扱う

- [ ] dev scenario production bundle leak guard 候補を別バッチで追加する
  - `src/dev/scenario-runtime.ts`、`src/dev/scenarios/registry.ts`、`vite.config.ts` を見て、production bundle に dev scenario title / mock data が混入しないことを固定する
  - scenario 追加、command palette UI、dev intent 挙動変更とは混ぜず、build output または focused test の guard に限定する
  - dev-only runtime unavailable fallback は維持し、production import boundary だけを扱う

- [ ] duplicate local feed add ID reload 候補を別バッチで検証する
  - `add_local_feed` と `sqlite_feed.rs` の duplicate URL save path で、DB 上の既存 feed id を返却 DTO と初回 sync に使えるか確認する
  - add feed dialog UX、folder assignment、feed discovery URL normalization とは混ぜず、command / repository 境界の実体 ID contract に限定する
  - duplicate insert が no-op / upsert / existing row reuse のどれかを test で明示する

- [ ] account sync settings IPC validation 候補を別バッチで追加する
  - `account_commands.rs` と `src/api/schemas/commands.ts` の `sync_interval_secs` / `keep_read_items_days` を正の整数と許容範囲で揃える
  - sync scheduler backoff、startup sync、settings layout とは混ぜず、Rust command input と TypeScript schema の contract test に限定する
  - invalid value の error category と caller fallback を先に固定し、UI copy は別バッチに残す

- [ ] feed rename / folder create validation 候補を別バッチで追加する
  - `feed_commands.rs` と `sqlite_folder.rs` の title / folder name trim、empty、length、同一 account 内重複を command 境界で固定する
  - remote folder sync、drag/drop folder move、rename dialog visual/copy とは混ぜず、validation と repository error projection だけを見る
  - 既存データ migration は触らず、新規 update/create input の contract に限定する

- [ ] FreshRSS remote subscription stale detection 候補を別バッチで検証する
  - `sync_providers.rs`、`repository/feed.rs`、`sqlite_feed.rs` の remote subscription 差分検出を棚卸しし、消えた購読を stale diagnostic として扱えるか確認する
  - pending mutation queue、手動 unsubscribe UX、article retention とは混ぜず、remote subscription presence の検出と記録だけを見る
  - いきなり削除せず、diagnostic DTO / log / test fixture から始める

- [ ] mute keyword SQL/Rust match parity 候補を別バッチで追加する
  - `sqlite_mute_keyword.rs`、`sqlite_article.rs`、`sqlite_tag.rs` の Rust 側 match helper と SQL 側 match clause を同じ fixture で比較する
  - summary / content_text / content_sanitized / title の body 判定がズレないよう、境界値 test で固定する
  - sanitizer policy、settings form props、tag chip visual は混ぜない

- [ ] updater pending update lifecycle 候補を別バッチで検証する
  - `updater_commands.rs` と `use-updater.ts` の `PendingUpdate` cache、download 二重起動、download 失敗後の state reset を棚卸しする
  - release workflow preflight、version dry-run、署名 / artifact matrix 変更とは混ぜず、updater command lifecycle だけを扱う
  - check / download / install の user action availability を focused test と manual verification に分ける

- [ ] sidebar footer actions Storybook 候補を別バッチで追加する
  - `sidebar-footer-actions.tsx` の subscriptions / settings / theme toggle の通常表示と狭幅 truncation を story 化する
  - preference schema、theme persistence、mobile navigation redesign とは混ぜず、footer action surface の visual coverage に限定する
  - tooltip / icon label の有無と hit target の崩れを story test で固定する

- [ ] accounts nav long label surface 候補を別バッチで追加する
  - `accounts-nav-view.tsx` と `accounts-nav-view.stories.tsx` に長い account name / server host / username の story を追加する
  - selected row、description、provider summary の収まりだけを確認し、account setup lock や credential 保存とは混ぜない
  - provider DTO contract や account list sorting は別バッチに残す

- [ ] account connection summary tone variants 候補を別バッチで追加する
  - `account-connection-summary.tsx` と account detail stories に success 以外の warning / danger / detail なしの header summary を追加する
  - sync scheduler status、keyring verification、account settings copy 改善とは混ぜず、summary tone variant coverage に限定する
  - icon / label / secondary detail の有無が layout を崩さないことを story で固定する

- [ ] provider sync local feed failure warning 候補を別バッチで追加する
  - `sync_providers.rs` で GReader / FreshRSS account 配下の local feed sync failure が `warn!` だけで消えないか確認する
  - 必要なら `ProviderSyncWarning` へ乗せる contract を追加し、scheduler backoff、provider error mapping、manual sync toast 文言とは混ぜない
  - warning DTO / log / sync result feedback の対応は別段階で扱う

- [ ] GReader subscription icon persistence boundary 候補を別バッチで検証する
  - `greader.rs` と `sync_providers.rs` で `iconUrl` を受け取った subscription が sync 保存時に icon を保存する / しない契約を固定する
  - provider icon visual fallback、app icon theme、feed row UI とは混ぜず、provider DTO から feed persistence への mapping だけを見る
  - 保存しない判断なら diagnostic / fallback source を test comment ではなく contract として明示する

- [ ] UI reference canvas iframe smoke matrix 候補を別バッチで追加する
  - Storybook Playwright smoke に UI Reference の主要 iframe URL が blank / error にならない確認を追加する
  - visual snapshot、canvas 名変更、Storybook fixture runtime 整理とは混ぜず、loadable smoke gate だけを見る
  - 既存 1 canvas smoke から対象 URL の小さい matrix へ広げる

- [ ] mute keyword auto mark preference guard 候補を別バッチで追加する
  - `mute_keyword_commands.rs` と `sqlite_mute_keyword.rs` で、create / update 時の既存一致記事 auto mark read を `mute_auto_mark_read=true` の時だけ適用する
  - SQL/Rust match parity、settings UI copy、記事フィルタリング仕様とは混ぜず、preference guard と既存記事更新条件だけを見る
  - preference false / missing の fallback を contract test で固定する

- [ ] feed integrity orphan cleanup command 候補を別バッチで追加する
  - `get_feed_integrity_report` で見つかる orphaned articles を削除する backend command と TS wrapper / schema を追加できるか確認する
  - subscriptions-index 表示、Data settings UI 導線、feed cleanup candidate 判定ロジックとは混ぜない
  - cleanup 対象と dry-run / execution の境界を先に command contract として固定する

- [ ] account create keyring orphan rollback 候補を別バッチで追加する
  - `account_commands.rs` で keyring 保存成功後に DB save が失敗した場合、作成した credential を削除する contract test を追加する
  - provider login flow、connection verification UI、既存 account 更新時の credential 検証とは混ぜない
  - rollback failure は元 error と log の扱いを分けて固定する

- [ ] dev credentials JSON corruption fail-closed 候補を別バッチで追加する
  - `keyring_store.rs` で壊れた `dev-credentials.json` を空 store 扱いで上書きせず、read error / parse error を明示エラーにする
  - native keyring backend、実 credential 値、dev credentials 保存場所変更とは混ぜない
  - corrupted file を保持することと新規保存時の挙動を別 test にする

- [ ] migration backup atomic write guard 候補を別バッチで追加する
  - `backup.rs` と `connection.rs` で backup を temp file 経由で作成し、DB / WAL / SHM の一部だけ残る失敗ケースを固定できるか確認する
  - migration recovery runbook、Data settings backup UX、repository test とは混ぜない
  - atomic write と auxiliary file pairing を小さい infra/db test に分ける

- [ ] sync-completed invalidation scope guard 候補を別バッチで追加する
  - `App.tsx` の `sync-completed` listener と `query-invalidation.ts` を見直し、全量 `invalidateQueries()` を必要 query key に限定できるか確認する
  - sync scheduler、toast 文言、manual sync UI とは混ぜず、feed / article / account sync status の cache invalidation scope だけを扱う
  - event payload なしの場合の fallback と scoped invalidation を test で分ける

- [ ] provider HTTP client policy 候補を別バッチで追加する
  - `local.rs`、`greader.rs`、`feed_discovery.rs` の timeout / redirect limit / User-Agent の差を provider HTTP contract として fixture test で固定する
  - retry / backoff、scheduler、UI toast 文言とは混ぜない
  - provider ごとの意図的な差分と共通 policy を対応表にする

- [ ] GReader pagination guard 候補を別バッチで追加する
  - `greader.rs` と `sync_providers.rs` で同一 continuation の再返却や空 page 連続時に無限 loop しないことを固定する
  - FreshRSS stale detection、pending mutation、unread reconcile とは混ぜない
  - max page / duplicate continuation / empty continuation の fixture を分ける

- [ ] local provider JSON Feed body parsing 候補を別バッチで追加する
  - `normalizer.rs` と `local.rs` で、取得済み `application/feed+json` body が `RemoteEntry` に落ちる contract を fixture test で固定する
  - feed discovery rel / JSON Feed detection、add feed dialog、URL normalization とは混ぜない
  - discovery ではなく fetched body parsing に限定する

- [ ] GReader folder label normalization 候補を別バッチで追加する
  - `greader.rs` で `user/-/label/...` id 文字列、`label` field、URL encoded label の扱いを provider parsing test で固定する
  - provider normalizer DTO、folder drag/drop、folder rename UI とは混ぜない
  - folder id と display label の normalization を別 assertion にする

- [ ] local create_subscription HTTP error contract 候補を別バッチで追加する
  - `local.rs` と `feed_commands.rs` で 404 / 500 / HTML response を feed parser へ流す前に network / parse のどちらで返すかを固定する
  - feed discovery failure UX、duplicate local feed add、toast copy とは混ぜない
  - mockito fixture で status error と content-type mismatch を分ける

- [ ] sidebar roving hidden target skip 候補を別バッチで追加する
  - `sidebar.tsx` で collapsed folder 配下や disabled row を ArrowUp / Down の移動対象から外す contract を追加する
  - visibility / density preference、focus return 全体設計、account pane navigation とは混ぜない
  - hidden row と disabled row の skip を別 test にする

- [ ] feed tree folder disclosure aria pairing 候補を別バッチで追加する
  - `feed-tree-folder-section.tsx` で toggle の `aria-controls` と panel id、open / closed の `aria-expanded` / `aria-hidden` 対応を固定する
  - drag/drop、motion 見た目、folder selection priority とは混ぜない
  - folder empty / has children の両方で aria pairing を見る

- [ ] article same-timestamp pagination stability 候補を別バッチで追加する
  - `sqlite_article.rs` と `sqlite_tag.rs` の `ORDER BY published_at DESC` 系に `fetched_at` / `id` の tie-breaker を足せるか確認する
  - account / feed stable sort、UI 側 sort、reader grouping とは混ぜない
  - 同一日時記事の pagination fixture を repository test に追加する

- [ ] article search empty / FTS special char guard 候補を別バッチで追加する
  - `sqlite_article.rs` と必要なら `article_commands.rs` で whitespace-only / quote / FTS 予約記号の扱いを固定する
  - frontend empty state、search ranking、CJK 検索改善とは混ぜない
  - 空検索を空配列にするか validation error にするかを command / repository contract として明示する

- [ ] FTS / LIKE merged search order contract 候補を別バッチで追加する
  - `sqlite_article.rs` で FTS 結果と LIKE fallback 結果を merge した後の最終表示順を repository test で固定する
  - tokenizer 変更、search UI、reader scope matrix とは混ぜない
  - duplicate hit の dedupe と order priority を別 assertion にする

- [ ] startup unread count mute reconcile 候補を別バッチで追加する
  - `connection.rs` と `sqlite_feed.rs` で startup reconcile と `recalculate_unread_count` の mute count 定義を揃える
  - mute keyword parity 本体、preferences guard、badge / UI 表示とは混ぜない
  - 小さい DB fixture で muted article を含む unread count を確認する

- [ ] article_tags orphan integrity guard 候補を別バッチで追加する
  - `sqlite_tag.rs` と必要なら `dto.rs` で foreign_keys off の破損 `article_tags` を検出する read-only helper / repository test から始める
  - feed integrity orphan cleanup command、tag settings UI、tag color / rename 挙動とは混ぜない
  - cleanup 実行ではなく検出 contract の追加に限定する

- [ ] account detail sync progress render contract 候補を別バッチで追加する
  - `sync-section-view.tsx` と `use-account-detail-view-props.tsx` で `progressLabel` / `progressValue` / `progressCurrentLabel` が view に表示される契約を固定する
  - manual sync toast、sync scheduler、provider error mapping とは混ぜない
  - progress なし / indeterminate / current label ありを focused component test で分ける

- [ ] account detail sync-now in-flight guard 候補を別バッチで追加する
  - `use-account-detail-sync-controls.ts` と `sync-section-view.tsx` で `Sync Now` 連打時に `syncAccount(account.id)` が二重起動しないことを固定する
  - sync-on-wake guard、global sync progress、manual sync feedback copy とは混ぜない
  - hook と view の disabled / pending contract を分けて見る

- [ ] account connection test in-flight guard 候補を別バッチで追加する
  - `use-account-detail-credentials-editor.ts` と `credentials-section-view.tsx` で `Test connection` 連打時に `testAccountConnection()` が重複しない契約を追加する
  - keyring backend、credential migration、FreshRSS auth copy とは混ぜない
  - credential save dedupe と connection test dedupe を別 assertion にする

- [ ] add account submit double-click guard 候補を別バッチで追加する
  - `account-config-form.tsx` と `add-account-form.ts` で submit 直後の再クリック / Enter 連打が `addAccount()` と setup sync を二重起動しないことを固定する
  - account setup lock、provider login flow、keyring orphan rollback とは混ぜない
  - focused test では pending submit と validation failure の再送可否を分ける

- [ ] data settings action pending state 候補を別バッチで追加する
  - `use-data-settings-controller.ts` と `data-settings-view.tsx` で `Open log directory` / `VACUUM` の pending 表示と連打抑止を data settings 内だけで固定する
  - native open command 化、backup / export UX、DB migration recovery とは混ぜない
  - action ごとの pending flag と shared disabled 表示を別 assertion にする

- [ ] Article auto-mark failed mutation retry boundary 候補を別バッチで追加する
  - `use-article-auto-mark.ts` で auto mark read mutation 失敗時に `autoMarkedArticleIdRef` を戻すか、同じ記事で再試行するかを固定する
  - pending mutation queue、backend article command、toast 文言、after-reading preference UI とは混ぜない
  - 失敗後の再選択と次記事 selection の挙動を hook test で分ける

- [ ] Sidebar startup expanded-folder persistence guard 候補を別バッチで追加する
  - `use-sidebar-startup-folder-expansion.ts` で startup restore 前の一時的な `expandedFolderIds` が localStorage の保存済み展開状態を上書きしないことを固定する
  - folder drag/drop、sidebar visual density、folder tree sorting、startup account selection とは混ぜない
  - account / feedsReady / foldersReady の組み合わせごとに保存タイミングを確認する

- [ ] Settings modal hook placement parity 候補を別バッチで追加する
  - `use-settings-modal-view-props.tsx` と `use-reading-settings-view-props.ts` を `settings/hooks/` 配下へ揃えられるか、import path と既存 tests だけで確認する
  - settings nav type 分割、modal behavior、account setup lock、表示 copy 変更とは混ぜない
  - 移動する場合は path-only に近い差分で、hook contract の再設計は別に残す

- [ ] Settings preference option schema parity 候補を別バッチで追加する
  - general / appearance / reading settings hooks の select / switch option value と `setPref` key が preferences schema の許容値とズレないことを固定する
  - preferences migration、default value 変更、settings UI copy、layout / design 変更とは混ぜない
  - settings hook contract test に限定し、UI 表示文言は assertion しない

- [ ] CI workflow / mise task execution name parity guard 候補を別バッチで追加する
  - `.github/workflows/ci.yml` が呼ぶ `mise run format:check` / `lint` / `test:ci` / `build` / `app:build:debug` が実在 task として解決できることを static test にする
  - CI job matrix 変更、Storybook gate 追加、release workflow preflight とは混ぜない
  - workflow 上の実行名と `mise.toml` の task 名だけを照合する

- [ ] Tauri mock response schema validation guard 候補を別バッチで追加する
  - `tests/helpers/tauri-mocks.ts` の代表 mock response が frontend response schema に通ることを test helper contract として固定する
  - 未対応 command coverage guard、mock data 文言変更、実 command schema の仕様変更とは混ぜない
  - まずは high-traffic command の response validation だけに限定する

- [ ] Storybook addon / config dependency parity guard 候補を別バッチで追加する
  - `.storybook/main.ts` の addons / framework が `package.json` devDependencies と一致し、不要に config だけ残らないことを static test で見る
  - Storybook iframe smoke、UI Reference canvas 分割、a11y violation の実行 gate とは混ぜない
  - dependency 名の existence check に限定し、Storybook 起動検証は別バッチに残す

- [ ] docs relative link target guard 候補を別バッチで追加する
  - `README.md`、`docs/README.md`、`docs/*.md` の repository 内相対 Markdown link だけを対象に、リンク先ファイルが存在することを小さい static test で固定する
  - 外部 URL チェック、歴史的 `docs/superpowers/plans` / `specs` の全面監査、本文更新とは混ぜない
  - 初回は通常 docs だけを対象にし、archived / dated records は除外 allowlist を持つ

- [ ] historical docs command replacement parity guard 候補を別バッチで追加する
  - `docs/superpowers/README.md` に書かれている旧コマンドから現行 `mise run ...` への置換表が実在 task を指すことを検証する
  - dated records 内の旧コマンド書き換え、README 全体の command table parity、release checklist 更新とは混ぜない
  - replacement table と task existence の対応だけを package-scripts 系 test に寄せる

- [ ] pending mutation type canonicalization 候補を別バッチで追加する
  - `PendingMutation.mutation_type` を string 直書きから domain enum / parser に寄せ、`mark_read` / `mark_unread` / `star` / `unstar` と旧 `set_starred` 系の互換を固定する
  - provider push の retry / backoff、UI toast、remote state reconcile とは混ぜない
  - repository / service test で parser と legacy compatibility を分ける

- [ ] pending mutation replace atomicity 候補を別バッチで追加する
  - `sqlite_pending_mutation.rs` で同一 `(account_id, remote_entry_id)` の delete -> insert を transaction / upsert 境界として固定する
  - mutation 種別 enum 化、provider sync 実行順、UI 側の連打抑止とは混ぜない
  - 途中失敗で既存 pending が消えない contract test を追加する

- [ ] GReader subscription URL merge preserves local settings 候補を別バッチで追加する
  - `sync_providers.rs` と `sqlite_feed.rs` で remote subscription が既存 local feed と `account_id + url` で衝突した時に user settings を失わないことを固定する
  - duplicate feed UI、folder drag/drop、feed discovery normalization とは混ぜない
  - `reader_mode` / `web_preview_mode` / folder の preserve assertion を小さい DB fixture に分ける

- [ ] stale remote folder detach policy 候補を別バッチで追加する
  - `sync_providers.rs` と `sqlite_folder.rs` で GReader 側から消えた folder remote_id の feed.folder_id を保つ / 外す方針を contract test として固定する
  - stale feed 購読削除、folder rename UI、manual cleanup command とは混ぜない
  - 初回は削除実装ではなく missing remote folder の detach policy 明文化に限定する

- [ ] sync_state scope key typed helper 候補を別バッチで追加する
  - `scheduler`、`account:greader:all`、`account:greader:remote-state-full`、`feed:{remote_id}`、`local_feed:{url}` を typed helper に寄せる
  - sync_state schema migration、backoff 計算、remote-state cooldown の挙動変更とは混ぜない
  - scope collision と accidental typo を pure test で固定する

- [ ] article toolbar action resolver contract 候補を別バッチで追加する
  - `article-toolbar-view.tsx` と `use-article-toolbar-controls.tsx` で `hasArticle` / `url` / `action_copy_link` / `hideBrowserOverlayActions` / `layoutMode` から action 表示状態を解く resolver を検討する
  - visual token、icon、toast、article action 本体、context menu action id 整理とは混ぜない
  - 表示 / disabled / desktop-mobile 配置順だけを小さい contract test に寄せる

- [ ] article list header control availability contract 候補を別バッチで追加する
  - `article-list-header-actions.tsx` と header hooks で `mark all read`、search、sidebar toggle、feed display select がどの scope で出る / 押せる / no-op になるかを固定する
  - mark-all-read 件数 resolver、confirm dialog copy、reader query scope matrix、feed display setting 保存処理とは混ぜない
  - UI contract として availability だけを test し、実 mutation は別に残す

- [ ] article row presentation helper contract 候補を別バッチで追加する
  - `article-list-item.tsx` で title / feed / summary / viewed_at / starred / unread / recently-read から aria label、meta label、summary、thumbnail 表示を組む判定を helper 化できるか確認する
  - row selection styling、keyboard navigation、scroll、grouping、article content sanitizer とは混ぜない
  - 境界値 test は missing title / missing feed / summary empty / thumbnail empty を分ける

- [ ] article list context trigger ownership contract 候補を別バッチで追加する
  - `article-list-body.tsx`、`article-list-screen-view.tsx`、`article-context-menu.tsx` で list background menu trigger と article row menu trigger が listbox / option role とクリック選択を壊さないことを固定する
  - menu item enabled/disabled、action id 対応表、mark all read scope、Base UI visual token とは混ぜない
  - trigger ownership と selection side effect だけを focused component test にする

- [ ] sidebar footer utility action contract 候補を別バッチで追加する
  - `sidebar-footer-actions.tsx` で subscriptions index / theme toggle / settings の footer utility action を label、tooltip、icon、click handler、theme light/dark 切替の contract として固定する
  - settings page navigation、subscriptions index UI、preferences schema migration、theme token / design 変更とは混ぜない
  - footer action surface の narrow display は Storybook 候補へ残す

- [ ] API pagination args finite integer guard 候補を別バッチで追加する
  - `commands.ts` と `schemas.test.ts` で `offset` / `limit` を使う list/search 系 args だけを finite integer / nonnegative / positive として固定する
  - backend pagination order、FTS search、同一 timestamp pagination stability、UI empty state とは混ぜない
  - validation failure の typed result だけを見て、UI copy は触らない

- [ ] addAccount provider args discriminated validation 候補を別バッチで追加する
  - `commands.ts` と `account_commands.rs` で `Local` と `FreshRss` の `kind` / `serverUrl` / `username` / `password` 必須条件を揃える
  - provider login UX、keyring rollback、connection test 連打抑止、account setup lock とは混ぜない
  - TS schema と Rust command 境界の invalid args fixture を対応させる

- [ ] preference value max-length parity guard 候補を別バッチで追加する
  - `commands.ts` と `preference_commands.rs` で backend の `value.len() > 1024` 制限を frontend `setPreferenceArgs` でも事前 validation するか、差分を contract test で明示する
  - preference default / migration、settings UI option parity、shortcut preference registry、表示 copy とは混ぜない
  - max-length と UTF-8 byte / char count の扱いを先に固定する

- [ ] sync result numeric schema guard 候補を別バッチで追加する
  - `sync-result.ts` と `schemas.test.ts` で `total` / `succeeded` / `retry_in_seconds` を nonnegative integer として固定する
  - provider warning DTO 追加、manual sync toast、scheduler backoff、sync result feedback copy とは混ぜない
  - `succeeded <= total` を同時に固定するかは別判断として残す

- [ ] actions toolbar service contract 型固定候補を別バッチで追加する
  - `use-actions-settings-view-props.tsx` と `actions-settings-view.tsx` で `serviceEntries` の `id` / `prefKey` / `label` / `icon` を typed registry として固定する
  - toolbar action の追加、reader toolbar 表示、shared button visual とは混ぜない
  - view props へ渡す toggle contract と preference key の対応を focused test にする

- [ ] data settings database info loading/error contract 候補を別バッチで追加する
  - `use-data-settings-controller.ts` と `data-settings-view.tsx` で DB size の loading / ready / error を hook result と view props で明示する
  - vacuum 実装、log dir native-open、backup / export UX、database command schema とは混ぜない
  - `...` が loading と failure を兼ねないよう表示 contract を固定する

- [ ] add-account config controller/view contract 分離候補を別バッチで追加する
  - `account-config-form.tsx` の inline JSX を既存 `form-view.tsx` 相当の view props 境界へ寄せられるか確認する
  - provider 追加、account setup session lock、keyring rollback、FreshRSS 接続仕様変更とは混ぜない
  - submit / cancel / disabled / error の contract を小さく固定する

- [ ] account detail credentials draft/save race contract 候補を別バッチで追加する
  - `use-account-detail-credentials-editor.ts` と `credentials-section-view.tsx` で blur save 中の再編集、password mask focus、copy URL の draft 優先順位を固定する
  - native keyring 検証、credential 値の保存方式、connection verification flow 再設計とは混ぜない
  - hook contract と focused component test を分ける

- [ ] account detail sync action in-flight guard 候補を別バッチで追加する
  - `use-account-detail-sync-controls.ts` と `sync-section-view.tsx` で `handleSyncNow` / setup retry の二重実行防止と view の disabled / loading contract を固定する
  - progress 表示追加、sync scheduler / backoff、manual sync toast 文言、provider error mapping とは混ぜない
  - account detail sync-now guard 候補と統合する場合は実装前に scope を整理する

- [ ] database vacuum busy error contract 候補を別バッチで追加する
  - `database_commands.rs` で VACUUM 実行時の sqlite busy / locked / generic error を command result として分類できるか確認する
  - data settings pending state、backup / export UX、migration recovery とは混ぜない
  - UI 文言ではなく backend error category と TS schema compatibility に限定する

- [ ] migration duplicate column fallback guard 候補を別バッチで追加する
  - `migration.rs` の idempotent column helpers と V8 / V16 系 migration で duplicate column error を許容する範囲を test で固定する
  - full rollback behavior、backup restore、schema redesign とは混ぜない
  - 許容する migration と許容しない migration を明示する

- [ ] article content text backfill drift guard 候補を別バッチで追加する
  - `connection.rs` と V14 migration 後の `content_text` backfill が sanitizer / text extraction helper と drift しないことを fixture で固定する
  - sanitizer privacy hardening、article content migration 全体、reader display UI とは混ぜない
  - migration-time backfill と runtime sanitized update の差分を明示する

- [ ] dev intent env precedence contract 候補を別バッチで追加する
  - `src/dev/intent.ts` で `VITE_DEV_INTENT`、runtime dev options、未設定時 fallback の優先順位を pure test で固定する
  - dev scenario production bundle leak、command palette dev scenario 実行、mock data 変更とは混ぜない
  - invalid env と runtime option の組み合わせを別 case にする

- [ ] dev runtime options bounds contract 候補を別バッチで追加する
  - `src/dev/intent.ts` の dev window width / height parse で 0、負数、非数値、過大値をどう扱うかを固定する
  - web preview geometry fixture、Tauri window resize 実行、dev server 起動とは混ぜない
  - parse helper の typed error と public fallback を別 assertion にする

- [ ] dev scenario keyword uniqueness contract 候補を別バッチで追加する
  - `scenario-ids.ts` と `scenarios/registry.ts` で scenario id / title / keyword の重複を static test で固定する
  - scenario 追加、command palette ranking、dev scenario UI copy とは混ぜない
  - id duplicate と keyword duplicate を別 assertion にする

- [ ] dev scenario window sizing failure surface 候補を別バッチで追加する
  - `scenarios/helpers.ts` の web preview window resize helper で resize 失敗時の toast / warn / continuation を固定する
  - browser geometry 数値変更、Tauri window API wrapper、Playwright 実機検証とは混ぜない
  - apply size failure と final size mismatch を別 fixture にする

- [ ] browser webview event listener cleanup contract 候補を別バッチで追加する
  - `use-browser-webview-events.ts` で diagnostics / fallback / state changed の listen cleanup が unmount 時に必ず呼ばれることを focused test で固定する
  - generic Tauri event listener lifecycle、browser state reducer、native WebView event payload 変更とは混ぜない
  - runtime unavailable と listener registration failure の扱いを分ける

- [ ] browser overlay focus return fallback 候補を別バッチで追加する
  - `use-browser-overlay-focus-return.ts` で return target が消えた時に open-in-browser button か safe fallback へ戻る contract を固定する
  - reader focus navigation 全体、browser overlay shortcut、article selection UX とは混ぜない
  - previous target あり / target missing / no browser URL を別 case にする

- [ ] browser requested-url state merge contract 候補を別バッチで追加する
  - `browser-webview-state.ts` と `use-browser-webview-request-state.ts` で requested URL と native state changed payload の merge priority を固定する
  - browser history stack、load timeout surface、WebView bounds とは混ぜない
  - same URL reload、redirected URL、stale native payload を別 assertion にする

- [ ] browser debug geometry null reset contract 候補を別バッチで追加する
  - `use-browser-debug-geometry-events.ts` と `browser-debug-geometry.ts` で diagnostics off / unmount 時に `browserDebugGeometry` event が null reset されることを固定する
  - Debug HUD visual、geometry calculation、native diagnostics payload 変更とは混ぜない
  - initial off と on -> off transition を別 test にする

- [ ] updater restart failure state guard 候補を別バッチで追加する
  - `use-updater.ts` で download 済み update の restart 失敗時に pending update / loading / error state がどう残るかを hook contract として固定する
  - updater pending update lifecycle 全体、release artifact config、restart UI copy とは混ぜない
  - restart command failure と runtime unavailable を別 case にする

- [ ] clipboard runtime unavailable category 候補を別バッチで追加する
  - `clipboard.ts` と article copy actions で Tauri clipboard unavailable / permission denied / invalid text の error category を固定する
  - share command unsupported scheme、toast copy、article share menu visual とは混ぜない
  - web fallback と native failure の projection を別 assertion にする

- [ ] window event helper options parity 候補を別バッチで追加する
  - `window-events.ts` で keyboard / pointer / custom event helper が add/remove に同じ target / type / listener / options を渡すことを test で固定する
  - browser webview event listener cleanup、global shortcut guard、DOM event behavior 変更とは混ぜない
  - capture/passive/options object の parity を小さい fake target で確認する

- [ ] platform capabilities mock parity 候補を別バッチで追加する
  - `platform/mod.rs` の capability DTO と `tests/helpers/tauri-mocks.ts` の mock platform info が同じ field set を持つことを schema / fixture test で固定する
  - platform abstraction contract 全体、capability JSON、packaged app manual verification とは混ぜない
  - missing field と stale extra field を別 assertion にする

- [ ] locale plural form parity 候補を別バッチで追加する
  - `src/locales/en/*.json` と `ja/*.json` で `_one` / `_other` など plural suffix の key set が locale 間でズレないことを static test にする
  - placeholder parity、文言改善、i18next namespace drift とは混ぜない
  - plural family だけを対象にし、通常 key existence は既存候補へ残す

- [ ] menu i18n accelerator label parity 候補を別バッチで追加する
  - `menu_i18n.rs` と frontend shortcut label の「ブラウザで開く」「コピー」系 action の語彙がズレないことを小さい contract として棚卸しする
  - native menu checked state、shortcut preference validation、copy 文言改善全体とは混ぜない
  - action id と label source の対応表だけを固定する

- [ ] browser surface runtime issue reset contract 候補を別バッチで追加する
  - `use-browser-view-surface-state.ts` で runtime unavailable / failed / blocked issue が URL 変更、close、retry success でどう reset されるかを固定する
  - browser overlay issue Storybook、load timeout surface、native WebView command 変更とは混ぜない
  - issue kind ごとの reset trigger を fake runtime test に分ける

- [ ] Command palette prefix parser whitespace contract 候補を別バッチで追加する
  - `use-command-search.ts` の `parsePrefix` で、leading whitespace、prefix 直後の whitespace、prefix だけの入力、通常検索の query を pure test で固定する
  - command action filtering、resource search ranking、palette UI copy は混ぜず、prefix parser の入出力だけを扱う

- [ ] Command palette history storage compaction contract 候補を別バッチで追加する
  - `command-palette-history.ts` と `use-command-history.ts` で、重複 entry の先頭移動、最大件数、invalid stored entry の扱いを storage helper contract として固定する
  - unavailable action guard、resource existence validation、recent item UI 表示順は別バッチに残す

- [ ] Sidebar feed navigation expansion freshness 候補を別バッチで追加する
  - `use-sidebar-feed-navigation.ts` で keyboard/event navigation により collapsed folder 配下の feed へ移動する時、expanded folder set が stale closure で上書きされない契約を固定する
  - startup folder expansion、roving hidden target skip、scroll positioning の見た目調整は混ぜない

- [ ] Feed tree click suppression timer cleanup 候補を別バッチで追加する
  - `use-feed-tree-handle-click-suppression.ts` で suppress timer が unmount 時に clear され、連続 drag handle 操作でも stale timer が残らない契約を fixed timer test で固定する
  - drag outcome、drop target hover、folder disclosure aria は別バッチにする

- [ ] Sync scheduler panic progress completion contract 候補を別バッチで追加する
  - `sync_scheduler.rs` で account sync panic 時にも account finished event と scheduler continuation の契約が崩れないことを helper 化して固定する
  - provider panic の原因調査、retry/backoff policy、UI sync feedback copy は別バッチにする

- [ ] Updater progress percent normalization contract 候補を別バッチで追加する
  - `use-updater.ts` で `update-download-progress` の percent が `null` / 0 / 100 / 範囲外の場合に toast progress と message がどう出るかを hook/runtime test で固定する
  - updater command implementation、release artifact verification、restart failure guard は混ぜない

- [ ] Tag color validation normalization contract 候補を別バッチで追加する
  - `tag_commands.rs` の `validate_color` と frontend tag form 周辺で、hex color の大文字小文字、短縮形、空文字、invalid value の扱いを contract test として明示する
  - tag chip visual token、color picker UI、tag count cache invalidation は別バッチに残す

- [ ] Preference language menu update failure contract 候補を別バッチで追加する
  - `preference_commands.rs` で `ui_language` 保存後に menu update が失敗した時の error category と保存済み preference の扱いを contract として固定する
  - locale copy、menu accelerator label、settings view option schema は混ぜない

- [ ] Article list search debounce / close contract 候補を別バッチで追加する
  - `use-article-list-search.ts` で `openSearch` / `handleToggleSearch` / `handleCloseSearch` と `ARTICLE_SEARCH_DEBOUNCE_MS` 後の trimmed query 反映を hook test で固定する
  - article scope matrix、footer filter、search UI の見た目、検索 API/schema 変更は混ぜない

- [ ] Article auto mark timer ownership contract 候補を別バッチで追加する
  - `use-article-auto-mark.ts` で `after_reading` の delayed timer が article change / unmount で cancel され、同一 article を二重 mark しない契約を fake timer で固定する
  - mutation retry、toast 文言、recent smart view の表示仕様、retention helper のリファクタは混ぜない

- [ ] Sidebar hidden-section fallback contract 候補を別バッチで追加する
  - `use-sidebar-visibility-fallback.ts` で unread / starred / recent / tag section が非表示、または選択中 tag が消えた時の fallback 順を hook test で固定する
  - sidebar visual、section collapse UI、account switcher、tag create/delete mutation は混ぜない

- [ ] Article status actions null selection guard 候補を別バッチで追加する
  - `use-article-status-actions.ts` で `articleId` が null の時に read/star mutation、retain、toast が呼ばれない契約を hook test で固定する
  - optimistic cache、auto mark timer、article toolbar visual state は混ぜず、action guard のみ扱う

- [ ] Article view browser-only fallback precedence 候補を別バッチで追加する
  - `use-article-view-selection.ts` で `contentMode=browser` かつ selected article が見つからない時の browser-only fallback と not-found の優先順を固定する
  - article list source planning、browser overlay display override、empty summary copy は別バッチに残す

- [ ] Command palette shortcuts help history exclusion 候補を別バッチで追加する
  - `use-command-palette-handlers.ts` で `open-shortcuts-help` が palette close と modal open だけを行い、command history に記録されない契約を固定する
  - command history compaction、shortcut help modal UI、action availability guard は混ぜない

- [ ] Command palette feed landing failure projection 候補を別バッチで追加する
  - `use-command-palette-handlers.ts` で `openFeedLanding(feedId)` が reject した時の close 済み状態、history 記録、error projection 方針を明示する
  - feed landing query、toast copy、resource search result ranking は別バッチにする

- [ ] Debug settings dev action disabled guard 候補を別バッチで追加する
  - `use-debug-settings-view-props.ts` で devBuild=false 時の scenario action が disabled になり、呼び出し側が誤って onAction しても runtime scenario を起動しない方針を固定する
  - Debug HUD visual、dev scenario registry、settings layout は混ぜない

- [ ] Screen snapshot adoption latch 候補を別バッチで追加する
  - `use-screen-snapshot.ts` で `candidate=null` は未解決入力として扱い、いったん採用した snapshot と `hasAdoptedSnapshot` が dependency change で意図せず戻らない契約を固定する
  - first-screen readiness 全体、startup data loading、visual skeleton は別スコープに残す

- [ ] Reading settings clear recent articles no-account guard 候補を別バッチで追加する
  - `use-reading-settings-view-props.ts` で selected account が無い時、clear recent articles action が disabled になり confirm/mutation を起動しない契約を固定する
  - recent history repository、settings copy、reader recent smart view 表示は混ぜない

- [ ] Preferences load single-flight fallback 候補を別バッチで追加する
  - `preferences-store.ts` で concurrent `loadPreferences()` が single-flight になり、失敗時も `loaded=true` と default language fallback が適用される契約を固定する
  - preference schema migration、theme view transition、settings UI 表示は別バッチにする

- [ ] Browser tracker redirect history replacement 候補を別バッチで追加する
  - `browser_webview.rs` の `BrowserWebviewTracker` で new/back/forward/reload 後に finish URL が redirect 済み URL へ置換される契約を Rust unit test で固定する
  - native WebView bounds、frontend requested-url merge、browser history UI は混ぜない

- [ ] Browser webview timeout fallback emission 候補を別バッチで追加する
  - `browser_webview_commands.rs` と `browser_webview.rs` で load timeout 時に tracker clear、fallback event、closed event の発火順と重複防止を helper contract として整理する
  - frontend load timeout surface、external browser fallback、geometry diagnostics は同じバッチに混ぜない

- [ ] Browser WebView preference read failure fallback 候補を別バッチで追加する
  - `browser_webview.rs` と `browser_webview_commands.rs` で `load_browser_preview_prefs` 失敗時にも WebView 作成全体を失敗させない fallback を契約化する
  - shortcut 割り当て仕様、WebView bounds、Windows WebView2 bridge の挙動変更は混ぜない

- [ ] Database size info auxiliary files contract 候補を別バッチで追加する
  - `connection.rs` と `database_commands.rs` で database info の total が db / wal / shm のどこまでを含むかを DTO 名と test で明示する
  - migration recovery、backup cleanup policy、data settings UI copy は別バッチに残す

- [ ] VACUUM reopen failure recoverable error 候補を別バッチで追加する
  - `connection.rs` と `database_commands.rs` で `vacuum()` 後の file connection reopen failure が panic ではなく `DomainError` / `AppError` として返る契約へ寄せる
  - migration restore、sync 中 guard、DB compaction UI は同じバッチに混ぜない

- [ ] Dev intent cancellation before scenario run 候補を別バッチで追加する
  - `use-dev-intent.ts` で runtime options load 中または timeout 前に unmount された場合、`runRuntimeDevScenario` が起動しない契約を fake timer test で固定する
  - dev scenario registry、scenario error toast copy、production bundle leak guard は混ぜない

- [ ] Story query client retry isolation contract 候補を別バッチで追加する
  - `story-query-client-provider.tsx` で story ごとに retry=false の QueryClient が作られ、query cache が story render 間で漏れない契約を lightweight test で固定する
  - Storybook decorator runtime provider parity、production query retry policy、visual specimen は混ぜない

- [ ] Platform dev runtime positive integer parsing contract 候補を別バッチで追加する
  - `platform_commands.rs` の dev runtime options で window width/height env が positive integer の時だけ DTO に入り、空文字・0・負数・非数値を無視する契約を固定する
  - dev scenario window sizing failure surface、platform capabilities mock parity、Tauri capability JSON は混ぜない

- [ ] Reading List URL quote escaping contract 候補を別バッチで追加する
  - `share_commands.rs` の macOS Reading List command で URL 内の double quote が AppleScript 文字列を壊さないよう escape 方針を contract test 化する
  - unsupported scheme guard、clipboard runtime category、Safari 実機 verification は別バッチにする

- [ ] Subscriptions list scroll restore idempotency contract 候補を別バッチで追加する
  - `subscriptions-list-pane.tsx` で `initialScrollTop` が同じ値で再 render された時は再代入せず、値が変わった時だけ scrollTop を復元する契約を固定する
  - selection flow、keep/defer/delete、summary filter、visual density は混ぜない

- [ ] Subscriptions duplicated folder label accessibility contract 候補を別バッチで追加する
  - `subscriptions-list-pane.tsx` で同名 folder が複数ある場合も `aria-controls`、panel id、`data-testid` が folderId ベースで衝突しない契約を固定する
  - folder rename、drag/drop 実装、購読整理 decision flow は別バッチに残す

- [ ] Set preference shortcut key rejection contract 候補を別バッチで追加する
  - `commands.ts` の `setPreferenceArgs` で unknown `shortcut_*` key が reject され、known shortcut key だけ `shortcutPreferenceValueSchema` で検証される契約を schema test で固定する
  - shortcut recording UI、keyboard shortcut conflict resolver、Rust preference command は別バッチにする

- [ ] Mute keyword invalid stored scope conversion contract 候補を別バッチで追加する
  - `sqlite_mute_keyword.rs` で DB に unknown scope が入った場合、`find_all` が silent fallback せず conversion error として扱う契約を repository test で固定する
  - command input validation、migration cleanup、UI error projection は別バッチにする

- [ ] Command args registry coverage contract 候補を別バッチで追加する
  - `commands.ts` の `commandArgsSchemas` で argument schema を持つ exported command wrapper が registry に登録されていることを代表的な static test で固定する
  - response schema validation、Tauri mock argument coercion、command implementation 変更は混ぜない

- [ ] Mute keyword auto-mark account enumeration contract 候補を別バッチで追加する
  - `mute_keyword_commands.rs` の `maybe_mark_existing_muted_articles_as_read` で feeds から distinct account_id を列挙し、同一 account の複数 feed でも mark 処理が重複しない契約を helper test で固定する
  - mute keyword create/update UI、article cache invalidation、provider sync flow は別バッチにする

- [ ] Article sanitized text summary fallback contract 候補を別バッチで追加する
  - `sqlite_article.rs` の `article_body_text` / `update_sanitized` で sanitized HTML が空の時に summary fallback を使うかどうかの方針を contract test で明示する
  - sanitizer privacy hardening、content migration、search ranking は別バッチに残す

- [ ] Tag rename duplicate case-insensitive contract 候補を別バッチで追加する
  - `tag_commands.rs` / `sqlite_tag.rs` で既存 tag と大文字小文字だけ違う名前へ rename できるかを明示し、禁止するなら `COLLATE NOCASE` の重複判定を固定する
  - tag color validation、tag chip visual、settings tag row UI、article tag assignment は同じバッチに混ぜない
  - exact duplicate と case-only duplicate、self rename を別 fixture にする

- [ ] Tag article counts muted-article inclusion contract 候補を別バッチで追加する
  - `sqlite_tag.rs` の `find_articles_by_tag` は muted articles を除外する一方、`count_articles_per_tag` が muted articles を数える / 数えないどちらを正とするか固定する
  - mute keyword SQL/Rust match parity、settings mute form、tag count cache invalidation、reader tag chip visual は混ぜない
  - account filter あり / なしで muted tagged article の count が一貫するか repository test に分ける

- [ ] Tag/mute delete missing-row command contract 候補を別バッチで追加する
  - `delete_tag` / `delete_mute_keyword` に存在しない id を渡した時、成功 no-op にするか user-visible not found にするかを affected rows test で明示する
  - cascade cleanup、article_tags orphan detection、delete confirmation UI、toast copy は同じバッチに混ぜない
  - repository delete と command wrapper の error projection を別 assertion にする

- [ ] Mute settings unchanged-scope no-op contract 候補を別バッチで追加する
  - `mute-settings.tsx` で saved mute rule の scope select に現在値と同じ値を選んだ時、`update_mute_keyword` を呼ばず toast も出さない契約を固定する
  - scope label copy、select visual、backend scope validation、auto mark read 挙動は混ぜない
  - draft editing 中の no-op と saved row の no-op を別 case にする

- [ ] Feed folder sort_order renumber contract 候補を別バッチで追加する
  - `sqlite_folder.rs` と folder command で folder delete / create / reorder 後の `sort_order` が account 内で安定し、別 account の順序に影響しない契約を固定する
  - folder drag/drop UI、remote folder sync、sidebar disclosure state は混ぜない
  - same sort_order が既にある破損データ時の tie-break は別 TODO に残す

- [ ] Folder delete feed detach contract 候補を別バッチで追加する
  - `sqlite_folder.rs` / `feed_commands.rs` で folder delete 時に所属 feed の `folder_id` を null に戻す / cascade しない方針を repository test で固定する
  - stale remote folder detach policy、folder selection UI、sync provider folder mutation は同じバッチに混ぜない
  - empty folder delete と feeds あり folder delete を別 fixture にする

- [ ] Account delete selected fallback contract 候補を別バッチで追加する
  - `ui-store.ts` と settings modal 周辺で selected account が delete された時、次 account / null への fallback と settings page state の扱いを store contract として固定する
  - keyring cleanup、account delete command、accounts nav sorting、settings modal type split は混ぜない
  - selected reader account と settings detail account の fallback を別 assertion にする

- [ ] Feed unread recalculation muted article contract 候補を別バッチで追加する
  - `sqlite_feed.rs` / `sqlite_article.rs` の unread count recalculation が muted unread article を含む / 除外するどちらを正とするかを DB fixture で固定する
  - mute SQL/Rust parity、badge count projection、startup unread reconcile は別バッチに残す
  - mute keyword なし / あり、read state change 後の recalculation を分ける

- [ ] OPML export folder order contract 候補を別バッチで追加する
  - `opml.rs` / `opml_commands.rs` で export 時の folder outline と feed outline の順序を name / sort_order / input order のどれにするか固定する
  - OPML duplicate import policy、outline text fallback、feed discovery title normalization は混ぜない
  - no-folder feeds と foldered feeds の混在 case を fixture に分ける

- [ ] App action registry dispatch coverage contract 候補を別バッチで追加する
  - `app-actions.ts` の `APP_ACTIONS` と `executeAction` の switch が drift しないよう、全 action が runtime guard と dispatch test の代表 case に乗る契約を固定する
  - command palette ranking、shortcut preference registry、native menu label は同じバッチに混ぜない
  - action 追加時に guard だけ通って dispatch が no-op になる漏れを検出する static / behavior test を分ける

- [ ] Browser preview shortcut bridge registry contract 候補を別バッチで追加する
  - `browser_webview.rs` の `BROWSER_PREVIEW_SHORTCUT_SPECS` で default binding、app_action、script bridge 対応が `AppAction` と shortcut prefs から drift しないことを固定する
  - shortcut recording UI、native menu accelerator label、browser overlay shortcut ownership は混ぜない
  - script bridge 対象外の Escape と対象内の article actions を別 case にする

- [ ] Browser webview diagnostics emit gating contract 候補を別バッチで追加する
  - `browser_webview_commands.rs` の `log_browser_webview_bounds` が diagnostics disabled の時に event emit せず、enabled の時だけ requested/applied/native bounds を payload にする契約を固定する
  - Debug HUD visual、geometry calculation policy、native WebView bounds 実機確認は同じバッチに混ぜない
  - disabled no-op と enabled payload shape を別 fixture にする

- [ ] Database vacuum syncing guard contract 候補を別バッチで追加する
  - `database_commands.rs` の `vacuum_database` が sync 中は DB lock や VACUUM を実行せず user-visible error を返す契約を固定する
  - database vacuum busy error、data settings pending state、migration recovery は別バッチに残す
  - syncing=true の early return と syncing=false の database_info refresh を command test で分ける

- [ ] Command palette dev scenario cancelled load contract 候補を別バッチで追加する
  - `use-command-palette-runtime.ts` で dev scenario load 中に unmount された場合、resolve/reject 後に state update しない契約を固定する
  - dev runtime invalid module cache、production bundle leak、debug settings dev action guard は混ぜない
  - success resolve と failure reject の cancelled branch を別 case にする

- [ ] Command palette resource history before navigation contract 候補を別バッチで追加する
  - `use-command-palette-handlers.ts` で feed/tag/article 選択時に history 追加、navigation/select、close の順序を固定する
  - command history compaction、resource search ranking、feed landing failure projection は別バッチに残す
  - feed landing promise reject 時に history が残るかどうかも contract として明示する

- [ ] Pending browser close action overwrite contract 候補を別バッチで追加する
  - `actions.ts` で browser close in-flight 中に `next-article` 後 `prev-feed` など複数 navigation が来た時、pending action を最新で上書きする契約を固定する
  - browser overlay close guard、debug input trace visual、reader navigation selection は混ぜない
  - flush 前の overwrite と flush 後の clear を別 assertion にする
