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

- [ ] P3 TODO priority taxonomy を CLAUDE.md / TODO.md で同期する
  - 対象: `CLAUDE.md`, `TODO.md`
  - TODO が大量化しているため、P1/P2/P3 の意味が agent ごとに揺れると、重要度の低い cleanup とデータ破壊系リスクが同じ扱いになりやすい
  - P1 は data loss/security/stale destructive action、P2 は runtime boundary/contract drift、P3 は observability/polish のように短い分類を明記する

- [ ] P2 React Doctor の unused type / unused export を機械削除できる単位へ分ける
  - 対象: `src/stores/ui-store.ts`, `src/api/tauri-commands.ts`, `src/constants/*`, `src/components/**`, `tests/helpers/*`
  - unused type 67 件、unused export 58 件が出ており、公開 contract と dead surface が混ざると型配置整理や import 移動のたびに判断コストが増える
  - public API、test helper、storybook/dev-only、real dead code に分類し、worker 単位で削除または contract test へ明示する

- [ ] P3 React 19 deprecated API warning を context wrapper 単位で移行判断する
  - 対象: `src/components/settings/shared/settings-content-layout.tsx`, `src/components/settings/**`
  - React Doctor は `useContext` を React 19 の `use()` 移行候補として検出しているが、現時点で全体方針がないまま局所移行すると style が揺れる
  - React 19 API adoption policy、compiler有無、library compatibility、context read test を整理し、移行するなら settings shared から小さく始める

- [ ] P3 React Doctor の `.toSorted()` / combine-iterations 指摘を test/dev と production で分けて処理する
  - 対象: `src/__tests__/**`, `tests/helpers/**`, `src/dev/**`, `src/lib/**`
  - `.toSorted()` 29 件、combine iterations 59 件は test/dev noise と production hot path が混在しており、一括置換すると Node/WebView target や readability を崩しやすい
  - runtime target、polyfill不要性、production-only優先、test helper bulk rewrite の順でバッチ化する

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

- [ ] P3 React Compiler 未導入状態の採用判断メモを作る
  - 対象: `CLAUDE.md`, `.claude/rules/*`, `TODO.md`, `vite.config.ts`
  - React Doctor は React 19.2.6 を検出している一方で React Compiler は未検出なので、今後の memoization / effect cleanup の判断基準が compiler 有無で揺れやすい
  - すぐ導入するかではなく、compiler adoption preflight、unsupported pattern scan、performance gate、opt-in/opt-out 方針を task 化する

- [ ] P2 article-view test の repeated extraction を reader fixture helper へ寄せる
  - 対象: `src/__tests__/components/article-view.test.tsx`, `src/__tests__/lib/article-list.test.ts`, `tests/helpers/fixtures.ts`
  - React Doctor の `js-combine-iterations` が article view/list test に出ており、article fixture から group/item を抽出する処理が散っている可能性がある
  - selected article、empty group、read/unread/starred、tag filtered list の helper を共有し、test readability と assertion diagnostics を維持する
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

- [ ] P2 sidebar test の async loop を user-event ordering と fixture setup に分離する
  - 対象: `src/__tests__/components/sidebar.test.tsx`, `src/components/reader/sidebar-view.tsx`
  - React Doctor の `async-await-in-loop` が sidebar test に出ており、連続 user event の意図的逐次実行と独立 fixture setup が混ざっている可能性がある
  - keyboard navigation / pointer interaction は逐次維持し、独立 render setup や mock response setup は並列化できるか確認する

- [ ] P3 test-only `.toSorted()` 一括移行バッチを node-target gate 後に作る
  - 対象: `src/__tests__/**/*.test.ts`, `src/__tests__/**/*.test.tsx`, `tests/helpers/*`
  - React Doctor の `.toSorted()` warning 29 件の大半は test-only なので、runtime target 確認後に production 変更と分けて一括処理できる
  - test helper bulk rewrite、Node 24 support、snapshot order stability、readability regression の review checklist を用意する

- [ ] P2 use-updater hook の unused export を updater schema migration と一緒に整理する
  - 対象: `src/hooks/use-updater.ts`, `src/api/schemas/update-info.ts`, `src/__tests__/hooks/use-updater.test.ts`
  - React Doctor / Knip が updater hook/schema 周辺に unused export/type を検出しており、別エージェントの updater schema 差分と衝突しやすい
  - hook result、test fixture、schema parse helper、Tauri command wrapper を分類し、public API と fixture を別名で明確にする

- [ ] P2 article-display helper の unused type を sanitized article view contract と揃える
  - 対象: `src/lib/articles/article-display.ts`, `src/lib/articles/article-view.ts`, `src/components/reader/article-content-view.tsx`
  - React Doctor / Knip が article display 周辺の unused type/export を検出しており、backend article DTO、sanitized HTML、view model の境界が曖昧になりやすい
  - empty body、sanitized title、external link、relative URL、feed label stripping の view model contract を確認し、不要な display type を削る

- [ ] P2 article-list-header unused type を header action contract と colocate する
  - 対象: `src/components/reader/article-list-header.tsx`, `src/components/reader/article-list-header-search.tsx`, `src/components/reader/hooks/article-list/use-article-list-header-actions.ts`
  - React Doctor / Knip が article list header の unused type を検出しており、header props、search props、action hook params が分散している
  - view-local props は component 内へ寄せ、hook params/result と keyboard/search focus contract だけを public type として残す

- [ ] P2 browser / storage / events constants の unused type を runtime boundary constants として整理する
  - 対象: `src/constants/browser.ts`, `src/constants/storage.ts`, `src/constants/events.ts`, `src/lib/runtime/*`
  - React Doctor / Knip が runtime constants の unused type/export を検出しており、browser event name、storage key、Tauri event key の source of truth が散りやすい
  - public runtime event、private storage key、test fixture key、deprecated alias を分類し、残す constants は contract test へ明示する
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

- [ ] P1 article content の `SanitizedArticleHtml` brand を runtime boundary として固定する
  - 対象: `src/components/reader/article-content-view.tsx`, `src/lib/content/html.ts`, `src-tauri/src/infra/sanitizer.rs`
  - `SanitizedArticleHtml` は型 brand だけで runtime では通常の string なので、未 sanitize HTML が `fromSanitizedArticleHtml` 経由で混入しても検出しにくい
  - backend sanitizer 済み DTO、frontend test fixture、view-local helper の境界を分け、raw HTML を渡す test helper には明示名を付ける

- [ ] P3 requestAnimationFrame / setTimeout flush helper を UI tests で共通化する
  - 対象: `src/__tests__/components/article-view.test.tsx`, `src/__tests__/components/sidebar.test.tsx`, `src/__tests__/hooks/use-updater.test.ts`, `src/__tests__/hooks/use-app-icon-theme.test.tsx`
  - `await new Promise((resolve) => setTimeout(resolve, 0))` が複数 test にあり、fake timer / real timer の混在で flake の原因になりやすい
  - `flushTimers` / `flushMicrotasks` / `flushRaf` helper を分け、real timer 前提の test を明示する

- [ ] P2 startup main webview focus restore の async spawn を lifecycle-aware にする
  - 対象: `src-tauri/src/lib.rs`, `src/components/app-shell.tsx`, `src/hooks/use-screen-snapshot.ts`
  - startup focus restore は `tauri::async_runtime::spawn` + sleep 後に main window/webview を探すため、window close や slow startup で stale focus warning が出やすい
  - app handle drop、main window missing、webview missing、permission denied、retry不要条件の Rust test / manual verification を追加する

- [ ] P3 Rust test unwrap policy を production boundary と fixture boundary に分ける
  - 対象: `src-tauri/src/**/*.rs`, `src-tauri/tests/**/*.rs`, `CLAUDE.md`
  - Rust tests には `unwrap` / `expect` が多く、fixture setup と production behavior assertion が混ざると panic message が調査しづらい
  - fixture-only unwrap 許容、production boundary は error assertion、panic message naming、helper `expect_ok` の採用可否を決める

- [ ] P2 FeedTree drag drop overlay が folder row controls を過剰に覆わないようにする
  - 対象: `src/components/reader/feed-tree-folder-section.tsx`, `src/components/reader/feed-tree-selectable-row.tsx`, `src/components/reader/hooks/feed-tree/*`
  - drag 中の absolute overlay button が folder row 全体を覆うため、toggle/context/menu/focus target と drop target の責務が重なり、keyboard と pointer の挙動が壊れやすい
  - drag active 中の toggle click、context menu open、keyboard focus、drop target aria-label、same folder drop の component test を追加する

- [ ] P2 AppLayout の inert / aria-hidden fallback を WebView support matrix で検証する
  - 対象: `src/components/app-layout.tsx`, `src/__tests__/app.test.tsx`, `e2e/app.spec.ts`
  - hidden pane は `inert` と `aria-hidden` に依存するため、WebView 互換や test environment 差で focusable descendant が残ると keyboard navigation が背後 paneへ入る
  - inert unsupported fallback、programmatic focus、Tab navigation、compact/mobile/wide layout、subscriptions workspace open の e2e test を追加する

- [ ] P3 overlay / drag / inert の CSS token を scattered z-index から semantic layer へ寄せる
  - 対象: `src/components/app-shell.tsx`, `src/components/ui/dialog.tsx`, `src/components/shared/app-toast-view.tsx`, `src/components/shared/workspace-header.tsx`
  - z-index や pointer-events の数値が component 内に分散しており、overlay 追加のたびにどの layer が上に来るべきか review で判断する必要がある
  - semantic layer constants、CSS custom property、component snapshot、DESIGN/CLAUDE rule 化のどれで固定するか決める

- [ ] P2 Result.unwrap usage を async boundary ごとに failure surface 化する
  - 対象: `src/hooks/**`, `src/dev/**`, `tests/helpers/**`
  - `Result.unwrap` は成功前提を短く書ける一方、queryFn/dev scenario/test helper に混在しており、失敗時に user-visible error・console・test failure のどれにするかが呼び出し元ごとに曖昧
  - queryFn、mutationFn、dev-only loader、test helper に分類し、production path は explicit `Result.isFailure` で message redaction を固定する

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

- [ ] P3 similarity scan baseline を TODO / report command として定期更新できるようにする
  - 対象: `package.json`, `mise.toml`, `TODO.md`
  - 今回の `similarity-ts --threshold 0.9 src/` は 32 function pairs、1 similar type pair、2 type literal pairs を検出しており、今後の改善で何が減ったか追跡しにくい
  - `report:similarity` タスク、threshold 0.95/0.9/0.87 の使い分け、false positive allowlist、TODO 化済み項目の baseline 記録を整備する

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
