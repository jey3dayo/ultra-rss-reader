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

- [ ] OPML import/export contract test 候補を別バッチで追加する
  - `src-tauri/src/infra/opml.rs` の parse/generate round trip、folder nesting、missing xmlUrl/htmlUrl、特殊文字 escape を境界値で固定する
  - frontend import/export command schema と Rust OPML parser の責務を分け、UI copy や file picker 挙動とは混ぜない
  - 大きな end-to-end import ではなく、parser/generator と command response contract の小さい test を優先する

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

- [ ] account / feed list stable sort 候補を別バッチで追加する
  - `sqlite_account.rs` と `sqlite_feed.rs` の `find_all` / `find_by_account` の ORDER BY を定義し、repository test で順序を固定する
  - sidebar section visibility、unread priority、folder expansion とは混ぜず、DB query の deterministic order だけを扱う
  - UI 側 sort 変更は含めず、backend DTO list の安定性に限定する

- [ ] FreshRSS remote subscription stale detection 候補を別バッチで検証する
  - `sync_providers.rs`、`repository/feed.rs`、`sqlite_feed.rs` の remote subscription 差分検出を棚卸しし、消えた購読を stale diagnostic として扱えるか確認する
  - pending mutation queue、手動 unsubscribe UX、article retention とは混ぜず、remote subscription presence の検出と記録だけを見る
  - いきなり削除せず、diagnostic DTO / log / test fixture から始める

- [ ] preference key registry parity 候補を別バッチで追加する
  - `src/api/schemas/preferences.ts`、`preference_commands.rs`、preferences schema contract test の frontend/backend key registry を双方向に照合する
  - frontend key が backend で許可されるだけでなく、backend-only key と重複 key も検出できる contract test にする
  - preference value validation、settings UI、migration は混ぜず、key registry parity だけを扱う

- [ ] shortcut preference validation 候補を別バッチで追加する
  - `keyboard-shortcuts.ts`、preferences schema、`preference_commands.rs` の `shortcut_` 動的 key を既知 shortcut id と保存値形式で検証する
  - prefix 全許可を続けるか、known shortcut registry へ寄せるかを test で固定する
  - shortcut UI 再設計、native menu shortcut、表示 copy 変更とは混ぜない

- [ ] set_preference per-key schema 候補を別バッチで追加する
  - `src/api/schemas/commands.ts` と `src/api/tauri-commands.ts` の `set_preference` args を、既存 preference schemas と接続できるか確認する
  - key/value が単なる string のまま不正値を通さないよう、API args schema の境界値 test を追加する
  - backend persistence、toast 文言、settings control layout は別バッチに残す

- [ ] shortcut row individual reset 候補を別バッチで追加する
  - `shortcuts-settings.tsx` と `shortcuts-settings-view.tsx` で、全リセットとは別に 1 行ごとに default へ戻す操作を追加できるか確認する
  - shortcut 定義追加、native menu shortcut、i18n 表記整理とは混ぜず、row action と persistence update に限定する
  - reset disabled state と focused row の keyboard 操作を component test で固定する

- [ ] article tag picker existing-name assignment 候補を別バッチで追加する
  - `article-tag-chips.tsx` と `article-tag-picker-popover.tsx` で、既存タグ名を入力した場合に重複作成ではなく既存タグ割り当てへ寄せる
  - tag settings、tag color、mute keyword、Rust tag schema とは混ぜず、picker input resolution と submit action だけを扱う
  - case sensitivity と trim の扱いを先に test で固定する

- [ ] command palette unavailable action guard 候補を別バッチで追加する
  - `use-command-palette-actions.ts` と `use-command-palette-handlers.ts` の現在記事 / 選択 / 同期状態が必要な action を disabled または非表示にする
  - 検索 ranking、history、dev scenario error surface とは混ぜず、実行不能 action の guard と表示状態に限定する
  - action 実行時の二重 guard を残すかどうかも test で固定する

- [ ] discovered feed duplicate title disambiguation 候補を別バッチで追加する
  - `discovered-feed-options-view.tsx` と `add-feed-dialog-state.ts` で、同じ title の discovered feed を URL / host 付きで識別できる表示へ寄せる
  - feed discovery pipeline、folder create validation、duplicate local feed ID reload とは混ぜず、検出結果 view model と表示に限定する
  - single candidate 時の表示密度を変えず、duplicate title 時だけ補助情報を出す

- [ ] article mutation missing-id contract 候補を別バッチで検証する
  - `article_commands.rs` と `sqlite_article.rs` の `mark_article_read` / `mark_articles_read` / `toggle_article_star` で存在しない article id の扱いを固定する
  - pending mutation queue、toast 表示、auto mark retry とは混ぜず、repository / command result の contract test に限定する
  - no-op と user-visible error のどちらにするかを既存 caller fallback と照合して決める

- [ ] mute keyword SQL/Rust match parity 候補を別バッチで追加する
  - `sqlite_mute_keyword.rs`、`sqlite_article.rs`、`sqlite_tag.rs` の Rust 側 match helper と SQL 側 match clause を同じ fixture で比較する
  - summary / content_text / content_sanitized / title の body 判定がズレないよう、境界値 test で固定する
  - sanitizer policy、settings form props、tag chip visual は混ぜない

- [ ] Reading List URL escaping contract 候補を別バッチで追加する
  - `share_commands.rs` と `src/api/schemas/commands.ts` の macOS Reading List 追加で、AppleScript 生成の quote / newline / non-http URL を固定する
  - native share menu 表示、clipboard fallback、article share menu UI とは混ぜず、URL escaping helper と command args validation に限定する
  - platform unavailable 時の error projection は既存 platform command scope に残す

- [ ] updater pending update lifecycle 候補を別バッチで検証する
  - `updater_commands.rs` と `use-updater.ts` の `PendingUpdate` cache、download 二重起動、download 失敗後の state reset を棚卸しする
  - release workflow preflight、version dry-run、署名 / artifact matrix 変更とは混ぜず、updater command lifecycle だけを扱う
  - check / download / install の user action availability を focused test と manual verification に分ける
