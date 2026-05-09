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
