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

- P3 MAX_RETAINED_ARTICLE_IDS=50 と一括既読の仕様判断 (created batch: 2026-07-20)
  - priority: P3 / domain: reader-state / work type: decision + implementation / write scope: article-retention.ts + use-articles.ts
  - 未読51件以上の一括既読では cap により古い ID から retention が外れ、unread 表示で一部行が消える。また一括 retain が選択中記事の retention を追い出しうる。cap を bulk 時に緩めるか、消えてよい仕様とするか、選択中記事の eviction を防ぐかのプロダクト判断が必要。Rust 側返却順の ORDER BY 付与(newest 保証)もこの判断とセット。発見方法: 実装時チェックリスト + 大量未読フォルダでの手動確認

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

- P1 quick-xml <0.41 advisories via feed-rs/plist — BLOCKED (external) (created batch: 2026-07-15)
  - priority: P1 / domain: security-privacy / work type: dependency upgrade follow-up / write scope: src-tauri/Cargo.toml, src-tauri/Cargo.lock, .cargo/audit.toml
  - blocked: RUSTSEC-2026-0194 / RUSTSEC-2026-0195 (quick-xml quadratic-time attribute parsing + unbounded namespace-declaration memory exhaustion) remain via `feed-rs 2.3.1` (parses untrusted RSS/Atom feed content — reachable) and `plist 1.9.0 -> tauri 2.11.3` (lower reachability). Neither crate has released a version pinning quick-xml >=0.41 yet. Ignored in `.cargo/audit.toml` per `.claude/rules/quality-policy.md` Dependency Advisory Policy; our own direct quick-xml dependency is already bumped to 0.41 and unaffected
  - unblock 条件: feed-rs または plist が quick-xml >=0.41 を取り込んだ新バージョンをリリースしたら `cargo update -p feed-rs` / `cargo update -p plist` で追従し、`.cargo/audit.toml` の該当 ignore エントリと `quality-policy.md` の記録を削除する
  - acceptance criteria: `mise run audit:deps:rust` が ignore エントリなしで成功する
  - focused verification: `cargo info feed-rs` / `cargo info plist` で quick-xml 依存バージョンを確認 → 更新後 `cargo audit --file src-tauri/Cargo.lock`

### Release / Native / Keyboard / I18n / A11y

### Database / Updater / Window

- P3 window-state 復元の Windows 実機検証と generated schema 再生成 (created batch: 2026-07-28)
  - priority: P3 / domain: release-native / work type: manual verification / write scope: src-tauri/gen/schemas
  - `tauri-plugin-window-state` 追加時、`src-tauri/gen/schemas/windows-schema.json` は Windows 実機でしか再生成できないため、macOS で生成した `desktop-schema.json` を手で同期した(追加前は 3 ファイルが byte 一致、生成後も desktop/macOS は一致、`release-repo-contract` は 3 ファイルの一致を要求)
  - 残: 次の Windows ビルドで Tauri CLI に再生成させ、差分が出ないことを確認する。併せて Windows 実機でサイズ復元とセンタリング、および最大化して終了した場合は最後の非最大化サイズで開くこと(最大化状態は復元しない)を確認する
  - 発見方法: manual native verification (`docs/release-manual-verification.md` §5)

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
