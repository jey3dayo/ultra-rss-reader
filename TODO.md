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

#### subscriptions-index-page filter/scroll restore tests quarantine 解除

- [ ] priority: P2 / domain: quality-tooling / work type: defect fix
  - created batch: 2026-06-13
  - 対象: `src/__tests__/components/subscriptions-index-page.test.tsx` の 3 件(`filters the list in place from the summary cards and restores all subscriptions` / `removes deferred feeds from the active review filter and clears the detail pane` / `restores a returned stale filter, collapsed group state, and list scroll position`)
  - scope: 上記 3 件が CI 親コミット d992e6d0a では緑だったが 6c439457 以降赤になり、ローカル darwin 単体実行でも決定的に 3/3 失敗する。filter 反映の同期 assertion / scrollTop 復元の timing 依存が疑われる。`it.skip` で flaky-quarantine 中(annotation 同梱)。root cause を特定して恒久修正し skip を解除する
  - 関連: `tests/setup.ts` に document.body/documentElement の inline style リセットを追加済み(別ファイルの scroll-lock リーク対策)、`vitest.config.ts` に `unstubGlobals`/`unstubEnvs` 追加済み。これらだけでは当 3 件は直らなかった
  - acceptance criteria: `pnpm exec vitest run --environment jsdom src/__tests__/components/subscriptions-index-page.test.tsx` が CI ubuntu で 3 回連続 0 failed になり、`it.skip` を `it` に戻して full suite も緑
  - focused verification: `mise run test:unit:dom`
  - 発見方法: 2026-06-13 リリース前 CI 確認(focused test で再現・固定する分類)

### Rust Provider / DB / Scheduler

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
