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

- [ ] reader hook error feedback 候補をまとめて見直す
  - `src/components/reader/hooks/article/use-article-status-actions.ts` の既読・スター操作失敗時に、toast と状態復帰の契約を追加する
  - `src/components/reader/hooks/feed-actions/use-old-unread-read-action.ts` の本実行 `markOldUnreadRead.mutate` 失敗時に、count 成功後の mutation error を通知できるか確認する
  - 自動既読系の error handling と揃え、UI copy 変更は最小限にする

- [ ] browser webview failure surface 候補を別バッチで見直す
  - `src/components/reader/hooks/browser/use-browser-webview-sync.ts` の bounds resize 失敗を、`console.error` だけで終わらせず surface issue / retry 導線へ乗せられるか検討する
  - `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` の listener 初期化失敗を拾い、bounds sync が silent に止まらない契約を追加する
  - `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` の timeout message は、URL 直出しを避けた localized surface message に寄せる

- [ ] similarity browser visibility lifecycle helper 候補を追加する
  - `similarity-ts src/` で 93% 類似になった `use-browser-webview-sync` / `use-sidebar-visibility-fallback` / `use-browser-overlay-focus-return` の visibility / focus listener pattern を棚卸しする
  - 共通化する場合は listener registration / cleanup / hidden state guard だけを helper 化し、WebView bounds や sidebar fallback の business rule は各 hook に残す
  - browser webview failure surface とは分け、visibility lifecycle boilerplate の重複整理だけを扱う

- [ ] similarity browser lifecycle small hook false-positive review 候補を追加する
  - `use-browser-webview-bounds-sync` / `use-browser-webview-load-timeout` / `use-browser-webview-request-state` / `use-browser-overlay-shortcuts` / `use-mouse-navigation` が 90% 前後で類似検出された理由を確認する
  - hook skeleton だけの類似なら共通化せず、timeout / request / shortcut / mouse navigation の責務差分を保つ判断を TODO コメントか test で固定する
  - browser visibility lifecycle helper とは分け、small lifecycle hook の共通化可否判断だけを扱う

- [ ] similarity updater/sidebar lifecycle false-positive review 候補を追加する
  - `use-sidebar-account-selection` と `use-updater`、`use-browser-webview-bounds-sync` と `use-updater` が 91-92% 類似なので、effect cleanup / status polling skeleton だけの一致か確認する
  - 共通化する場合は interval/listener cleanup helper だけに限定し、updater check flow と account selection side effect は分けたままにする
  - updater hook state effects とは分け、lifecycle boilerplate の共通化可否判断だけを扱う

- [ ] command palette feed landing failure 候補を小粒で直す
  - `src/hooks/use-feed-landing.ts` の feed 未選択・feed 不在・landing fetch 失敗を、呼び出し元で扱える result として返せるか確認する
  - `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts` の feed / dev scenario 失敗 toast を i18n key 化する
  - command palette の resource selection 成功経路とは混ぜず、失敗 feedback の契約に限定する

- [ ] article tag picker keyboard contract 候補を追加する
  - `src/components/reader/hooks/article/use-article-tag-picker-popover.ts` の listbox 操作に `Home` / `End` を追加できるか確認する
  - 既存の `Escape` / 上下矢印 / selected option contract と同じ hook test で固定する
  - tag 作成・割当の mutation contract とは別バッチにする

- [ ] settings navigation disabled contract 候補を追加する
  - `src/__tests__/components/settings-nav-view.test.tsx` に、`SettingsNavView` disabled 時にカテゴリ選択が発火しない契約を追加する
  - `src/__tests__/components/accounts-nav-view.test.tsx` に、`AccountsNavView` disabled 時に account selection / add account が発火しない契約を追加する
  - add-account verification pending 中の navigation lock と同じ意味になるよう、container 側の挙動変更は避ける

- [ ] account detail sync status row 候補を専用 test で固定する
  - `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` の次回リトライ・連続失敗・最終エラーの行生成順を確認する
  - 日時 fallback と locale formatting は user-facing copy ではなく status row contract として固定する
  - account detail view 本体の広い integration test とは分ける

- [ ] subscriptions index pane 単体 contract 候補を追加する
  - `src/components/subscriptions-index/subscription-detail-pane.tsx` の decision bar / management bar の出し分けと click delegation を isolated に押さえる
  - `src/components/subscriptions-index/subscriptions-list-pane.tsx` の `onListScrollTopChange` callback を、スクロール位置保存の委譲 contract として固定する
  - `src/components/subscriptions-index/subscriptions-overview-summary.tsx` の `renderValue` prop が card structure を壊さないことを追加する

- [ ] shared feed detail link label 候補を整理する
  - `src/components/shared/feed-detail-panel.tsx` の `FeedDetailLink.label` が表示に使われず `href` 表示になっているため、label 表示へ寄せるか型から外すかを決める
  - subscriptions detail / feed detail の既存表示差分を見てから、copy 変更と型削除を同じバッチに混ぜない

- [ ] Rust feed command display settings contract 候補を追加する
  - `src-tauri/src/commands/feed_commands.rs` の `update_feed_display_settings` で `inherit` / `on` / `off` 保存を command 経由で固定する
  - 未知値は user-visible error になることを確認し、frontend fallback copy とは混ぜない

- [ ] Rust tag command validation contract 候補を追加する
  - `src-tauri/src/commands/tag_commands.rs` の `create_tag` で name trim、50文字制限、color lowercase 正規化を command 経由で固定する
  - `list_articles_by_tag` の未知 `mode` が user-visible error になる経路も小粒 test として追加する

- [ ] Rust article bulk input validation 候補を追加する
  - `src-tauri/src/commands/article_commands.rs` の `OldUnreadScope::parse` と `validate_older_than_days` の不正値エラーを直接固定する
  - mark-all-read / old-unread-read の UI confirm flow とは別に、command input contract だけを扱う

- [ ] Rust repository cursor round-trip 候補を追加する
  - `src-tauri/src/infra/db/sqlite_sync_state.rs` の `last_modified` と `etag` 同時保存・読込を migration 適用済み DB fixture で固定する
  - local feed cursor の保存契約に限定し、scheduler backoff や account sync status とは混ぜない

- [ ] provider HTTP / label normalization 候補を追加する
  - `src-tauri/src/infra/provider/local.rs` の `create_subscription` が `User-Agent` を送ることを `pull_entries` と同じ HTTP contract として固定する
  - `src-tauri/src/infra/provider/greader.rs` の label remote id 正規化で、label 欠落時 percent decode と label 優先分岐を追加検証する
  - 外部サービス互換の実通信検証ではなく、provider adapter の unit contract に限定する

- [ ] Debug HUD locale / accessibility copy 候補を追加する
  - `src/components/debug/focus-debug-hud-view.tsx` の見出し、aria-label、`Show` / `Hide` / `No trace yet` を dev-only English として contract 化するか locale 化する
  - `src/components/settings/hooks/use-debug-settings-view-props.ts` の `Open: Open web preview geometry check` のような重複 accessible name を、短い専用 aria copy に分ける
  - Debug HUD の visual layout や geometry diagnostics 追加とは混ぜない

- [ ] Debug settings URL / platform fallback 候補を小粒で直す
  - `src/components/settings/debug-settings.tsx` の Web Preview URL 入力で、空文字だけでなく URL 不正時の localized toast を追加する
  - platform info 取得失敗時に credentials backend が既定値由来で OS keyring 表示になり得るため、`loadError` 用の debug copy を追加する
  - dev-only 設定画面の copy 変更に限定し、runtime platform store の contract 変更とは分ける

- [ ] locale source-of-truth / leaf sanity 候補を追加する
  - `src/lib/i18n.ts` の `supportedLanguages` と `src/lib/ui/ui-language.ts` の `UiLanguagePreference` が drift しない contract を追加する
  - `src/__tests__/lib/locale-placeholders.test.ts` に、空文字・空配列・未展開 key 文字列の混入を拾う locale leaf sanity test を追加する
  - settings copy polish は同じ検証基盤が入った後の別バッチにする

- [ ] API numeric schema contract 候補を追加する
  - `src/api/schemas/account.ts` の `sync_interval_secs` / `keep_read_items_days` を、command args 側と同じく整数・範囲 contract に寄せる
  - `src/api/schemas/folder.ts` の `sort_order` を folder DTO の順序値として整数 contract にする
  - Rust DTO 変更ではなく frontend runtime schema の境界値 test に限定する

- [ ] API bulk / count response schema 候補を追加する
  - `src/api/schemas/common.ts` の `IntResponseSchema` から、count 系と `clearArticleViewHistory` 向けの nonnegative int response を分けられるか確認する
  - `src/api/schemas/commands.ts` の `markArticlesReadArgs.articleIds` が空配列を許すため、frontend API 境界で no-op bulk mutation を弾く contract を追加する
  - backend command validation や UI confirm flow とは別に、schema parser の契約だけを扱う

- [ ] account sync status query key drift 候補を追加する
  - `src/hooks/use-account-sync-statuses.ts` の query key を `accountSyncStatusQueryKey` と共有し、status invalidation と drift しないようにする
  - account detail sync section の row 表示や sidebar feedback copy とは混ぜない

- [ ] article search whitespace query 候補を追加する
  - `src/hooks/use-articles.ts` の `useSearchArticles` が whitespace-only query でも有効になるため、trim 後 empty を disable する query contract を追加する
  - search input UI の copy や debouncing 変更は別バッチにする

- [ ] updater progress runtime guard 候補を追加する
  - `src/hooks/use-updater.ts` の `update-download-progress` payload を型注釈だけで信頼せず、schema / guard で malformed progress を無視する
  - updater UI copy や release artifact 検証とは混ぜず、runtime event payload の contract に限定する

- [ ] Tauri dev Vite port contract 候補を追加する
  - `scripts/tauri-dev-vite-manager.ts` で `TAURI_DEV_PORT` 指定時、既存プロセス確認だけでなく Vite 起動ポートも同じ値になる contract を追加する
  - `src/__tests__/scripts/tauri-dev-vite-manager.test.ts` に静的な env / args 検証として足す

- [ ] Tauri CLI config argument cleanup 候補を追加する
  - `scripts/tauri-cli-dispatch.ts` で `--config=src-tauri/tauri.dev.conf.json` 形式でも stale macOS dev bundle cleanup が発火するよう固定する
  - Windows dispatch や Vite process 管理とは混ぜず、config argument parsing だけを扱う

- [ ] Storybook E2E port / registry drift 候補を追加する
  - `playwright.storybook.config.ts` の `webServer.command` と `baseURL` の port / host が drift しない静的 contract を追加する
  - `e2e/storybook/ui-reference-canvas-smoke.spec.ts` の iframe URL 手書きリストを、story registry 由来で検証できるようにする
  - visual regression や screenshot 更新は同じバッチに混ぜない

- [ ] test helper fixture parity 候補を追加する
  - `tests/helpers/render-story.tsx` で `parameters` / `globals` を Storybook decorator context に渡す contract を追加する
  - `tests/helpers/fixtures.test.ts` で `sampleMuteKeywords` も `MuteKeywordDtoSchema` parse 対象にし、他 DTO fixture と同じ schema parity に揃える
  - fixture 表示 copy や mock response の追加は別バッチにする

- [ ] repo docs / labeler contract 候補を追加する
  - `src/__tests__/config/repo-contracts.test.ts` に、`CLAUDE.md` と `.claude/rules/README.md` 配下の相対リンクも markdown link contract 対象として追加する
  - `.github/labeler.yml` で `scripts/**` と `mise.toml` 変更に `ci` か maintenance 系ラベルが付く contract を追加する
  - workflow 実行条件や issue template 文面の変更とは別に、repo metadata の drift 防止だけを扱う

- [ ] sync scheduler abnormal state contract 候補を追加する
  - `src-tauri/src/service/sync_scheduler.rs` の `error_count` が負値・異常値になった時の backoff clamp を固定する
  - scheduler の account load / DB lock 失敗を silent `continue` で捨てず、warning として観測できるようにする
  - UI sync feedback や account status row の copy 変更とは混ぜない

- [ ] account command creation validation 候補を追加する
  - `src-tauri/src/commands/account_commands.rs` の `add_account` に account name trim / empty / duplicate validation を追加する
  - `test_account_connection` で FreshRSS の `server_url` 欠落を明示エラーにし、空文字から認証へ進まない contract を固定する
  - keyring 保存や provider login flow の再設計とは別に、command input validation だけを扱う

- [ ] GReader compatibility parsing 候補を追加する
  - `src-tauri/src/infra/provider/greader.rs` で subscription JSON の `categories` / `htmlUrl` 欠落許容 contract を追加する
  - item category の read / star 判定を `contains` ではなく exact state id contract に寄せる
  - 実サービス通信ではなく provider adapter fixture test に限定する

- [ ] local provider site URL fallback 候補を追加する
  - `src-tauri/src/infra/provider/local.rs` の `create_subscription` で `site_url` 欠落時 fallback を feed URL に寄せる
  - 追加直後の link / open 系挙動が空文字に依存しないことを provider unit test で固定する

- [ ] updater menu availability contract 候補を追加する
  - `src-tauri/src/menu.rs` の `Check for Updates` menu 表示方針を updater 初期化可否と分けて固定する
  - updater command 側の runtime error 表示や release artifact 検証とは混ぜない

- [ ] command palette resource recents 候補を追加する
  - `src/components/reader/hooks/command-palette/use-command-palette-data.ts` で feed / tag / article resource recent を表示に戻す contract を追加する
  - `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts` で article 検索結果選択時に tag / starred / recent 文脈を維持するかを固定する
  - command palette の広い action taxonomy 変更とは混ぜない

- [ ] command palette resource display polish 候補を追加する
  - `src/components/reader/command-palette-resource-groups.tsx` で feed / tag / article 結果の同名判別用に URL や feed 名などの補助表示を検討する
  - `Dev Scenarios` 見出しの直書きを command palette heading key に寄せる
  - search ranking や resource grouping の再設計とは別に、表示 contract だけを扱う

- [ ] article list loading a11y contract 候補を追加する
  - `src/components/reader/article-list-screen-view.tsx` の loading 表示に `role="status"` / `aria-live` を追加する
  - sidebar skeleton と同じ最小 a11y contract として固定し、loading UI の visual 変更は含めない

- [ ] sidebar sync failure invalidation 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-sync.ts` で manual sync error 時にも account sync status を invalidate する
  - sync result toast や scheduler retry copy とは分け、失敗後の sidebar 表示更新契約に限定する

- [ ] tag section empty/open state 候補を追加する
  - `src/components/reader/tag-list-view.tsx` で tag 0 件でも section open state と empty state の意味が混ざらないようにする
  - tag settings / article tag picker mutation とは別に、reader sidebar tag section の UI contract だけを扱う

- [ ] package manager / E2E port drift 候補を追加する
  - `package.json` の `packageManager` と `mise.toml` の `npm:pnpm` version が drift しない静的 contract を追加する
  - `playwright.config.ts` の `webServer.command` / `baseURL` / Vite port を package script と合わせて固定する
  - Storybook E2E port contract とは別に、app E2E の起動 contract として扱う

- [ ] CI quality gate / labeler test coverage 候補を追加する
  - `.github/workflows/ci.yml` の `quality-gate.needs` が全チェック job を含むことを repo contract test で固定する
  - `.github/labeler.yml` で `tests/**` / `e2e/**` / `playwright*.config.ts` に test 系ラベルが付く contract を追加する
  - workflow job 追加や label taxonomy 変更とは分け、drift 防止に限定する

- [ ] seed dev DB cleanup contract 候補を追加する
  - `scripts/seed-dev-db-from-prod.ts` で staging copy 後の途中失敗時に `.staging` が残らない cleanup contract を追加する
  - production credential や seed UX 変更は扱わず、script failure cleanup の test に限定する

- [ ] E2E runtime error guard 候補を追加する
  - `e2e/app.spec.ts` に Storybook smoke と同様の `pageerror` guard を追加する
  - 表示 assertion だけでは見逃す runtime error を拾う smoke contract として扱い、E2E scenario 追加とは混ぜない

- [ ] OPML import account / folder contract 候補を追加する
  - `src-tauri/src/commands/opml_commands.rs` の `import_opml` で `account_id` 存在確認を先に行い、DB 制約エラーではなく user-visible error にする
  - OPML import の folder cache が exact-name match のため、`create_folder` と同じ case-insensitive 契約に寄せて重複 folder を防ぐ
  - feed save や OPML UI copy とは混ぜず、import command の入力・folder 解決 contract に限定する

- [ ] OPML parser attribute error contract 候補を追加する
  - `src-tauri/src/infra/opml.rs` の `parse_outline_attrs` が `flatten()` で malformed attribute を silent drop しないようにする
  - 壊れた OPML attribute は明示的な parse error として返す fixture を追加する
  - outline tree の仕様拡張や export 形式変更とは別に、parser error surface だけを扱う

- [ ] feed discovery HTML attribute / dedupe 候補を追加する
  - `src-tauri/src/infra/feed_discovery.rs` の `extract_attribute` が `href = "..."` のような `=` 前後 whitespace 付き attribute を拾える contract を追加する
  - 同じ URL の `<link rel="alternate">` が複数ある場合は、入力順を保った URL dedupe を追加する
  - network fetch や scoring 変更ではなく、HTML parse fixture の小粒改善に限定する

- [ ] migration V16 drift contract 候補を追加する
  - `src-tauri/migrations/V16__account_connection_verification.sql` と `src-tauri/src/infra/db/migration.rs` の inline migration が drift しない contract を追加する
  - SQL 内容の再設計ではなく、file-based migration と inline 実行の同期検証だけを扱う

- [ ] database command busy / restore contract 候補を追加する
  - `src-tauri/src/commands/database_commands.rs` の `get_database_info` で busy / lock 時の command-level error contract を `vacuum_database_inner` と揃える
  - `src-tauri/src/infra/db/connection.rs` の `restore_file_connections_after_vacuum` で VACUUM 失敗後も DB が read/write 可能なことを固定する
  - DB metadata 表示や backup UI とは混ぜず、database command recovery の test に限定する

- [ ] add feed async race / submit guard 候補を追加する
  - `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts` と `src/components/reader/add-feed-dialog-state.ts` に feed discovery request token を追加する
  - URL 変更後に古い discovery response が state を上書きしないことを固定する
  - add feed submit に in-flight guard を追加し、click / Enter 連打で `addLocalFeed` が二重実行されない contract を追加する

- [ ] add account URL validation / locale copy 候補を追加する
  - `src/components/settings/add-account/account-config-form.tsx` と `src/lib/account/add-account-form.ts` で FreshRSS `serverUrl` を空文字だけでなく URL 形式まで validation する
  - add account validation message の英語直書きを settings locale key 経由に寄せる
  - provider login flow や credentials 保存方式は触らず、form validation / copy 境界に限定する

- [ ] account detail edit validation 候補を追加する
  - `src/components/settings/hooks/account-detail/use-account-detail-name-editor.ts` で Escape cancel 後の blur commit が draft を保存しない state transition を固定する
  - `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts` で credentials 保存・接続テスト前に server URL 形式 validation を追加する
  - account detail section layout や sync status 表示とは混ぜず、editor hook の contract に限定する

- [ ] rename feed validation / nested escape 候補を追加する
  - `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-controller.ts` で空 title submit 時に dialog を閉じず validation error を出す
  - `src/components/subscriptions-index/subscriptions-index-page.tsx` で rename / delete nested dialog の Escape が workspace close listener に伝播しないことを固定する
  - subscriptions decision flow とは分け、dialog state machine の小粒 contract として扱う

- [ ] release workflow manual dispatch / preflight 候補を追加する
  - `.github/workflows/release.yml` の `workflow_dispatch` が tag ref 以外で no-op にならないよう、manual run 条件を repo contract test で固定する
  - release job が `tauri-action` 前に `mise run ci` 相当の preflight を通す contract を追加する
  - release notes 生成や artifact naming 変更とは別に、workflow gate の drift 防止だけを扱う

- [ ] updater stale pending / runtime unavailable 候補を追加する
  - `src-tauri/src/commands/updater_commands.rs` の `check_for_update` 失敗時に cached `PendingUpdate` が残らないことを固定する
  - `src/hooks/use-updater.ts` で Tauri updater unavailable な browser-only / dev preview 実行を silent skip できるようにする
  - updater UI copy や release artifact 検証とは混ぜず、runtime state guard に限定する

- [ ] release install / manual verification contract 候補を追加する
  - `docs/release-manual-verification.md` に release asset digest、codesign、Gatekeeper 結果の記録欄を追加する
  - `mise.toml` / `README.md` / package script contract で published release install と local `app:install` の違いを明示する
  - local build の resign 手順を published artifact install と混同しないための docs / script contract に限定する

- [ ] Tauri dev Vite check / port validation 候補を追加する
  - `scripts/tauri-dev-vite-manager.ts` の `--check` が既存 Vite を停止せず成功確認だけ行う contract に分ける
  - `TAURI_DEV_PORT` は blank / fractional / zero / negative を拒否し、Vite 起動ポートと既存プロセス確認が同じ値を見ることを固定する
  - Tauri CLI dispatch や app E2E scenario とは混ぜず、dev server manager の static test に限定する

- [ ] article list search close stale query 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-search.ts` で検索 UI を閉じた時に `debouncedQuery` も即時 clear する
  - `showSearch` が false の間は `useSearchArticles` に古い query が残らない contract を追加する
  - whitespace-only query disable とは別に、検索 close 後の stale query / cache だけを扱う

- [ ] article star toggle mode-aware cache 候補を追加する
  - `src/hooks/use-articles.ts` の star toggle cache patch で `accountArticles` query key の `mode` を見て挿入条件を分ける
  - read 済み記事を一時的に `unread` cache へ `insertIfMissing` しない contract を追加する
  - query wrapper 全体の整理ではなく、`useToggleStar` の optimistic cache 更新だけに限定する

- [ ] reader data selector escaping 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-navigation.ts` の `data-article-id` selector に ID を直接埋め込まないようにする
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-navigation.ts` の `data-feed-id` selector も同じ helper か DOM 走査に寄せる
  - reader focus 復帰の広い責務整理とは分け、quote などを含む ID で selector が壊れない contract に限定する

- [ ] article list primary loading naming 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-sources.ts` の primary source loading を `isLoadingAccountArticles` に詰め替えない形へ整理する
  - `src/components/reader/hooks/article-list/use-article-list-view-state.ts` で folder / recent loading の意味が型名から分かる contract にする
  - article scope matrix の再設計ではなく、loading state の命名・伝搬だけを扱う

- [ ] tag deletion selection fallback 候補を追加する
  - `src/components/reader/tag-context-menu.tsx` と `src/hooks/use-tags.ts` で現在選択中の tag 削除後に reader selection を fallback する
  - `selection.type === "tag"` かつ削除対象 ID の時だけ `selectAll` か smart unread へ戻す contract を追加する
  - tag section empty/open UI とは分け、削除済み selection が残らない状態整合性だけを扱う

- [ ] article auto mark retained rollback 候補を追加する
  - `src/components/reader/hooks/article/use-article-auto-mark.ts` で auto mark read 失敗時の retained article state を rollback するか現仕様を test で固定する
  - toast 表示だけで未読 view に retained 状態が残らない contract を追加する
  - 手動既読・スター操作の error feedback とは分け、auto mark timer 経路だけを扱う

- [ ] sync provider post-write failure contract 候補を追加する
  - `src-tauri/src/commands/sync_providers.rs` で `mark_muted_unread_as_read` / `recalculate_unread_count` の失敗を `let _ =` で捨てない
  - local feed sync の post-write 整合性として warning 化または hard error 化する contract test を追加する
  - scheduler retry や sidebar invalidation ではなく、provider sync 内部の count / mute 整合性だけを扱う

- [ ] GReader pending mutation DB error contract 候補を追加する
  - `src-tauri/src/commands/sync_providers.rs` の `pending_mutation_targets_provider_managed_greader_feed` で DB error と対象なしを分離する
  - `QueryReturnedNoRows` 以外の error では pending mutation を削除しない contract を追加する
  - provider parsing 互換性ではなく、pending mutation 削除判定の DB error handling に限定する

- [ ] add local feed unread count failure 候補を追加する
  - `src-tauri/src/commands/feed_commands.rs` の `add_local_feed` 後 unread count 再計算失敗を `.unwrap_or(0)` で成功扱いにしない
  - 再計算失敗を command error にするか、保存済み feed の count を再読込する contract を追加する
  - frontend add-feed race とは分け、backend command の永続化後 count contract だけを扱う

- [ ] tag article list limit guard 候補を追加する
  - `src-tauri/src/commands/tag_commands.rs` の `list_articles_by_tag` で極端な `limit` を clamp または reject する
  - tag article list の pagination resource guard として境界値 test を追加する
  - tag name / color validation や unknown mode error とは別に、limit 上限だけを扱う

- [ ] dev credentials env truthy parsing 候補を追加する
  - `src-tauri/src/platform/mod.rs` の `DEV_CREDENTIALS` を env 存在だけで有効化せず truthy 値だけ許可する
  - `1` / `true` と `0` / `false` / blank の contract を追加する
  - platform abstraction 全体ではなく、dev credential env semantics の一点修正に限定する

- [ ] dev keyring file permission contract 候補を追加する
  - `src-tauri/src/infra/keyring_store.rs` の dev credential store で `set_permissions(0600)` 失敗を無視しない
  - Unix permission 設定失敗を `DomainError::Keychain` または warning として観測できる contract を追加する
  - native keyring 保存・復元の広い検証ではなく、dev store file permission hardening だけを扱う

- [ ] Storybook update toast runtime guard 候補を追加する
  - `e2e/storybook/update-toast.spec.ts` の `openShellOverlayStory` に `pageerror` 収集と Storybook error 表示検出を追加する
  - toast の表示・寸法 assertion だけでは見逃す runtime error を smoke contract として拾う
  - app E2E runtime guard や Storybook registry drift とは別に、update toast 専用 smoke を扱う

- [ ] Tauri mock unhandled command strictness 候補を追加する
  - `tests/helpers/tauri-mocks.ts` で未対応 command が `undefined` を返さず、明示的に `Unhandled Tauri mock command` として失敗するようにする
  - 必要なら opt-out 付き strict mode にし、mock 追加漏れを後段の曖昧な failure にしない
  - argument coercion strictness とは別に、未mock command 検出契約だけを扱う

- [ ] CI pnpm store cache 候補を追加する
  - `.github/workflows/ci.yml` の各 job に release workflow と同じ `pnpm store path` / `actions/cache` パターンを追加できるか確認する
  - `pnpm install --frozen-lockfile` の重複 install cost を下げる runtime improvement として扱う
  - quality gate needs や labeler taxonomy 変更とは混ぜない

- [ ] docs reader article scope matrix index 候補を追加する
  - `docs/README.md` の Operational Docs に `docs/reader-article-scope-matrix.md` を追加する
  - `CLAUDE.md` が source of truth として参照する文書を docs index から辿れるようにする
  - markdown link contract や docs 全体再編とは分け、案内漏れの 1 行追加に限定する

- [ ] destructive confirm pending close guard 候補を追加する
  - `src/components/shared/destructive-confirm-dialog-view.tsx` で `pending` 中の Escape / outside click close を抑止する
  - `pending && !open` の `onOpenChange` を無視する wrapper を追加し、既存 view test で固定する
  - subscriptions nested Escape 伝播とは別に、shared destructive dialog の pending close 経路だけを扱う

- [ ] unsubscribe dialog pending guard 候補を追加する
  - `src/components/reader/unsubscribe-feed-dialog.tsx` と view に `pending` prop を通し、削除確定の連打を止める
  - `src/components/subscriptions-index/subscriptions-index-page.tsx` と feed context menu から mutation pending を渡す
  - subscriptions pane 表示 contract とは分け、delete mutation 中の confirm UI guard に限定する

- [ ] shortcut recording Alt key contract 候補を追加する
  - `src/components/settings/shortcuts-settings.tsx` の recorded key event に `altKey` を含める
  - `Alt+K` が plain `k` として保存されないよう、Alt 系を無視するか表示形式に含める契約を test 化する
  - shortcut 表示 copy や native menu shortcut 同期とは混ぜない

- [ ] account detail sync controls race guard 候補を追加する
  - `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts` の sync interval / startup / wake / retention 更新に revision guard を追加する
  - 連続変更時に古い response が後勝ちで cache 更新しない hook contract を追加する
  - account detail name / credentials editor validation とは分け、sync controls の更新 race だけを扱う

- [ ] settings tag / mute input submit 候補を追加する
  - `src/components/settings/tags-settings-view.tsx` の tag 追加行を form 化し、入力中 Enter で追加できるようにする
  - `src/components/settings/mute-settings-view.tsx` の mute keyword 追加行も同じ submit contract に揃える
  - reader tag section や mute reducer とは分け、settings 入力行の submit / disabled contract だけを扱う

- [ ] settings nav id narrowing 候補を追加する
  - `src/components/settings/settings-nav.types.ts` の `SettingsNavItemId = string` を、modal category nav と reusable specimen の境界に合わせて narrow する
  - `SettingsNavViewProps<T extends string>` か modal 側 `SettingsCategory` へ寄せる型 contract を検討する
  - navigation disabled click contract とは別に、nav item id の型境界だけを扱う

- [ ] browser embed support URL validation 候補を追加する
  - `src-tauri/src/commands/article_commands.rs` の `check_browser_embed_support` で `parse_browser_http_url` を通す
  - `open_in_browser` / browser webview と同じ非 http(s) URL error contract を unit test で固定する
  - browser webview bounds / timeout surface とは分け、embed support command の URL validation だけを扱う

- [ ] mailto share command boundary 候補を追加する
  - `src/components/reader/article-share-menu.tsx` の mail share が http(s) 専用 `open_in_browser` に `mailto:` を渡さないようにする
  - `open_external_url` か share email 専用 command / schema を分け、既存 share menu test を成功契約へ更新する
  - clipboard share や browser open behavior の再設計とは分け、mailto share の command 境界だけを扱う

- [ ] release log cleanup observability 候補を追加する
  - `src-tauri/src/lib.rs` の release log cleanup で `read_dir` / `metadata` / `remove_file` 失敗を完全に silent drop しない
  - cleanup は継続しつつ、失敗ファイルと理由を `tracing::warn!` か `debug!` で観測できるようにする
  - log directory open や release verification とは分け、rotation cleanup の観測性だけを扱う

- [ ] startup preferences read warning 候補を追加する
  - `src-tauri/src/lib.rs` の起動時 preference 読み込みで `unwrap_or_default()` による DB read error の握りつぶしをやめる
  - 起動継続方針は維持しつつ、失敗時は warn 付き default にして menu state / diagnostics の初期化理由を残す
  - DB busy recovery や scheduler warning とは別に、app setup preference read の一点修正に限定する

- [ ] article sanitizer responsive media contract 候補を追加する
  - `src-tauri/src/infra/sanitizer.rs` で `picture` / `source` / `img` と responsive image attributes の保持方針を fixture test で固定する
  - 必要なら安全に保存できる属性だけを追加し、広い sanitizer 再設計はしない
  - feed discovery parser ではなく、記事本文 sanitizer の media preserve contract として扱う

- [ ] add feed command schema URL trim 候補を追加する
  - `src/api/schemas/commands.ts` の `discoverFeedsArgs` / `addLocalFeedArgs` で blank / whitespace-only URL を弾く
  - `trim().min(1)` 相当の schema contract を `src/__tests__/api/schemas.test.ts` に追加する
  - add feed async race や backend count contract とは分け、frontend IPC schema の入力境界だけを扱う

- [ ] dev intent scenario id coverage 候補を追加する
  - `src/__tests__/dev/intent.test.ts` の `parseDevIntent` 既知 ID test を手書き列挙から `DEV_SCENARIO_IDS` loop に寄せる
  - `DEV_SCENARIO_ID.syncAllSmoke` など新規 ID が個別 assertion から漏れない contract にする
  - dev scenario runtime error surface とは分け、intent parser の ID coverage だけを扱う

- [ ] Storybook UI reference pageerror retry hygiene 候補を追加する
  - `e2e/storybook/ui-reference-canvas-smoke.spec.ts` の `pageErrors` を `toPass()` retry 間で持ち越さない
  - 各 `page.goto` 前に error buffer を clear するか、retry 外/内の責務を分けて flaky failure を防ぐ
  - update toast runtime guard とは別に、UI reference smoke matrix の retry hygiene だけを扱う

- [ ] sidebar expanded folder storage dedupe 候補を追加する
  - `src/schemas/storage.ts` の `StoredSidebarExpandedFoldersSchema` で同一 account 内の duplicate folder id を order-preserving dedupe する
  - 非 string filter 後の重複ケースを `src/__tests__/schemas/storage.test.ts` に追加する
  - startup folder expansion UI ではなく、localStorage 復元 schema の正規化だけを扱う

- [ ] keyboard open settings input guard 候補を追加する
  - `src/lib/keyboard/keyboard-shortcuts.ts` で `open_settings` の単キー remap が入力欄フォーカス中に発火しない contract を追加する
  - 既定の `Cmd+,` は入力中でも許可しつつ、単キー custom shortcut は `ignored_input` にする
  - shortcut recording Alt key contract とは分け、実行時 resolver の text input guard だけを扱う

- [ ] app icon theme matchMedia guard 候補を追加する
  - `src/hooks/use-app-icon-theme.ts` で `theme === "system"` の時も `window.matchMedia` の存在を guard する
  - preview / test / 特殊 WebView で `matchMedia` 不在でも fallback できる hook contract を追加する
  - updater runtime unavailable とは別に、app icon theme hook の browser API guard に限定する

- [ ] feed context menu open site failure toast 候補を追加する
  - `src/components/reader/feed-context-menu.tsx` の open site 失敗を `console.error` だけで終わらせない
  - article browser action 側と同じく user-visible toast を出し、failure case の component test を追加する
  - 既読・スター mutation error feedback とは分け、外部ブラウザ起動失敗だけを扱う

- [ ] smart view clear history confirm 候補を追加する
  - `src/components/reader/smart-view-context-menu.tsx` の `Recently viewed` / `Clear history` を即 mutate ではなく confirm 経由にする
  - `Unstar all` と同じ destructive action contract として view / handler test を更新する
  - shared confirm dialog pending guard とは分け、recent history clear の確認有無だけを扱う

- [ ] subscriptions section empty folder actions 候補を追加する
  - `src/components/reader/subscriptions-section-context-menu.tsx` で folder 0 件時の expand / collapse all を no-op 表示にしない
  - `src/components/reader/subscriptions-section-context-menu-view.tsx` に disabled / hidden contract を追加する
  - sidebar expanded folder storage dedupe とは別に、空 folder 時の context menu action 状態だけを扱う

- [ ] feed / folder mark-all-read zero affordance 候補を追加する
  - `src/components/reader/feed-context-menu-view.tsx` と `src/components/reader/folder-context-menu-view.tsx` で unread count 0 件時の `Mark all as read` を無効化または非表示にする
  - feed / folder unread count から disabled prop を渡し、view test で no-op confirm を避ける contract を固定する
  - mark read error feedback とは分け、0 件時の context menu affordance だけを扱う

- [ ] article command pagination guard 候補を追加する
  - `src-tauri/src/commands/article_commands.rs` の `list_articles` / `list_account_articles` / `list_recent_articles` / `search_articles` で極端な `limit` を clamp または reject する
  - 共通 `Pagination` 生成 helper と上限 test を追加する
  - tag article list limit guard とは別に、article command 一覧系 pagination だけを扱う

- [ ] article pending mutation query error contract 候補を追加する
  - `src-tauri/src/commands/article_commands.rs` の `maybe_queue_mutation` で `query_row(...).ok()` による DB error の握りつぶしをやめる
  - `OptionalExtension::optional()?` 相当に寄せ、`QueryReturnedNoRows` 以外は error として返す contract を追加する
  - GReader pending mutation DB error contract とは別に、article command 側の pending mutation 判定だけを扱う

- [ ] manual sync warning event parity 候補を追加する
  - `src-tauri/src/commands/sync_commands.rs` で manual all / account / feed sync でも warnings が空でなければ `SYNC_WARNING_EVENT` を emit する
  - `trigger_automatic_sync` だけ warning event を出す状態を helper / test で揃える
  - scheduler abnormal state や provider internal warning とは分け、manual command event parity だけを扱う

- [ ] account credentials orphan secret guard 候補を追加する
  - `src-tauri/src/commands/account_commands.rs` の `update_account_credentials` で DB 上の account 存在確認前に keyring password を保存しない
  - account 取得後に保存するか、DB 更新失敗時に rollback する contract test を追加する
  - frontend credentials URL validation とは分け、backend command の secret 保存順序だけを扱う

- [ ] account name duplicate normalization 候補を追加する
  - `src-tauri/src/commands/account_commands.rs` の add / rename account 重複判定を case-insensitive に揃える
  - `Work` と `work` のような視認上近い重複を拒否する command contract を追加する
  - account detail editor validation とは分け、account command の name uniqueness だけを扱う

- [ ] shortcut preference control character guard 候補を追加する
  - `src-tauri/src/commands/preference_commands.rs` の shortcut preference value で改行や制御文字を保存できないようにする
  - `is_valid_shortcut_preference_value` に control char / newline rejection test を追加する
  - frontend shortcut recording とは分け、backend preference boundary の値検証だけを扱う

- [ ] command history storage blank cleanup 候補を追加する
  - `src/schemas/storage.ts` の `CommandHistoryStorageSchema` で空文字や whitespace-only の履歴 ID を破棄する
  - `src/__tests__/hooks/use-command-history.test.ts` と schema test で corrupted localStorage cleanup を固定する
  - command palette recents 表示復帰とは分け、永続化 schema の blank value cleanup だけを扱う

- [ ] test setup storage getter fallback 候補を追加する
  - `tests/setup.ts` の `ensureWorkingStorage()` で `window.localStorage` / `sessionStorage` getter 自体が投げるケースを扱う
  - SecurityError などの getter failure 時に `MemoryStorage` を注入する小テストを追加する
  - Tauri mock strictness とは分け、test setup の Storage polyfill resilience だけを扱う

- [ ] seed dev DB env blank fallback 候補を追加する
  - `scripts/seed-dev-db-from-prod.ts` の `ULTRA_RSS_PROD_APP_DATA_DIR` / `ULTRA_RSS_DEV_APP_DATA_DIR` で blank env を unset と同じ扱いにする
  - 空文字なら platform default に fallback する helper contract を script test で固定する
  - seed cleanup や debug UI 導線とは分け、seed script env parsing の一点修正に限定する

- [ ] Windows dispatch secret env filter 候補を追加する
  - `scripts/lib/windows-dispatch.ts` の WSL PowerShell dispatch で `TAURI_` prefix を丸ごと encoded command line に渡さない
  - dev 実行に必要な allowlist か `*_KEY` / `*_TOKEN` / `*_PASSWORD` 除外 contract を追加する
  - release workflow preflight とは分け、ローカル Windows dispatch の secret exposure 防止だけを扱う

- [ ] article tag picker existing tag assign failure 候補を追加する
  - `src/components/reader/article-tag-picker-popover.tsx` の既存タグ選択で mutation 成否前に picker を閉じない
  - `src/components/reader/article-tag-chips.tsx` 側で assign 成功時だけ close し、失敗時は picker 維持と toast を追加する
  - 既読・スター error feedback とは分け、tag assignment mutation の failure surface だけを扱う

- [ ] article tag picker create-then-assign failure 候補を追加する
  - `src/components/reader/article-tag-chips.tsx` で tag 作成後の article assign 成功を待ってから draft clear / close する
  - create 成功後の assign に `onSuccess` / `onError` を付け、assign 失敗時は toast と draft 維持を固定する
  - settings tag input submit とは分け、reader article tag picker の post-create assign contract だけを扱う

- [ ] article tag picker close draft reset 候補を追加する
  - `src/components/reader/hooks/article/use-article-tag-picker-popover.ts` の `showPicker: false` 遷移で `newTagName` を clear する
  - outside click / Escape / 既存タグ選択後の再オープンで古い draft が残らない reducer contract を追加する
  - settings の tag / mute 入力行とは分け、reader tag picker draft state に限定する

- [ ] article toolbar action resolver drift 候補を追加する
  - `src/components/reader/article-toolbar-view.tsx` の `showExternalBrowserInMoreMenu` resolver field が描画判定と drift しないようにする
  - 未使用 field を削除するか、More menu 表示判定を resolver 経由に統一して既存 toolbar test を更新する
  - mobile discoverability ではなく、toolbar action resolver contract の一点整理として扱う

- [ ] browser history reload empty src contract 候補を追加する
  - `src/lib/browser/webview-history.ts` の fallback iframe reload で empty `src` を成功扱いにしない
  - typed failure にするか no-op 成功を明示名に分け、`webview-history.test.ts` の契約を更新する
  - browser bounds / listener / timeout surface とは分け、history helper の入力契約だけを扱う

- [ ] SQLite article row datetime parse contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_article.rs` と `src-tauri/src/infra/db/sqlite_tag.rs` の datetime parse 失敗を epoch fallback にしない
  - `parse_datetime` を `rusqlite::Result<DateTime<Utc>>` に寄せ、malformed date fixture で row decode error を固定する
  - article sanitizer や pagination とは分け、SQLite row decode の日時エラー境界だけを扱う

- [ ] SQLite feed upsert folder conflict contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_feed.rs` の `ON CONFLICT(account_id, url)` update で `folder_id` をどう扱うか固定する
  - duplicate URL upsert 時に `folder_id = excluded.folder_id` を含めるか、現仕様維持なら test 名で明示する
  - OPML folder cache や frontend add-feed race とは分け、feed repository save の conflict 更新列だけを扱う

- [ ] SQLite folder delete transaction 候補を追加する
  - `src-tauri/src/infra/db/sqlite_folder.rs` の folder delete と sort_order 詰め直しを同一 transaction にする
  - account lookup / delete / remaining folders fetch / renumber を `unchecked_transaction()` に包む
  - feed tree drag/drop ではなく、repository delete の原子性だけを扱う

- [ ] SQLite sync state upsert contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_sync_state.rs` の `INSERT OR REPLACE` を `ON CONFLICT(account_id, scope_key) DO UPDATE` に寄せる
  - 同一 key 更新で cursor / retry metadata が上書きされる repository test を追加する
  - cursor round-trip ではなく、sync state upsert 実装方式の副作用固定として扱う

- [ ] test i18n ja bundle registration 候補を追加する
  - `tests/helpers/i18n-setup.ts` に `ja: i18nResources.ja` を登録する
  - `src/__tests__/lib/i18n-setup.test.ts` で test i18n helper が `ja` bundle へ切り替えられることを固定する
  - locale source-of-truth / leaf sanity とは分け、test helper の登録 locale 不足だけを扱う

- [ ] preferences store load failure font fallback 候補を追加する
  - `src/stores/preferences-store.ts` の `loadPreferences` 失敗 branch でも default font style / size class を適用する
  - `preferences-store.test.ts` で失敗時の `font-sans` / `text-base` contract を追加する
  - Rust startup preference warning や theme listener cleanup とは分け、frontend store の font fallback に限定する

- [ ] dev mock recent mute pagination order 候補を追加する
  - `src/dev/mocks.ts` の `list_recent_articles` で pagination 前に mute filter を適用する
  - mute 対象が先頭にある時も `limit` 件数が欠けない contract を `dev-mocks.test.ts` に追加する
  - dev mock fixture boundary ではなく、recent + mute + pagination の順序バグだけを扱う

- [ ] dev mock search account pagination 候補を追加する
  - `src/dev/mocks.ts` の `search_articles` で `accountId` / `offset` / `limit` を schema と同じ意味で反映する
  - browser-only dev mock で別アカウント記事が混ざらない test を追加する
  - Rust article command pagination guard とは分け、dev mock の返却 semantics だけを扱う

- [ ] dev mock platform capability parity 候補を追加する
  - `src/dev/mocks.ts` の browser-only platform info が `kind: "unknown"` なのに runtime icon / native navigation を true にしている意味を固定する
  - `DEFAULT_PLATFORM_INFO` 相当に寄せるか、dev browser 専用 capability として test で明示する
  - platform abstraction 全体ではなく、dev mock の unknown capability parity だけを扱う

- [ ] article list body empty context menu 候補を追加する
  - `src/components/reader/article-list-body.tsx` で empty / loading 中に body context menu から `mark all read` を出さない
  - `groups.length === 0 || isLoading` の時は item を disabled または hidden にする component contract を追加する
  - feed / folder context menu の 0 件 affordance とは分け、article list body の空状態 menu だけを扱う

- [ ] article list item title normalization 候補を追加する
  - `src/components/reader/article-list-item.tsx` で計算済み `normalizedTitle` を aria label と `<h3>` 表示に使う
  - 前後空白入り title の a11y label / 表示揺れと empty title fallback を test で固定する
  - article list loading や motion とは分け、row title 正規化の一点修正に限定する

- [ ] article list item thumbnail blank guard 候補を追加する
  - `src/components/reader/article-list-item.tsx` の thumbnail URL を `trim()` し、whitespace-only は非表示扱いにする
  - resolver test に whitespace thumbnail を追加し、空の画像枠が出ない contract を固定する
  - sanitizer responsive media とは分け、article row thumbnail 入力正規化だけを扱う

- [ ] browser overlay escape keyboard ownership 候補を追加する
  - `src/hooks/use-keyboard.ts` で global keyboard handler が `event.defaultPrevented` を尊重する
  - `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` の Escape close と global close-browser が二重実行されない contract を追加する
  - browser failure surface ではなく、keyboard ownership の一点契約として扱う

- [ ] browser state card long detail wrapping 候補を追加する
  - `src/components/reader/browser-surface-state-card.tsx` の technical detail に長い URL / native error 向けの折り返し class を追加する
  - `break-words` / `overflow-wrap-anywhere` 相当を component または story test で固定する
  - timeout message i18n とは分け、state card のレイアウト耐性だけを扱う

- [ ] layout content mode contract 候補を追加する
  - `src/hooks/use-layout.ts` の `resolveLayout` で `_contentMode` が未使用な理由を helper / test contract として固定する
  - browser mode no-op を明示するか、API から削って `resolveVisiblePane` 側へ test を寄せる
  - mobile UI 見直しではなく、layout pure helper の引数契約だけを扱う

- [ ] sync flow remote folder upsert 候補を追加する
  - `src-tauri/src/service/sync_flow.rs` で remote folder 同期時に同じ `remote_id` の既存 folder id を再利用する
  - `find_by_remote_id(account_id, remote_id)` があれば `FolderId::new()` ではなく既存 id を使う sync flow test を追加する
  - OPML folder cache や SQLite folder delete transaction とは分け、generic sync flow の remote folder upsert だけを扱う

- [ ] provider normalizer article link preference 候補を追加する
  - `src-tauri/src/infra/provider/normalizer.rs` で `entry.links.first()` ではなく alternate / HTML link 相当を優先する
  - enclosure / self が先に来る feed fixture で本文リンク URL を選ぶ contract を追加する
  - GReader parsing 互換性ではなく、local feed normalizer の link selection だけを扱う

- [ ] provider normalizer thumbnail media type 候補を追加する
  - `src-tauri/src/infra/provider/normalizer.rs` の thumbnail fallback で `image/webp` / `image/gif` など一般的な image MIME を扱う
  - `is_image_media_type` helper と fixture test を追加する
  - UI thumbnail 表示や sanitizer とは分け、normalizer の MIME 判定だけを扱う

- [ ] platform command dev web URL validation 候補を追加する
  - `src-tauri/src/commands/platform_commands.rs` の `VITE_DEV_WEB_URL` を trim だけで DTO に出さない
  - `http` / `https` URL のみ返す helper と command unit test を追加する
  - Tauri dev port validation や FreshRSS URL validation とは分け、platform command の dev URL 境界だけを扱う

- [ ] browser webview placeholder navigation dedupe 候補を追加する
  - `src-tauri/src/commands/browser_webview_commands.rs` で Windows placeholder `about:blank` 使用中の同一 URL 再 navigate を避ける
  - tracker snapshot の target URL も見て、bounds update だけなら navigation しない contract を追加する
  - browser history fallback reload とは分け、Rust command 側の placeholder navigation 契約だけを扱う

- [ ] provider loopback timeout probe 候補を追加する
  - `src-tauri/src/domain/error.rs` の loopback timeout 判定で `to_socket_addrs().next()` の最初の address だけに依存しない
  - 解決された loopback address を短い timeout で順に probe し、どれか接続できれば response timeout 扱いにする
  - DB error mapping ではなく、provider HTTP error classification の一点修正として扱う

- [ ] mise test-all Storybook E2E semantics 候補を追加する
  - `mise.toml` の `test:all` 説明が “including E2E” なのに `test:storybook:e2e` を含まないズレを解消する
  - Storybook E2E を含めるか、説明を app E2E のみに狭めて package script contract に追加する
  - Storybook port / registry / runtime guard とは分け、aggregate task semantics だけを扱う

- [ ] YAML lint config self-check 候補を追加する
  - `mise.toml` の `lint:yaml` が `.github/` だけでなく `.yamllint` 自体も lint 対象にする
  - `yamllint -c .yamllint .github/ .yamllint` 相当の contract を追加する
  - CI cache や quality gate ではなく、YAML lint 対象漏れの一点修正として扱う

- [ ] Storybook config labeler contract 候補を追加する
  - `.github/labeler.yml` で `.storybook/**` 変更に `ui` または `category/tests` ラベルが付くようにする
  - `src/__tests__/config/repo-contracts.test.ts` に Storybook config path の labeler contract を追加する
  - 既存の scripts / tests / e2e labeler coverage とは別に、`.storybook/**` の漏れだけを扱う

- [ ] AGENTS router contract 候補を追加する
  - `AGENTS.md` が `CLAUDE.md` への thin router であることを `src/__tests__/config/repo-contracts.test.ts` で固定する
  - markdown link scan 対象へ `AGENTS.md` を含めるか、`CLAUDE.md` 参照の存在 contract を追加する
  - `CLAUDE.md` / `.claude/rules` link contract とは分け、repo-local agent router の一点だけを扱う

- [ ] settings page inline action disabled contract 候補を追加する
  - `src/components/settings/settings-page-view.tsx` の text control で `control.disabled` 中も inline action が押せる状態を防ぐ
  - action button の disabled を `control.disabled || control.actionDisabled` に揃え、settings page view test に contract を追加する
  - settings nav / tag input とは分け、共通 SettingsPageView の disabled 伝搬だけを扱う

- [ ] account switcher single-account menu contract 候補を追加する
  - `src/components/reader/account-switcher-view.tsx` で account 1 件時に menu open できる状態と aria 属性のズレを解消する
  - 1 件時は menu を開かないか、1 件 menu を正式公開するかを test で固定する
  - account detail / backend account validation とは分け、sidebar account switcher の single-account contract だけを扱う

- [ ] data settings action in-flight ref guard 候補を追加する
  - `src/components/settings/hooks/use-data-settings-controller.ts` の `handleVacuum` / `handleOpenLogDir` に同期的な in-flight ref guard を追加する
  - 同一 render closure からの連続実行でも二重 command を投げない focused hook test を追加する
  - database command recovery や release verification とは分け、Data settings action の重複実行 guard だけを扱う

- [ ] FeedDto remote id exposure 候補を追加する
  - `src-tauri/src/commands/dto.rs` の `FeedDto` と `src/api/schemas/feed.ts` に `remote_id` を追加する
  - provider-managed feed を frontend DTO から判定できるよう、schema test と代表 fixture を更新する
  - sync flow / pending mutation ではなく、Tauri DTO の欠落フィールド一点として扱う

- [ ] article entry id whitespace GUID fallback 候補を追加する
  - `src-tauri/src/domain/article.rs` の `generate_entry_id` で whitespace-only GUID を有効 ID として扱わない
  - GUID 判定を trim ベースにし、whitespace GUID は URL / title fallback へ落ちる unit test を追加する
  - article list title normalization とは分け、domain article ID 生成だけを扱う

- [ ] local provider HTTP status classification 候補を追加する
  - `src-tauri/src/infra/provider/local.rs` の `create_subscription` で HTTP status error を raw network error にしない
  - `DomainError::from_provider_http_error` に寄せ、401 / 429 などが Auth / RateLimit 分類へ通る test を追加する
  - loopback timeout probe とは分け、HTTP status formatting / classification だけを扱う

- [ ] GReader canonical URL fallback 候補を追加する
  - `src-tauri/src/infra/provider/greader.rs` の item mapping で `alternate` 欠落時に `canonical` の非空 href を URL fallback に使う
  - alternate 優先、なければ canonical へ fallback する helper と unit test を追加する
  - local feed normalizer link preference とは分け、GReader JSON item mapping だけを扱う

- [ ] shared field stories render smoke 候補を追加する
  - `src/__tests__/components/shared-stories.test.tsx` に `CopyableReadonlyField` / `CopyableReadonlyFieldList` story の最小 render assertion を追加する
  - story export registry だけでなく、shared field story が実 render できる contract を固定する
  - Storybook E2E runtime guard とは分け、shared component story の unit smoke に限定する

- [ ] Tauri mock fixture fresh clone 候補を追加する
  - `tests/helpers/tauri-mocks.ts` が `sampleAccounts` / `sampleFeeds` / `sampleArticles` の共有オブジェクトをそのまま返さないようにする
  - `tests/helpers/fixtures.ts` に fresh clone builder を追加し、mock 返却値の mutation が fixture を汚染しない contract を追加する
  - fixture parity とは分け、test data builder の immutability だけを扱う

- [ ] account switcher story ref isolation 候補を追加する
  - `src/components/reader/account-switcher-view.stories.tsx` の `triggerRef` / `itemRefs` を meta args で共有しない
  - story render または decorator 内で story ごとに refs を生成するようにし、mutable ref 共有を避ける
  - account switcher runtime contract とは分け、Storybook story args の isolation だけを扱う

- [ ] docs index RTK link 候補を追加する
  - `docs/README.md` の Top-Level Docs から `../RTK.md` へ辿れるようにする
  - repo の外部コマンド実行方針を docs index から見つけられる 1 行追加に限定する
  - AGENTS router contract や markdown link scan 拡張とは分け、docs index の案内漏れだけを扱う

- [ ] article tag picker create focus contract 候補を追加する
  - `src/components/reader/article-tag-picker-popover.tsx` で新規 tag 作成後に picker を閉じるか開いたままにするかを固定する
  - `src/__tests__/components/article-tag-picker-view.test.tsx` で Enter 作成後の draft reset と focus 復帰を確認する
  - tag assignment failure handling とは分け、create success 後の picker UI contract だけを扱う

- [ ] article share mailto fallback 候補を追加する
  - `src/components/reader/article-share-menu.tsx` の mail share で title / url が空または長文の時の subject / body fallback を固定する
  - `src/__tests__/components/article-share-menu.test.tsx` で encode と失敗 toast の境界を追加する
  - external browser / reading list command とは分け、mailto 生成の入力境界だけを扱う

- [ ] article action shortcut URL null guard 候補を追加する
  - `src/components/reader/hooks/article/use-article-action-shortcuts.ts` で Web Preview 表示中の URL なし記事に対する `b` / copy / reading list shortcut を no-op にする
  - selected article null / URL null の hook test を追加し、toast を出すか silent no-op にするかを固定する
  - toolbar action resolver や share menu fallback とは分け、shortcut handler の URL guard だけを扱う

- [ ] subscriptions index filter scroll reset 候補を追加する
  - `src/components/subscriptions-index/use-subscriptions-index-state.ts` で summary filter / search 変更時に `listScrollTop` を保持するか 0 に戻すかを固定する
  - page state の return restore と衝突しない focused test を追加する
  - decision flow や nested dialog handling とは分け、subscriptions list scroll contract だけを扱う

- [ ] subscriptions detail invalid date display 候補を追加する
  - `src/components/subscriptions-index/subscription-detail-pane.tsx` で `metrics.latestArticleAt` が null / invalid 相当の時に出す表示を localized empty に寄せる
  - `src/__tests__/components/subscription-detail-pane.test.tsx` で date formatter 境界を確認する
  - review candidate ranking とは分け、detail metrics 表示の空値 contract だけを扱う

- [ ] shortcuts recording reset guard 候補を追加する
  - `src/components/settings/shortcuts-settings-view.tsx` で shortcut recording 中に全リセット / row reset を押せるか禁止するかを固定する
  - recording 中の reset disabled と key capture 干渉を focused view test で確認する
  - shortcut preference control char guard とは分け、settings view 操作 guard だけを扱う

- [ ] OPML import transaction contract 候補を追加する
  - `src-tauri/src/commands/opml_commands.rs` の OPML import を transaction 化し、途中の folder / feed 保存失敗で部分作成が残らない contract を追加する
  - account / folder validation とは分け、import command の atomicity だけを Rust test で固定する
  - UI copy や feed discovery とは混ぜない

- [ ] OPML export deterministic order 候補を追加する
  - `src-tauri/src/commands/opml_commands.rs` の export で folder 内 feed / top-level feed の順序を title / id で deterministic にする
  - 入力順に依存しない helper test を追加し、snapshot drift を減らす
  - import transaction や folder matching とは分け、export serialization order だけを扱う

- [ ] add local feed account preflight 候補を追加する
  - `src-tauri/src/commands/feed_commands.rs` の `add_local_feed` で network fetch 前に `account_id` 存在と Local account であることを検証する
  - 無効 account で外部 request しない command test を追加する
  - URL validation や duplicate feed policy とは分け、account preflight だけを扱う

- [ ] delete account keyring order 候補を追加する
  - `src-tauri/src/commands/account_commands.rs` の `delete_account` で DB 削除失敗時に credential だけ失われない順序または rollback contract を固定する
  - keyring delete failure / DB delete failure の helper test を追加する
  - update credentials orphan secret guard とは分け、account deletion の secret cleanup 順序だけを扱う

- [ ] Storybook alias parity contract 候補を追加する
  - `.storybook/main.ts` と `vite.config.ts` / `vitest.config.ts` の alias 設定が drift しない contract を `src/__tests__/config/repo-contracts.test.ts` に追加する
  - Storybook だけ import 解決が壊れる状態を config test で検出する
  - Storybook E2E runtime guard とは分け、config alias parity だけを扱う

- [ ] reader selection browser state reset 候補を追加する
  - `src/stores/ui-store.ts` で feed / tag / account / smart view 遷移時に `browserUrl` / `browserNavigationState` / close in-flight を消す契約を固定する
  - `src/__tests__/stores/ui-store.test.ts` で Web Preview 中の selection 変更後に stale browser state が残らないことを確認する
  - browser geometry や overlay motion とは分け、reader selection の state reset だけを扱う

- [ ] native menu shortcut hint parity 候補を追加する
  - `src-tauri/src/menu.rs` の Item メニューに出している `J/K/V/B/S/M/A` 表示が shortcut 設定と乖離しない方針を決める
  - prefs を反映するか固定表示にするかを Rust test で固定する
  - shortcut recording UI とは分け、native menu hint の表示 contract だけを扱う

- [ ] native menu accelerator collision 候補を追加する
  - `src-tauri/src/menu.rs` の `CmdOrCtrl+R` sync all と Web Preview reload 系 shortcut の優先順位を整理する
  - `src/lib/keyboard/keyboard-shortcuts.ts` 側の customizable shortcut と native accelerator の衝突 contract を追加する
  - action taxonomy 変更ではなく、既存 accelerator の競合整理に限定する

- [ ] share action URL target contract 候補を追加する
  - `src/lib/actions.ts` の share 系 action が選択記事 URL と現在 WebView URL のどちらを対象にするかを固定する
  - Web Preview 内遷移後の `copy-link` / external open / reading list 対象を contract test 化する
  - mailto fallback とは分け、menu action の URL source だけを扱う

- [ ] browser webview focus preference 候補を追加する
  - `src/components/reader/hooks/browser/use-browser-webview-sync.ts` の create 後 `focusBrowserWebview()` が `web_preview_keep_focus` とどう関係するかを固定する
  - 設定 off 時の focus 挙動を hook test で確認する
  - focus restore failure feedback とは分け、create 後の focus policy だけを扱う

- [ ] browser overlay back availability 候補を追加する
  - `src/components/reader/browser-overlay-chrome.tsx` の back button が history なしでも有効に見える状態を整理する
  - disabled / close fallback / label 変更のどれにするかを view test で固定する
  - native navigation availability とは分け、overlay chrome の back affordance だけを扱う

- [ ] browser webview lost surface contract 候補を追加する
  - `src/components/reader/hooks/browser/use-browser-view-surface-state.ts` で embedded webview lost event を user-visible にするか silent close にするか固定する
  - `use-browser-view-surface-state` の focused test で toast / surface issue / close state のいずれかを確認する
  - bounds sync failure surface とは分け、webview disappeared 経路だけを扱う

- [ ] reading list platform capability parity 候補を追加する
  - `src-tauri/src/menu.rs` の Reading List native menu 表示条件と `src/stores/platform-store.ts` の `supports_reading_list` を揃える
  - macOS / non-macOS の menu と frontend capability が drift しない contract test を追加する
  - share command boundary とは分け、platform capability parity だけを扱う

- [ ] always-on-top error surface 候補を追加する
  - `src/hooks/use-window-always-on-top.ts` の `setWindowAlwaysOnTop` 失敗を完全 no-op にするか debug surface に出すか固定する
  - unsupported platform と実エラーを同じ扱いにしない hook test を追加する
  - window fullscreen / app icon とは分け、always-on-top preference application だけを扱う

- [ ] create folder account preflight 候補を追加する
  - `src-tauri/src/commands/feed_commands.rs` の `create_folder` で `account_id` 不在時に外部キー制約ではなく user-visible error を返す
  - 存在しない account で folder が作られない command test を追加する
  - add local feed account preflight とは分け、folder creation の account validation だけを扱う

- [ ] article mark read transaction contract 候補を追加する
  - `src-tauri/src/commands/article_commands.rs` の `mark_article_read` / `mark_articles_read` で pending mutation 作成と unread_count 再計算を同一 transaction に寄せる
  - remote mutation queue 失敗時の local read state rollback を command / repository test で固定する
  - auto mark retained rollback とは分け、manual article read command の atomicity だけを扱う

- [ ] Playwright artifact separation contract 候補を追加する
  - `playwright.config.ts` と `playwright.storybook.config.ts` の `outputDir` / HTML report folder が app と Storybook で分離される contract を追加する
  - 失敗 artifact が互いに上書きされないことを config test で固定する
  - Storybook runtime guard とは分け、E2E artifact path の config contract だけを扱う

- [ ] mute keyword create trim contract 候補を追加する
  - `src/components/settings/mute-settings.tsx` の keyword 作成時に `keyword.trim()` を command へ渡す契約を固定する
  - 前後空白だけで 3 文字判定をすり抜けないことを `src/__tests__/components/mute-settings.test.tsx` で確認する
  - mute scope reducer や backend schema とは分け、settings create form の入力境界だけを扱う

- [ ] mute keyword scope race guard 候補を追加する
  - `src/components/settings/mute-settings.tsx` の saved rule scope 連続変更に revision guard を追加するか、現仕様を test で固定する
  - 古い `updateMuteKeyword` 成功が後勝ちしない component / hook test を追加する
  - tag rename/delete pending guard とは分け、mute rule scope update の race だけを扱う

- [ ] tag create in-flight guard 候補を追加する
  - `src/components/settings/tags-settings.tsx` の tag 作成に同期的な in-flight guard を追加する
  - disabled 反映前の click / Enter 連打で `createTag` が二重実行されないことを component test で確認する
  - tag picker create focus contract とは分け、settings tag creation の submit guard だけを扱う

- [ ] account detail OPML export filename guard 候補を追加する
  - `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` の OPML export に連打 guard と安全な fallback filename を追加する
  - 空文字・禁止文字だけの account 名でも `feeds.opml` などへ落ちる hook test を追加する
  - OPML import/export backend serialization とは分け、account detail export action の UI guard だけを扱う

- [ ] account detail credentials copy trim 候補を追加する
  - `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts` の server URL copy で draft 値を trim する
  - 空白のみなら `copyToClipboard` に渡さない focused test を追加する
  - credentials save validation とは分け、copy action の入力境界だけを扱う

- [ ] pending mutation type axis contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_pending_mutation.rs` の `save` が同一 `remote_entry_id` の別種 mutation を消すか共存させるかを固定する
  - read / unread と star / unstar を別軸で相殺できる repository test を追加する
  - manual article read transaction とは分け、pending mutation dedupe key の contract だけを扱う

- [ ] remote state pending type separation 候補を追加する
  - `src-tauri/src/infra/db/sqlite_article.rs` の `apply_remote_state` で pending 種別ごとの remote state 適用範囲を分ける
  - read pending が star state まで止めないこと、star pending が read state まで止めないことを repository test で固定する
  - GReader pending mutation DB error とは分け、remote state reconcile の pending type handling だけを扱う

- [ ] GReader item id pagination limit warning 候補を追加する
  - `src-tauri/src/infra/provider/greader.rs` の `pull_all_item_ids` が max pages 到達時に continuation 残存を成功扱いしない contract を追加する
  - partial state を warning / error のどちらにするか provider test で固定する
  - sync scheduler backoff とは分け、GReader item id pagination limit だけを扱う

- [ ] local feed validator retention contract 候補を追加する
  - `src-tauri/src/commands/sync_providers.rs` の local feed sync で 200 応答かつ ETag / Last-Modified 欠落時に既存 validator を消すか維持するか固定する
  - `sync_local_feed` の state contract test を追加する
  - local provider HTTP status classification とは分け、local feed sync cursor retention だけを扱う

- [ ] recent viewed mute exclusion contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_article.rs` の `find_recently_viewed_by_account` で muted article を出すか除外するかを固定する
  - article list / search / recent view の mute keyword exclusion parity を repository test で確認する
  - subscriptions detail recent articles とは分け、recently viewed query の mute handling だけを扱う

- [ ] dev mock DTO schema contract 候補を追加する
  - `src/dev/mock-data.ts` の `mockAccounts` / `mockFeeds` / `mockArticles` / `mockTags` を DTO schema で parse する test を追加する
  - dev fixture drift を `src/__tests__/dev/dev-mock-data.test.ts` で検出する
  - Tauri mock fixture fresh clone とは分け、browser dev mock data の schema parity だけを扱う

- [ ] test i18n language reset contract 候補を追加する
  - `tests/helpers/i18n-setup.ts` に test ごとの language reset contract を追加する
  - `i18n.changeLanguage("ja")` 後の後続 test に言語状態が漏れないことを helper test で確認する
  - locale key registration とは分け、test helper の isolation だけを扱う

- [ ] external URL command schema trim 候補を追加する
  - `src/api/schemas/commands.ts` の `openExternalUrlArgs` / `addToReadingListArgs` で URL の leading / trailing space を trim または reject する方針を固定する
  - command schema test で blank / whitespace-wrapped URL の境界を確認する
  - share action URL target contract とは分け、Tauri command args schema の URL boundary だけを扱う

- [ ] article list search reopen debounce 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-search.ts` で検索 close 直後の古い debounce timer が stale query を復活させない契約を追加する
  - `src/__tests__/components/use-article-list-search.test.tsx` で close -> reopen -> timer flush の境界を確認する
  - article list primary loading naming とは分け、search input state の debounce lifecycle だけを扱う

- [ ] article list search escape focus 候補を追加する
  - `src/components/reader/article-list-header-search.tsx` で Escape close 後の focus 戻し先を search toggle / list row のどちらにするか固定する
  - `src/__tests__/components/article-list-header.test.tsx` で keyboard 導線を確認する
  - global shortcut handling とは分け、article search field の close focus だけを扱う

- [ ] article list missing row navigation 候補を追加する
  - `src/components/reader/hooks/article-list/use-article-list-navigation.ts` で row DOM 未描画時に `selectArticle` だけ進む現挙動を固定するか retry する
  - missing row / delayed row の focused test を追加する
  - navigation scroll helper とは分け、DOM row availability と selection update の contract だけを扱う

- [ ] sidebar feed navigation latest ref 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-feed-navigation.ts` の `navigate-feed` 連打で rerender 前に同じ feed を再選択しない contract を追加する
  - latest selected ref を持つか現仕様固定を `src/__tests__/hooks/use-sidebar-feed-navigation.test.tsx` で確認する
  - account selection fallback とは分け、feed keyboard navigation の stale selection だけを扱う

- [ ] feed tree zero unread middle click 候補を追加する
  - `src/components/reader/feed-tree-row.tsx` で unreadCount 0 の feed middle click 時に `onMarkFeedRead` を呼ぶか no-op にするか固定する
  - `src/__tests__/components/feed-tree-row.test.tsx` で callback 境界を確認する
  - mark-all-read mutation transaction とは分け、feed tree row gesture の no-op contract だけを扱う

- [ ] folder tree zero unread middle click 候補を追加する
  - `src/components/reader/feed-tree-folder-section.tsx` で unreadCount 0 folder の middle click mark-read を no-op にするか固定する
  - `src/__tests__/components/feed-tree-folder-section.test.tsx` で folder row の middle click contract を追加する
  - feed row gesture とは分け、folder section gesture の境界だけを扱う

- [ ] article search source scope contract 候補を追加する
  - `src/lib/articles/article-list.ts` の search result に対する `folderFeedIds` / feed selection / tag selection の scope を固定する
  - `src/__tests__/lib/article-list.test.ts` で feed selection 中の search result scope を確認する
  - command palette resource search とは分け、article list local search source selection だけを扱う

- [ ] sqlite feed remote URL upsert 候補を追加する
  - `src-tauri/src/infra/db/sqlite_feed.rs` の `save` で同一 `account_id + remote_id` だが URL が変わった feed の upsert 契約を追加する
  - `UNIQUE(account_id, remote_id)` 衝突時に既存 id を再利用する repository test を追加する
  - sync flow remote folder upsert とは分け、feed remote identity の URL drift だけを扱う

- [ ] folder article mute exclusion contract 候補を追加する
  - `src-tauri/src/infra/db/sqlite_article.rs` の `find_by_folder` / `find_unread_by_folder` / `find_starred_by_folder` で mute 除外を pagination 前に適用する
  - feed / account / recent query とは分け、folder scope query の mute parity を repository test で固定する
  - recent viewed mute exclusion とは別バッチにする

- [ ] feed article summary mute parity 候補を追加する
  - `src-tauri/src/infra/db/sqlite_article.rs` の `list_feed_article_summaries_by_account` で muted article が `latest_article_at` / `starred_count` に入るかを固定する
  - 空 feed を summary に残すかも含めた repository test を追加する
  - subscriptions review ranking とは分け、feed summary query の mute handling だけを扱う

- [ ] OPML nested folder contract 候補を追加する
  - `src-tauri/src/infra/opml.rs` の `parse_opml` で nested folder を最下層名 / full path / reject のどれで扱うか固定する
  - nested outline fixture を追加し、folder name mapping を parser test で明示する
  - OPML import transaction とは分け、parser の folder path interpretation だけを扱う

- [ ] feed discovery base href resolution 候補を追加する
  - `src-tauri/src/infra/feed_discovery.rs` の `extract_feed_links` で HTML `<base href>` を relative feed URL 解決に使うか固定する
  - final URL と base URL が違う parser test を追加する
  - HTTP status handling とは分け、HTML discovery URL resolution だけを扱う

- [ ] sanitizer srcset URL filtering 候補を追加する
  - `src-tauri/src/infra/sanitizer.rs` の `sanitize_html` で `srcset` 内の `javascript:` / `data:` URL を落とす contract を追加する
  - 通常 `src` だけでなく responsive image 属性の sanitizer test を追加する
  - article responsive media styling とは分け、sanitizer URL filtering だけを扱う

- [ ] release note label parity contract 候補を追加する
  - `.github/release.yml` と `.github/labeler.yml` の release note category labels が drift しない contract を追加する
  - `docs` / `dependencies` / `chore` / `refactor` / `feature` / `enhancement` の label 名対応を config test で固定する
  - release workflow preflight とは分け、release note categorization だけを扱う

- [ ] Storybook story export allowlist contract 候補を追加する
  - `tests/helpers/storybook-story-export-registry.ts` の `ALLOWED_NON_STORY_EXPORTS` が UI Reference helper export だけを許す契約を固定する
  - 許可理由コメントまたは dedicated test を追加し、通常 story file の helper export 漏れを検出する
  - shared field story render smoke とは分け、story export registry の allowlist governance だけを扱う

- [ ] Storybook stale server health check 候補を追加する
  - `playwright.storybook.config.ts` の `reuseExistingServer: true` が古い 6006 server を掴む問題を検出する
  - iframe smoke 前に project / version / story registry health check を追加するか、runbook contract を固定する
  - Playwright artifact separation とは分け、Storybook server freshness だけを扱う

- [ ] react-doctor critical errors 候補を追加する
  - `npx -y react-doctor@latest . --verbose` で出た `react-doctor/no-eval` と `react-hooks/rules-of-hooks` を先に潰す
  - `src/__tests__/app/theme-bootstrap-script.test.ts` の `new Function` 実行を script 挙動確認用の安全な helper へ置き換える
  - `src/components/reader/article-toolbar-view.stories.tsx` の anonymous decorator hook を named component / hook 境界へ寄せる
  - score regression を防ぐため、修正後に `react-doctor --diff` と該当 test / Storybook smoke を確認する

- [ ] react-doctor Tailwind size shorthand 候補を追加する
  - `react-doctor/design-no-redundant-size-axes` の `w-N h-N` を view scope ごとに `size-N` へ置き換える
  - まず `article-empty-state-view` / `article-tag-picker` / `feed-tree-row` / `settings` small icons を小さな worker scope に分ける
  - Storybook specimen と test fixture は別バッチにし、UI 表示差分が出ないことを focused component test で確認する

- [ ] react-doctor settings size shorthand runtime batch 候補を追加する
  - `settings-modal-view` / `settings-row` / `actions-settings-view` / `accounts-nav-view` / `tags-settings-view` の runtime icon sizing を `size-N` へ寄せる
  - settings surface focused test で button/icon の accessible name と visible state が変わらないことを確認する
  - Storybook settings specimen とは分け、settings runtime view の `w-N h-N` cleanup だけを扱う

- [ ] react-doctor reader toolbar size shorthand batch 候補を追加する
  - `article-toolbar-view` / `article-list-header-actions` / `article-share-menu` / `browser-surface-state-card` の icon sizing を `size-N` へ寄せる
  - reader toolbar / article header focused test で主要 action の表示と aria state が変わらないことを確認する
  - toolbar action taxonomy とは分け、reader action icon の size shorthand cleanup だけを扱う

- [ ] react-doctor shared surface size shorthand batch 候補を追加する
  - `feed-detail-panel` / `workspace-header` / `tag-chip` / `copyable-text-field` / `article-filter-toggle-button` の equal width/height 指定を `size-N` へ寄せる
  - shared component focused test で layout class 以外の behavior が変わらないことを固定する
  - UI primitive API 変更とは分け、shared surface component の visual utility cleanup だけを扱う

- [ ] react-doctor Storybook size shorthand batch 候補を追加する
  - `ui-reference-canvas-specimens` / `ui-reference-settings-workspace-canvas.stories` / settings story files の `w-N h-N` を `size-N` へ寄せる
  - Storybook canvas smoke で reference specimen が crash しないことを確認する
  - runtime component cleanup とは分け、Storybook/demo-only size utility cleanup だけを扱う

- [ ] react-doctor test fixture size shorthand batch 候補を追加する
  - `src/__tests__/components/icon-toolbar-control.test.tsx` など test-only JSX fixture の `w-N h-N` を `size-N` へ寄せる
  - snapshot / role assertion に影響しないことを focused test で確認する
  - production UI cleanup とは分け、test fixture JSX の Tailwind utility cleanup だけを扱う

- [ ] react-doctor reader article summary icon size shorthand 候補を追加する
  - `src/components/reader/article-view.tsx` の summary / empty-state leading visual に残る `h-N w-N` を `size-N` へ寄せる
  - article view focused test で summary icon / empty state / article list selection の表示 contract が変わらないことを確認する
  - reader toolbar size shorthand とは分け、ArticleView 本文周辺の小さい icon sizing だけを扱う

- [ ] react-doctor subscriptions index icon size shorthand 候補を追加する
  - `subscription-detail-pane.tsx` / `subscriptions-overview-summary.tsx` の detail / overview 表示 icon sizing を `size-N` へ寄せる
  - subscriptions index focused test で decision bar / overview card / status icon の role と visible state が変わらないことを確認する
  - subscriptions index pane contract とは分け、visual utility cleanup だけを扱う

- [ ] react-doctor add-account icon size shorthand 候補を追加する
  - `account-config-form-view.tsx` / `service-picker.tsx` の add-account flow 内 icon sizing を `size-N` へ寄せる
  - add-account form focused test で provider selection / config form / validation state が変わらないことを確認する
  - add account service picker props boundary とは分け、icon utility cleanup だけを扱う

- [ ] react-doctor reader sidebar leaf icon size shorthand 候補を追加する
  - `feed-tree-drag-overlay.tsx` / `feed-item.tsx` / `folder-section.tsx` / `sidebar-feed-tree-skeleton.tsx` の leaf / skeleton icon sizing を `size-N` へ寄せる
  - feed item / folder section / sidebar focused test で row height、skeleton shape、drag preview が変わらないことを確認する
  - `feed-tree-row` 本体や drag/drop behavior とは分け、sidebar leaf 表示の utility cleanup だけを扱う

- [ ] react-doctor article story padding shorthand 候補を追加する
  - `article-meta-view.stories.tsx` / `article-content-view.stories.tsx` の `px-N py-N` 同値指定を `p-N` へ寄せる
  - Storybook build または article story smoke で story canvas が crash しないことを確認する
  - runtime padding shorthand cleanup とは分け、article story fixture の padding utility cleanup だけを扱う

- [ ] react-doctor React 19 forwardRef cleanup 候補を追加する
  - `react-doctor/no-react19-deprecated-apis` の対象 wrapper から不要な `forwardRef` を外す
  - 対象: `shortcuts-settings-view` / `article-tag-picker-buttons` / `sidebar-nav-button` / `account-switcher-view` / `reader-inline-action-button` / `settings-content-layout` / `nav-row-button`
  - public wrapper API と ref forwarding contract を壊さないよう component test 付きで worker 分割する

- [ ] react-doctor mutation invalidation 候補を追加する
  - `src/hooks/use-tags.ts` と `src/hooks/use-articles.ts` の `useMutation` / `createMutation` に cache update contract を明示する
  - `useTagArticle` / article mutation 系で stale tag/article data が残らない invalidation を focused hook test で固定する
  - pending mutation backend contract とは分け、TanStack Query cache consistency だけを扱う

- [ ] react-doctor browser-view state effects 候補を追加する
  - `src/components/reader/browser-view.tsx` の cascading setState / state-only handler / trivial `useMemo` を整理する
  - reducer 化する state と `useRef` 化する render 非依存 state を分け、browser surface state test を追加する
  - Browser WebView geometry 数値や native bounds 挙動は触らず、React state/effect の形だけを扱う

- [ ] react-doctor App visibility handler ref 候補を追加する
  - `src/App.tsx` の visibilitychange listener が handler identity 変更で再購読される点を ref-based event handler へ寄せる
  - sync-on-wake の in-flight guard と hidden duration 判定が変わらない test を追加する
  - startup sync / Tauri listener invalidation とは分け、DOM event subscription stability だけを扱う

- [ ] react-doctor article content danger boundary 候補を追加する
  - `src/components/reader/article-content-view.tsx` の `dangerouslySetInnerHTML` を sanitizer contract とセットで再確認する
  - Rust sanitizer 済みであることを TS 側の branded/sanitized HTML 型または schema 境界で表現できるか検討する
  - HTML rendering の挙動変更は避け、danger boundary の documentation / type contract と sanitizer regression test に限定する

- [ ] react-doctor dead code type surface 候補を追加する
  - `knip/types` / `knip/exports` の unused type/export を feature ごとに棚卸しする
  - `article-list.types.ts` / `browser-view.types.ts` / `command-palette.types.ts` など広い contract は一括削除せず参照範囲ごとに分ける
  - public wrapper API と Storybook helper export は allowlist 化し、実 dead code だけを削除する

- [ ] react-doctor i18n / schema barrel dead export 候補を追加する
  - `src/lib/i18n-resources.ts` / `src/lib/i18n.ts` / `src/api/schemas/index.ts` / schema barrels の `knip/types` / `knip/exports` 指摘を実参照と public barrel に分類する
  - locale/schema contract test が import path 変更で壊れないことを確認し、public barrel と実 dead export を分けて整理する
  - reader view type surface cleanup とは分け、i18n/schema barrel の dead export 判断だけを扱う

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

- [ ] react-doctor test fixture combine-iterations 候補を追加する
  - `article-view.test.tsx` / `use-feed-landing.test.tsx` / `ui-reference-specimen-registry.test.ts` の `.filter().map()` / `.map().filter()` を test helper 単位で整理する
  - test readability を壊さない範囲に限定し、assertion message と fixture order が変わらないことを確認する
  - runtime iterable performance とは分け、test-only fixture iteration cleanup だけを扱う

- [ ] react-doctor repo contract lookup cleanup 候補を追加する
  - `src/__tests__/config/repo-contracts.test.ts` / `src/__tests__/api/schemas.test.ts` / `src/__tests__/lib/i18next-locale-contract.test.ts` の repeated membership check を `Set` 化する
  - contract test の failure message と検証対象 glob/order が変わらないことを確認する
  - tauri dispatch lookup set とは分け、test contract lookup cleanup だけを扱う

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

- [ ] react-doctor icon toolbar handler naming 候補を追加する
  - `src/components/shared/icon-toolbar-control.tsx` の non-descriptive `handleClick` を、実際の動作を表す handler name へ変更する
  - `icon-toolbar-control` focused test で click / ariaDisabled / tooltip behavior が変わらないことを確認する
  - icon toolbar ariaDisabled activation guard とは分け、handler naming と readability だけを扱う

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

- [ ] react-doctor article-list length guard 候補を追加する
  - `src/lib/articles/article-list.ts` の `.every()` 比較に length guard を足し、長さ不一致時に早期 return する
  - `src/__tests__/lib/article-list.test.ts` で same length / different length / same IDs different order の boundary を固定する
  - article list navigation や selection helper cleanup とは分け、`js-length-check-first` の一点だけを扱う

- [ ] react-doctor dev mock min-max cleanup 候補を追加する
  - `src/dev/mocks.ts` の min/max 用 `sort()[0]` を `Math.min` / `Math.max` または single-pass reduce へ寄せる
  - dev mock の generated timestamp / article order / scenario fixture が変わらないことを `dev-mock-data` 系 test で確認する
  - dev mock combine-iterations cleanup とは分け、`js-min-max-loop` の一点だけを扱う

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

- [ ] create folder schema blank name 候補を追加する
  - `src/api/schemas/commands.ts` の `createFolderArgs.name` で空文字 / whitespace-only folder 名を拒否する
  - `src/__tests__/api/schemas.test.ts` と `src/__tests__/api/tauri-commands.test.ts` で invalid name が IPC invoke へ進まないことを確認する
  - rename feed validation とは分け、create folder IPC schema boundary だけを扱う

- [ ] tauri default mock command coverage 候補を追加する
  - `tests/helpers/tauri-mocks.ts` の default handler に public wrapper でよく使う副作用小さめ command を追加する
  - 対象候補: `list_feed_article_summaries` / `get_preferences` / `get_database_info` / `check_for_update` / `cleanup_feed_integrity_orphans`
  - `tests/helpers/tauri-mocks.test.ts` で default mock response が schema-valid に通ることを固定する

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

- [ ] account switcher view model boundary 候補を追加する
  - `src/components/reader/account-switcher-view.tsx` に残る selected account view model 解決と展開時 focus frame を hook 側へ寄せる
  - `src/__tests__/hooks/use-sidebar-account-switcher.test.tsx` で selected missing / single account / multiple accounts と focus frame を固定する
  - account menu action とは分け、account switcher view model と DOM scheduling 境界だけを扱う

- [ ] similarity reader focus retry helper 候補を追加する
  - `src/lib/reader-focus.ts` の `focusArticleListRowTargetWhenReady` と `focusSidebarSmartViewTargetWhenReady` が 88% 類似なので、retry / frame scheduling 部分を共通 helper に寄せる
  - target selector / fallback focus rule は呼び出し側に残し、article list と smart view の focus behavior が変わらないことを focused test で固定する
  - account switcher focus frame とは分け、reader focus retry loop の重複だけを扱う

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

- [ ] feed discovery resolved URL safety 候補を追加する
  - `src-tauri/src/infra/feed_discovery.rs` で `<base>` / `<link href>` 解決後の feed candidate URL にも private / unsupported URL filter を適用する
  - Rust test で `127.0.0.1` / `file://` / public `https://` を混ぜ、公開 http/https だけ残ることを固定する
  - discovery start URL / redirect validation とは分け、resolved candidate URL safety だけを扱う

- [ ] feed discovery unquoted attribute parser 候補を追加する
  - `src-tauri/src/infra/feed_discovery.rs` の link attribute parser が unquoted `rel=alternate type=application/rss+xml href=/feed.xml` を拾えるようにする
  - Rust test で unquoted `rel` / `type` / `href` / `title` から feed URL と title が抽出されることを固定する
  - HTML whitespace attribute parsing とは分け、unquoted link attribute 境界だけを扱う

- [ ] local provider private URL guard 候補を追加する
  - `src-tauri/src/infra/provider/local.rs` の `pull_entries` / `create_subscription` が feed URL を直接 `reqwest` へ渡す前に private / loopback URL を拒否する
  - Rust test で `http://127.0.0.1:<mock-port>/feed.xml` が validation error になり、mock server hit が 0 のままになることを確認する
  - feed discovery candidate filter とは分け、保存済み / 直接追加 feed URL の provider boundary だけを扱う

- [ ] sync scheduler backoff persistence error 候補を追加する
  - `src-tauri/src/service/sync_scheduler.rs` の `reset_error_count` / `increment_error_count` が `repo.save(&state)` 失敗を silent success にしないようにする
  - Rust test で backoff state 保存成功時の `is_in_backoff` と保存失敗時の error surface を固定する
  - scheduler interval tuning とは分け、backoff persistence failure handling だけを扱う

- [ ] OPML head title escaping contract 候補を追加する
  - `src-tauri/src/infra/opml.rs` の `generate_opml` で head title が二重 escape されないことを固定する
  - Rust test で `Test & Title` が `<title>Test &amp; Title</title>` になり、`&amp;amp;` を含まないことを確認する
  - OPML nested folder / import transaction とは分け、head title serialization だけを扱う

- [ ] Playwright app server owner contract 候補を追加する
  - `playwright.config.ts` の app E2E `webServer.command` を `scripts/tauri-dev-vite-manager.ts` の port owner 判定経由に寄せる
  - repo contract test で app E2E が manager 経由になっていること、script test で foreign listener を誤用しないことを固定する
  - Storybook stale server health check とは分け、app E2E dev server ownership だけを扱う

- [ ] Playwright forbidOnly contract 候補を追加する
  - `playwright.config.ts` と `playwright.storybook.config.ts` に `forbidOnly: Boolean(process.env.CI)` を明示する
  - `src/__tests__/config/repo-contracts.test.ts` で app / Storybook 両 config が CI の `test.only` を防ぐことを固定する
  - Playwright port drift とは分け、focused test 漏れ防止だけを扱う

- [ ] E2E runtime error guard shared helper 候補を追加する
  - `e2e/app.spec.ts` と `e2e/storybook/ui-reference-canvas-smoke.spec.ts` に散っている runtime error guard を shared helper に寄せる
  - `pageerror` だけでなく `console.error` も拾う contract を最小 Playwright spec で固定する
  - E2E scenario 追加とは分け、runtime error detection helper だけを扱う

- [ ] seed dev DB running app guard 候補を追加する
  - `scripts/seed-dev-db-from-prod.ts` の macOS / Linux 起動中アプリ検出を `pgrep -x` exact name 依存から強くする
  - `src/__tests__/scripts/seed-dev-db-from-prod.test.ts` で長い app name / `ultra-rss-reader` process 検出時に DB 置換へ進まないことを固定する
  - seed cleanup contract とは分け、running app guard の検出境界だけを扱う

- [ ] updater toast locale boundary 候補を追加する
  - `src/hooks/use-updater.ts` の manual update check toast 日本語直書きを locale key 経由に寄せる
  - `src/__tests__/hooks/use-updater.test.ts` で update check 失敗時 / no-update 時の toast が `ja` / `en` の言語設定に従うことを固定する
  - updater startup unmount guard や progress payload schema とは分け、manual updater toast copy だけを扱う

- [ ] command palette message translation fallback 候補を追加する
  - `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts` の `enReader` / `jaReader` 直接 import fallback を pure helper へ切り出す
  - missing resource fallback、`{{feedId}}` / `{{message}}` 補間、`ja` 以外は `en` へ落ちることを focused test で固定する
  - command palette resource ranking とは分け、message translation fallback だけを扱う

- [ ] shared dialog close label locale 候補を追加する
  - `src/components/ui/dialog.tsx` の `Close` 直書きを props または common locale key 経由に寄せる
  - dialog wrapper test で `showCloseButton` の accessible name が props 由来になり、未指定時 fallback が locale と一致することを確認する
  - feature dialog copy 変更とは分け、shared dialog primitive の close label だけを扱う

- [ ] sidebar landmark locale 候補を追加する
  - `src/components/reader/sidebar.tsx` の `aria-label="Sidebar"` 直書きを reader/sidebar locale key へ寄せる
  - sidebar rendering test で `en` は `Sidebar`、`ja` は日本語 landmark 名になることを固定する
  - sidebar header runtime prop boundary とは分け、navigation landmark copy だけを扱う

- [ ] provider normalizer URL trim 候補を追加する
  - `src-tauri/src/infra/provider/normalizer.rs` の article URL 選択で `href.trim()` 判定後に未 trim の URL を返さないようにする
  - Rust test で前後空白付き article link が `RemoteEntry.url == Some("https://example.com/article")` になることを固定する
  - local provider private URL guard とは分け、feed entry URL normalization だけを扱う

- [ ] provider normalizer media type params 候補を追加する
  - `src-tauri/src/infra/provider/normalizer.rs` の HTML link 判定で `text/html; charset=utf-8` など media type parameter 付き値を扱えるようにする
  - Rust test で `rel=self` feed URL より `rel=alternate type="text/html; charset=utf-8"` article URL が優先されることを固定する
  - provider URL trim とは分け、article link media type parsing だけを扱う

- [ ] provider thumbnail href normalization 候補を追加する
  - `src-tauri/src/infra/provider/normalizer.rs` の thumbnail fallback で blank image href を skip し、採用 href を trim する
  - Rust test で空の `image/png` enclosure の次にある空白付き `image/webp` URL が trim 済みで採用されることを固定する
  - article responsive media styling とは分け、provider thumbnail URL normalization だけを扱う

- [ ] local subscription site URL preference 候補を追加する
  - `src-tauri/src/infra/provider/local.rs` の `create_subscription` で Atom self feed link より alternate HTML site link を優先する
  - Rust test で self atom link と alternate HTML link が並ぶ feed から `subscription.site_url` が alternate HTML になることを固定する
  - feed discovery site URL scoring とは分け、local provider subscription site URL selection だけを扱う

- [ ] GReader missing categories fallback 候補を追加する
  - `src-tauri/src/infra/provider/greader.rs` の `GReaderItem.categories` に default を持たせ、互換 API の categories 省略で stream parse が落ちないようにする
  - Rust test で categories 省略 item が unread / unstarred として parse されることを固定する
  - GReader item id pagination limit とは分け、item state category fallback だけを扱う

- [ ] GReader published fallback 候補を追加する
  - `src-tauri/src/infra/provider/greader.rs` の `map_item_to_entry` で `published` なし `updated` ありの記事が sync 時刻依存の `Utc::now()` にならないようにする
  - Rust test で `published=None`, `updated=1700000100` の item が `published_at` / `updated_at` とも updated timestamp になることを固定する
  - GReader categories fallback とは分け、entry timestamp fallback だけを扱う

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

- [ ] Storybook runtime flag reset 候補を追加する
  - `src/components/storybook/story-tauri-runtime.ts` の runtime present / missing 切替時に `__TAURI_INTERNALS__` と browser mock flags の残り方を統一する
  - story runtime tests で missing 時は property descriptor も消え、present 時は `__DEV_BROWSER_MOCKS__` / `__ULTRA_RSS_BROWSER_MOCKS__` が false になることを固定する
  - Storybook stale server health check とは分け、Storybook runtime global state cleanup だけを扱う

- [ ] storage key prefix migration 候補を追加する
  - `src/constants/storage.ts` の `startupSyncLastTriggeredAt` だけ `ultra-rss:` prefix がない状態を整理する
  - `src/__tests__/constants/storage.test.ts` で永続 storage key の prefix contract を固定し、移行するなら旧 key から新 key へ読めることを確認する
  - command history storage とは分け、startup sync storage key migration だけを扱う

- [ ] startup sync storage getter guard 候補を追加する
  - `src/lib/sync/startup-sync-storage.ts` で `window.localStorage` getter 自体が `SecurityError` を投げる環境でも public function が落ちないようにする
  - `src/__tests__/lib/startup-sync-storage.test.ts` で getter failure 時に read は not throttled、write は no-op になることを固定する
  - storage key prefix migration とは分け、storage access failure boundary だけを扱う

- [ ] command history storage getter guard 候補を追加する
  - `src/components/reader/hooks/command-palette/use-command-history.ts` の `readStorage()` で `window.localStorage` getter failure を捕捉する
  - `src/__tests__/hooks/use-command-history.test.ts` で getter failure 時に `getHistory()` は `[]`、`addToHistory()` / `clearHistory()` は throw しないことを固定する
  - command palette message translation fallback とは分け、command history storage access だけを扱う

- [ ] command history persisted size cap 候補を追加する
  - `src/schemas/storage.ts` の `CommandHistoryStorageSchema` 読み込み時にも `MAX_COMMAND_HISTORY` 超過を丸める
  - `src/__tests__/schemas/storage.test.ts` と `src/__tests__/hooks/use-command-history.test.ts` で巨大な保存済み配列が UI にそのまま流れないことを確認する
  - command history storage getter guard とは分け、persisted history size normalization だけを扱う

- [ ] sidebar expanded folders storage failure 候補を追加する
  - `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts` の expanded folder 永続化で `setItem` 失敗を捕捉する
  - `src/__tests__/hooks/use-sidebar-startup-folder-expansion.test.ts` で storage quota / unavailable 時も UI state 更新は維持されることを固定する
  - sidebar navigation frame cleanup とは分け、expanded folder persistence failure だけを扱う

- [ ] preferences load normalization 候補を追加する
  - `src/stores/preferences-store.ts` の `loadPreferences()` で backend から返る schema 外 preference 値を store state に入れる前に default へ正規化する
  - `src/__tests__/stores/preferences-store.test.ts` で `layout: "narrow"` や `unread_badge: "bad"` が schema default へ戻ることを確認する
  - settings preference key type boundary とは分け、loaded preference value normalization だけを扱う

- [ ] account repository provider kind decode 候補を追加する
  - `src-tauri/src/infra/db/sqlite_account.rs` で DB 上の未知 `kind` を `ProviderKind::Local` に丸めず decode error にする
  - Rust test で `kind='UnknownProvider'` の account row を `find_all` / `find_by_id` した時に persistence error になり、Local として返らないことを固定する
  - account deletion keyring order とは分け、account repository enum decode だけを扱う

- [ ] account verification status decode 候補を追加する
  - `src-tauri/src/infra/db/sqlite_account.rs` で未知 `connection_verification_status` を `Unverified` に丸めず decode error にする
  - Rust test で `connection_verification_status='expired'` の row が persistence error になり、Unverified として返らないことを固定する
  - provider kind decode とは分け、connection verification status decode だけを扱う

- [ ] pending mutation missing id guard 候補を追加する
  - `src-tauri/src/service/sync_flow.rs` で `PendingMutation.id == None` の row を push 後に silent skip しない contract を固定する
  - fake `PendingMutationRepository` test で deletion impossible な mutation を silent success にせず、再送されない方針を明示する
  - pending mutation DB error contract とは分け、missing local mutation id handling だけを扱う

- [ ] pending mutation remote id validation 候補を追加する
  - `src-tauri/src/infra/db/sqlite_pending_mutation.rs` で blank / whitespace-only `remote_entry_id` を保存前に拒否する
  - Rust test で `""` / `"   "` が `DomainError::Validation` になり、pending row が増えないことを固定する
  - pending mutation missing id guard とは分け、remote entry id invariant だけを扱う

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

- [ ] settings action aria label contract 候補を追加する
  - `src/components/settings/settings-page-view.tsx` と `src/components/settings/shortcuts-settings-view.tsx` の ``${actionLabel}: ${label}`` 直組みを locale/control props へ寄せる
  - view test で `actionAriaLabel` / `resetAriaLabel` props が優先され、controller test で `ja` の aria label が locale key 由来になることを確認する
  - settings nav/page/modal contract 再設計とは分け、action button aria label だけを扱う

- [ ] general settings language option contract 候補を追加する
  - `src/components/settings/hooks/use-general-settings-view-props.ts` の `English` / `日本語` self-label を locale 例外として残すか locale 管理へ寄せるか固定する
  - `src/__tests__/components/use-general-settings-view-props.test.ts` で `system` は locale 由来、`en` / `ja` は意図した self-label であることを確認する
  - general settings preference handling とは分け、language option label contract だけを扱う

- [ ] IPC pagination limit schema parity 候補を追加する
  - `src/api/schemas/commands.ts` の `paginationLimitSchema` を Rust 側 article / tag list limit 上限 `200` と揃える
  - `src/__tests__/api/schemas.test.ts` で `limit: 200` は通し、`201` / `Infinity` / 小数は parse で落ちることを固定する
  - article list query scope とは分け、frontend IPC pagination limit だけを扱う

- [ ] list articles filter exclusivity 候補を追加する
  - `src/api/schemas/commands.ts` の `listArticlesArgs` で `unreadOnly: true` と `starredOnly: true` の同時指定を拒否する
  - `src/__tests__/api/schemas.test.ts` で片方だけ true は通し、両方 true は parse error になることを固定する
  - article scope matrix 再設計とは分け、list articles filter exclusivity だけを扱う

- [ ] open in browser schema URL boundary 候補を追加する
  - `src/api/schemas/commands.ts` の `openInBrowserArgs` を `openExternalUrlArgs` / `addToReadingListArgs` と同等の URL validation に寄せる
  - `src/__tests__/api/tauri-commands.test.ts` で blank / newline / `mailto:` / `file:` が invoke 前に失敗し、valid URL は trim 済みで渡ることを固定する
  - browser webview focus policy とは分け、open-in-browser IPC validation だけを扱う

- [ ] search articles query schema trim 候補を追加する
  - `src/api/schemas/commands.ts` の `searchArticlesArgs.query` が blank / whitespace-only query を許さないようにする
  - `src/__tests__/api/schemas.test.ts` と必要なら `src/__tests__/api/tauri-commands.test.ts` で blank search が invoke 前に止まることを固定する
  - article search source scope とは分け、search IPC query validation だけを扱う

- [ ] mute keyword IPC schema trim 候補を追加する
  - `src/api/schemas/commands.ts` の `createMuteKeywordArgs.keyword` を backend invariant と同じく trim / blank reject にする
  - `src/__tests__/api/schemas.test.ts` または `src/__tests__/hooks/tag-mute-settings-contract.test.ts` で `" spoiler "` は `spoiler`、blank は reject になることを固定する
  - mute keyword scope race guard とは分け、mute keyword IPC input normalization だけを扱う

- [ ] create query whitespace id guard 候補を追加する
  - `src/hooks/create-query.ts` の enabled 判定が `!!id` だけで whitespace-only id を fetcher に渡さないようにする
  - `src/__tests__/hooks/create-query.test.tsx` で whitespace-only id は disabled のまま fetcher が呼ばれないことを固定する
  - individual command schema 変更とは分け、generic query hook id boundary だけを扱う

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

- [ ] article body feed label suffix cleanup 候補を追加する
  - `src/lib/content/html.ts` の `normalizeArticleBodyHtml()` で先頭の `Feed Name:` / `Feed Name｜` / `Feed Name -` 形式を小さく除去対象にする
  - `src/__tests__/lib/html.test.ts` で `Tech Blog:` は除去、`Tech Blog Weekly` や media を含む先頭 node は維持されることを固定する
  - article summary spacing とは分け、body leading feed label cleanup だけを扱う

- [ ] ArticleDto blank URL normalization 候補を追加する
  - `src/api/schemas/article.ts` の `url` / `thumbnail` が whitespace-only string を DTO 境界で通さないようにする
  - `src/__tests__/api/schemas.test.ts` で `url: "   "` / `thumbnail: "   "` を reject または `null` 正規化する方針を固定する
  - provider thumbnail href normalization とは分け、frontend Article DTO schema boundary だけを扱う

- [ ] release workflow manual tag guard 候補を追加する
  - `.github/workflows/release.yml` の `workflow_dispatch` が tag ref 以外で non-version release を作れないようにする
  - repo contract test で manual dispatch は tag input 必須、または `refs/tags/v` のみ release 作成可能なことを固定する
  - release install verification docs とは分け、release workflow dispatch guard だけを扱う

- [ ] Tauri config schema URL contract 候補を追加する
  - `src-tauri/tauri.conf.json` の `$schema` を公式 `tauri-apps/tauri` 系の v2 schema に揃える
  - `src/__tests__/schemas/tauri-config-identifiers.test.ts` で schema URL が unofficial fork や古い version に drift しないことを固定する
  - Tauri identifier / bundle metadata contract とは分け、tauri config schema URL だけを扱う

- [ ] package engines mise parity 候補を追加する
  - `package.json` に Node / pnpm engines を明示し、`mise.toml` の `[tools].node` / `npm:pnpm` と揃える
  - `src/__tests__/config/repo-contracts.test.ts` で `engines.node` / `engines.pnpm` と mise / `packageManager` の整合を固定する
  - package manager / E2E port drift とは分け、runtime toolchain version visibility だけを扱う

- [ ] PackageJsonSchema static fields 候補を追加する
  - `src/schemas/app-config.ts` の `PackageJsonSchema` で `version` / `packageManager` / `private` / `type` / `engines` を parse できるようにする
  - `src/__tests__/schemas/package-scripts.test.ts` で package static contract の重要 field が schema から検証できることを固定する
  - package engines mise parity とは分け、package json schema coverage だけを扱う

- [ ] markdown task glob parity 候補を追加する
  - `mise.toml` の `format:md` / `lint:md` が `MD_GLOB` / exclude env と drift しないようにする
  - `src/__tests__/schemas/package-scripts.test.ts` で markdown format / lint の対象 glob と exclude set が一致することを固定する
  - markdownlint 実行結果とは分け、task definition parity だけを扱う

- [ ] issue template affected area parity 候補を追加する
  - `.github/ISSUE_TEMPLATE/02-bug.yml` の `Affected Areas` に workflow/config failure を起票しやすい選択肢を追加するか、labeler 説明との対応を固定する
  - `src/__tests__/config/repo-contracts.test.ts` で issue template の領域選択肢と labeler / 自動領域ラベルの最低限対応を確認する
  - release label parity contract とは分け、issue template affected area contract だけを扱う

- [ ] icon toolbar ariaDisabled activation guard 候補を追加する
  - `src/components/shared/icon-toolbar-control.tsx` の `ariaDisabled` が `aria-disabled="true"` だけでなく click / Enter / Space の実行抑止にも効くようにする
  - `src/__tests__/components/icon-toolbar-control.test.tsx` で tooltip は維持しつつ、pointer / keyboard activation で `onClick` しないことを固定する
  - settings action aria label contract とは分け、shared icon toolbar の disabled interaction だけを扱う

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

- [ ] reqwest error classification helper 候補を追加する
  - `src-tauri/src/domain/error.rs` の DNS / connect / timeout 分類 test を外部ネットワーク依存から pure helper test へ寄せる
  - Rust test で主要 branch を fake/input helper で固定し、実 reqwest request test は最小補助にする
  - retryable message redaction とは分け、network error classification test stability だけを扱う

- [ ] tauri mock folder default fixture 候補を追加する
  - `tests/helpers/tauri-mocks.ts` の default `list_folders` が `sampleFolders` を account filter 済み clone として返すようにする
  - `tests/helpers/tauri-mocks.test.ts` で返却値 mutation が次回呼び出しへ漏れないことを固定する
  - fixture folder relationship contract とは分け、default folder mock behavior だけを扱う

- [ ] tauri mock call recorder helper 候補を追加する
  - `tests/helpers/tauri-mocks.ts` / `tests/helpers/tauri-types.ts` に schema validation 後 args を記録できる call recorder helper を用意する
  - helper test で handler が `undefined` を返した場合は既存 default handler に fallback することを固定する
  - tauri default mock command coverage とは分け、test call recording ergonomics だけを扱う

- [ ] test query client mutation retry default 候補を追加する
  - `tests/helpers/create-wrapper.tsx` の `createTestQueryClient` で queries だけでなく mutations retry も default false にする
  - helper test で `queries.retry` / `mutations.retry` が false になり、明示 override は維持できることを固定する
  - TanStack Query invalidation contract とは分け、test query client default behavior だけを扱う

- [ ] test runtime flags teardown 候補を追加する
  - `tests/setup.ts` / `tests/helpers/tauri-runtime.ts` の共通 teardown で IPC mock だけでなく `__TAURI_INTERNALS__` / browser mock flags も reset する
  - helper test で runtime present/missing/dev mock flags が test 間で漏れないことを固定する
  - Storybook runtime flag reset とは分け、Vitest global runtime teardown だけを扱う

- [ ] MemoryStorage DOM parity 候補を追加する
  - `tests/setup.ts` の `MemoryStorage` fallback が DOM Storage と同じ key/value string coercion と insertion order を守ることを固定する
  - `src/__tests__/helpers/test-setup-storage.test.ts` で `setItem` / `getItem` / `removeItem` / `key()` の挙動を確認する
  - localStorage getter failure guards とは分け、test fallback storage semantics だけを扱う

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

- [ ] NavRowButton trailing motion number contract 候補を別バッチで追加する
  - `src/components/shared/nav-row-button.tsx` で string / number trailing は `MotionNumber` 経由、ReactNode trailing はそのまま描画される契約を固定する
  - default button type が `button` であることも shared nav row の regression test に含める
  - sidebar row density、motion constants、feed unread count semantics は別バッチにする

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
