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

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
