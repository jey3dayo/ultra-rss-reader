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

### Rust Provider / DB / Scheduler

- [ ] P2 `provider-sync`: account/feed delete と background sync の concurrent mutation boundary を固定する
  - work type: race condition contract
  - write scope: account commands、feed commands、sync scheduler、sync flow repository writes、query invalidation
  - acceptance: delete 中の account/feed に対して in-flight sync が article/cache/retry state を書き戻しても削除済みデータが復活しない
  - focused verification: delete during fetch、delete before persist、sync completes after delete、retry state cleanup、frontend invalidation order
  - defer: multi-process DB lock redesign は別タスクにする

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

- [ ] P2 `provider-sync`: single feed の entry count / per-entry text size / media metadata cap を固定する
  - work type: parser scalability contract
  - write scope: feed normalizer、local provider pull entries、article repository persistence、sync result diagnostics
  - acceptance: 1 feed に大量 entry、巨大 summary/content、過大 media/enclosure metadata が入っても UI/DB/sanitizer が過負荷にならない
  - focused verification: 10k entries fixture、oversized content text、oversized title/author、huge media metadata、skipped entry diagnostics、partial sync summary
  - defer: infinite scrolling pagination redesign は別タスクにする

- [ ] P2 `security-privacy`: sanitizer version backfill を sync flow 依存だけにしない契約を固定する
  - work type: content security contract
  - write scope: article repository sanitizer version query、startup/read-path repair trigger、sync flow repair tests、article render boundary tests
  - acceptance: sanitizer policy 更新後、sync が走らない account/feed でも古い `content_sanitized` が長期に render されず、repair failure は user-visible degraded state か diagnostics に残る
  - focused verification: app startup with stale sanitizer_version、reader opens stale article before sync、repair batch failure、large stale batch cap、no raw HTML render fallback
  - defer: sanitizer crate replacement や HTML policy redesign は別タスクにする

### Release / Native / Keyboard / I18n / A11y

### Database / Updater / Window

- [ ] P2 `db-recovery`: startup migration recovery message と backup restore runbook の drift を防ぐ
  - work type: recovery documentation contract
  - write scope: startup error messages、backup path redaction、log/support checklist、database recovery tests
  - acceptance: migration failure、persistence failure、integrity failure の user-visible message が削除推奨や raw path leakage を再導入しない
  - focused verification: migrated-but-restored DB error、permission denied、integrity check failure、backup directory label、support checklist wording
  - defer: GUI restore wizard 実装は別タスクにする

### Article List / Schema / Mute / Tags / Share

- [ ] P2 `reader-state`: recent article history recording/clearing と account/article deletion の race を固定する
  - work type: history mutation contract
  - write scope: record article view command/hook、clear article view history、recent smart view context menu、article view/history tests
  - acceptance: deleted account/feed/article や history-disabled state を in-flight record/clear が再導入せず、clear は current account だけを対象にして recent smart view を安全に更新する
  - focused verification: record resolves after article delete、clear while selected account switches、history disabled during in-flight record、recent smart view open while clear、query invalidation rejection
  - defer: history retention duration、cross-device history sync、smart view ranking redesign は別タスクにする

### Feed / Folder / Storage / Settings Data

- [ ] P2 `db-recovery`: OPML import の post-commit refresh / query invalidation failure を partial success として扱う
  - work type: data import recovery contract
  - write scope: OPML import command、query statistics refresh、frontend import result handling、feed/folder invalidation tests
  - acceptance: DB transaction commit 後の query statistics refresh や frontend invalidation が失敗しても、import 自体を完全失敗に見せず、再試行で重複や mixed success toast を発生させない
  - focused verification: refresh_query_statistics failure after commit、frontend invalidation rejection、retry after partial success、duplicate folder/feed suppression、maintenance guard release
  - defer: OPML parser policy、large file cap、folder naming redesign は別タスクにする

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics
