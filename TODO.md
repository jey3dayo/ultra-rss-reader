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

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

### Browser WebView / Runtime Diagnostics

- [ ] P1 corrupted preference row が startup/menu/settings を連鎖的に壊さない quarantine policy を作る
  - 対象: preference repository、startup menu prefs、settings store
  - 1 行の不正 preference で menu rebuild や settings 全体が fallback すると、ユーザーが修復できない
  - unknown key、invalid value、oversized value、menu fallback、settings quarantine/reset の contract を追加する

- [ ] P2 provider credential verification request の side effect を account create/update と分離する
  - 対象: account setup、test connection commands、provider HTTP client
  - 接続確認が remote server 側で session/cookie/last-login を更新する場合、保存前の試行が side effect になる
  - verify before save、verify after save、cookie discarded、rate limit、failed verify logging の contract を追加する

- [ ] P3 Rust/TS cross-language enum drift を generated table で見える化する
  - 対象: domain enums、API schemas、frontend constants
  - provider kind、sync status、display mode、error category などの enum が増えると手動 parity test だけでは漏れる
  - Rust enum list、TS schema list、locale labels、unknown fallback、dead variant の report を追加する

- [ ] P3 repository SQL strings を migration-defined table/column inventory と照合する tooling を作る
  - 対象: `src-tauri/src/infra/db`, migrations, repo contract tests
  - column rename や migration 追加後に raw SQL string が古いままでも compiler が拾えない
  - table names、column names、index names、raw SQL parser limits、intentional dynamic SQL allowlist の report を追加する

- [ ] P2 account recovery flow を credential reset / server URL fix / cache clear の三系統に分ける
  - 対象: account detail settings、sync error UI、diagnostics
  - すべての account failure を「認証情報更新」に寄せると、server URL typo や stale cache の復旧が遠回りになる
  - credential reset、server URL edit、test connection、sync_state clear、pending mutation quarantine の flow を整理する

- [ ] P2 keyboard-only recovery actions を error dialog/toast/settings debug で検証する
  - 対象: error surfaces、settings debug actions、toasts
  - 復旧導線が mouse 前提だと、キーボード操作ユーザーが backup restore/open log/retry に到達できない
  - retry button、open settings、open log dir、restore backup、dismiss toast、focus restore の E2E check を追加する

- [ ] P2 import/export progress cancellation の confirmation timing を固定する
  - 対象: OPML import/export、DB backup/restore、settings data future flow
  - cancel を押した瞬間に partial file/partial DB state が残る場合、確認なし cancel は危険になる
  - safe cancel、unsafe cancel confirm、partial file cleanup、transaction rollback、post-cancel summary の contract を追加する

- [ ] P2 malformed provider account config を settings 表示可能な quarantine state にする
  - 対象: account repository、settings account detail、sync scheduler
  - account row が壊れた時に list failure で settings に入れないと、ユーザーが削除/修復できない
  - invalid provider kind、invalid server URL、missing credential ref、settings read-only view、delete/quarantine action の contract を追加する

- [ ] P2 internal dev mock data が product metrics / screenshots に混ざらないよう source label を出す
  - 対象: dev mocks、debug HUD、screenshots/storybook
  - mock data と実データが画面上で区別できないと、レビューやドキュメントで誤解される
  - dev data label、storybook badge、debug HUD source、screenshot naming、release build absence の contract を追加する

- [ ] P3 flaky test quarantine policy を TODO / issue / skip annotation で統一する
  - 対象: tests、quality policy、CI
  - flake を場当たり的に skip すると、未解決リスクが TODO と CI のどちらにも残らない
  - skip annotation format、TODO link、owner、expiry date、retry evidence、unskip gate の policy を追加する

- [ ] P2 provider API version / server product detection を capability と diagnostics に接続する
  - 対象: GReader/FreshRSS provider、test connection、account detail
  - FreshRSS 互換 API の実装差がある場合、capability を server version/product から分けないと sync failure が増える
  - product header、version endpoint、missing capability、unknown server、diagnostics label の contract を追加する

- [ ] P2 provider clock skew と server timestamp を sync cursor/backoff で扱う方針を決める
  - 対象: GReader cursor、sync_state、scheduler backoff
  - server 時刻が client より進む/遅れると future cursor や retry_at が不自然になり、sync が止まる可能性がある
  - server future timestamp、server past timestamp、client clock skew、cursor clamp、diagnostics warning の test を追加する

- [ ] P2 remote delete vs local optimistic mutation conflict を provider capability ごとに固定する
  - 対象: pending mutation replay、sync flow、article cache
  - remote で article/feed が消えた後に local read/star/tag mutation を replay すると、404/skip/rollback の方針が必要になる
  - remote article missing、remote feed missing、mutation replay 404、local cache rollback、user warning の contract を追加する

- [ ] P2 account/feed/tag rename の optimistic UI と backend normalization 差分を固定する
  - 対象: rename account/feed/tag flows、repository validation、query cache
  - frontend 表示名と backend normalized name が違う場合、保存直後にちらつきや duplicate 判定ずれが起きる
  - trim、case fold、Unicode normalization、duplicate after normalization、optimistic rollback の contract を追加する

- [ ] P2 article action undo を導入しない場合の accidental action recovery copy を揃える
  - 対象: mark read/star/tag/mute actions、reader toolbar、context menu
  - 既読・スター・タグ操作は軽いが、undo がないと誤操作時の戻し方が UI surface ごとに違う
  - mark read reversal、star toggle、tag remove/add、bulk mark read、toast copy の policy を追加する

- [ ] P2 stale closure in settings save handlers を form revision で guard する
  - 対象: settings forms、account credentials editor、shortcut settings
  - 保存 promise が返る前に別 field を編集すると、古い success/failure が新しい draft state を上書きする可能性がある
  - edit while saving、save success stale、save failure stale、retry latest draft、dirty state の contract を追加する

- [ ] P2 large account switch の query cancellation / stale render budget を計測する
  - 対象: account switcher、reader query hooks、article list/feed tree rendering
  - 記事・feed が多い account 間で切替えると、旧 account の query result や render work が残りやすい
  - old query cancel、new account skeleton、stale result reject、render duration budget、memory budget の smoke を追加する
