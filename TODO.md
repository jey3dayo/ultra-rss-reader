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

#### UI commonization backlog refresh

- [x] priority: P2 / domain: settings-state / work type: shared row cleanup / recommended next tranche
  - 対象: `src/components/settings/settings-page-view.tsx`, `src/components/shared/labeled-action-input-row.tsx`, related settings page/modal tests
  - evidence: settings page text controls still hand-roll `LabeledControlRow + Input + SettingsActionButton` while mute/tag settings already use shared action rows
  - scope: text controls with inline settings action should use the existing shared action-input row API or a narrow compatible extension; keep settings-specific button styling at the call site
  - acceptance criteria: `settings-page-view` no longer imports `@/components/ui/input` directly for action text rows, visible copy and control callbacks stay unchanged, and row width/a11y remain covered by focused tests
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-settings-modal-view-props.node.test.ts src/__tests__/components/settings-modal.test.tsx --project node --project jsdom` plus `pnpm exec tsc --noEmit`
  - stop if shared row API changes would force unrelated settings pages or public prop churn
- [x] priority: P2 / domain: reader-state / work type: passive state action commonization
  - 対象: `src/components/reader/article-empty-state-view.tsx`, `src/components/reader/article-list-screen-view.tsx`, `src/components/reader/browser-surface-state-card.tsx`, `src/components/reader/feed-tree-empty-state.tsx`
  - evidence: reader passive/empty/error states each import `@/components/ui/button` directly for small retry/setup/open actions with similar subdued surface treatment
  - scope: introduce a reader/passive-state action button only if it removes repeated state-action styling without absorbing business logic or icon choices
  - acceptance criteria: direct `Button` imports are reduced in the listed passive state surfaces, visual variants remain equivalent, and focused component tests assert accessible names and key classes
  - focused verification: `pnpm exec vitest run src/__tests__/components/article-list-screen-view.test.tsx src/__tests__/components/browser-surface-state-card.test.tsx --project jsdom` plus `pnpm exec tsc --noEmit`
  - stop if candidate surfaces need different interaction semantics or broad visual redesign
- [ ] priority: P2 / domain: reader-state / work type: similarity triage
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`, `src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts`, `src/components/reader/hooks/article-list/use-article-list-view-state.ts`, `scripts/similarity-report.ts`
  - evidence: `mise run report:similarity` currently reports 42 function pairs against a scan baseline of 32; the gate still passes because unparsed blocks and type report drift are clean
  - scope: audit high-score hook lifecycle pairs before extracting helpers; prefer classifying false positives over broad lifecycle abstraction
  - acceptance criteria: either a narrow helper extraction lands with focused lifecycle tests, or `scripts/similarity-report.ts` false-positive baseline explains why the top pairs should remain separate
  - focused verification: `mise run report:similarity` plus focused node/jsdom tests for any touched hooks
  - stop if the duplicated unit is only generic hook shape or cancellation boilerplate without a safe shared owner

### Dev / Tooling / E2E / Test Helpers

#### Vitest jsdom dependency reduction

- [x] priority: P2 / domain: quality-tooling / work type: test split
  - 対象: `src/__tests__/dev/dev-mocks.test.ts`
  - scope: source/schema/mock-command の static contract を `.node.test.ts` へ分離し、window/document diagnostics は jsdom に残す
  - focused verification: `pnpm exec vitest run src/__tests__/dev/dev-mocks.node.test.ts --project node && pnpm exec vitest run src/__tests__/dev/dev-mocks.test.ts --project jsdom`
- [x] priority: P2 / domain: quality-tooling / work type: helper extraction
  - 対象: `src/__tests__/lib/actions.test.ts`
  - scope: action registry、preference toggle、sync/update/window command 契約を `.node.test.ts` へ分離し、document focus/navigation assertions は jsdom に残す
  - focused verification: `pnpm exec vitest run src/__tests__/lib/actions.node.test.ts --project node && pnpm exec vitest run src/__tests__/lib/actions.test.ts --project jsdom`
- [x] priority: P2 / domain: quality-tooling / work type: test classification
  - 対象: `src/__tests__/lib/clipboard.test.ts`
  - scope: `navigator.clipboard` と Tauri runtime の test shim を DOM-free に寄せ、clipboard fallback 契約を `.node.test.ts` へ移す
  - focused verification: `pnpm exec vitest run src/__tests__/lib/clipboard.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: view-model extraction
  - 対象: `src/__tests__/components/use-subscriptions-index-state.test.tsx`
  - scope: selection/disclosure/scroll/decision set の pure state model を feature-local lib に切り出し、React state/effect restoration は jsdom に残す
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-subscriptions-index-state.node.test.ts --project node && pnpm exec vitest run src/__tests__/components/use-subscriptions-index-state.test.tsx --project jsdom`

#### Vitest fixture cleanup and builder alignment

- [x] priority: P2 / domain: quality-tooling / work type: fixture cleanup
  - 対象: `src/__tests__/components/use-subscriptions-index-state.test.tsx`
  - scope: local `makeRow()` の手書き `SubscriptionListRow` を production の `buildSubscriptionListRows()` 由来に寄せる
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-subscriptions-index-state.test.tsx --project jsdom`
- [x] priority: P2 / domain: quality-tooling / work type: view-model extraction
  - 対象: `src/__tests__/components/use-settings-modal-view-props.test.tsx`
  - scope: content reset key と nav descriptor の pure builder を feature-local lib に出し、DOM不要な契約を `.node.test.ts` へ分離する
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-settings-modal-view-props.node.test.ts --project node && pnpm exec vitest run src/__tests__/components/use-settings-modal-view-props.test.tsx --project jsdom`

#### Vitest node migration batch

- [x] priority: P2 / domain: quality-tooling / work type: test classification
  - 対象: `src/components/reader/hooks/feed-dialogs/use-rename-feed-dialog-view-props.ts`, `src/__tests__/components/use-rename-feed-dialog-view-props.test.tsx`
  - scope: rename feed dialog の props builder を feature-local pure helper へ切り出し、既存テストを `.node.test.ts` へ移す
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-rename-feed-dialog-view-props.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: test split
  - 対象: `src/__tests__/hooks/use-command-search.test.ts`
  - scope: `parsePrefix` の純粋パーサ契約を `.node.test.ts` へ分離し、React hook の `useDeferredValue` 契約だけ jsdom に残す
  - focused verification: `pnpm exec vitest run src/__tests__/hooks/use-command-search.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: helper extraction
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/__tests__/components/use-article-list-data.test.tsx`
  - scope: article list data の pure computation を helper 化し、memo stability 以外の純粋契約を `.node.test.ts` へ寄せる
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-article-list-data.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: test classification
  - 対象: `src/__tests__/api/schemas.test.ts`, `src/__tests__/api/tauri-commands.test.ts`, `src/__tests__/dev/intent.test.ts`, `tests/helpers/tauri-mocks.test.ts`, `tests/tauri-command-return-contract.test.ts`
  - scope: DOM/Testing Library シグナルなしで node 実行が通る契約テストを `.node.test.ts` へ寄せる
  - focused verification: `pnpm exec vitest run src/__tests__/api/schemas.node.test.ts src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/intent.node.test.ts tests/helpers/tauri-mocks.node.test.ts tests/tauri-command-return-contract.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: test classification
  - 対象: `src/__tests__/lib/startup-sync-storage.test.ts`, `tests/test-isolation-policy.test.ts`
  - scope: storage shim で動く startup sync storage と repo policy contract を `.node.test.ts` へ寄せる
  - focused verification: `pnpm exec vitest run src/__tests__/lib/startup-sync-storage.node.test.ts tests/test-isolation-policy.node.test.ts --project node`
- [x] priority: P2 / domain: quality-tooling / work type: test split
  - 対象: `tests/helpers/async-flush.test.ts`
  - scope: microtask/macrotask/fake timer/legacy helper を `.node.test.ts` へ分離し、`requestAnimationFrame` 契約だけ jsdom に残す
  - focused verification: `pnpm exec vitest run tests/helpers/async-flush.node.test.ts --project node && pnpm exec vitest run tests/helpers/async-flush.test.ts --project jsdom`
- [x] priority: P2 / domain: quality-tooling / work type: fixture cleanup
  - 対象: `src/__tests__/components/use-article-list-sources.test.tsx`, `src/__tests__/lib/article-list.node.test.ts`
  - scope: 手書き source plan / source key 期待値を `resolveReaderSourcePlan()` 由来に寄せる
  - focused verification: `pnpm exec vitest run src/__tests__/components/use-article-list-sources.test.tsx --project jsdom && pnpm exec vitest run src/__tests__/lib/article-list.node.test.ts --project node`

### Rust Provider / DB / Scheduler

#### FreshRSS pending mutation partial-success audit

- [x] priority: P1 / domain: provider-sync / work type: contract audit + focused test
  - issue: #31
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - scope: pending mutation push が途中成功・途中失敗した場合の現行挙動を確認し、duplicate replay / local intent priority / queue deletion 単位の contract test を追加する
  - acceptance criteria: 現行挙動を test name と assertion で説明できる。仕様判断が必要な範囲は #31 に残し、実装修正へ進める範囲を分離する
  - focused verification: `rtk test cargo test --manifest-path src-tauri/Cargo.toml pending_mutation`

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

#### Feed content privacy change preflight

- [x] priority: P2 / domain: security-privacy / work type: implementation-time checklist
  - issue: #33
  - 対象: `docs/feed-content-privacy.md`, `docs/release-manual-verification.md`, feed content / WebView / CSP 変更差分
  - scope: feed content privacy、reader image loading、CSP、Web Preview へ触る変更時に、compatibility-first 継続か tightening かを #33 の判断対象として記録する
  - acceptance criteria: CSP / remote image / Web Preview に触る PR で、manual verification または issue escalation のどちらかが残る
  - focused verification: docs-only なら `mise run format:check`、実装差分ありなら該当 UI/native smoke を追加

### Release / Native / Keyboard / I18n / A11y

#### Long-running native operation sleep/resume preflight

- [x] priority: P2 / domain: release-native / work type: implementation-time checklist
  - issue: #32
  - 対象: updater download、OPML export、database backup/restore、`docs/release-manual-verification.md`
  - scope: sleep/resume、cancel、retry、partial artifact cleanup に触る変更時に、supported / unsupported / guarded の扱いを明記する
  - acceptance criteria: 変更 PR の verification notes に packaged-build manual verification または #32 への deferred reason が残る
  - focused verification: `mise run ci` に加えて、該当 surface の manual native verification を記録する

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
