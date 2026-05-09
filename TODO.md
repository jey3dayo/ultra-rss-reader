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

- [ ] P2 React Doctor の unused type / unused export を機械削除できる単位へ分ける
  - 対象: `src/stores/ui-store.ts`, `src/api/tauri-commands.ts`, `src/constants/*`, `src/components/**`, `tests/helpers/*`
  - unused type 67 件、unused export 58 件が出ており、公開 contract と dead surface が混ざると型配置整理や import 移動のたびに判断コストが増える
  - public API、test helper、storybook/dev-only、real dead code に分類し、worker 単位で削除または contract test へ明示する

- [ ] P3 React 19 deprecated API warning を context wrapper 単位で移行判断する
  - 対象: `src/components/settings/shared/settings-content-layout.tsx`, `src/components/settings/**`
  - React Doctor は `useContext` を React 19 の `use()` 移行候補として検出しているが、現時点で全体方針がないまま局所移行すると style が揺れる
  - React 19 API adoption policy、compiler有無、library compatibility、context read test を整理し、移行するなら settings shared から小さく始める

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

- [ ] P2 e2e app sequential await を test isolation と並列化可否で分類する
  - 対象: `e2e/app.spec.ts`, `src/__tests__/dev/scenario-runtime.test.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - React Doctor の `server-sequential-independent-await` が e2e と hook test に出ており、独立 setup を直列実行していると Playwright / Vitest の待ち時間が増える
  - browser state 共有、fixture isolation、user event ordering、screenshot timing に依存しない await だけ並列化する

- [ ] P3 test-only `.toSorted()` 一括移行バッチを node-target gate 後に作る
  - 対象: `src/__tests__/**/*.test.ts`, `src/__tests__/**/*.test.tsx`, `tests/helpers/*`
  - React Doctor の `.toSorted()` warning 29 件の大半は test-only なので、runtime target 確認後に production 変更と分けて一括処理できる
  - test helper bulk rewrite、Node 24 support、snapshot order stability、readability regression の review checklist を用意する

- [ ] P2 browser / storage / events constants の unused type を runtime boundary constants として整理する
  - 対象: `src/constants/browser.ts`, `src/constants/storage.ts`, `src/constants/events.ts`, `src/lib/runtime/*`
  - React Doctor / Knip が runtime constants の unused type/export を検出しており、browser event name、storage key、Tauri event key の source of truth が散りやすい
  - public runtime event、private storage key、test fixture key、deprecated alias を分類し、残す constants は contract test へ明示する
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
