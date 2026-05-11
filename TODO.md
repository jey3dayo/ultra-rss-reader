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

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics

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

- [ ] P2 filesystem path normalization を log/backup/export/settings で共通化する
  - 対象: log commands、database backup/export commands、Tauri path helpers
  - symlink、non-UTF8 path、reserved name、case-insensitive collision の扱いが command ごとに違うと platform bug になる
  - symlink、non-UTF8、Windows reserved name、case collision、path redaction の matrix を作る

- [ ] P2 atomic file write policy を export / backup / dev credential store で揃える
  - 対象: OPML export、DB backup、dev credential file store
  - 途中失敗で target file を半端に残すと、次回 import/restore/debug で正常ファイルとして扱われる
  - temp file、fsync、rename failure、existing file collision、cleanup failure の contract を追加する

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

- [ ] P2 image/fallback favicon cache eviction を account/feed deletion と同期する
  - 対象: favicon/image cache helpers、feed deletion flow、storage cleanup
  - feed 削除後に favicon/image failure cache が残ると、同じ URL 再追加時に古い失敗状態を引き継ぐ
  - feed delete、feed URL change、account delete、cache TTL、manual refresh の contract を追加する

- [ ] P2 updater downloaded artifact cleanup を cancel / failed install / app restart で固定する
  - 対象: updater hook、updater commands、release docs
  - download 済み artifact が cancel や failed install 後に残ると、次回 check/install が stale artifact を使う可能性がある
  - cancel、download failure、install failure、restart before install、cleanup diagnostics の contract を追加する

- [ ] P1 app shutdown 中の background sync / DB write / browser webview cleanup を drain する contract を作る
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/service/sync_scheduler.rs`, browser webview tracker, DB commands
  - window close や restart 中に sync/DB write/webview close が走ると、WAL・query cache・native webview state が中途半端に残る
  - close requested、restart app、sync in-flight、DB write in-flight、browser webview open、timeout forced exit の contract を追加する

- [ ] P1 startup database init panic を recoverable startup error UI へ寄せる
  - 対象: `src-tauri/src/lib.rs`, DB init, startup fallback UI
  - `panic!` で起動失敗するとログを読めないユーザーに復旧手順が届かず、migration/permission/disk full の切り分けができない
  - migration error、permission denied、disk full、backup exists、redacted path、support copy の期待値を固定する

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

- [ ] P2 OS sleep中の updater download / file export / DB backup を cancellation-aware にする
  - 対象: updater hook、export/backup commands、runtime lifecycle
  - laptop sleep で long-running file/network operation が中断すると、partial artifact や stale progress が残る
  - sleep during download、sleep during export、sleep during backup、resume cleanup、progress reset の contract を追加する

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
