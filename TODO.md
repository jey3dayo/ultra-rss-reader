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

#### UI primitive direct import commonization triage

- [ ] priority: P2 / domain: reader-state / work type: shared component triage + report maintenance
  - 対象: `src/components/reader/sidebar-footer-actions.tsx`, `src/components/subscriptions-index/subscription-detail-pane.tsx`, `src/components/shared/`
  - scope: `src/components/ui/*` の直接 import 調査で見つかった共通化候補を、意味・状態・a11y が揃うものだけ `shared` または settings-local shared へ寄せる
  - candidates:
    - subscriptions management action: `subscription-detail-pane` の compact edit/delete action と `DecisionButton` / workspace action class の境界を整理する
  - local exception: `article-tag-picker-popover` の create action は icon-only で visible loading label を持たないため、loading label/spinner helper へ寄せず現状維持する
  - direct import のまま残す候補: `ScrollArea`, `Dialog`, `Command`, `Collapsible`, `Skeleton` は layout/runtime/feature state 依存が強いため、実装時に再評価理由を残す
  - report responsibility: 実装後に `mise run report:similarity` を確認し、共通化で TODO-backed false positive や similarity baseline が変わる場合は `scripts/similarity-report.ts` の report baseline / TODO ref を同じ変更に含める
  - acceptance criteria: 共通化した箇所は既存 visual language と `DESIGN_REVIEW.md` の shared 昇格条件に合う。共通化しなかった候補は local exception として理由が説明できる。report baseline drift が残らない
  - focused verification: `mise run report:similarity` と、変更対象に応じて focused component test または `mise run test:unit:dom`

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
