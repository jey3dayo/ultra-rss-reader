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

- [ ] P1 feed/folder 一括既読を transaction 化して partial write を防ぐ
  - 対象: `src-tauri/src/commands/article_commands.rs`
  - `mark_feed_read` / `mark_folder_read` が既読化、unread count 再計算、pending mutation 追加を 1 transaction にしていないため、途中失敗で local state、remote sync queue、count がズレ得る
  - pending mutation insert failure を注入する Rust test を追加し、feed count と mutation queue まで同時 commit する helper へ寄せる

- [ ] P1 account/old-unread/starred bulk 操作の partial write を防ぐ
  - 対象: `src-tauri/src/commands/article_commands.rs`
  - `mark_rows_read` / `bulk_unstar_account_articles` が複数 update と pending mutation queue を非 transaction で実行するため、大量件数や制約エラー時に一部だけ永続化され得る
  - queue 保存失敗時に article state が戻ることを contract test 化し、bulk helper を transaction 受け取りに寄せる

- [ ] P1 star toggle の local state と pending mutation を同一 commit にする
  - 対象: `src-tauri/src/commands/article_commands.rs`
  - `toggle_article_star_with_conn` は article 更新後に pending mutation を追加するため、pending mutation だけ失敗すると remote に反映されない starred state が残る
  - blank/invalid remote id や pending table failure を注入し、`mark_article_read_with_conn` と同じく transaction 内 queue にする

- [ ] P1 manual full sync の並列設計と single DB mutex の噛み合わせを検証する
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/commands/mod.rs`
  - account sync は `join_all` で並列化される一方、DB は `Mutex<DbManager>` で直列化されるため、長い write 中に他 account や UI read が詰まりやすい
  - 複数 account sync 中に list/count command が返る時間を測り、並列度制限、DB operation queue、read path の busy/error policy を固定する

- [ ] P1 vacuum と sync 開始の race を database maintenance guard で整理する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/infra/db/connection.rs`
  - `vacuum_database` は開始時に `syncing` を読むだけで自分では sync guard を取らないため、直後に sync が始まると DB lock 待ちと UI 進捗が不自然になり得る
  - vacuum lock 中に sync 開始を競合させる test を追加し、vacuum 用 guard か sync 側の maintenance 検出を入れる

- [ ] P1 global shortcut が dialog/modal 中に背後の reader state を変えない contract を作る
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/app-shell.tsx`
  - `settingsOpen` / `confirmDialog.open` / `shortcutsHelpOpen` などを見ず capture の `keydown` を処理すると、設定や確認ダイアログ上で command palette や reader action が重なり得る
  - modal open 時に reader/global shortcut が無効化される test を追加し、許可する shortcut は dialog scoped のみにする

- [ ] P1 feed display 設定の optimistic rollback を latest-only にする
  - 対象: `src/hooks/use-update-feed-display-mode.ts`
  - 連続変更時に先行 request が後から失敗すると `previousFeedsQueries` を無条件に戻し、後続成功済みの reader/web preview mode を消せる
  - deferred promise で `A -> B fail` と `B -> C success` を逆順 settle させる test を追加し、feedId ごとの mutation generation か現在値比較 rollback にする

- [ ] P1 article read/star cache patch を out-of-order 成功に強くする
  - 対象: `src/hooks/use-articles.ts`
  - `setRead` / `toggleStar` は成功順に cache patch するため、star on が遅延して star off より後に成功すると `starredArticles` に古い状態を再挿入し得る
  - 同一 article の toggle 2 回を逆順 resolve する hook test を追加し、articleId ごとの latest mutation id か server revision で stale patch を捨てる

- [ ] P1 feed landing の optimistic restore を latest-only にする
  - 対象: `src/hooks/use-feed-landing.ts`
  - feed A の landing が `previousUiState` を保持した後に feed B が成功しても、A の fetch 失敗が後から来ると B の選択を巻き戻せる
  - A/B 並行 landing で A だけ後失敗させる test を追加し、landing request generation を store/hook に持って最新でない restore を無視する

- [ ] P1 add account setup sync 完了が古いユーザー意図を上書きしないようにする
  - 対象: `src/components/settings/add-account/account-config-form.tsx`, `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`
  - `runAccountSetupSync` 成功時に無条件で `selectAccount` / `selectSmartView` / `closeSettings` するため、sync 中にユーザーが別画面へ移動すると古い setup 完了が画面を奪える
  - setup sync を遅延させ、途中で settings navigation や account selection を変える test を追加し、owner/account/generation 一致時だけ final UI action を適用する

- [ ] P1 feed discovery / local provider redirect policy の cross-scheme downgrade を固定する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/local.rs`
  - initial URL が `https` でも redirect 先が `http` の場合にどこまで許すかが曖昧だと、feed discovery と actual fetch の security posture がズレる
  - https -> http、http -> https、public -> private、public -> localhost redirect の policy を discovery/provider 両方の Rust test で固定する

- [ ] P1 sanitizer で許可した media/source/link attribute の privacy policy を固定する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - sanitizer が `source` の `srcset` / `sizes` / `media` などを許可するため、将来 article body rendering が media を増やした時に remote request 面積が広がりやすい
  - reader body で実際に描画される tag/attribute と CSP/privacy doc を照合し、media tag を残す/落とす/手動検証へ分ける

- [ ] P1 release workflow の manual dispatch と tag push の concurrency collision を検証する
  - 対象: `.github/workflows/release.yml`
  - `concurrency` が release workflow 単位だと、tag push と manual dispatch が近いタイミングで走った時に片方が cancel され、draft release や artifact が中途半端に残る可能性がある
  - tag 名を含む concurrency group にするか manual dispatch を禁止するか決め、同一 tag の再実行/キャンセル時の cleanup 手順を release checklist に入れる

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

- [ ] P2 add feed discovery の throw/reject 時に discovering を戻す
  - 対象: `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - `discoverFeeds` が `Result.fail` ではなく throw/reject した場合、`discover-error` dispatch まで到達せず `discovering` が true のまま残る
  - rejected promise の test を追加し、`try/catch` で request id が最新なら error state へ落とす

- [ ] P2 provider article URL の credential / fragment / control char normalization を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-toolbar-view.tsx`
  - feed item の article URL は open/copy/browser preview に流れるため、`https://user:pass@host`、fragment token、control char をどこで落とすか未固定だと privacy と UI 表示が揺れる
  - normalizer、ArticleDtoSchema、open/copy action のどこで sanitize するか決め、credential-in-URL と invalid URL の fixture を追加する

- [ ] P2 feed discovery の response content-type / body size policy を固定する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/local.rs`
  - discovery と local provider fetch の content-type 許容、HTML parse、RSS parse、body size 上限がズレると、巨大 HTML や binary response で latency/memory が悪化しやすい
  - text/html、XML、binary、missing content-type、large body の response fixture で discovery/provider の expected behavior を固定する

- [ ] P2 Windows Rust test scope が integration_test だけになっている理由を固定する
  - 対象: `mise.toml`, `.github/workflows/ci.yml`
  - Windows の `test:rust` が `--test integration_test` のみに絞られており、unit tests が Windows 固有の path/keyring/OS 差を拾わない可能性がある
  - 絞り込み理由を明文化するか、Windows で走らせる safe Rust unit subset を作り、path/keyring/browser geometry 周辺だけでも gate へ入れる

- [ ] P2 actionlint の shellcheck 無効化を補う workflow shell gate を追加する
  - 対象: `mise.toml`, `.github/workflows/*.yml`
  - `actionlint -shellcheck=` で shellcheck integration を切っているため、workflow 内 shell script の引用や未定義変数の問題を拾いにくい
  - shellcheck を導入するか、workflow script を外部 script 化して lint するか決め、CI shell の最小 gate を追加する

- [ ] P2 release preflight が branch/tag source を検証してから artifact を作るようにする
  - 対象: `.github/workflows/release.yml`, `.codex/skills/release/SKILL.md`
  - manual `release_tag` と checkout ref の関係が曖昧だと、意図しない commit から正しい tag 名の artifact を作る運用事故が起き得る
  - tag object の target sha、workflow ref、package version を preflight で照合し、不一致なら tauri-action 前に失敗させる

- [ ] P3 schema_version を single-row contract に寄せる
  - 対象: `src-tauri/migrations/*.sql`, `src-tauri/src/infra/db/migration.rs`
  - 古い migration は `INSERT`、近い migration は `DELETE FROM schema_version` + insert で、helper は single row 前提のため、新規 migration 追加時に履歴/現行値の扱いが揺れやすい
  - migration 後 `schema_version` が 1 row だけで latest になる contract test を追加し、以後は `set_schema_version` 相当の書き方へ統一する

- [ ] P3 confirm dialog の confirm callback に in-flight/error 境界を追加する
  - 対象: `src/components/app-confirm-dialog.tsx`
  - `onConfirm` を呼んで即 close するだけなので、同期 throw なら close されず、async destructive action の in-flight 表示や二重実行 policy も共有されていない
  - throwing callback と double confirm の component test を追加し、共有 confirm に `confirming` guard を持たせるか callback は内部で例外を吸収する contract にする

- [ ] P3 auto mark read の同一 article 再自動既読 policy を固定する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`
  - `autoMarkedArticleIdRef` が同じ article id を抑止し続けるため、同一セッションで手動 unread に戻した記事は再表示しても自動既読にならない可能性がある
  - auto mark success 後に unread へ戻して再表示する hook test を追加し、再 auto mark する/しないの product policy を決める

- [ ] P3 browser overlay close 後の focus return 優先順位を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts`
  - 元の toolbar button 等を記憶していても、選択 article row があれば先にそこへ focus するため、キーボード操作では「閉じたら元の操作ボタンへ戻る」期待とズレやすい
  - open-in-browser button から overlay open/close した時の focus return test を追加し、article row 優先か previous target 優先かを明文化する

- [ ] P3 CI cache restore-key による stale dependency 復元リスクを検証する
  - 対象: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
  - pnpm store cache に restore-key があるため、lockfile 変更時も古い cache が復元される。通常は安全でも corrupted store や package manager mismatch 時の切り分けが難しい
  - cache miss/hit、pnpm version mismatch、lockfile update 時の behavior を確認し、release job だけ restore-key を外すか運用手順に残す

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

- [ ] P1 preference persist の out-of-order failure が最新設定の error toast を出さないようにする
  - 対象: `src/stores/preferences-store.ts`
  - preference 保存は latest request guard を持つが、key ごとの同時変更や normalize 後の value 比較が崩れると古い failure が最新 UI に error として出やすい
  - 同一 key 連続変更、別 key 同時変更、backend reject 後の UI retained state を store test で固定する

- [ ] P1 i18n language change failure の UI/DB state contract を固定する
  - 対象: `src/stores/preferences-store.ts`, `src/lib/ui/ui-language.ts`
  - language preference は DB 保存と `i18n.changeLanguage` が別境界で、changeLanguage reject 時に DB と表示言語のどちらを source of truth にするか曖昧
  - i18n runtime unavailable、unknown navigator language、DB save success + language change failure の fallback/rollback 方針を store test で固定する

- [ ] P1 native menu event payload の runtime validation を追加する
  - 対象: `src/hooks/use-menu-events.ts`, `src/lib/app-actions.ts`, `src-tauri/src/menu.rs`
  - Tauri menu event は外部 runtime 境界なので、unknown action や malformed payload を silent ignore するだけだと menu definition drift を検出しにくい
  - native menu action registry と frontend action guard を照合し、unknown action は diagnostics に残す contract test を追加する

- [ ] P1 Tauri event listener attach failure の user-visible degradation を整理する
  - 対象: `src/components/app-shell.tsx`, `src/lib/runtime/tauri-event-listeners.ts`, `src/hooks/use-menu-events.ts`
  - menu、browser webview、debug input などの listener attach が失敗した時の fallback が console warning 中心だと、packaged app だけでショートカットや menu が効かない原因が見えにくい
  - listener attach failure を一度だけ toast/diagnostics へ出すか、developer-only log に閉じるか決め、failure injection test を追加する

- [ ] P1 app badge count が unavailable platform で stale badge を残さない contract を作る
  - 対象: `src/hooks/use-badge.ts`, `src-tauri/capabilities/default.json`
  - badge command が unsupported/unavailable の時に best-effort で終わるため、preference off、account switch、sync count 0 の時に stale badge が残らない保証が薄い
  - unsupported platform、command reject、rapid count change、preference off の sequence test を追加し、最後に clear badge が試行されることを固定する

- [ ] P1 app icon theme switching の request queue と OS failure policy を固定する
  - 対象: `src/hooks/use-app-icon-theme.ts`, `src/stores/preferences-store.ts`
  - theme/matchMedia 変更に応じた app icon 更新は native command queue に依存するため、rapid change や command reject で古い icon が最後に適用されると視覚状態がズレる
  - light/dark/system の高速切替、OS command reject、unmount 中の request drain を hook test で固定する

- [ ] P1 window always-on-top preference と native command failure の rollback 方針を決める
  - 対象: `src/hooks/use-window-always-on-top.ts`, `src/stores/preferences-store.ts`
  - DB preference は true でも native window command が reject した場合、設定画面では有効に見えるが実際の window state は変わらない可能性がある
  - command unavailable/reject、preference load failure、rapid toggle の UI 表示・toast・rollback policy を test にする

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

- [ ] P1 account detail name save の stale account response を最新編集へ反映しない
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-name-editor.ts`
  - rename 中に別 account へ切り替わる、または再編集が始まると、古い rename 成功が `updateCachedAccount` と `finish-edit` を実行して現在画面に混ざる可能性がある
  - accountId/editSession を response 適用時にも確認し、account switch 中の delayed rename success/failure を hook test にする

- [ ] P1 account detail credentials test connection を latest account/draft だけへ適用する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`
  - `handleTestConnection` は save 後に `testAccountConnection(account.id)` を実行するため、account switch や draft 更新が挟まると古い connection result が toast/cache に反映され得る
  - accountId/draftRevision/request id を result 適用前に確認し、古い success/error は toast も cache update もしない contract test を追加する

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

- [ ] P2 generated mutation helper の invalidation failure policy を呼び出し元ごとに決める
  - 対象: `src/hooks/create-mutation.ts`, generated mutation users
  - `onSuccess` の invalidation が reject すると mutation が error state になるため、server mutation 自体は成功したのに UI が failure と扱う箇所が出る可能性がある
  - destructive/critical mutation は strict、UI refresh only は log-only などに分類し、代表 hook の invalidation reject test を追加する

- [ ] P2 generated query helper の blank id throw が error boundary に昇格しないようにする
  - 対象: `src/hooks/create-query.ts`, generated query users
  - `requireQueryId` は enabled 前提が崩れると throw するため、empty string や stale selected id が queryFn に入った時に view crash へつながる
  - blank id、whitespace id、id changed during render の contract test を追加し、disabled reason と user-facing fallback を揃える

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

- [ ] P2 browser webview request state reset と native event race を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-request-state.ts`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`
  - `browserUrl` change 時に fallback flag と sync state を即 reset するため、古い native `loaded/error/closed` event が後から来ると新しい request の state に混ざる可能性がある
  - URL/request id ごとの event filtering を追加するか、old event ignore policy を hook test で固定する

- [ ] P2 browser webview listener cleanup failure 後の duplicate event policy を固定する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`
  - cleanup が throw した listener は残存する可能性があり、再open後に duplicate event が来ると progress/state が二重更新され得る
  - cleanup failure injection、reopen overlay、duplicate loaded/closed event の idempotence test を追加する

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

- [ ] P1 add account の service switch 後 stale fields submit を防ぐ
  - 対象: `src/lib/account/add-account-form.ts`, `src/components/settings/add-account/account-config-form.tsx`
  - provider を FreshRSS -> Local に切り替えても `serverUrl` / `username` / `password` が reducer state に残るため、後続 provider 追加時や payload 拡張で非表示 field が混入しやすい
  - kind switch 時に hidden field を clear するか payload builder で必ず drop する方針を決め、provider switch、back switch、submit 中 switch の test を追加する

- [ ] P1 add account の test connection / submit response を provider snapshot で検証する
  - 対象: `src/components/settings/add-account/account-config-form.tsx`, `src/components/settings/hooks/use-add-account-form-controller.ts`
  - 接続確認や追加 submit 中に provider/name/serverUrl が変わると、古い success/error が現在の form state に toast や navigation として反映される可能性がある
  - request 開始時の provider snapshot と current state を比較し、stale response ignore / abort / latest-only のどれにするか component test で固定する

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

- [ ] P2 `bindWindowEvents` cleanup throw が React unmount を壊さないようにする
  - 対象: `src/lib/window/window-events.ts`, `src/components/settings/hooks/use-scroll-overflow-state.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`
  - cleanup 時の `removeEventListener` throw を再throw すると、unmount や effect cleanup が例外で止まり、後続 listener cleanup が不完全になる可能性がある
  - cleanup failure を aggregate/log-only にするか呼び出し元で握るか決め、multiple cleanup failure と partial cleanup の unit test を追加する

- [ ] P2 scroll overflow observer の high-frequency mutation / layout read 負荷を測る
  - 対象: `src/components/settings/hooks/use-scroll-overflow-state.ts`, `src/components/settings/settings-modal-view.tsx`
  - MutationObserver が subtree/attributes/characterData を広く監視し、そのたびに `scrollHeight/clientHeight` を読むため、settings の大きな form や transition 中に layout thrash が出やすい
  - large settings content、rapid input typing、ResizeObserver absent の計測を行い、debounce / content-only observe / explicit dependency 更新に分ける

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

- [ ] P2 preference typo suggestion の edit distance cost を large key set で固定する
  - 対象: `src/schemas/preferences.ts`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - preference key が増えるほど typo suggestion の edit distance 計算と候補選定が drift し、間違った key を推奨する可能性がある
  - similar shortcut key、debug key、selected account key、unknown long key の suggestion/no-suggestion contract を test にする

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

- [ ] P1 feed tree pointer drag が window 外 release で stuck しないようにする
  - 対象: `src/components/reader/hooks/feed-tree/use-feed-tree-drag.ts`, `src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts`
  - pointer capture を使わず window の `pointerup` / `pointercancel` に依存しているため、drag 中に pointer が別 window / WebView / OS 領域へ出ると `isPointerTracking` や drag overlay が残る可能性がある
  - pointer capture、blur/visibilitychange cleanup、Escape cleanup、unmount cleanup のどれを正にするか決め、outside-window release と lost pointer capture の component test を追加する

- [ ] P1 feed tree drag drop 中の async move 失敗時に visual hover / suppression を残さない
  - 対象: `src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts`, `src/components/reader/hooks/feed-tree/use-feed-tree-handle-click-suppression.ts`
  - drop outcome は async move を呼んだ後も click suppression と drag end の境界が分かれ、mutation reject 時に hover target や suppressed click が次操作へ残ると誤選択が起きやすい
  - move success、move reject、same target no-op、drop直後 click の順序を test 化し、visual cleanup と data rollback の責務を分ける

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

- [ ] P1 keyring force-delete fallback の stderr / exit status を diagnostics へ残す
  - 対象: `src-tauri/src/infra/keyring_store.rs`
  - macOS dev build の ACL mismatch 対策で `security delete-generic-password` を実行しているが、結果を捨てているため、force-delete 自体の失敗と second `set_password` failure の原因が切り分けにくい
  - security CLI missing、No such keychain item、permission denied、stderr with account id の redaction と diagnostics message を Rust test / manual verification にする

- [ ] P2 dev credentials store の cross-process write collision を防ぐ
  - 対象: `src-tauri/src/infra/keyring_store.rs`
  - dev credential store は process 内 Mutex と固定 temp path `.<file>.tmp` に依存しており、dev app と test/別 process が同時に書くと temp file rename が競合し得る
  - process id / random suffix temp path、file lock、atomic rename failure retry のどれを採るか決め、並行 write と stale temp file の Rust test を追加する

- [ ] P2 dev credentials JSON の size / key / value schema を固定する
  - 対象: `src-tauri/src/infra/keyring_store.rs`
  - dev credential store は `HashMap<String, String>` として読むため、巨大 JSON、blank account id、control char、長大 password が入った時の memory/diagnostics/上書き方針が未固定
  - max file size、max entries、blank key rejection、corrupted JSON preserve、oversized value error の contract test を追加する

- [ ] P2 sidebar expanded folders localStorage の raw size / corrupted payload cleanup を固定する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/schemas/storage.ts`, `src/constants/storage.ts`
  - schema は account/folder 数を絞るが、巨大 raw JSON や object depth が深い payload を parse する前の上限がないため、起動時 sidebar 初期化で UI thread を止めやすい
  - max raw bytes、parse failure cleanup、schema failure cleanup、quota exceeded write の behavior を unit test にする

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

- [ ] P2 browser webview load timeout と native loaded event の late arrival policy を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts`, `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - load timeout 後に native `loaded` が届いた場合、surface failure を残すのか復旧扱いにするのかが曖昧だと、低速 network で overlay state が揺れやすい
  - timeout -> late loaded、timeout -> error、retry open、close before timeout の state transition を hook test にする

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

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
