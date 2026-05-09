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

- [ ] P2 reader focus DOM selector drift を検出する
  - 対象: `src/lib/reader-focus.ts`, reader list/sidebar/account pane components
  - focus helper が data attribute selector に強く依存しており、view refactor で attribute が外れると keyboard navigation が silent fallback になりやすい
  - selector source of truth または repo contract test を追加し、主要 focus target attribute の存在を固定する

- [ ] P2 article list retained snapshot duplicate identity contract を固定する
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`
  - retained article snapshot は Map で id 重複を後勝ち merge するため、same id with stale read/star state が source 間で競合した時の表示が未固定
  - retained snapshot stale、current source duplicate、search/tag/source切替の merge order を pure helper test にする

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

- [ ] P1 article thumbnail URL の sanitizer/privacy 境界を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-list-item.tsx`, `src/components/reader/article-content-view.tsx`
  - `content_sanitized` は Rust sanitizer 境界がある一方、`thumbnail` は provider 由来 URL を `<img src>` に渡すため、remote image privacy と scheme policy が本文 HTML と別管理になりやすい
  - http/https/relative/data/private URL policy を決め、normalizer / ArticleDtoSchema / reader rendering の contract test を追加する

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

- [ ] P1 vacuum と sync 開始の race を database maintenance guard で整理する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/infra/db/connection.rs`
  - `vacuum_database` は開始時に `syncing` を読むだけで自分では sync guard を取らないため、直後に sync が始まると DB lock 待ちと UI 進捗が不自然になり得る
  - vacuum lock 中に sync 開始を競合させる test を追加し、vacuum 用 guard か sync 側の maintenance 検出を入れる

- [ ] P1 sanitizer で許可した media/source/link attribute の privacy policy を固定する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - sanitizer が `source` の `srcset` / `sizes` / `media` などを許可するため、将来 article body rendering が media を増やした時に remote request 面積が広がりやすい
  - reader body で実際に描画される tag/attribute と CSP/privacy doc を照合し、media tag を残す/落とす/手動検証へ分ける

- [ ] P2 local feed sync の article upsert と sync_state 保存を atomic にする
  - 対象: `src-tauri/src/commands/sync_providers.rs`
  - articles/count は保存済みだが validator `sync_state` 保存だけ失敗すると、次回同じ feed を再取得し、逆方向の不整合も将来 refactor で入りやすい
  - `sync_state` table failure test で記事保存済み時の state 方針を固定し、article upsert、mute auto-read、count、state を service transaction へまとめる

- [ ] P2 pending_mutations の duplicate row を DB 制約で防ぐ
  - 対象: `src-tauri/migrations/V1__initial.sql`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - repository は delete-then-insert で正規化しているが DB 制約がなく、legacy row や手動破損で duplicate が入ると sync push が重複実行される
  - duplicate fixture で push 回数と delete 結果を固定し、`account_id + remote_entry_id + mutation axis` の cleanup migration / unique index を検討する

- [ ] P2 account update/delete repository の affected rows policy を固定する
  - 対象: `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/commands/account_commands.rs`
  - `update_sync_settings` / `rename` は command 側の re-read で missing を検出するが repository contract は silent no-op で、`delete` も missing account で成功扱いになり得る
  - missing account の command/repository policy を test 化し、repository 層で affected rows を返すか validation error に統一する

- [ ] P2 account sync 設定更新の stale error toast を revision guard する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`
  - 成功側は revision guard があるが失敗側は常に `showSyncUpdateError` するため、古い request の失敗が後続成功後にエラー表示だけ出せる
  - 連続設定変更で先行失敗/後続成功を逆順 settle させ、error path も revision guard する

- [ ] P2 provider article URL の credential / fragment / control char normalization を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-toolbar-view.tsx`
  - feed item の article URL は open/copy/browser preview に流れるため、`https://user:pass@host`、fragment token、control char をどこで落とすか未固定だと privacy と UI 表示が揺れる
  - normalizer、ArticleDtoSchema、open/copy action のどこで sanitize するか決め、credential-in-URL と invalid URL の fixture を追加する

- [ ] P2 Windows Rust test scope が integration_test だけになっている理由を固定する
  - 対象: `mise.toml`, `.github/workflows/ci.yml`
  - Windows の `test:rust` が `--test integration_test` のみに絞られており、unit tests が Windows 固有の path/keyring/OS 差を拾わない可能性がある
  - 絞り込み理由を明文化するか、Windows で走らせる safe Rust unit subset を作り、path/keyring/browser geometry 周辺だけでも gate へ入れる

- [ ] P2 actionlint の shellcheck 無効化を補う workflow shell gate を追加する
  - 対象: `mise.toml`, `.github/workflows/*.yml`
  - `actionlint -shellcheck=` で shellcheck integration を切っているため、workflow 内 shell script の引用や未定義変数の問題を拾いにくい
  - shellcheck を導入するか、workflow script を外部 script 化して lint するか決め、CI shell の最小 gate を追加する

- [ ] P3 schema_version を single-row contract に寄せる
  - 対象: `src-tauri/migrations/*.sql`, `src-tauri/src/infra/db/migration.rs`
  - 古い migration は `INSERT`、近い migration は `DELETE FROM schema_version` + insert で、helper は single row 前提のため、新規 migration 追加時に履歴/現行値の扱いが揺れやすい
  - migration 後 `schema_version` が 1 row だけで latest になる contract test を追加し、以後は `set_schema_version` 相当の書き方へ統一する

- [ ] P3 auto mark read の同一 article 再自動既読 policy を固定する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`
  - `autoMarkedArticleIdRef` が同じ article id を抑止し続けるため、同一セッションで手動 unread に戻した記事は再表示しても自動既読にならない可能性がある
  - auto mark success 後に unread へ戻して再表示する hook test を追加し、再 auto mark する/しないの product policy を決める

- [ ] P3 browser overlay close 後の focus return 優先順位を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts`
  - 元の toolbar button 等を記憶していても、選択 article row があれば先にそこへ focus するため、キーボード操作では「閉じたら元の操作ボタンへ戻る」期待とズレやすい
  - open-in-browser button から overlay open/close した時の focus return test を追加し、article row 優先か previous target 優先かを明文化する

- [ ] P1 external opener に渡す article/feed URL の scheme policy を固定する
  - 対象: `src/components/reader/hooks/article/use-article-actions.ts`, `src/lib/actions.ts`, `src/api/tauri-commands.ts`
  - provider 由来 URL が外部ブラウザ/open command に流れるため、`javascript:`、`file:`, credential-in-URL、control char をどこで拒否するか未固定だと OS opener 境界で事故りやすい
  - frontend action と Rust opener command の両方で allowed scheme を固定し、invalid URL は toast だけで native invoke しない contract test を追加する

- [ ] P1 updater install/restart 中の sync・DB write gate を固定する
  - 対象: `src/hooks/use-updater.ts`, `src-tauri/src/commands/updater_commands.rs`, `src-tauri/src/commands/sync_commands.rs`
  - update download/install は restart を伴う一方、manual/automatic sync や DB maintenance が走っている時の禁止・待機・中断方針が見えにくい
  - installing update 中の sync 開始、sync 中の update install、download failure after ready state の UI/command contract test を追加する

- [ ] P1 updater manifest の channel / prerelease / downgrade policy を固定する
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`, `src/api/schemas/update-info.ts`, `src/hooks/use-updater.ts`
  - update endpoint が `latest.json` 固定のため、prerelease、downgrade、same version、platform mismatch の扱いが曖昧だと release 運用で誤配信に気づきにくい
  - fake update manifest で newer/same/older/prerelease/platform mismatch を固定し、UI 表示と install 可否を schema test にする

- [ ] P1 browser webview event payload の schema validation を Rust/TS で揃える
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/api/schemas/browser-webview.ts`, `src-tauri/src/browser_webview.rs`
  - native event payload は frontend schema と Rust emit shape がズレると malformed event warning で止まり、browser overlay の state だけ stale になり得る
  - Rust event fixture と TS schema fixture を同じケースで照合し、unknown stage、missing URL、malformed bounds の recovery を固定する

- [ ] P2 article view history cleanup / retention policy を決める
  - 対象: `src-tauri/migrations/V17__article_view_history.sql`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/commands/article_commands.rs`
  - viewed history が増え続ける場合、recent view や DB size に効き、削除 feed/account との cascade/no-op も将来 migration で揺れやすい
  - retention days、max rows、account/feed delete cascade、clear history command の count contract を Rust test にする

- [ ] P2 cleanup_feed_integrity_orphans の dry-run / destructive 実行 policy を固定する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/api/schemas/feed-integrity.ts`
  - orphan cleanup は destructive なので、dry-run と実削除の count 差、concurrent feed delete、sync 中実行の扱いが曖昧だと DB repair 操作で事故りやすい
  - dry-run直後の状態変化、sync中拒否、deleted count と orphan count の一致を Rust/TS schema test で固定する

- [ ] P2 reader selection が削除済み feed/folder/tag を指す時の recovery を固定する
  - 対象: `src/stores/ui-store.ts`, `src/lib/reader/reader-query.ts`, `src/components/reader/hooks/article-list/use-article-list-sources.ts`
  - feed/folder/tag 削除後に selection が stale id を指すと disabled query や empty view に落ちるが、どこで all/unread へ戻すかが分かれやすい
  - selected feed deleted、selected folder deleted、selected tag deleted、account switch の recovery を store/hook test で固定する

- [ ] P2 account unread count と feed unread count の reconciliation policy を作る
  - 対象: `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src/hooks/use-account-unread-count.ts`
  - feed unread_count は denormalized で、article mutation や sync failure 後に account total とズレる可能性がある
  - recalculation command、startup repair、sync completion のどこで count consistency を保証するか決め、mismatch fixture の repair test を追加する

- [ ] P2 Reader Query key と invalidation key の source of truth を照合する
  - 対象: `src/lib/reader/reader-query.ts`, `src/lib/query/query-invalidation.ts`, `src/hooks/use-articles.ts`
  - query key が hook ごとに手書きされる箇所が残ると、mode/account/tag の invalidation 漏れが UI stale data につながる
  - query key factory を棚卸しし、mark read/star/tag/feed delete/add feed 後に必要 key が invalidated される contract test を追加する

- [ ] P2 Windows command dispatch の env allowlist と path conversion failure を contract 化する
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/windows-command-dispatch.ts`, `scripts/tauri-cli-dispatch.ts`
  - WSL/Windows dispatch は env と cwd conversion に依存するため、secret/env pollution や path conversion failure が CI/local Windows だけで出やすい
  - allowed env、PowerShell encoded command、cwd inaccessible、missing powershell の failure message を script test に追加する

- [ ] P2 seed-dev-db-from-prod の destructive target cleanup safety を強化する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `mise.toml`
  - prod data を dev へコピーする script は target 削除/コピーを伴うため、identifier 取り違えや symlink/path traversal に弱いと dev/prod data を壊し得る
  - source/target identifier guard、symlink拒否、backup作成、credentials非コピー確認を script test と TODO 実行手順に入れる

- [ ] P2 capabilities/default.json の permission 最小化を feature matrix と照合する
  - 対象: `src-tauri/capabilities/default.json`, `src-tauri/src/commands/*.rs`, `src/hooks/*.ts`
  - clipboard/opener/updater/window permission が広く見えるため、使っていない permission が残ると Tauri capability の意図が drift する
  - frontend invoke/use site と permission list を照合し、unused permission を削るか理由をコメント/contract test に残す

- [ ] P2 `withGlobalTauri` の必要性と browser-mode fallback を固定する
  - 対象: `src-tauri/tauri.conf.json`, `src/api/tauri-commands.ts`, `src/dev/mocks.ts`
  - global Tauri API を有効にしているため、browser-mode/dev mock と packaged app の runtime boundary が曖昧になりやすい
  - `window.__TAURI__` なし、mock runtime、packaged runtime の safeInvoke behavior を schema/runtime test で固定し、不要なら withGlobalTauri を外す検討をする

- [ ] P3 release notes label categories と issue/PR labels の drift を検出する
  - 対象: `.github/release.yml`, `.github/labeler.yml`, `.github/ISSUE_TEMPLATE/*.yml`
  - release note categories と labeler/issue template の labels がズレると、修正が release notes の想定カテゴリに乗らない
  - labels の存在、category coverage、catch-all の順序を config contract test に追加する

- [ ] P3 PR insights labeler と local labeler の source of truth を整理する
  - 対象: `.github/workflows/pr-insights-labeler.yml`, `.github/workflows/labeler.yml`, `.github/labeler.yml`
  - `risk/*` や `size/*` は PR insights、area labels は labeler という境界が崩れると、同じ PR に矛盾した label が付く
  - label ownership 表を TODO/CLAUDE.md に寄せ、workflow inputs と issue template の説明が一致する config test を追加する

- [ ] P3 issue template の Done When と PR DoD の差分を棚卸しする
  - 対象: `.github/ISSUE_TEMPLATE/*.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `CLAUDE.md`
  - issue template の Done When と PR template / agent DoD が別々に増えると、タスク作成時と完了時の quality gate がズレる
  - 共通 gate、issue type 固有 gate、manual verification gate に分類し、文言 drift を config/docs test で検出する

- [ ] P1 feed folder drag/drop の optimistic rollback を latest-only にする
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/components/reader/hooks/sidebar/use-sidebar-controller-actions.ts`
  - feed を folder A -> B -> C と連続移動した時、古い mutation failure が後から来ると `previousFeedsQueries` で最新の folder state を巻き戻し得る
  - deferred promise で逆順 settle する hook test を追加し、feedId ごとの mutation generation または現在値比較 rollback にする

- [ ] P1 account detail の masked password 表示と keyring missing 状態を分ける
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`, `src-tauri/src/commands/account_commands.rs`
  - FreshRSS account なら `hasSavedPassword` を true 初期化するため、実際には keyring password が消えていても UI が保存済み password のように見える可能性がある
  - backend から credential presence を返すか connection verification status で補足し、keyring missing / DB account exists の表示と test connection failure を固定する

- [ ] P1 manual sync cooldown の retryable failure policy を固定する
  - 対象: `src/lib/sync/manual-sync.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`
  - `Retryable` error でも cooldown を開始するため、一時的な provider/network failure 後にすぐ再試行できないことが product 意図か分かりにくい
  - success、Retryable、UserVisible failure、cooling_down の各ケースで cooldown と toast を test 化し、Retryable を cooldown 対象にする理由を明文化する

- [ ] P1 sync progress / warning event の malformed payload を diagnostics に残す
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src/lib/sync/sync-progress-event.types.ts`
  - malformed `sync-progress` / `sync-warning` / `sync-completed` は silent ignore されるため、native/frontend event schema drift で progress が stuck しても原因が見えにくい
  - invalid stage、nonfinite count、completed non-null payload、warning schema mismatch を一度だけ warning/diagnostics に残す contract test を追加する

- [ ] P1 sync completed event 欠落時の stuck progress recovery を追加する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src/stores/ui-store.ts`
  - native sync が途中で error/abort して `sync-completed` を emit しない場合、frontend の `syncProgress.active` が残り manual sync が無効化され続ける可能性がある
  - timeout recovery、manual clear、next started event での reset のどれを正にするか決め、missing completed event の store/hook test を追加する

- [ ] P1 Reading List command の AppleScript stderr を user-facing error に直出ししない
  - 対象: `src-tauri/src/commands/share_commands.rs`, `src/components/reader/article-browser-actions.ts`
  - `osascript` failure stderr をそのまま `UserVisible` message に含めると、URL や OS 固有の内部情報が toast/log に出る可能性がある
  - stderr は diagnostics/log に寄せ、UI には分類済み message を出す contract test を追加する

- [ ] P1 clipboard write の text category と size limit を固定する
  - 対象: `src-tauri/src/commands/share_commands.rs`, `src/lib/runtime/clipboard.ts`, `src/components/reader/article-browser-actions.ts`
  - clipboard command は任意 text を受けるため、巨大 text、credential-like value、multiline URL をどこで拒否するか未固定だと copy action の責務が広がる
  - article link、server URL、debug text の category ごとに max length / multiline / secret-like pattern の扱いを分け、unit test にする

- [ ] P1 debug input trace が typed key や target text を記録しすぎないようにする
  - 対象: `src/components/app-shell.tsx`, `src/lib/debug-input-trace.ts`, `src/components/settings/debug-settings.tsx`
  - Debug HUD の raw keyboard/pointer trace は入力欄や URL/credential field の target description を扱うため、debug log 上に sensitive interaction が残る可能性がある
  - password/server URL/input/textarea/contenteditable では key value を redact し、trace retention と copy/export 可否を test にする

- [ ] P1 log directory を開く導線の privacy checklist を追加する
  - 対象: `src-tauri/src/commands/log_commands.rs`, `src-tauri/src/lib.rs`, `docs/feed-content-privacy.md`
  - log dir はユーザーが直接開けるため、sync error、browser diagnostics、debug trace に URL query や account data が残ると support 共有時に漏えいしやすい
  - log redaction 対象、retention、manual support 手順を checklist 化し、代表ログに secret-like string が出ない test を追加する

- [ ] P2 selected_account_id preference が stale の時に DB mirror を修復する
  - 対象: `src/lib/account/account-selection.ts`, `src/stores/preferences-store.ts`, `src/components/reader/hooks/sidebar/use-sidebar-controller-actions.ts`
  - `getPreferredAccountId` は missing saved id を先頭 account へ fallback するが、DB preference 自体を直さない場合、起動ごとに stale id を読み続ける
  - account delete、import後 account id 変更、blank saved id の時に selected_account_id を修復するか read-time fallback に留めるか test で固定する

- [ ] P2 account switcher outside-click listener の pointer/touch/focusout coverage を確認する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-account-switcher.ts`
  - outside close が `mousedown` だけだと touch/pointer/keyboard focus 移動で menu が残る可能性があり、account switcher の操作モデルが環境でズレる
  - pointerdown、touch、Escape、focusout、unmount cleanup の behavior を component/hook test にする

- [ ] P2 folder select の duplicate label / deleted selected folder 表示を固定する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-folder-selection.ts`, `src/components/reader/folder-select-view.tsx`
  - folder options は duplicate id を落とすが duplicate name や selected folder deleted の表示方針が未固定だと、add/rename feed dialog の folder assignment が分かりにくい
  - duplicate name、blank name fallback、selected folder missing、新規 folder 作成中の account switch を view/helper test にする

- [ ] P2 query client global retry=false の transient failure UX を棚卸しする
  - 対象: `src/lib/query/query-client.ts`, `src/hooks/use-account-sync-status.ts`, `src/hooks/use-articles.ts`
  - 全 query の retry が false のため、一時的な DB busy/runtime unavailable が即 error 表示になり、手動 retry 導線がない view では stale/empty に見えやすい
  - query group ごとに retryなし/1回 retry/manual retry の方針を分類し、DB busy と transient invoke failure の user-facing behavior を test にする

- [ ] P2 preferences freeform string の key別 max length / control char policy を固定する
  - 対象: `src/schemas/preferences.ts`, `src-tauri/src/commands/preference_commands.rs`
  - freeform preference は key によって URL、shortcut、selected account id など意味が違うため、長大文字列や control char が DB/UI に残ると後段 helper が壊れやすい
  - selected_account_id、debug_web_preview_url、shortcut_*、font/layout 系で max length と control char policy を分け、schema/backend test を追加する

- [ ] P2 app root visibilitychange sync trigger の throttle / cleanup を固定する
  - 対象: `src/App.tsx`, `src/lib/sync/startup-sync-storage.ts`, `src-tauri/src/service/sync_scheduler.rs`
  - visibilitychange や wake/startup sync が重なると、foreground 復帰時に manual sync、automatic sync、startup sync の開始条件が競合しやすい
  - hidden -> visible 連打、sleep wake、startup throttle metadata corruption の sync trigger contract を frontend/store/Rust service で固定する

- [ ] P3 article action error category を locale key ベースにする
  - 対象: `src/components/reader/article-browser-actions.ts`, `src/locales/*/reader.json`
  - error category は作っているが toast には raw message を出すため、runtime unavailable / permission denied / invalid URL の表示が backend/OS 文字列に依存する
  - category ごとの locale key、fallback message、unknown error の diagnostics-only 方針を component/lib test にする

- [ ] P3 manual sync cooldown listener error aggregation を diagnostics に接続する
  - 対象: `src/lib/sync/manual-sync.ts`
  - cooldown listener が throw しても console error に集約されるだけなので、UI 更新が止まった時にどの subscriber が壊れたか分かりにくい
  - listener id を持つか diagnostics-only に留めるか決め、複数 listener failure の report format を unit test にする

- [ ] P1 FreshRSS server URL の http 許可と credential 送信 policy を固定する
  - 対象: `src/lib/account/add-account-form.ts`, `src/components/settings/add-account/account-config-form.tsx`, `src-tauri/src/infra/provider/greader.rs`
  - form validation は `http:` と `https:` を許可しているため、FreshRSS credential を平文 HTTP へ送ることを product として許すか、localhost 例外だけにするかが曖昧
  - `https`、public `http`、loopback `http`、credential-in-URL、trailing slash の payload normalization を frontend/Rust provider test で固定する

- [ ] P1 rename feed dialog submit の feed/account snapshot を固定する
  - 対象: `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-controller.ts`, `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-view-props.tsx`
  - rename dialog を開いた後に selected feed/account が変わると、表示中タイトルと submit 先 feed がズレる可能性があり、別 feed を rename する事故につながりやすい
  - open 時の feed id/account id/title snapshot を submit payload に使うか、対象消失時に dialog を閉じるかを決め、account switch / feed delete / stale folder の test を追加する

- [ ] P1 destructive action confirmation の対象 snapshot と二重実行 policy を統一する
  - 対象: `src/components/app-confirm-dialog.tsx`, `src/hooks/use-delete-feed.ts`, `src/components/reader/article-list.tsx`, `src/components/settings/mute-settings.tsx`
  - confirm dialog が開いた後に selection や list order が変わると、confirm message と実行対象がズレる destructive action が混ざりやすい
  - feed delete、mark all read、mute keyword delete、account delete の confirm payload を snapshot 化し、confirm 中 loading/disable と double click の contract test を追加する

- [ ] P1 OPML import の duplicate URL merge / skip / overwrite policy を固定する
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/opml.rs`, `src/dev/mocks.ts`
  - OPML に同一 URL、同一 title 別 URL、同一 URL 別 folder が含まれる時に、既存 feed とどう merge するかが曖昧だと import 後の unread/folder 整合性が崩れやすい
  - duplicate within file、existing feed collision、folder move を import summary にどう出すか決め、Rust command test と dev mock parity test を追加する

- [ ] P1 app root missing / lazy chunk failure の user-visible fallback を固定する
  - 対象: `src/main.tsx`, `src/components/app-shell.tsx`
  - `#root` 不在や lazy chunk import failure が throw のままだと、packaging / asset path / webview cache 事故で白画面になり、復旧導線がない
  - root missing、settings chunk failure、command palette chunk failure の fallback UI / telemetry / reload action 方針を決め、app shell test を追加する

- [ ] P2 search_articles の query length / unicode / FTS escape policy を固定する
  - 対象: `src/hooks/use-articles.ts`, `src/dev/mocks.ts`, `src-tauri/src/commands/article_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - frontend/dev mock は title includes に近い挙動だが、backend FTS は quote、operator、絵文字、全角空白、長大 query で挙動が変わりやすい
  - blank、quoted phrase、`OR`/`NEAR` 風文字列、combining mark、長大 query の normalize/escape/max length を schema/Rust/dev mock で揃える

- [ ] P2 dev mock command response を production schema と同期する
  - 対象: `src/dev/mocks.ts`, `src/dev/mock-data.ts`, `src/api/schemas`
  - dev mock は command args schema を通す一方、response は手書き fixture が多く、DTO schema 変更時に Storybook/dev runtime だけ古い shape を返しやすい
  - 主要 command response を schema parse する helper を追加するか、fixture boundary test を拡張して dev mock と production DTO の drift を検出する

- [ ] P2 Storybook stories の fixture DTO strictness を上げる
  - 対象: `src/**/*.stories.tsx`, `src/dev/mock-data.ts`, `src/__tests__/components/storybook-explorer-organization.test.ts`
  - stories が hand-written DTO や partial props を直接渡すと、schema/contract 変更時に dev canvas だけ壊れても `mise run check` で見逃されやすい
  - story fixtures を schema-derived fixture helper に寄せるか、story render smoke で DTO parse を通す方針を決める

- [ ] P2 i18n key placeholder / missing key contract を namespace 単位で固定する
  - 対象: `src/locales/*/*.json`, `src/lib/i18n.ts`, `src/__tests__/schemas`
  - 翻訳 key は増えているが、補間 placeholder の不一致や片言語だけ missing key があると、runtime まで気づけない UI regression になりやすい
  - 全 locale namespace の key 差分、placeholder 名差分、unused key を検出する lint/test を追加し、意図的な locale-only key の例外リストを作る

- [ ] P2 command palette action が account switch 後 stale resource を実行しないようにする
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/reader/hooks/command-palette`, `src/stores/ui-store.ts`
  - palette を開いたまま selected account/feed が変わると、表示中 resource action が古い account scope の article/feed に対して実行される可能性がある
  - palette open 時 snapshot、account switch 時 close、実行直前再検証のどれにするか決め、resource action と recent command の test を追加する

- [ ] P2 keyboard shortcut preference の duplicate / reserved key conflict を固定する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/hooks/use-shortcuts-settings-view-props.ts`, `src/schemas/preferences.ts`
  - shortcut preference は native menu hint、browser reserved key、global handler の 3 層にまたがるため、duplicate assignment や reserved key 保存時の挙動が曖昧になりやすい
  - duplicate shortcut、reserved OS/browser key、invalid modifier、empty reset の validation と display fallback を settings/lib test にする

- [ ] P2 tag mutation の duplicate name / stale article assignment policy を固定する
  - 対象: `src/hooks/use-tags.ts`, `src/components/reader/article-tag-chips.tsx`, `src/components/reader/tag-context-menu.tsx`
  - tag create/rename/assign が複数 UI から実行できるため、duplicate name や article deletion 後の assign/unassign が stale success として見えやすい
  - duplicate name normalization、deleted article/tag、invalidation failure の user-visible message と rollback 方針を hook/component test で固定する

- [ ] P2 subscription review / cleanup candidates の account deletion race を固定する
  - 対象: `src/components/subscriptions-index`, `src/lib/subscriptions`, `src-tauri/src/commands/feed_commands.rs`
  - review candidates を表示中に account/feed が削除されると、candidate detail と cleanup action の target が stale になりやすい
  - candidate snapshot、deleted target disable、cleanup result reconciliation を subscriptions component/lib/Rust command test にする

- [ ] P2 feed favicon remote image failure / mixed content policy を固定する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/components/reader/article-list-item.tsx`, `src/components/reader/feed-tree-row.tsx`
  - favicon/thumbnail と本文 sanitizer は別境界なので、http image、tracking query、broken image、SVG data をどこで許可/拒否するかがズレやすい
  - image src scheme、fallback icon、onError retryなし、privacy-sensitive query stripping の方針を component/helper test にする

- [ ] P2 runtime platform dev options の env / Tauri command precedence を固定する
  - 対象: `src/dev/intent.ts`, `src-tauri/src/commands/platform_commands.rs`, `src/__tests__/dev/intent.test.ts`
  - dev runtime options は env と Tauri command の両方から入るため、invalid env、command failure、window size overflow の fallback precedence が drift しやすい
  - env only、Tauri only、both present、command reject、out-of-range size の precedence matrix を test にする

- [ ] P2 generated command args schema の coverage gate を追加する
  - 対象: `src/api/tauri-commands.ts`, `src/api/schemas`, `src/dev/mocks.ts`, `src-tauri/src/commands`
  - command args schema がない command は dev mock や frontend call で malformed payload を早期検出できず、runtime boundary の責務が分散する
  - exported command wrapper、schema registry、dev mock case、Rust command name の一覧差分を検出する test を追加する

- [ ] P3 TODO priority taxonomy を CLAUDE.md / TODO.md で同期する
  - 対象: `CLAUDE.md`, `TODO.md`
  - TODO が大量化しているため、P1/P2/P3 の意味が agent ごとに揺れると、重要度の低い cleanup とデータ破壊系リスクが同じ扱いになりやすい
  - P1 は data loss/security/stale destructive action、P2 は runtime boundary/contract drift、P3 は observability/polish のように短い分類を明記する

- [ ] P3 dev mock unknown command failure を diagnostics と story canvas に出す
  - 対象: `src/dev/mocks.ts`, `src/dev/scenario-runtime.ts`, `src/components/debug`
  - unknown command は throw するだけなので、Storybook/dev preview 上では白画面や console only になり、mock coverage drift の発見が遅れやすい
  - unknown command を diagnostics panel に集約するか test failure 専用に留めるか決め、dev runtime test を追加する

- [ ] P1 account delete 後の reader selection / article cache cleanup を account scope で固定する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`, `src/stores/ui-store.ts`, `src/hooks/use-articles.ts`
  - account delete 成功後に accounts/feed queries は invalidation するが、reader の selected feed/article/tag や retained/recentlyRead cache が削除 account を指し続けると、次の操作が missing id で落ちやすい
  - delete account 後の selected account/feed/article/tag、browser overlay、article cache の cleanup/fallback を component/store test で固定する

- [ ] P1 account OPML export の stale account snapshot と object URL lifecycle を固定する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`
  - export 中に account rename/delete/navigation が起きると、download filename と OPML content の account snapshot がズレたり、unmount 後 click/revoke が競合しやすい
  - request 開始時の account id/name snapshot、delete during export、anchor click throw、timer cleanup、URL revoke を hook test にする

- [ ] P1 updater progress / ready event を download session 単位で検証する
  - 対象: `src/hooks/use-updater.ts`, `src/api/schemas/update-info.ts`
  - updater event に request/session id がないため、失敗後の再試行や duplicate listener で古い `update-download-progress` / `update-ready` が現在の toast を上書きする可能性がある
  - download generation、progress after failure、ready without in-flight、listener attach failure の contract test を追加する

- [ ] P1 browser webview bounds sync の resize storm と stale native command backlog を抑える
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src-tauri/src/commands/browser_webview_commands.rs`
  - ResizeObserver と window resize が毎回 async sync を投げるため、連続 resize で古い `resize` command が後から届き、WebView bounds が過去の矩形へ戻る可能性がある
  - request generation、latest-only resize、throttle/debounce、native side idempotence を hook/native test と実機計測に分ける

- [ ] P1 article body anchor click の URL scheme / base URL policy を toolbar opener と揃える
  - 対象: `src/components/reader/article-reader-body.tsx`, `src/components/reader/article-browser-actions.ts`, `src-tauri/src/commands/share_commands.rs`
  - sanitized body 内 anchor は本文 HTML から直接 external opener に流れるため、relative URL、protocol-relative URL、mailto/tel/file/javascript などの扱いが toolbar link とズレやすい
  - article base URL あり/なし、relative path、fragment-only、unsupported scheme、credential-in-URL の behavior を component/lib test で固定する

- [ ] P1 sync scheduler panic recovery を backoff / warning と同じ経路に乗せる
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/commands/sync_commands.rs`
  - `sync_account` panic は catch されるが backoff persistence や user-visible warning が通常 error と別経路なので、同じ account が短周期で panic を繰り返す可能性がある
  - panic account の next_sync、warning emit、sync-completed/succeeded 条件、purge 実行有無を scheduler test で固定する

- [ ] P1 startup/update/manual sync の foreground 復帰時 concurrency を system test 化する
  - 対象: `src/App.tsx`, `src/hooks/use-updater.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src-tauri/src/service/sync_scheduler.rs`
  - foreground 復帰時に wake sync、startup throttle、manual sync、updater install gate が近いタイミングで動くため、UI では idle に見えて native 側だけ busy になりやすい
  - app wake、manual sync click、update-ready、scheduler tick を組み合わせた integration test / manual verification checklist を作る

- [ ] P2 article auto-mark read の stale error rollback を latest article/viewMode で guard する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`, `src/stores/ui-store.ts`
  - auto mark mutation の error が後から返ると、現在表示中 article や viewMode が変わっていても retained article rollback と toast が走る可能性がある
  - delayed auto mark、article switch、unread/all switch、manual mark read との競合を hook test にし、generation guard を入れるか no-op 方針を決める

- [ ] P2 sidebar sync feedback spin と cooldown/disabled 状態の表示優先順位を固定する
  - 対象: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`
  - cooldown 中でも `allowAriaDisabledClick` で click handler が呼ばれるため、実 sync は走らなくても feedback spin や toast が user intent とズレやすい
  - cooldown click、disabled click、syncing中 click、manual sync rejected の表示優先順位を component/hook test で固定する

- [ ] P2 browser theme wipe overlay の rapid theme switching / reduced motion 追従を固定する
  - 対象: `src/components/reader/browser-view.tsx`, `src/stores/preferences-store.ts`
  - theme を連続変更した時に wipe timer と system theme subscription が重なると、overlay key reset や reduced motion 切替が現在 preference とズレる可能性がある
  - system light/dark change、manual rapid toggle、reduced motion enabled mid-animation の component test を追加する

- [ ] P2 command history の巨大 localStorage JSON parse 負荷と corruption cleanup を固定する
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`, `src/schemas/storage.ts`
  - command palette open 時に巨大 JSON や deeply nested invalid data を parse すると、UI thread を止めたり毎回同じ corruption を読み続ける可能性がある
  - max raw size、parse failure cleanup、schema failure cleanup、quota exceeded の behavior を unit test にする

- [ ] P2 sync scheduler backoff の invalid `next_retry_at` cleanup policy を固定する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`
  - `next_retry_at` が壊れた文字列だと backoff を無視するが、壊れた state を修復しないため、破損 DB で scheduler の挙動が毎 tick 変わりにくい
  - invalid timestamp、future timestamp、past timestamp、negative error_count の cleanup/ignore policy を Rust test にする

- [ ] P2 updater startup check と manual check の shared in-flight result の UX を固定する
  - 対象: `src/hooks/use-updater.ts`
  - startup silent check と manual check が同じ `checkInFlight` を共有するため、manual click が silent startup の失敗/成功結果に相乗りした時の toast 方針が分かりにくい
  - startup in-flight 中 manual click、manual in-flight 中 startup effect、failure/success/null result の toast behavior を hook/lib test にする

- [ ] P2 account setup session owner の state transition matrix を固定する
  - 対象: `src/stores/ui-store.ts`, `src/components/settings/add-account/account-config-form.tsx`, `src/components/settings/hooks/account-detail`
  - `accountSetupSession` は add-account と account-detail の両方から owner 付きで触るため、verifying/syncing/failed/succeeded の遷移が崩れると別画面の setup state を上書きしやすい
  - owner mismatch、same account retry、different account start、clear during verifying の store test を追加する

- [ ] P2 dev scenario helper の delayed replay timer cleanup を固定する
  - 対象: `src/dev/scenarios/helpers.ts`, `src/dev/scenarios/runner.ts`
  - dev scenario が `setTimeout` で preview state を遅延 replay するため、別 scenario 実行や画面遷移後に古い scenario が UI state を上書きする可能性がある
  - scenario generation/cancel token、late replay ignore、sequential scenario run の dev runtime test を追加する

- [ ] P2 Tauri dev server manager が他 repo の Vite process を止める条件を厳格化する
  - 対象: `scripts/tauri-dev-vite-manager.ts`, `src/__tests__/scripts/tauri-dev-vite-manager.test.ts`
  - port owner 判定が command line の Vite 文字列中心なので、同じ port を使う別 repo の Vite を停止してしまう可能性がある
  - cwd/project root/package name を判定に含めるか user confirmation に逃がし、same repo / other repo / unknown command line の test を追加する

- [ ] P2 Windows dispatch の forwarded env allowlist を secret pattern だけに依存しない
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/windows-command-dispatch.ts`
  - `DEV_` / `VITE_` / `TAURI_` / `RUST_` prefix を広く転送し、suffix で secret を落としているため、suffix に当たらない token-like env が Windows 側へ漏れる可能性がある
  - explicit allowlist、masked diagnostics、secret-like value detection、`DEV_CREDENTIALS` 例外の扱いを script test にする

- [ ] P2 OPML generate の XML writer `expect` を production boundary として棚卸しする
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - in-memory XML writer の `expect` は通常落ちない前提だが、export command の user-facing boundary で panic になる箇所が増えると support 時の原因が残りにくい
  - writer failure を Result に変える必要があるか評価し、panic acceptable なら理由を contract test/comment に残す

- [ ] P3 UI store toast timer を store lifecycle / test isolation として整理する
  - 対象: `src/stores/ui-store.ts`, `src/__tests__/stores/ui-store.test.ts`
  - module-level `toastTimer` は store reset や test isolation と別 lifecycle なので、テスト間や HMR 中に古い timer が新しい toast を消す可能性がある
  - store reset helper で timer を clear するか、timer id を store state に寄せるか決める

- [ ] P3 rAF focus helper の unavailable / throwing fallback を共通化する
  - 対象: `src/components/reader/hooks/*`, `src/components/settings/hooks/account-detail/account-detail-editor-focus.ts`, `src/lib/reader-focus.ts`
  - requestAnimationFrame + setTimeout fallback が複数箇所に分散し、unavailable/throwing/cancel cleanup の扱いが少しずつ違うため、focus regression の原因が散らばりやすい
  - shared helper 化するか contract test のみ置くか決め、主要 focus hooks の behavior matrix を作る

- [ ] P1 local feed 追加の duplicate URL race と rollback cleanup を固定する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - `add_local_feed` は fetch 後に DB 保存するため、同じ URL の並行追加や初期 sync 失敗 rollback で duplicate feed / orphan article / UI selected feed が残りやすい
  - duplicate URL concurrent add、sync failure rollback、unread count recalculation failure、rollback failure warning を Rust command と dialog test で固定する

- [ ] P1 purge_old_articles が開いている記事・tag・history を破壊しない contract を作る
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src/components/reader/article-view.tsx`
  - background sync 後の purge が read article を削除するため、現在開いている read article、tag assignment、recent history、browser preview の参照が消えるタイミングが曖昧
  - selected article が purge 対象、starred/tagged/read history 付き article、account keep_read_items_days 変更直後の behavior を Rust/frontend test にする

- [ ] P1 command args の blank id を frontend schema で止める
  - 対象: `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`
  - 多くの command args が `z.string()` のままなので、blank/whitespace id が Rust まで届き、missing resource と invalid input の区別が崩れやすい
  - accountId/feedId/folderId/articleId/tagId/muteKeywordId を nonblank trimmed id schema に寄せ、blank id の user-facing error と test を追加する

- [ ] P1 destructive command の missing target policy を delete/feed/tag/account で揃える
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/tag_commands.rs`, `src-tauri/src/commands/account_commands.rs`
  - `delete_feed` は missing を error にする一方、`delete_tag` は missing no-op になっており、confirm 後の stale target を成功扱いにするかが操作ごとにズレる
  - delete feed/tag/account/mute keyword の missing target、already deleted、cross-account target の policy を command/component test で統一する

- [ ] P2 frontend command args schema と Rust validation の max length を同期する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/tag_commands.rs`, `src-tauri/src/commands/account_commands.rs`
  - frontend schema は feed title / folder name / tag name / account name の長さ制限を持たず、Rust まで送ってから落ちるため、UI と backend の validation message が drift しやすい
  - FEED_TITLE_MAX_CHARS、FOLDER_NAME_MAX_CHARS、tag 50 chars、account name limit を shared contract test で照合する

- [ ] P2 tag color validation を frontend schema と view helper で共有する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/tag_commands.rs`, `src/components/reader/article-tag-chips.tsx`, `src/components/reader/tag-context-menu.tsx`
  - Rust は `#rrggbb` だけを許すが frontend args schema は arbitrary string を通すため、invalid color の failure surface が UI ごとにズレやすい
  - short hex、uppercase hex、blank color、nullish color、invalid color の normalization と message を TS/Rust test で揃える

- [ ] P2 pagination offset の上限と large offset performance policy を固定する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/article_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/db/sqlite_tag.rs`
  - limit は 200 で止めているが offset は無制限なので、破損 UI state や手動 IPC で巨大 offset が入り、SQLite scan と response latency が悪化しやすい
  - max offset、large offset empty response、negative/nonfinite rejection、tag/account/feed/recent/search の parity test を追加する

- [ ] P2 paginated article list の page boundary mutation contract を固定する
  - 対象: `src-tauri/src/infra/db/sqlite_article.rs`, `src/hooks/use-articles.ts`, `src/components/reader/hooks/article-list`
  - stable order はあるが、page 1 と page 2 の間に sync/purge/mark read が入ると offset pagination が duplicate/skip を起こす可能性がある
  - cursor 化が必要か、offset pagination は best-effort とするかを決め、article inserted/deleted/read-state changed during pagination の test を追加する

- [ ] P2 list_articles_by_tag の limit source of truth を command args schema と backend で一本化する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/tag_commands.rs`
  - TS 側は `MAX_IPC_PAGINATION_LIMIT`、Rust 側は `MAX_TAG_ARTICLE_LIST_LIMIT` を別定義しており、片方だけ変わると tag view だけ挙動がズレる
  - tag article limit の TS/Rust fixture、boundary 200、over-limit error message を schema contract test にする

- [ ] P2 OPML import の folder sort_order を max+1 にするか len 基準を明記する
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - OPML import は existing folder count から sort_order を始めるため、既存 sort_order に gap/large value/duplicate がある DB では並び順が衝突しやすい
  - existing sort_order gaps、duplicate sort_order、deleted folder gap、multi-folder import の expected order を Rust test で固定する

- [ ] P2 GReader remote folder removal が local folder assignment を残す条件を固定する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/service/sync_flow.rs`
  - remote subscription から folder が消えた時に existing local folder を保持する helper があり、remote 側の folder removal を反映するのか local override とみなすのか曖昧
  - remote folder present/missing/empty、local manual move 後 sync、remote deleted folder の conflict policy を provider sync test にする

- [ ] P2 feed unread count の negative / overflow DTO を backend でも防ぐ
  - 対象: `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/commands/dto.rs`, `src/api/schemas/feed.ts`
  - frontend schema は nonnegative count を期待するが DB column は破損や migration drift で negative/large value を返し得るため、DTO 化時の責務が曖昧
  - negative unread_count、large count、recalculate failure、muted unread exclusion の Rust/TS schema test を追加する

- [ ] P2 provider Retry-After / rate limit を sync warning と scheduler backoff に反映する
  - 対象: `src-tauri/src/domain/error.rs`, `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_scheduler.rs`
  - rate limit error はあるが provider の `Retry-After` を scheduler の `next_retry_at` と UI warning へどう渡すか未固定だと、過剰 retry や短すぎる cooldown になりやすい
  - 429 with Retry-After seconds/date、missing header、invalid header、account sync/manual sync の warning表示を test にする

- [ ] P2 `safeInvoke` の schema parse error を user-facing / diagnostics に分類する
  - 対象: `src/api/tauri-commands.ts`, `src/schemas/parse.ts`, `src/lib/ui-errors.ts`
  - response schema mismatch や args schema mismatch が throw として扱われると、backend failure と frontend contract drift の区別が UI 上でつきにくい
  - args parse failure、response parse failure、AppError parse failure の error category と toast/log policy を lib test で固定する

- [ ] P2 update_feed_display_settings の `inherit` / default preference 解決を account/feed context で固定する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src/components/reader/feed-context-menu.tsx`, `src/components/reader/hooks/article-list/use-article-list-header-actions.ts`
  - feed の reader/web preview mode と account/default preference が別経路で解決されるため、`inherit` 表示と実際の article/browser behavior がズレやすい
  - default変更後、feed override解除、folder/context menu からの変更、cache invalidation の contract test を追加する

- [ ] P2 command registry の null-response commands と Rust return type を照合する
  - 対象: `src/api/tauri-commands.ts`, `src/api/schemas/commands.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/commands`
  - frontend は `NullResponseSchema` を期待している command が多く、Rust 側が将来 count/result DTO を返すようになると schema parse failure で UI が壊れる
  - command name、args schema、response schema、Rust return type の一覧を repo contract test で照合する

- [ ] P2 dev mocks の mutation side effect と real DB cascade の差分を検出する
  - 対象: `src/dev/mocks.ts`, `src/dev/mock-data.ts`, `src-tauri/src/infra/db`
  - dev mock の delete_feed/delete_tag/update_folder は配列操作中心で、real DB cascade や foreign key error とズレると Storybook/dev だけ成功する操作が増える
  - delete feed cascading articles/tags/history、delete tag cascade、folder move missing target の dev mock parity test を追加する

- [ ] P2 external opener の `mailto:` 許可と article link opener の許可差を明文化する
  - 対象: `src/api/schemas/commands.ts`, `src/components/reader/article-reader-body.tsx`, `src/components/reader/article-browser-actions.ts`
  - `plugin:opener|open_url` は `mailto:` を許す一方、`open_in_browser` / Reading List / WebView は http(s) のみで、どの UI action が mailto を許すか分かりにくい
  - toolbar/body link/copy/open external/Web Preview/Reading List の scheme matrix を test と TODO contract にする

- [ ] P3 article command pagination constants を single source に寄せる候補を作る
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/article_commands.rs`, `src-tauri/src/commands/tag_commands.rs`
  - default limit と max limit が TS/Rust/tag command に分散しているため、今後の pagination UI 変更で片側だけ更新されやすい
  - constants 共有は難しければ repo contract test で数値一致を固定し、default 20/50 と max 200 の意味をコメント化する

- [ ] P3 deleted resource no-op の product copy を locale key として揃える
  - 対象: `src/locales/*/reader.json`, `src/locales/*/settings.json`, `src/components/reader`, `src/components/settings`
  - stale target を no-op/成功扱いにする操作では、toast を出さないのか「既に削除済み」と出すのかが feature ごとに揺れやすい
  - feed/tag/account/article の already-deleted copy、diagnostics-only policy、user-visible policy を locale key と component test で固定する

- [ ] P1 fullscreen toggle の unhandled rejection を global action boundary で吸収する
  - 対象: `src/lib/actions.ts`, `src/lib/window/windows.ts`, `src/hooks/use-keyboard.ts`, `src/hooks/use-menu-events.ts`
  - `toggleFullscreen()` を fire-and-forget で呼び、`setWindowFullscreen` reject を catch していないため、native menu / keyboard 経由で unhandled rejection が出ても toast や diagnostics に残らない
  - isFullscreen failure、setFullscreen failure、runtime unavailable、rapid toggle の Result/diagnostics policy を lib test にする

- [ ] P1 native injected browser bridge の global EventTarget monkey patch を互換性検証する
  - 対象: `src-tauri/src/browser_webview.rs`
  - focus override script が child webview 内で `EventTarget.prototype.addEventListener/removeEventListener` を wrap するため、対象ページの framework や third-party script と衝突すると embedded browser だけクリック/keyboard が壊れやすい
  - idempotent install、listener option passthrough、remove symmetry、page-defined patched EventTarget との順序、disable preference の recovery を manual verification と JS fixture で固定する

- [ ] P1 browser bridge script の injected command payload を session/URL 単位で stale ignore する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`
  - child webview 内 script は back/forward/close を native command へ直接送るため、WebView recreate 後に古い page script から command が届くと現在 overlay state と別セッションの操作が混ざる可能性がある
  - browser session id、target URL、window label の照合を入れるか、native 側 idempotent no-op とするか決め、recreate直後の late command test を追加する

- [ ] P2 command palette recent resource が削除済み target を表示し続けないようにする
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`, `src/components/reader/hooks/command-palette/use-command-palette-data.ts`, `src/components/reader/command-palette-history.ts`
  - history は id 文字列だけを保存するため、feed/tag/article 削除後に recent entry が残ると stale target action や空の検索結果に見えやすい
  - deleted feed/tag/article、account switch、history normalization 時の prune/no-op policy を component/lib test にする

- [ ] P2 command palette feed landing の async toast を palette session 単位で stale ignore する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/hooks/use-feed-landing.ts`
  - feed select 後に palette を閉じて非同期 `openFeedLanding` の失敗 toast を出すため、直後に account switch や別 feed selection があると古い feedId のエラーが現在文脈へ出る
  - palette session id、selected account snapshot、feedId revalidation のどれを採るか決め、delayed failure と account switch の test を追加する

- [ ] P2 account pane navigation の DOM query selector contract を reader focus policy と揃える
  - 対象: `src/lib/account/account-pane-navigation.ts`, `src/components/settings/account-detail`, `src/lib/reader-focus.ts`
  - account pane は data attribute と `document.activeElement` に依存して移動対象を決めるため、settings/account-detail の view 分割で attribute が外れると keyboard navigation だけ silent regression になりやすい
  - required data attribute、empty pane fallback、disabled button skip、focus restore の contract test を追加する

- [ ] P2 article share menu の email client opener と external opener の scheme policy を照合する
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/api/schemas/commands.ts`, `src/components/reader/article-browser-actions.ts`
  - share menu の email action は `mailto:` を OS opener へ流す一方、toolbar/body/browser actions の allowed scheme と別経路なので、URL encode、subject/body length、invalid article URL の扱いが drift しやすい
  - mailto subject/body encode、newline rejection、long URL fallback、opener failure toast の component/lib test を追加する

- [ ] P2 app shell lazy preload failure の retry/backoff を一度だけにする
  - 対象: `src/components/app-shell.tsx`
  - settings modal preload が failure を console に出すだけだと、chunk outage や asset path 破損時に hover/focus のたびに同じ preload が失敗し続け、原因が diagnostics に残りにくい
  - preload failure cache、manual retry、reload action、production/dev logging の behavior を app shell test にする

- [ ] P2 app action event dispatch の CustomEvent detail schema を listener 側と照合する
  - 対象: `src/lib/actions.ts`, `src/hooks/use-keyboard.ts`, `src/components/reader/hooks/article-list/use-article-list-keydown-handler.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-navigation.ts`
  - central action dispatcher は DOM event 名と detail を手書きで流すため、listener 側の expected detail とズレると menu/keyboard 経由だけが壊れる
  - action id、event name、detail shape、listener guard の一覧 contract test を追加し、unknown detail は diagnostics に残す

- [ ] P3 command history warning once cache を test/runtime reset できるようにする
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`
  - module-level warned set は HMR/test isolation と別 lifecycle なので、一度 warning が出ると後続の storage recovery/failure を同じ session で観測しにくい
  - reset helper を test-only export するか diagnostics counter へ寄せ、unavailable -> recovered -> failed again の behavior を unit test にする

- [ ] P3 native browser bridge JS source を fixture snapshot で最小限固定する
  - 対象: `src-tauri/src/browser_webview.rs`, `src-tauri/src/browser_webview/*`
  - Rust string 内の injected JS は quote/brace/feature flag の regression が compile 時に見えにくく、今後 bridge action が増えるほど review 負荷が上がる
  - source を helper/fixture 化するか、重要 token と syntax parse smoke を test にし、全量 snapshot ではなく bridge API contract だけ固定する

- [ ] P2 mute settings auto-mark optimistic rollback を latest-only にする
  - 対象: `src/components/settings/mute-settings.tsx`, `src/hooks/use-mute-keywords.ts`
  - auto-mark toggle は store を先に書き換えて失敗時に previous value を戻すため、ON -> OFF 連続操作で古い failure が最新設定を巻き戻す可能性がある
  - deferred mutation で ON failure / OFF success を逆順 settle させる component test を追加し、revision guard または current value compare rollback にする

- [ ] P2 updater pending update handle を version/source 付きで検証する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`
  - `check_for_update` の cached `Update` を `download_and_install_update` が再利用するため、manual check と startup check が近いタイミングで走ると、UI が見せた version と install 対象の対応が見えにくい
  - cached version、check source、created_at を持つか fresh check mandatory にするか決め、stale cached update / newer check failure / download no update の test を追加する

- [ ] P2 updater DOWNLOADING guard を panic-safe / cancellation-safe にする
  - 対象: `src-tauri/src/commands/updater_commands.rs`
  - `DOWNLOADING` は `do_download_and_install` の正常な `Result` 後に false へ戻す形なので、将来 panic/cancel 経路が入ると update download が永続的に in-progress 扱いになり得る
  - RAII guard、panic catch、test-only injected panic の方針を決め、guard reset と duplicate download rejection の Rust test を追加する

- [ ] P2 restart_app command の return contract と frontend toast 方針を固定する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`, `src/api/schemas/commands.ts`
  - Rust command は `Result` を返さず即 `app.restart()` するため、frontend の schema/Result 境界では restart failure・no-op・dev runtime fallback の扱いが見えにくい
  - restart unavailable、dev mode reload、packaged restart success の expected behavior を command schema / hook test / manual verification に分ける

- [ ] P2 database size 表示の WAL/SHM/total 定義を UI と schema で揃える
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src/api/schemas/database-info.ts`, `src/components/settings/hooks/use-data-settings-controller.ts`
  - DTO は db/wal/total を返すが SHM は total から除外され、UI は total だけ表示するため、実ファイルサイズ・Finder 表示・vacuum saved 表示の差が説明しづらい
  - SHM を含む/含まない定義、vacuum前後の saved 計算、negative saved の表示を schema/component/Rust test で固定する

- [ ] P2 data settings の vacuum / open log dir loading owner を settings 全体 loading と分離する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/components/settings/settings-modal-view.tsx`
  - data settings controller が `setSettingsLoading(false)` を直接呼ぶため、別 settings pane の save/setup sync と重なると、先に終わった操作が全体 loading を解除し得る
  - loading owner token、operation counter、pane-local disabled state のどれを採るか決め、vacuum中 account save / open log中 setup sync の test を追加する

- [ ] P2 subscriptions index の review candidate 日付基準を長時間表示で更新する
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/subscriptions/subscription-review-candidates.ts`
  - candidates は `getCurrentDate()` を memo 内で使うため、画面を開いたまま日付をまたいでも staleDays/review bucket が再計算されない
  - midnight tick、workspace reopen、manual refresh のどれで更新するか決め、now injection と day rollover の component/lib test を追加する

- [ ] P2 subscriptions index の kept/deferred decision を account scope で保持する
  - 対象: `src/components/subscriptions-index/use-subscriptions-index-state.ts`, `src/stores/ui-store.ts`, `src/lib/subscriptions/subscriptions-workspace.types.ts`
  - kept/deferred feed id set が workspace return state に残る一方、account switch や feed id collision/corruption 時の scope が見えず、別 account の review state に混ざりやすい
  - accountId 付き return state、account switch 時 reset、missing feed prune の behavior を component/store test にする

- [ ] P2 subscriptions index の Escape key close が modal/dialog stack を越えないようにする
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/window/window-events.ts`
  - window-level Escape handler は edit/delete dialog が null かだけを見るため、別の portal/modal や context menu が開いた時に workspace close と内側 close が競合しやすい
  - event defaultPrevented、Radix dialog stack、context menu open、input composition 中 Escape の behavior を component test にする

- [ ] P3 backup/log file path を user-facing diagnostics に出す時の redaction policy を統一する
  - 対象: `src-tauri/src/infra/db/backup.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/log_commands.rs`
  - startup DB error は database path を出す一方、log dir command は generic message に閉じており、support/debug のためにどこまで local path を出すかが境界ごとに揺れている
  - user-visible path、diagnostics-only path、privacy-sensitive username redaction の基準を CLAUDE/rules か contract test にする

- [ ] P3 dev runtime options の env alias 一覧を docs/test で source of truth 化する
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src/dev/intent.ts`, `mise.toml`
  - `VITE_DEV_*` と `VITE_ULTRA_RSS_DEV_*` alias が Rust/frontend/mise に分散しており、追加時に片側だけ更新されると dev scenario 起動だけ壊れやすい
  - alias table、schema fixture、mise env example の一致を config test にする

- [ ] P1 feed discovery / local provider の DNS rebinding 対策を入れる
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/domain/error.rs`
  - URL validation は host 文字列だけで private/loopback を判定しており、public hostname が DNS 解決後に private IP を返すケースを request 前に止められない
  - resolved IP allow/deny、redirect 後再解決、DNS cache / TOCTOU、dev private URL 例外を Rust integration test にする

- [ ] P1 network error redaction が userinfo credentials を漏らさないようにする
  - 対象: `src-tauri/src/domain/error.rs`, `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/infra/feed_discovery.rs`
  - URL redaction は query/fragment を主に消しているため、`https://user:pass@example.com/feed.xml` の userinfo が error message / diagnostics に残る可能性がある
  - userinfo、query token、fragment、invalid URL string、nested reqwest source の redaction fixture を追加する

- [ ] P1 GReader push mutation の partial remote success を idempotent にする
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - remote mutation を順番に POST するため、途中 failure の retry で既に成功した read/star/unstar が再送され、local pending state と remote state の対応が曖昧になりやすい
  - per-mutation ack、remote idempotency、retry dedupe、partial failure diagnostics の policy を決め、2件目 failure と retry の Rust test を追加する

- [ ] P1 GReader auth token が logs / errors / debug output に出ないことを固定する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/domain/error.rs`, `src-tauri/src/infra/http.rs`
  - `GoogleLogin auth=...` header を各 request で組み立てるため、HTTP error や debug formatting の追加時に token が混入しやすい
  - auth header redaction、request debug禁止、401/403 response body redaction、manual diagnostics 表示の contract test を追加する

- [ ] P2 DomainError の DNS failure 判定が async path で追加 DNS lookup しないようにする
  - 対象: `src-tauri/src/domain/error.rs`
  - error classification 内で host を `to_socket_addrs()` へ渡すと、network error を分類するだけで blocking DNS lookup や二重名前解決が発生し得る
  - reqwest error source だけで分類するか async-safe resolver へ寄せるか決め、offline / slow DNS / NXDOMAIN の timing fixture を追加する

- [ ] P2 feed discovery の HTML attribute entity decode を固定する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`
  - `<link href="/feed.xml?x=1&amp;y=2">` や title の entity を raw string のまま扱うと、候補 URL や表示 label が実ブラウザ解釈とズレる
  - href/title/type の entity decode、invalid entity、quoted/unquoted attribute、relative URL の fixture を追加する

- [ ] P2 feed discovery の `<base href>` cross-origin policy を決める
  - 対象: `src-tauri/src/infra/feed_discovery.rs`
  - discovery 対象 HTML が `<base href>` を使うと、feed candidate が元ページとは別 origin へ解決され得るため、意図しない third-party feed を候補に出しやすい
  - same-origin only、public cross-origin allow、private host rejection、protocol-relative base の policy を test で固定する

- [ ] P2 local feed provider の compressed body size limit を content-encoding 込みで検証する
  - 対象: `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/infra/http.rs`
  - `content-length` は compressed size になり得るため、decompressed body の上限、stream chunk 上限、gzip/brotli failure の扱いが不明瞭だと memory spike を見落としやすい
  - gzip bomb、unknown content-length、oversized decompressed body、truncated compressed body の Rust test を追加する

- [ ] P2 local feed provider の 304 validator cursor contract を固定する
  - 対象: `src-tauri/src/infra/provider/local.rs`
  - 304 response では body/content-type を読まず previous cursor を継続するため、server が ETag / Last-Modified を落とす、弱い ETag を返す、validator が変わるケースの保持方針が曖昧
  - 304 with/without validators、weak ETag、clock-skew Last-Modified、stale cursor retry の contract test を追加する

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

- [ ] P2 sanitizer が relative media URL を article base URL に解決するか削除するか決める
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - sanitizer は relative `srcset` を保持できるため、reader body で base URL がない相対画像が broken link になるか、将来 base tag 追加時に意図しない origin へ解決される可能性がある
  - relative img/srcset/source、protocol-relative URL、article URL missing、privacy setting enabled/disabled の fixture を追加する

- [ ] P2 sanitizer_version 更新時の re-sanitize / repair policy を作る
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/service/sync_flow.rs`
  - sanitizer rule を変えても既存 article の sanitized_html が古い policy のまま残るため、危険属性の削除や media policy 変更が過去記事へ反映されない
  - lazy re-sanitize、migration batch、on-read repair、failure fallback のどれを採るか決め、version mismatch fixture を追加する

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

- [ ] P2 reader focus retry timer を generation / unmount cleanup で stale focus しないようにする
  - 対象: `src/lib/reader-focus.ts`, `src/components/reader/hooks/article-list`, `src/components/reader/hooks/sidebar`
  - focus helper は `window.setTimeout` で最大 12 回 retry するが、pane/source/account が変わった後も古い selected id の focus retry が残る可能性がある
  - generation token、cancel handle、source/account snapshot、unmount cleanup、rapid selection change の component test を追加する

- [ ] P2 sync-on-wake の per-account failure を Promise.all fail-fast から集約 diagnostics にする
  - 対象: `src/App.tsx`, `src/hooks/use-feeds.ts`, `src/lib/query/query-invalidation.ts`
  - 複数 account を並列 sync する時、1 account の throw/reject が他 account の結果待ちや warning 集約を壊すと、どの account が成功/失敗したか見えにくい
  - `Promise.allSettled`、per-account warning、partial success invalidation、sync_on_wake off account skip の component test を追加する

- [ ] P2 platform info load failure の retry / diagnostics owner を決める
  - 対象: `src/stores/platform-store.ts`, `src/components/app-shell.tsx`, `src/hooks/use-app-icon-theme.ts`
  - platform info failure は default platform へ fallback するが、capability-dependent UI が silent degrade した時に再試行する導線や diagnostics owner が見えにくい
  - runtime unavailable、temporary command reject、manual retry、capability false fallback、loadError 表示/非表示の store/component test を追加する

- [ ] P2 Tauri listener failure once flag を runtime recovery / test reset できるようにする
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `src/components/app-shell.tsx`
  - listener failure event は module-level once flag で抑制されるため、runtime recovery 後の再失敗や test isolation で二回目以降の警告を観測しにくい
  - reset helper、diagnostics counter、runtime session id、registration failure -> cleanup failure の ordering test を追加する

- [ ] P2 CI workflow の third-party action pinning を全 workflow へ広げる
  - 対象: `.github/workflows/*.yml`, `mise.toml`
  - release workflow だけ SHA pin check している場合、CI 側の `actions/checkout`、`jdx/mise-action`、`dtolnay/rust-toolchain`、`Swatinem/rust-cache` が tag pin のまま drift し得る
  - all workflow action pin check、renovate/update policy、official action exception、local mise gate の test/script を追加する

- [ ] P2 CI apt package install の retry / mirror failure policy を固定する
  - 対象: `.github/workflows/ci.yml`, `mise.toml`
  - Linux CI は `apt-get update && apt-get install` を各 job で直接実行するため、mirror timeout や package rename が lint/test/build 全体の flake になりやすい
  - retry wrapper、package list source of truth、cache禁止方針、apt failure diagnostics、Ubuntu version pinning の workflow test/documentation を追加する

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

- [ ] P2 article list search focus restore が aria-label 文字列依存で壊れないようにする
  - 対象: `src/components/reader/article-list-header-search.tsx`, `src/components/reader/article-list-header.tsx`
  - Escape 後の focus restore が全 button から aria-label 一致で探すため、locale 変更や同名 button が増えた時に別要素へ focus が移りやすい
  - trigger ref / data attribute 化、duplicate label、locale switch、search open/close rapid toggle の component test を追加する

- [ ] P2 settings add account form の preventDefault warning を Tauri form contract として整理する
  - 対象: `src/components/settings/add-account/form-view.tsx`, `src/components/settings/add-account/account-config-form-view.tsx`
  - React Doctor は form `preventDefault` を progressive enhancement warning として出すが、Tauri app では native command submit が正なので、button/form semantics の意図を明文化しないと毎回 noise になる
  - `type=submit` / `onSubmit` / Enter key / disabled submitting / no-JS 非対応方針を component test と suppression policy へ整理する

- [ ] P2 subscription review candidate の array chain warning を production hot path として潰す
  - 対象: `src/lib/subscriptions/subscription-review-candidates.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - `filter().map()` warning は小さく見えるが、feed 数が増えるほど review index 表示時の全件走査コストに直結する
  - single-pass build、hiddenFeedIds large set、stale reason sorting、candidate count regression の lib test を追加する

- [ ] P2 command palette dev scenario loader の dynamic import / runtime load を stale open state で捨てる
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`, `src/dev/scenario-runtime.ts`
  - dev scenario loader は open state と別 effect で一度走るため、palette close/open や HMR 中の late result が現在 input reset と混ざる可能性がある
  - cancelled flag、open generation、module load failure、scenario registry update、rapid close/open の hook test を追加する

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

- [ ] P2 command palette runtime の independent await warning を open generation と一緒に整理する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`, `src/dev/scenario-runtime.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - React Doctor は runtime load の sequential independent await を検出しているが、palette open/close の generation guard と混ざると late result の扱いが曖昧になる
  - loader の並列化可否、cancelled flag、open generation、dynamic import failure、HMR 中 close/open の hook test を追加する

- [ ] P2 use-update-feed-folder の repeated find を Map index 化する
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/components/reader/hooks/feed-tree/*`
  - React Doctor の `js-index-maps` が `array.find()` in loop を検出しており、feed 数が増えるほど folder update 時の lookup が O(n*m) になりやすい
  - folder/feed id index を一度だけ作り、duplicate id、missing folder、same folder move、large list の hook test を追加する

- [ ] P2 account detail name editor の await placement を skip path 優先で整理する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-name-editor.ts`
  - React Doctor の `async-defer-await` が、early return で使わない await が先に走る箇所を検出している
  - 同名 submit、blank/trimmed name、saving中再submit、mutation reject、focus restore の順序を崩さず、skip path が同期的に抜けるようにする

- [ ] P2 seed-dev-db script の independent await を Promise.all 化できるか検証する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - React Doctor の `async-parallel` が script 内の 3 sequential await を検出しており、dev data refresh が不要に遅くなる可能性がある
  - DB connection、backup/read、transform、write の依存関係を明確にし、独立処理だけ並列化して error diagnostics を維持する

- [ ] P3 article list equality helper に length guard を入れる
  - 対象: `src/lib/articles/article-list.ts`, `src/__tests__/lib/article-list.test.ts`
  - React Doctor の `js-length-check-first` が、配列長が違っても `.every()` へ入る比較を検出している
  - empty list、different length、same ids different order、large list の pure helper test を追加し、短絡条件を先に置く

- [ ] P3 account sync statuses の map/filter chain を single-pass 化する
  - 対象: `src/hooks/use-account-sync-statuses.ts`, `src/__tests__/hooks/use-account-sync-statuses.test.tsx`
  - React Doctor の `js-flatmap-filter` が `.map().filter(Boolean)` を検出しており、account 数が増えた時に不要な中間配列を作る
  - sync disabled、missing account、warning/error mixed、order preservation の hook test を維持して `.flatMap` または明示 loop へ寄せる

- [ ] P3 Tailwind redundant size axes を design primitive から小さく潰す
  - 対象: `src/components/reader/account-switcher-view.tsx`, `src/components/shared/nav-row-button.stories.tsx`
  - React Doctor の `design-no-redundant-size-axes` が `w-4 h-4` を検出しており、Tailwind v3.4+ なら `size-4` に寄せられる
  - production component を先に直し、Storybook は visual diff 影響がない範囲で同じ表記へ揃える

- [ ] P3 locale contract test の deep property access を hoist する
  - 対象: `src/__tests__/lib/i18next-locale-contract.test.ts`
  - React Doctor の `js-cache-property-access` が loop 内の `settings.reading.in_app_browser` repeated read を検出している
  - test readability を落とさず、該当 locale / setting branch の fixture 名を保ったまま const hoist へ寄せる

- [ ] P3 React Compiler 未導入状態の採用判断メモを作る
  - 対象: `CLAUDE.md`, `.claude/rules/*`, `TODO.md`, `vite.config.ts`
  - React Doctor は React 19.2.6 を検出している一方で React Compiler は未検出なので、今後の memoization / effect cleanup の判断基準が compiler 有無で揺れやすい
  - すぐ導入するかではなく、compiler adoption preflight、unsupported pattern scan、performance gate、opt-in/opt-out 方針を task 化する

- [ ] P2 storage schema の chained transform を single-pass helper へ寄せる
  - 対象: `src/schemas/storage.ts`, `src/__tests__/schemas/storage-schema-contract.test.ts`
  - React Doctor の `js-combine-iterations` が production schema の同一行を重複検出しており、key/value normalization が増えるほど parse 時の中間配列が増えやすい
  - schema strictness を変えず、unknown key、blank value、duplicate storage entry、malformed persisted value の contract test を維持して single-pass 化する

- [ ] P2 repo-contracts test の file list scan を index 化する
  - 対象: `src/__tests__/config/repo-contracts.test.ts`
  - React Doctor が `js-combine-iterations`、`js-tosorted-immutable`、`js-set-map-lookups`、`js-index-maps` を同一巨大 test に多数検出しており、repo ファイル数増加に比例して gate が重くなる
  - `rg --files` 結果を拡張子、dirname、basename、import target の Map/Set に分け、各 assertion が同じ全件走査を繰り返さないようにする

- [ ] P2 dev mocks の repeated array chain を fixture builder 単位で整理する
  - 対象: `src/dev/mocks.ts`, `src/__tests__/dev/dev-mock-data.test.ts`
  - React Doctor の `js-combine-iterations` が dev mocks に集中しており、mock dataset 追加のたびに Storybook/dev scenario 起動コストが増えやすい
  - feed/article/tag/account index を builder 初期化時に作り、fixture順序、duplicate id、unread/starred count、tag assignment の test を維持する

- [ ] P2 Tauri command contract helper の Set / toSorted 移行をまとめる
  - 対象: `tests/helpers/tauri-command-contract.ts`, `src/__tests__/api/tauri-commands.test.ts`, `src/__tests__/api/browser-webview-command-contract.test.ts`
  - React Doctor が `array.includes()` in loop と `[...array].sort()` を helper/test に検出しており、command 数が増えるほど contract test が遅くなる
  - command name Set、sorted snapshot helper、missing/extra command diagnostics、browser/native command parity を崩さず整理する

- [ ] P2 locale placeholder contract の repeated includes を Set 化する
  - 対象: `src/__tests__/lib/locale-placeholders.test.ts`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - React Doctor が locale test に `js-set-map-lookups`、`js-tosorted-immutable`、`js-cache-property-access` を検出しており、locale追加時の gate コストと error message が悪化しやすい
  - locale key Set、placeholder Set、sorted diagnostics、nested settings access hoist を入れ、missing placeholder の表示品質を維持する

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

- [ ] P2 add-account-services test の option extraction を service helper と揃える
  - 対象: `src/__tests__/components/add-account-services.test.ts`, `src/components/settings/add-account/services.ts`, `src/components/settings/add-account/services.types.ts`
  - React Doctor の `js-combine-iterations` が add-account service test に出ており、service option の filter/map が実装と test で重複している可能性がある
  - supported service、disabled service、provider label、config schema availability の test helper を service source of truth から組み立てる

- [ ] P2 ui-store の SyncProgressUiState unused type を store API として残すか決める
  - 対象: `src/stores/ui-store.ts`, `src/components/app-shell.tsx`, `src/hooks/use-account-sync-statuses.ts`
  - React Doctor / Knip が `SyncProgressUiState` を unused type として検出しており、sync progress 表示の public state なのか過去実装の残骸なのか曖昧になっている
  - store selector、sync progress toast、account sync status hook の参照を確認し、不要なら削除、必要なら public state contract test へ明示する

- [ ] P2 tauri-commands API surface の unused type / export を command schema と突き合わせる
  - 対象: `src/api/tauri-commands.ts`, `src/api/schemas/index.ts`, `src/__tests__/api/tauri-commands.test.ts`
  - React Doctor / Knip が API command module に unused type/export を検出しており、Rust IPC contract と frontend helper のどちらが source of truth か分かりにくい
  - command wrapper、schema-derived type、test-only export、public import path を分類し、不要 export は削除、必要 export は schema barrel contract へ追加する

- [ ] P2 update-info schema の unused type を updater command contract と揃える
  - 対象: `src/api/schemas/update-info.ts`, `src/hooks/use-updater.ts`, `src/__tests__/hooks/use-updater.test.ts`, `src-tauri/src/commands/updater_commands.rs`
  - React Doctor / Knip が update info schema 側の type を unused として検出しており、backend trusted schema と frontend guard の境界が揺れやすい
  - available/no-update/error payload、version string、release date、download URL、malformed updater response の schema contract を整理する

- [ ] P2 constants の unused export を design token / runtime token / dead token に分ける
  - 対象: `src/constants/storage.ts`, `src/constants/browser.ts`, `src/constants/events.ts`, `src/constants/motion.ts`, `src/constants/ui-layout.ts`
  - React Doctor / Knip が constants に unused type/export を複数検出しており、将来用 token と削除忘れ token が混ざると import 移動時に判断が遅くなる
  - runtime public token、test/storybook token、private literal、dead token に分類し、残すものは contract test か Storybook usage へ明示する

- [ ] P2 keyboard shortcut contract の sort / index / unused export を一括整理する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/__tests__/lib/keyboard-shortcuts.test.ts`, `src/hooks/use-keyboard.ts`
  - React Doctor / Knip が keyboard shortcut module に unused export と `js-index-maps` を検出しており、shortcut 数が増えると lookup と public API が膨らみやすい
  - shortcut id Map、scope Set、display order sort helper、native menu parity、duplicate shortcut diagnostics を整理する

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

- [ ] P2 actions test の action registry scan を id Map へ寄せる
  - 対象: `src/__tests__/lib/actions.test.ts`, `src/lib/actions.ts`, `src/hooks/use-menu-events.ts`
  - React Doctor の `js-combine-iterations` が action registry test に出ており、action id / shortcut / menu event の照合で全件走査を繰り返している可能性がある
  - action id Map、duplicate id diagnostics、menu action parity、disabled action handling、native event unknown action の test helper を追加する

- [ ] P2 tauri-mocks helper の command filtering を command index へ寄せる
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/tauri-command-contract.ts`, `src/__tests__/api/tauri-commands.test.ts`
  - React Doctor の `js-combine-iterations` が mock command helper に複数出ており、invoke mock の setup / assertion が command 数に比例して重くなる
  - command name index、call history index、per-command reset、unknown command diagnostics、async reject path を崩さず整理する

- [ ] P2 general settings view props test の option lookup を Map 化する
  - 対象: `src/__tests__/components/use-general-settings-view-props.test.ts`, `src/components/settings/hooks/use-general-settings-view-props.ts`
  - React Doctor が `js-combine-iterations` と `js-index-maps` を同 test に検出しており、settings option を loop 内 find で探している可能性がある
  - option id Map、duplicate option id、disabled state、label/description presence、preference update callback の assertion helper を追加する

- [ ] P2 dev scenario registry の sort / filter を registry index helper へ寄せる
  - 対象: `src/__tests__/dev/scenarios/registry.test.ts`, `src/dev/scenarios/registry.ts`, `src/dev/scenarios/helpers.ts`
  - React Doctor が dev scenario registry test に `js-combine-iterations` と `.toSorted()` warning を検出しており、scenario 数が増えると registry validation が重くなる
  - scenario id Set、category grouping、stable display order、duplicate id diagnostics、missing setup/teardown contract を helper 化する

- [ ] P2 dev scenario helpers の async loop を setup dependency graph で分類する
  - 対象: `src/dev/scenarios/helpers.ts`, `src/__tests__/dev/scenario-runtime.test.ts`
  - React Doctor の `async-await-in-loop` が dev scenario helper に複数出ており、独立 setup と順序依存 setup が同じ loop に見える
  - account/feed/article/tag setup の依存関係を graph として明示し、独立作成は並列化、順序が必要な箇所は comment と test で固定する

- [ ] P2 sidebar test の async loop を user-event ordering と fixture setup に分離する
  - 対象: `src/__tests__/components/sidebar.test.tsx`, `src/components/reader/sidebar-view.tsx`
  - React Doctor の `async-await-in-loop` が sidebar test に出ており、連続 user event の意図的逐次実行と独立 fixture setup が混ざっている可能性がある
  - keyboard navigation / pointer interaction は逐次維持し、独立 render setup や mock response setup は並列化できるか確認する

- [ ] P2 preferences schema contract の sorted key assertion を target-aware にする
  - 対象: `src/__tests__/schemas/preferences-schema-contract.test.ts`, `src/schemas/preferences.ts`
  - React Doctor が `.toSorted()` warning を preferences schema contract に出しており、schema key order assertion が spread sort 前提になっている
  - Node/WebView target 方針に合わせて `toSorted` へ寄せるか stable sort helper に逃がし、unknown enum、default value、missing nested setting の diagnostics を維持する

- [ ] P2 schema barrel public API test の sorted export assertion を helper 化する
  - 対象: `src/__tests__/api/schema-barrel-public-api.test.ts`, `src/api/schemas/index.ts`
  - React Doctor が `.toSorted()` warning を schema barrel test に検出しており、public schema export 追加時に test helper の並び替え処理が散りやすい
  - expected export list、actual export list、missing/extra diff、type-only export policy を共通 helper へ寄せる

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

- [ ] P2 i18n test setup の unused export を Vitest lifecycle contract として整理する
  - 対象: `tests/helpers/i18n-setup.ts`, `src/__tests__/lib/i18next-locale-contract.test.ts`, `src/__tests__/lib/locale-placeholders.test.ts`
  - React Doctor / Knip が `resetTestI18nState` を unused export として検出しており、test isolation に必要な helper なのか過去の cleanup 残骸なのか曖昧になっている
  - global setup、per-test reset、locale change side effect、parallel test 実行の状態漏れを確認し、不要なら削除、必要なら import して contract test に明示する

- [ ] P2 fixtures helper の unused export を reader/settings/API fixture に分割する
  - 対象: `tests/helpers/fixtures.ts`, `src/__tests__/components/article-view.test.tsx`, `src/__tests__/api/tauri-commands.test.ts`
  - React Doctor / Knip が fixtures helper の unused export を検出しており、巨大 fixture file に reader/settings/API 用 helper が混在して死んだ export を見分けにくい
  - reader article fixture、settings account fixture、API command fixture、generic date/id helper に分け、使わない export は削除する

- [ ] P2 use-articles の unused export と mutation invalidation を同じバッチで棚卸しする
  - 対象: `src/hooks/use-articles.ts`, `src/hooks/create-mutation.ts`, `src/__tests__/hooks/use-articles.test.tsx`
  - React Doctor / Knip が `use-articles` に unused export と mutation invalidation warning の両方を出しており、公開 hook API と cache update 責務が同時に膨らんでいる
  - external import、test-only helper、mutation helper、query key helperを分類し、cache update が必要な public mutation だけを残す

- [ ] P2 account-detail editor focus helper の unused export を focus restore contract と照合する
  - 対象: `src/components/settings/hooks/account-detail/account-detail-editor-focus.ts`, `src/components/settings/account-detail/*`, `src/__tests__/hooks/use-account-detail-sync-status-rows.test.tsx`
  - React Doctor / Knip が account detail editor focus helper の unused export を検出しており、name editor / service config editor の focus restore 仕様が helper とずれている可能性がある
  - rename submit、cancel、validation error、sync status update、account switch 時の focus owner を確認して dead helper を削る

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

- [ ] P2 tauri-types test helper の unused type を generated command fixtures と照合する
  - 対象: `tests/helpers/tauri-types.ts`, `tests/helpers/tauri-command-contract.ts`, `src/__tests__/api/tauri-commands.test.ts`
  - React Doctor / Knip が Tauri test helper type を unused として検出しており、generated command schema と手書き test type が二重管理になっている可能性がある
  - generated schema-derived type に寄せるもの、mock-only type として残すもの、削除する legacy type を分類する

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

- [ ] P2 query-invalidation helper の unused export を mutation owner ごとに棚卸しする
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/create-mutation.ts`, `src/hooks/use-articles.ts`, `src/hooks/use-tags.ts`, `src/hooks/use-delete-feed.ts`
  - React Doctor / Knip が query invalidation helper の unused export を検出しており、mutation warning の修正時に dead helper を再利用してしまう可能性がある
  - article、feed、tag、account sync の invalidation owner を決め、使う helper は mutation test へ明示し、使わない helper は削除する

- [ ] P2 use-feed-landing unused type を feed dialog / command palette navigation contract と照合する
  - 対象: `src/hooks/use-feed-landing.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`
  - React Doctor / Knip が `use-feed-landing` 周辺の unused type を検出しており、feed 作成後の navigation owner が hook / dialog / command palette に分散している
  - added feed landing、duplicate feed、folder selection、command palette add flow、settings transition の contract を確認して dead type を削る

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

- [ ] P2 keyboard async test の sequential await を shortcut ordering contract と fixture setup に分ける
  - 対象: `src/__tests__/hooks/use-keyboard.test.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/hooks/use-keyboard.ts`
  - React Doctor の `server-sequential-independent-await` が keyboard test に出ており、shortcut event ordering と独立 setup が同じ await 列に見える
  - user event sequence は逐次維持し、独立 mock setup / preference setup は並列化できるか確認する

- [ ] P2 browser-webview-events diff warning を current-diff blocker として再掲しない運用にする
  - 対象: `src/__tests__/hooks/use-browser-webview-events.test.tsx`, `TODO.md`, `mise.toml`
  - React Doctor diff scan は毎回 `use-browser-webview-events.test.tsx:315` の 1 件だけを返しており、TODO 追加のたびに同じ P1 が再発見されている
  - current diff blocker として担当者を決め、修正後は React Doctor diff scan で 0 warning を確認し、以後の TODO 追加では再掲しない

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

- [ ] P2 clipboard fallback の error category を browser permission / insecure context で固定する
  - 対象: `src/lib/runtime/clipboard.ts`, `src/components/app-shell.tsx`, `src/components/reader/article-browser-actions.ts`
  - Clipboard API の reject message を文字列分類しているため、ブラウザ/WebViewごとの `NotAllowedError`、insecure context、document not focused が unknown になり toast が不親切になりやすい
  - DOMException name/code、permission denied、runtime unavailable、empty text、large text、Tauri/browser fallback parity の unit test を追加する

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

- [ ] P2 Dialog close label の global i18n lookup を language change に追従させる
  - 対象: `src/components/ui/dialog.tsx`, `src/lib/i18n.ts`, `src/locales/*`
  - close label fallback が hook ではなく global `i18n.t` に依存しているため、language change 後に既存 dialog の close label が stale になる可能性がある
  - language switch while dialog open、explicit closeLabel、missing key fallback、SSR/browser test を追加する

- [ ] P2 browser runtime unavailable 判定を dev mocks / packaged runtime / Storybook で統一する
  - 対象: `src/components/reader/browser-runtime-availability.ts`, `src/lib/window/window-chrome.ts`, `src/components/storybook/story-tauri-runtime.ts`
  - `__DEV_BROWSER_MOCKS__` と `__ULTRA_RSS_BROWSER_MOCKS__`、`__TAURI_INTERNALS__` の組み合わせで browser feature の available/unavailable が決まるため、Storybook/dev/test で表示条件が揺れやすい
  - mock flag matrix、packaged runtime、browser preview、Storybook decorator cleanup、HMR 後 reset の test を追加する

- [ ] P3 contenteditable / ARIA textbox 判定を global shortcut 系 helper で共有する
  - 対象: `src/hooks/use-mouse-navigation.ts`, `src/hooks/use-keyboard.ts`, `src/components/reader/hooks/article/use-article-action-shortcuts.ts`
  - editable target 判定が hook ごとに増えると、`contenteditable=false`、nested role textbox、searchbox、CodeMirror 的 DOM の扱いが drift しやすい
  - shared helper 化し、input/textarea/select/contenteditable/plaintext-only/role textbox/searchbox/disabled input の unit test を追加する

- [ ] P3 overlay / drag / inert の CSS token を scattered z-index から semantic layer へ寄せる
  - 対象: `src/components/app-shell.tsx`, `src/components/ui/dialog.tsx`, `src/components/shared/app-toast-view.tsx`, `src/components/shared/workspace-header.tsx`
  - z-index や pointer-events の数値が component 内に分散しており、overlay 追加のたびにどの layer が上に来るべきか review で判断する必要がある
  - semantic layer constants、CSS custom property、component snapshot、DESIGN/CLAUDE rule 化のどれで固定するか決める

- [ ] P1 `safeInvoke` response validation error の detail 量と redaction を固定する
  - 対象: `src/api/tauri-commands.ts`, `src/schemas/parse.ts`, `src/api/schemas/error.ts`
  - Zod response parse failure 時に issue path/message を連結して user-visible message と console に出すため、巨大 payload や URL/token を含む malformed response で log/toast が過剰になりやすい
  - issue count cap、message length cap、URL/userinfo/query redaction、console-only detail、user-facing generic message の lib test を追加する

- [ ] P1 command args schema の id fields を non-blank trimmed contract に寄せる
  - 対象: `src/api/schemas/commands.ts`, `src/hooks/create-query.ts`, `src/hooks/use-articles.ts`, `src/hooks/use-tags.ts`
  - 多くの command args が `z.string()` のままなので、空白だけの account/feed/article/tag id が frontend schema を通り、Rust 側の missing target policy へ遅れて到達しやすい
  - accountId/feedId/articleId/tagId/folderId の shared schema、trim/no-trim 方針、legacy id 互換、blank id error category の schema test を追加する

- [ ] P2 `createQuery` の rejected queryFn と `enabled` 前提崩れを diagnostics 化する
  - 対象: `src/hooks/create-query.ts`, generated query users
  - query id が null の時は `enabled` で止める前提だが、TanStack Query の呼び出し順や future refactor で queryFn が走ると rejected promise だけが error boundary に見える
  - queryFn guard の return policy、blank id telemetry、generated hookごとの enabled condition、test-only forced queryFn の unit test を追加する

- [ ] P2 query key object segment の stable serialization contract を固定する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/use-articles.ts`, `src/hooks/use-tags.ts`
  - reader mode を `{ mode }` object segment として query key に入れているため、hashing は安定しても partial invalidation、snapshot、manual key比較で array/string segment と扱いが揺れやすい
  - object segment を続ける/tuple literalへ寄せる判断、partial match、invalidate root、devtools display、query key snapshot test を追加する

- [ ] P2 log-only invalidation の failure aggregation を feature diagnostics へ接続する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/hooks/create-mutation.ts`, `src/components/app-shell.tsx`
  - invalidation failure は console warn だけなので、mutation は成功したが UI が stale のままになるケースを user/support が検出しにくい
  - strict/log-only分類、queryKey redaction、toast有無、debug HUD/diagnostics counter、sync completed invalidation failure の test を追加する

- [ ] P2 schema barrel public API test を自動生成寄りにして manual list drift を減らす
  - 対象: `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`
  - public export list を test 側にも手で持っているため、schema 追加時に barrel だけ/テストだけ更新されると公開 contract の意図が review で分かりにくい
  - source file inventory、runtime export snapshot、type-only export policy、intentional private schema allowlist の test へ整理する

- [ ] P2 PreferencesDto の unknown key passthrough を size / prefix / retirement policy で固定する
  - 対象: `src/api/schemas/preferences.ts`, `src/schemas/preferences.ts`, `src/stores/preferences-store.ts`
  - backend から来た unknown preference を passthrough として保持できるため、typo、retired key、巨大 key/value、extension-like prefix が UI store に残り続ける可能性がある
  - max entries、key/value byte cap、known prefix allowlist、retired key cleanup、typo warning once の schema/store test を追加する

- [ ] P2 preference defaults と settings locale label の coverage を key 単位で照合する
  - 対象: `src/schemas/preferences.ts`, `src/locales/*/settings.json`, `src/components/settings/**`
  - preference key は schema/default/UI/locale にまたがるため、新しい key 追加時に label/help text/reset default のどれかが欠けると settings だけ silent regression になる
  - visible preference key inventory、hidden preference exception、locale key mapping、settings row coverage、reset default behavior の repo contract test を追加する

- [ ] P2 i18n plural / count key の fallback 表示を locale contract にする
  - 対象: `src/locales/*/*.json`, `src/lib/i18n-resources.ts`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - `{{count}}` を含む key と `_one/_other` 系 key が混在しており、英語/日本語で plural fallback や count interpolation がズレると UI 文言だけ壊れやすい
  - count placeholder parity、plural suffix pair、zero/one/other rendering、missing interpolation warning の locale test を追加する

- [ ] P2 global `i18n.t` 利用箇所を language-change reactive / static に分類する
  - 対象: `src/components/ui/dialog.tsx`, `src/stores/preferences-store.ts`, `src/lib/i18n.ts`
  - hook 外の `i18n.t` は language change に再レンダー追従しない場合があるため、toastやdialog labelのような transient text と store side effect text の境界が曖昧
  - static allowed list、reactive component は `useTranslation` へ移す方針、language switch中 toast/dialog の component test を追加する

- [ ] P2 dev/runtime error console policy を user-visible diagnostics と揃える
  - 対象: `src/dev/intent.ts`, `src/App.tsx`, `src/stores/platform-store.ts`, `src/hooks/use-app-icon-theme.ts`, `src/hooks/use-badge.ts`
  - runtime failure が `console.warn/error` だけで終わる箇所が多く、dev-only noise と packaged app の user-visible failure が混在している
  - dev-only console、production diagnostics、toast対象、once suppression、secret redaction の分類表と代表 hook test を追加する

- [ ] P2 Result.unwrap usage を async boundary ごとに failure surface 化する
  - 対象: `src/hooks/**`, `src/dev/**`, `tests/helpers/**`
  - `Result.unwrap` は成功前提を短く書ける一方、queryFn/dev scenario/test helper に混在しており、失敗時に user-visible error・console・test failure のどれにするかが呼び出し元ごとに曖昧
  - queryFn、mutationFn、dev-only loader、test helper に分類し、production path は explicit `Result.isFailure` で message redaction を固定する

- [ ] P3 repo-contracts test の regex parser を fixture-driven helper へ分ける
  - 対象: `src/__tests__/config/repo-contracts.test.ts`
  - workflow/mise/locale/storybook の contract を 1 ファイル内 regex で多数解析しており、設定ファイルが少し変わるたびに parser bug と本当の contract violation が切り分けにくい
  - workflow parser、mise parser、locale parser、storybook parser を helper 化し、最小 raw fixture で parser 自体の test を追加する

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

- [ ] P2 similarity 90.98%: global window listener hooks を bindWindowEvents contract へ寄せ切る
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/hooks/use-mouse-navigation.ts`, `src/hooks/use-updater.ts`, `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts`
  - 類似ペアが多く、window event registration / cleanup / stale callback のパターンが散っているため、1 箇所だけ cleanup throw や defaultPrevented handling が違う状態になりやすい
  - bindWindowEvents の allowed patterns、capture option、listener factory、cleanup error diagnostics を repo contract と focused tests へ追加する

- [ ] P2 similarity 90.27%: autofocus と auto-mark-read timer は共通化せず timer guard pattern だけ明文化する
  - 対象: `src/components/reader/use-tag-dialog-autofocus.ts`, `src/components/reader/hooks/article/use-article-auto-mark.ts`
  - 両者は ref + timer cleanup が似ているが、focus/select と article mutation は意味が違うため共通 hook 化すると abort/rollback semantics が曖昧になりやすい
  - timer ref cleanup、generation check、unmount no-op、StrictMode double effect の helper rule/test を作り、actual common abstraction は避ける判断を TODO に残す

- [ ] P2 similarity 90.42%: browser overlay close と sidebar smart view builder の structural false positive を guard する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`, `src/lib/sidebar/sidebar-smart-views.ts`
  - similarity は高いが lifecycle close action と static view model builder で責務が異なり、機械的共通化すると domain boundary が崩れる
  - similarity TODO では false positive として記録し、共通化しない理由、今後見るべき重複単位、必要なら rule/comment を追加する

- [ ] P2 similarity 90.27%: account sync statuses と subscription review candidates の map/filter pattern を hot path 優先で整理する
  - 対象: `src/hooks/use-account-sync-statuses.ts`, `src/lib/subscriptions/subscription-review-candidates.ts`
  - どちらも source list から view model を作る処理で、array chain と Map build の責務が似ているため、件数が増えると片方だけ最適化される drift が起きやすい
  - shared utility ではなく collection building guideline を作り、production hot path は single-pass化、test/helperは readability 優先に分類する

- [ ] P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する
  - 対象: `src/components/settings/account-detail/query-cache.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/hooks/use-updater.ts`
  - small cache updater が large hook と高類似判定されており、低トークン関数では AST shape だけの false positive が混ざる
  - similarity report を読む時の min-lines/min-tokens 閾値、cache helper は単独管理、large hook だけ調査対象にする rule を TODO/CLAUDE へ反映する

- [ ] P3 similarity 92.70%: markdown checkbox extractor の regex helper を統一する
  - 対象: `src/__tests__/config/repo-contracts.test.ts`
  - `extractMarkdownCheckboxLabels` と `extractIssueTemplateCheckboxLabels` がほぼ同じ regex extraction で、Issue template/TODO/PR template contract 追加時に parser variant が増えやすい
  - section extractor、checkbox label extractor、YAML-ish field extractor を test helper 化し、raw fixture で parser test を追加する

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
