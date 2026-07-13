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

- P3 local-sync auto-sync residual debt (created batch: 2026-07-04, last reviewed: 2026-07-14)
  - priority: P3 / domain: provider-sync / work type: implementation + i18n / write scope: src-tauri local_account_sync + locales
  - resolved: 手動 export 成功後の digest 更新を追加(直後の auto-export が no-op 化)。empty-operations digest/export・auto-import Err 分岐・rejected-only silent drop の現状挙動を contract test で固定した(CHANGELOG [Unreleased] 参照)
  - 残: merge レベル `rejected_operations` は auto path で warning にならず silent drop(手動 import では件数可視)。warning 文言 + i18n 追加が必要な別ギャップとして残す。発見方法: focused test で現状固定済み、実装時に warning surface を追加
  - pre-existing: `trigger_startup_sync` の warnings は SyncResult 返却のみで sync-warning event を emit しない(起動時は toast なし、次の scheduler cycle で toast される)

### App Shell / Command Palette / Dev Intent

### Reader UI / Account Settings

- P3 reader next-article button の has-next 判定が search 中に list pane とずれうる (created batch: 2026-07-14)
  - priority: P3 / domain: reader-state / work type: implementation-time checklist / write scope: use-article-view-selection.ts の hasNextArticle 算出
  - `hasNextArticle` は content pane の `data.filteredArticles`(`searchResults: undefined`)から算出するため、list pane で検索が有効なときは実際の navigable list と件数がずれ、末尾判定が不一致になりうる。通常閲覧では問題なし。既知の許容エッジとして記録。発見方法: 実装時チェックリスト + 検索中の手動確認

### Dev / Tooling / E2E / Test Helpers

- P3 TypeScript 7 compatibility alias cleanup — BLOCKED (external) (created batch: 2026-07-10, last reviewed: 2026-07-14)
  - priority: P3 / domain: quality-tooling / work type: dependency compatibility follow-up / write scope: package.json, pnpm-lock.yaml, build/typecheck task definitions
  - blocked: `@typescript-eslint/typescript-estree` の peer dependency は現時点で `typescript >=4.8.4 <6.1.0` であり TypeScript 7(`typescript-7` = `typescript@rc`)を正式サポートしていない。`quality-policy.md` によりリスクのある依存移行を incidental cleanup として実施しない
  - unblock 条件: typescript-eslint 等の TypeScript API 依存ツールが TS7 を peer として正式サポートしたら、`@typescript/typescript6` alias と `typescript-7` を外し `tsc6` を `tsc` に戻して emit build も TS7 へ移行する
  - acceptance criteria: `tsc6` が不要になり、typecheck・emit build・lint 関連ツールが単一の TypeScript 7 で動作する
  - focused verification: `npm view @typescript-eslint/typescript-estree peerDependencies` で TS7 対応を確認 → `mise run ci`

### Rust Provider / DB / Scheduler

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

- P3 tauri-系 skill を repo-local apm.yml へ移管 (created batch: 2026-07-10, last reviewed: 2026-07-14)
  - priority: P3 / domain: release-native / work type: 移管作業(apm-repo-bootstrap) / write scope: global apm.yml + このリポジトリの repo-local apm.yml
  - decided (2026-07-14): `~/.apm`(global apm.yml)の `EpicenterHQ/epicenter/.agents/skills/tauri`、catalog の `tauri-icon-gen`、`tauri-webview-geometry` はこのリポジトリでしか使っていないため、repo-local `apm.yml` へ移す。global 汚染を避け、単一リポジトリ専用の依存をローカルに閉じる
  - follow-up: `apm-repo-bootstrap` skill で global から外し repo-local `apm.yml` へ移す。将来複数 Tauri repo で再利用が必要になったら専用リポジトリ切り出しを再検討する
  - 発見方法: 移管後 `mise run` 系タスクと skill 露出で疎通確認

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
