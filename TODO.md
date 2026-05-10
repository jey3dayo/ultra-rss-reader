# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
- 同じカテゴリ内は原則同時に走らせない。並列化する場合は `対象:` の write scope が重ならないことを確認する
- Rust DB/provider、reader UI/hooks、schema/storage、E2E/tooling は競合しやすいので別カテゴリを優先して組み合わせる

### TODO intake stop rules

- 新しい risk TODO を追加する前に、既存の `P1-Q*` / `P2-*` tranche、domain shard、supersedes merge へ回収できるかを先に確認する
- 新規追加できる TODO は、owner domain、write scope、acceptance criteria、focused verification、defer 範囲を持つものだけにする
- 発見方法がない懸念は TODO 化しない。`code audit`、`focused test`、`manual native verification`、`implementation-time checklist`、CI/release gate のどれで見つけるかを明記する
- 既存 TODO と重なる場合は新しい項目を増やさず、該当 tranche の `supersedes` か検証条件へ統合する
- backlog が過密な domain は追加列挙を止め、first tranche 実装、重複 merge、parallel-safe shard 化のどれかへ切り替える

### TODO 棚卸し収束バッチ

- [ ] P1 P1/P2 backlog を domain shard へ分解して実装順を固定する
  - 背景: コードを広く読まずに TODO 化できる潜在リスクは概ね 80〜85% まで出ており、追加列挙より実装順への変換が価値になっている
  - 対象: `TODO.md`, future TODO shard files or export script
  - shard: provider/security/privacy/release/data-recovery を先頭 group、reader/settings/query/tooling を後続 group として分ける
  - 完了条件: 各 shard に owner domain、write scope、並列可否、blocking dependency、focused test、manual verification を持たせる
  - 検証: `pnpm markdownlint-cli2 TODO.md`, shard export を作る場合は parser fixture test と `git diff --check`
  - defer: 新規リスクの追加調査は、shard 化後に不足 domain だけへ限定する

- [ ] P1 provider/security/privacy/release/data-recovery の先行実装 queue を作る
  - 背景: 過密 backlog の中でも provider auth、security/privacy、release provenance、DB recovery は問題化した時の被害が大きい
  - 対象: P1 Security / Privacy、P1 Provider auth、P1 Release / updater、P1 DB migration / recovery の親バッチ
  - 完了条件: 最初に着手する 3〜5 個を選び、各 task に実装 worker prompt、対象ファイル、禁止する scope creep、検証 command を付ける
  - 検証: selected queue の重複 TODO が `superseded by` で閉じられ、同じ write scope の worker が同時投入されない
  - defer: reader/settings の P2 改善は、P1 queue の最初の実装 tranche が決まるまで混ぜない

- [ ] P2 残り 15〜20% のリスク発見方法を domain 別に決める
  - 背景: 残りは関数単位の race/stale closure/SQL 条件漏れ、Tauri 実機差分、実装時に出る contract test 欠けが中心で、浅い列挙では見つかりにくい
  - 対象: provider/DB、Tauri WebView/window、reader hooks、settings forms、release packaging、test infrastructure
  - 完了条件: 各 domain について、必要な深掘り方法を code audit、focused test、manual native verification、implementation-time checklist のどれかに分類する
  - 検証: 追加 TODO は分類済み domain と発見方法を持ち、単なる思いつきの P2/P3 追加を禁止する
  - defer: 将来機能前提の notification/tray/deep link/settings export は、設計判断 task として別枠に残す

- [ ] P2 risk TODO の重複 merge と acceptance criteria 補強を先に回す
  - 背景: TODO が backlog として過密になっており、実装 worker が同じ問題を別名で直すリスクが上がっている
  - 対象: `TODO.md` の P1/P2、特に query invalidation、auth failure、recovery、runtime diagnostics、accessibility/focus 系
  - 完了条件: 類似 task を親バッチへ集約し、残す leaf task には対象、問題、完了条件、focused test、defer を揃える
  - 検証: `rg -n "query invalidation|auth failure|recovery|diagnostics|focus" TODO.md` で重複候補を確認し、merge 理由を残す
  - defer: P3 の tooling 化は、手動 merge で基準が固まってから実装する

#### TODO 棚卸し収束 実行 tranche

- [ ] P2-C1 domain shard inventory を `TODO.md` 冒頭の tranche から作る
  - worker prompt: P1-Q1〜Q5、P2 Settings/Reader/A11y/Quality の tranche を `security-privacy`, `provider-sync`, `release-native`, `db-recovery`, `query-cache`, `settings-state`, `reader-state`, `a11y-keyboard`, `quality-tooling` に分類する
  - 対象: `TODO.md`
  - 完了条件: 各 tranche が priority、domain、write scope、focused verification、manual verification、parallel-safe hint を持つ
  - 検証: `rg -n "P1-Q|P2-S|P2-R|P2-A11Y|P2-QT" TODO.md`, `pnpm markdownlint-cli2 TODO.md`
  - defer: 物理的な shard file 分割は、P2-QT3 の parser が安定してから行う

- [ ] P2-C2 先行投入順を first tranche / second tranche / blocked に分ける
  - worker prompt: P1-Q1〜Q5 と P2-S/R/A11Y/QT から、すぐ実装できる first tranche、P1 の後に回す second tranche、設計/実機確認待ちの blocked を決める
  - 対象: `TODO.md`
  - 完了条件: 各 tranche に `parallel-safe`, `blocked-by`, `blocks`, `do-not-run-with` のどれかを持たせ、subagent 同時投入時の衝突を避ける
  - 検証: Rust DB/provider と query/store、reader state と a11y keyboard、release/native と frontend tooling の同時投入可否を手動確認する
  - defer: scheduler で自動投入する仕組みは作らない

- [ ] P2-C3 supersedes / superseded by 記法で leaf TODO を親 tranche へ回収する
  - worker prompt: query invalidation、auth failure、recovery、diagnostics、focus の leaf TODO を 1 domain ずつ選び、親 tranche の `supersedes` と leaf 側の `superseded by` を対応させる
  - 対象: `TODO.md`, future CHANGELOG move workflow
  - 完了条件: leaf task を削除する前に、残す検証観点、統合先、削除理由が読める
  - 検証: `rg -n "supersedes|superseded by|query invalidation|auth failure|recovery|diagnostics|focus" TODO.md`
  - defer: 完了済み task の CHANGELOG 移動は、実装完了後の別作業にする

#### Supersedes merge workflow

- [ ] P2-C3a `query-cache` leaf TODO を `P1-Q5*` へ回収する
  - merge target: `P1-Q5a` add/delete feed、`P1-Q5b` mutation diagnostics、`P1-Q5c` key normalization、`P1-Q5d` mute/tag/article matrix、`P1-Q5e` sync completed owner
  - leaf search: `rg -n "query invalidation|query key|createMutation|createQuery|mute keyword invalidation|sync completed" TODO.md`
  - rule: leaf にしかない検証観点は親 tranche の `supersedes` か完了条件へ移し、重複 leaf には `superseded by: P1-Q5x` を追記してから削除判断する
  - done when: query/cache domain の重複 leaf が親 tranche か blocked queue のどちらかに必ず紐づく
  - defer: 実際の leaf 削除は `P1-Q5a` 以降の実装完了後に行う

- [ ] P2-C3b `provider-sync` auth failure leaf TODO を `P1-Q2*` へ回収する
  - merge target: `P1-Q2a` auth storm、`P1-Q2b` credential rotation、`P1-Q2c` server URL/provider kind migration、`P1-Q2d` capability downgrade、`P1-Q2e` redaction/no-store
  - leaf search: `rg -n "auth failure|credential rotation|server URL|provider capability|pending mutation|backoff|401|403|lockout" TODO.md`
  - rule: scheduler/pending mutation を触る leaf は `P1-Q2a`〜`P1-Q2d` のどれかへ寄せ、diagnostics/redaction だけの leaf は `P1-Q2e` へ寄せる
  - done when: auth failure 系 leaf が provider scheduler、settings credential editor、diagnostics redaction のどの owner か読める
  - defer: provider HTTP politeness / crawl policy は provider-sync 運用バッチへ残す

- [ ] P2-C3c `db-recovery` recovery leaf TODO を `P1-Q4*` へ回収する
  - merge target: `P1-Q4a` migration/downgrade、`P1-Q4b` backup/restore integrity、`P1-Q4c` runtime corruption、`P1-Q4d` destructive recovery action、`P1-Q4e` frontend reconciliation
  - leaf search: `rg -n "migration|downgrade|backup|restore|corruption|integrity_check|WAL|recovery|selected account|localStorage" TODO.md`
  - rule: DB command/Rust migration leaf と settings data UI leaf を混ぜず、frontend stale cache/localStorage 系は `P1-Q4e` に集める
  - done when: recovery leaf が migration、backup integrity、runtime DB error、settings destructive action、restore reconciliation のいずれかに分類される
  - defer: DB encryption / uninstall retention / settings export import は privacy/docs バッチに残す

- [ ] P2-C3d `runtime-diagnostics` leaf TODO を diagnostics owner へ回収する
  - merge target: `P1-Q1d` runtime diagnostics redaction、`P1-Q2e` provider redaction、`P2-QT1` tool output diagnostics、関連 domain tranche
  - leaf search: `rg -n "diagnostics|redaction|toast|safeInvoke|unhandled rejection|support dump|log" TODO.md`
  - rule: secret/url/path redaction は `P1-Q1d`、provider auth/server URL redaction は `P1-Q2e`、tool output failure は `P2-QT1` へ寄せる
  - done when: diagnostics leaf が user-facing toast、runtime redaction、provider redaction、tooling failure のどれかに分類される
  - defer: telemetry/audit log の導入判断は future design task として残す

- [ ] P2-C3e `focus/a11y/reader-state` leaf TODO を `P2-R*` / `P2-A11Y*` へ回収する
  - merge target: `P2-R5` focus/timer cancellation、`P2-A11Y1` top-layer/focus trap、`P2-A11Y3` roving focus、`P2-A11Y4` keyboard/IME、`P2-A11Y5` landmark/focus visible
  - leaf search: `rg -n "focus|keyboard|shortcut|IME|roving|Escape|Tab|aria|inert|landmark|color-only" TODO.md`
  - rule: data/refetch による stale focus は `P2-R5`、modal/popover stack は `P2-A11Y1`、keyboard/IME は `P2-A11Y4` へ寄せる
  - done when: focus/a11y leaf が reader state と top-layer/keyboard a11y のどちらに属するか明確になる
  - defer: high contrast/zoom visual matrix と long article virtualization は visual regression/future reader design に残す

- [ ] P2-C4 残り 15〜20% の深掘り入口を domain ごとに 1 つだけ残す
  - worker prompt: 関数単位の race/stale closure/SQL 条件漏れ、Tauri 実機差分、実装中に見つかる contract test 欠けを domain 別の探索入口として整理し、思いつき TODO の追加を止める
  - 対象: provider/DB、Tauri WebView/window、reader hooks、settings forms、release packaging、test infrastructure
  - 完了条件: 各 domain に code audit、focused test、manual native verification、implementation-time checklist のどれを使うか明記される
  - 検証: 新規 TODO が発見方法なしで追加されていないことを `rg -n "残り 15|深掘り|code audit|manual native|implementation-time" TODO.md` で確認する
  - defer: notification/tray/deep link/settings export の将来設計はここに混ぜない

#### Residual deep-dive entrances

- [ ] P2-C4a provider/DB residual audit entrypoint を `code audit` に限定する
  - 対象: provider traits、sync scheduler、pending mutation repository、feed/article/tag repository、SQL 条件分岐
  - 探索方法: 関数単位で id blank、account mismatch、deleted row、duplicate key、retry/backoff、transaction rollback を code audit し、発見したものは既存の `P1-Q2` / `P1-Q4` / `P1-Q5` tranche に寄せる
  - 追加条件: pure helper または repository test で再現できる race / stale result / SQL 条件漏れだけを新規 TODO 化する
  - 完了条件: provider/DB の新規 TODO が owner tranche、write scope、focused verification を持ち、発見方法のない思いつき TODO が残っていない
  - defer: DB schema 再設計、sync UX redesign、provider 抽象全面刷新は別バッチにする

- [ ] P2-C4b Tauri WebView/window residual を `manual native verification` 入口に集約する
  - 対象: child WebView bounds、reader/browser overlay、window focus、native menu/shortcut、OS permission、packaged app 起動差分
  - 探索方法: macOS/Windows の manual native checklist と screenshot/diagnostics log を証跡にし、静的コードだけで判断できない差分を release-native shard へ寄せる
  - 追加条件: dev server では再現しない packaged/native 差分、または WebView/window API unavailable 時の fallback 欠けだけを新規 TODO 化する
  - 完了条件: manual verification が必要な TODO は対象 OS、確認手順、期待ログまたは screenshot 条件を持つ
  - defer: notification/tray/deep link/settings export の将来設計は residual 入口に混ぜない

- [ ] P2-C4c reader hooks residual を `focused test` 入口に集約する
  - 対象: article selection、feed tree selection、browser pane sync、search/filter state、tag/mute mutation、read/unread optimistic state
  - 探索方法: hook ごとに stale closure、latest-only、unmount cleanup、account/feed switch、timer/debounce cleanup を focused test で固定する
  - 追加条件: user-visible stale state、rollback 漏れ、unmount 後 state update、query invalidation 漏れを再現できる場合だけ新規 TODO 化する
  - 完了条件: reader hooks の residual TODO が対象 hook、再現イベント列、expected state、focused test 名を持つ
  - defer: reader layout/polish、animation duration、article-list 全面再設計は別 shard へ残す

- [ ] P2-C4d settings forms residual を `implementation-time checklist` 入口に集約する
  - 対象: add account、account detail、service picker、account config form、settings modal/page/nav contract
  - 探索方法: 実装時に dirty state、pending disable、credential redaction、validation drift、destructive action guard、toast/query invalidation を checklist で確認する
  - 追加条件: form submit の二重実行、保存済み値との drift、秘密情報露出、削除/切断系 guard 欠けだけを新規 TODO 化する
  - 完了条件: settings form の新規 TODO が対象 form、状態遷移、guard 条件、既存 test 追加先を持つ
  - defer: settings-nav/page/modal の contract 再設計、shared component 化、UI 文言整理は別バッチにする

- [ ] P2-C4e release packaging / test infrastructure residual を gate inventory に集約する
  - 対象: updater manifest、bundle identifier、artifact naming/provenance、Node/mise/pnpm toolchain、test fixture isolation、native smoke command
  - 探索方法: repo contract test、CI gate、manual release checklist のどこで拾うかを先に決め、単発 TODO ではなく gate owner へ紐づける
  - 追加条件: local green だが release/CI で壊れる差分、fixture 汚染、toolchain version mismatch、artifact 対応漏れだけを新規 TODO 化する
  - 完了条件: release/test infra の residual TODO が検出 gate、失敗時ログ、修正 owner、再実行コマンドを持つ
  - defer: release note 文体、marketing copy、将来の配布チャネル追加は residual risk ではなく運用計画で扱う

#### Domain shard inventory

- [ ] P2-C1a `security-privacy` shard inventory を確定する
  - owner tranche: `P1-Q1a`, `P1-Q1b`, `P1-Q1c`, `P1-Q1d`, `P1-Q1e`
  - write scope: Rust sanitizer/feed discovery/OPML、frontend diagnostics、reader content privacy
  - focused verification: sanitizer/feed discovery/OPML Rust tests、article content/html tests、runtime diagnostics tests
  - parallel-safe hint: `P1-Q1a` と `P1-Q1b` は Rust fixture/helper が衝突し得るため同時投入しない。`P1-Q1d` は frontend diagnostics に寄るため release/native tranche と並列可
  - next action: `P1-Q1b` は private host helper の影響範囲が広いので、最初は fixture-only commit から始める

- [ ] P2-C1b `provider-sync` shard inventory を確定する
  - owner tranche: `P1-Q2a`, `P1-Q2b`, `P1-Q2c`, `P1-Q2d`, `P1-Q2e`
  - write scope: provider traits/GReader、sync scheduler、account commands、pending mutation repository、account settings hooks
  - focused verification: provider Rust tests、sync scheduler tests、pending mutation repository tests、account detail focused tests
  - parallel-safe hint: scheduler と pending mutation を同時に触る `P1-Q2a`〜`P1-Q2d` は直列優先。`P1-Q2e` は redaction/helper 中心なら `P1-Q3` と並列可
  - next action: auth storm から始める前に provider error classification と scheduler backoff の現状を code audit する

- [ ] P2-C1c `release-native` shard inventory を確定する
  - owner tranche: `P1-Q3a`, `P1-Q3b`, `P1-Q3c`, `P1-Q3d`, `P1-Q3e`
  - write scope: release workflow、Tauri config、updater config/manifest、release docs/manual verification
  - focused verification: `tests/release-repo-contract.test.ts`, updater config schema tests、manual verification dry run、必要なら `mise run ci`
  - parallel-safe hint: static repo contract の `P1-Q3a`/`P1-Q3c` は近接しているため同時投入しない。docs/checklist 中心の `P1-Q3e` は frontend-only tranche と並列可
  - next action: `P1-Q3a` で release config 使用 gate を先に固め、artifact provenance はその後に積む

- [ ] P2-C1d `db-recovery` shard inventory を確定する
  - owner tranche: `P1-Q4a`, `P1-Q4b`, `P1-Q4c`, `P1-Q4d`, `P1-Q4e`
  - write scope: DB migration/connection/database commands、settings data UI、query cache/localStorage reconciliation
  - focused verification: migration integration tests、database command tests、settings data focused tests、storage/account-selection tests
  - parallel-safe hint: `P1-Q4a` と `P1-Q4b` は DB connection/migration が衝突しやすいので直列。`P1-Q4d` は settings UI 寄りだが recovery copy と DB command semantics に依存する
  - next action: DB schema/downgrade contract を先に固定し、settings UI recovery は後段に回す

- [ ] P2-C1e `query-cache` shard inventory を確定する
  - owner tranche: `P1-Q5a`, `P1-Q5b`, `P1-Q5c`, `P1-Q5d`, `P1-Q5e`
  - write scope: query invalidation helper、createQuery/createMutation、reader mutation hooks、manual/sidebar sync
  - focused verification: add/delete feed、createMutation、createQuery、mute/tags/articles、manual/sidebar sync focused vitest
  - parallel-safe hint: query helper を中心に触るため基本直列。`P1-Q5b` diagnostics と `P1-Q5c` key normalization は helper shape が衝突しやすい
  - next action: `P1-Q5a` で add/delete feed matrix を先に作ると、後続の owner diagnostics と key normalization の基準になる

- [ ] P2-C1f `settings-state` shard inventory を確定する
  - owner tranche: `P2-S1`, `P2-S2`, `P2-S3`, `P2-S4`, `P2-S5`
  - write scope: preferences store/schema、settings form hooks、data settings controller/view、settings modal dirty-state
  - focused verification: preferences store/schema tests、account detail/shortcuts/tags/mute tests、data settings tests
  - parallel-safe hint: `P2-S1` は store/schema、`P2-S3` は data settings で並列可。`P2-S2` と `P2-S4` は form dirty state が衝突しやすい
  - next action: P1 provider credential rotation と重ならないよう、settings UI 側は `P2-S3` から始めると安全

- [ ] P2-C1g `reader-state` shard inventory を確定する
  - owner tranche: `P2-R1`, `P2-R2`, `P2-R3`, `P2-R4`, `P2-R5`
  - write scope: article list data/search/selection hooks、article retention、reader focus/auto-mark
  - focused verification: article list/search/selection tests、article retention tests、auto-mark/focus tests
  - parallel-safe hint: `P2-R1`〜`P2-R4` は article list/selection の shared hook に近いため直列。`P2-R5` は focus/timer helper 中心なら A11Y tranche と調整して並列可
  - next action: `P2-R1` の stable key 化を先に実施し、selection/search の stale 判定は後段で揃える

- [ ] P2-C1h `a11y-keyboard` shard inventory を確定する
  - owner tranche: `P2-A11Y1`, `P2-A11Y2`, `P2-A11Y3`, `P2-A11Y4`, `P2-A11Y5`
  - write scope: dialog/modal/popover、destructive dialogs、roving focus、keyboard shortcuts/menu events、landmark/status UI
  - focused verification: dialog/settings modal/command palette tests、keyboard shortcut tests、roving focus tests、small visual/a11y smoke
  - parallel-safe hint: `P2-A11Y1` と `P2-A11Y4` は top-layer/keyboard priority が交差するため直列。`P2-A11Y2` は shared dialog component 中心で settings-state と衝突し得る
  - next action: top-layer stack contract を先に固定し、shortcut/IME はその後に合わせる

- [ ] P2-C1i `quality-tooling` shard inventory を確定する
  - owner tranche: `P2-QT1`, `P2-QT2`, `P2-QT3`, `P2-QT4`, `P2-QT5`
  - write scope: quality scripts、similarity script、future TODO parser/exporter、mise tasks
  - focused verification: script fixture tests、`mise run quality:react-doctor:diff`, `mise run report:similarity`, markdownlint
  - parallel-safe hint: `P2-QT1` と `P2-QT2` は既存 script 別なので並列可。`P2-QT3`〜`P2-QT5` は parser/export format が連鎖するため直列
  - next action: existing script の hardening を先にやり、TODO parser/export は仕様が固まってから実装する

#### First / second / blocked tranche queue

- [ ] P2-C2a first tranche queue を固定する
  - first: `P1-Q5a`, `P1-Q3a`, `P2-QT1`, `P2-QT2`, `P2-S3`
  - reason: query add/delete feed matrix、release config gate、既存 quality scripts、data settings action lifecycle は scope が比較的閉じており、他 shard の基準にもなる
  - parallel-safe: `P1-Q3a` と `P2-QT1`/`P2-QT2` は並列可。`P1-Q5a` は query helper を触るため query/cache 内では単独。`P2-S3` は DB command semantics と競合しない範囲に限定する
  - do-not-run-with: `P1-Q5a` と `P1-Q5b`/`P1-Q5c`; `P1-Q3a` と `P1-Q3c`; `P2-S3` と `P1-Q4d`
  - validation gate: 各 tranche の focused test に加えて `pnpm markdownlint-cli2 TODO.md` と `git diff --check`

- [ ] P2-C2b second tranche queue を固定する
  - second: `P1-Q1a`, `P1-Q1d`, `P1-Q2e`, `P2-R1`, `P2-A11Y1`, `P2-S1`
  - reason: first tranche の helper/gate が固まった後に、sanitizer corpus、diagnostics redaction、provider redaction、reader stable key、top-layer、preferences store を積む
  - blocked-by: `P1-Q1d` は diagnostics redaction policy、`P2-R1` は article list test surface、`P2-A11Y1` は dialog test helper、`P2-S1` は preference schema contract の現状確認
  - parallel-safe: `P1-Q1d` と `P1-Q3a` は並列可。`P2-R1` と `P2-S1` は並列可。`P2-A11Y1` は shortcut/top-layer を触るため `P2-A11Y4` と同時投入しない
  - validation gate: focused tests + `mise run check` は実装 tranche 完了時に実行する

- [ ] P2-C2c blocked tranche queue を固定する
  - blocked: `P1-Q2a`, `P1-Q2b`, `P1-Q2c`, `P1-Q4a`, `P1-Q4b`, `P1-Q1b`, `P1-Q1c`
  - reason: provider scheduler/pending mutation、DB migration/backup、private host/OPML XML boundary は影響範囲が広く、最初に code audit または fixture-only commit が必要
  - unblock condition: 対象 repository/hook の current behavior inventory、既存 focused tests の有無、失敗時の rollback/recovery policy が TODO ではなく test plan に落ちる
  - do-not-run-with: `P1-Q2a`〜`P1-Q2d` は同時投入しない。`P1-Q4a` と `P1-Q4b` は同時投入しない。`P1-Q1b` と `P1-Q1c` は shared URL/XML fixture が固まるまで同時投入しない
  - validation gate: Rust focused tests と必要なら `mise run ci`

- [ ] P2-C2d independent documentation/manual verification queue を固定する
  - queue: `P1-Q3e`, `P2-A11Y5`, `P2-C5`
  - reason: docs/checklist/rule baseline は実装と並列に進められるが、実装差分を先取りしすぎると stale になるため短い rule/checklist に留める
  - parallel-safe: release workflow 実装、A11Y component 実装、TODO tooling 実装とは並列可。ただし `CLAUDE.md` を触る場合はルール重複を確認する
  - do-not-run-with: 大きな UI 実装中に DESIGN/CLAUDE まで同時に大きく変えない
  - validation gate: markdownlint、diff check、manual checklist review

- [ ] P2-C2e subagent 投入単位の標準 prompt を固定する
  - prompt fields: task id、domain shard、write scope、do-not-run-with、worker prompt、acceptance criteria、focused tests、forbidden scope、handoff note
  - 完了条件: first tranche の 1 件をこの format で export でき、別 agent が追加質問なしで実装に入れる
  - validation: `P2-QT5` の export script ができるまでは手動 copy でよい
  - defer: 自動 scheduler、issue 作成、branch 作成はここでは扱わない

#### Ready-to-dispatch first tranche briefs

#### Ready-to-dispatch second tranche briefs

#### Blocked tranche unblock briefs

#### Independent docs / manual verification briefs

#### Parallel dispatch wave plan

- [ ] P2-C2ad Wave 3 blocked unblock lane を code audit と fixture-only に分けて投げる
  - code audit group: `P2-C2q`, `P2-C2r`, `P2-C2s`, `P2-C2t`, `P2-C2u`
  - fixture-only group: `P2-C2v`, `P2-C2w`
  - do-not-run-with: provider scheduler audit 3 件は同時に implementation へ進めない。DB migration/backup audit 2 件は同時に implementation へ進めない。URL/OPML fixture は shared helper owner が決まるまで同時に実装しない
  - output gate: inventory、missing tests、first failing test candidate、defer scope が揃うまでは blocked task を implementation queue に移さない
  - merge gate: TODO/docs-only なら markdownlint/diff check。fixture-only commit がある場合は該当 Rust focused tests を必ず走らせる

- [ ] P2-C2ae Wave 4 rule promotion lane を 1 tranche 運用後に投げる
  - queue: `P2-C2z`
  - trigger: Wave 1 のどれか 1 件が merge され、TODO intake stop rules が実際に使われた後
  - decision: CLAUDE.md へ昇格、TODO.md に留める、`.claude/rules` へ詳細を逃がす、のいずれかを選ぶ
  - do-not-run-with: CLAUDE.md/rules を触る別 agent の作業、TODO parser/export implementation
  - merge gate: markdownlint、diff check、rule link drift check。CLAUDE.md を触る場合は AGENTS.md thin-router 方針と重複しないこと

#### Wave handoff packet templates

- [ ] P2-C2af Wave 0 handoff packet を docs/checklist 用に固定する
  - packet fields: wave id、brief ids、docs/checklist write scope、do-not-run-with、stale-detail guard、verification、handoff status
  - copy source: `P2-C2x`, `P2-C2y`, `P2-C2aa`
  - required status: added checklist path、items intentionally left abstract、items deferred to implementation brief、verification command/result
  - reject condition: workflow YAML や UI/CSS 実装へ入った場合、または未確認 artifact 名を checklist に固定した場合は差し戻す
  - next owner: release checklist は `P1-Q3e`、a11y baseline 発見は `P2-A11Y1`〜`P2-A11Y4` へ返す

- [ ] P2-C2ag Wave 1 handoff packet を first implementation 用に固定する
  - packet fields: wave id、brief id、domain shard、write scope、forbidden scope、do-not-run-with、focused tests、merge gate、handoff status
  - copy source: `P2-C2f`, `P2-C2g`, `P2-C2h`, `P2-C2i`, `P2-C2j`, `P2-C2ab`
  - required status: changed files、tests run、tests not run with reason、new helper owner、follow-up TODO id、merge/conflict risk
  - reject condition: query helper shape、release workflow、quality script helper、data settings controller の write scope を越えた場合は split する
  - next owner: 2 件以上 merge したら integrator が `mise run check` を実行し、failed gate は該当 brief に戻す

- [ ] P2-C2ah Wave 2 handoff packet を second implementation 用に固定する
  - packet fields: wave id、brief id、first-wave dependency、shared helper owner、do-not-run-with、focused tests、`mise run check` requirement
  - copy source: `P2-C2k`, `P2-C2l`, `P2-C2m`, `P2-C2n`, `P2-C2o`, `P2-C2p`, `P2-C2ac`
  - required status: dependency satisfied、shared helper touched or not、focused tests run、`mise run check` result、remaining blocked-by
  - reject condition: redaction helper を 2 worker が同時に別 shape で作った場合、reader/settings/a11y の broad redesign に膨らんだ場合は integrator が止める
  - next owner: shared helper ができた場合は owner brief へ `completed by` を残し、後続 brief の forbidden scope を更新する

- [ ] P2-C2ai Wave 3 handoff packet を unblock audit / fixture-only 用に固定する
  - packet fields: wave id、brief id、audit or fixture-only、inventory target、missing tests、first failing test candidate、defer scope、implementation readiness
  - copy source: `P2-C2q`, `P2-C2r`, `P2-C2s`, `P2-C2t`, `P2-C2u`, `P2-C2v`, `P2-C2w`, `P2-C2ad`
  - required status: current behavior inventory、unsafe transition list、missing fixture/test、first implementation brief proposal、still blocked reason
  - reject condition: audit brief が実装変更を混ぜた場合、または fixture-only が shared helper redesign へ膨らんだ場合は blocked のまま戻す
  - next owner: unblock condition が揃った brief だけを implementation queue に昇格し、provider/DB/security の同一 shard は直列で投げる

- [ ] P2-C2aj Wave 4 handoff packet を rule promotion 用に固定する
  - packet fields: wave id、trigger evidence、rule destination、duplication check、verification、re-evaluation timing
  - copy source: `P2-C2z`, `P2-C2ae`, `TODO intake stop rules`
  - required status: first tranche evidence、CLAUDE.md 昇格 yes/no、rule link path、next review timing、verification command/result
  - reject condition: TODO 大量整理や CLAUDE.md 大改修を同時に始めた場合、または既存 rule と重複した場合は scope を戻す
  - next owner: 昇格した場合は AGENTS.md thin-router と CLAUDE.md link drift gate へ接続し、昇格しない場合は TODO.md に再評価条件を残す

#### Integrator review / merge gates

- [ ] P2-C2ak returned worker diff の scope gate を固定する
  - input: worker handoff status、changed files、brief id、wave id、tests run/not run、follow-up TODO id
  - check order: brief id と changed files の対応、forbidden scope 違反、do-not-run-with 衝突、未報告の shared helper 追加、unrelated file churn
  - reject condition: write scope 外の実装、UI/DB/release workflow の余計な redesign、TODO 大量追記、テスト未実行理由なし
  - output: accept for focused verification、split requested、scope rollback requested、blocked に戻す、のいずれかを記録する
  - verification: `git diff --name-only`, `git diff --check`, brief の focused test list

- [ ] P2-C2al shared helper owner gate を固定する
  - 対象: query invalidation helper、redaction helper、quality script helper、top-layer helper、settings request generation helper
  - check order: helper owner brief、public/private API、後続 brief が依存する shape、test fixture owner、defer する拡張範囲
  - reject condition: 同じ helper を複数 worker が別 shape で追加、helper が broad abstraction 化、owner 不明の barrel export 追加
  - output: owner brief に `completed by` または `blocks` を残し、後続 brief の forbidden scope / do-not-run-with を更新する
  - verification: helper focused tests、typecheck、必要なら `rg -n` で import surface を確認する

- [ ] P2-C2am focused verification aggregation gate を固定する
  - input: 各 worker の focused tests、skipped test reason、fixture-only/audit-only の output
  - check order: focused test 成功、skipped test の妥当性、fixture-only の Rust test、docs/checklist の markdownlint、shared helper の dependent test
  - reject condition: focused test なしで behavior change、fixture-only なのに fixture test 未実行、audit-only なのに implementation readiness が未記録
  - output: merge ready、focused test retry、additional dependent test required、`mise run check` required のいずれかを記録する
  - verification: worker-reported command を再実行するか、integrator が同等 command を明記して実行する

- [ ] P2-C2an wave-level full gate を固定する
  - trigger: Wave 1 で 2 件以上 merge、Wave 2 の implementation merge、shared helper owner 追加、release/native impact、DB/provider impact
  - required gate: `mise run check`
  - optional gate: release/native/Storybook impact があれば `mise run ci` または focused native/manual verification を記録する
  - reject condition: focused tests は通るが `mise run check` が failure、または failure が unrelated と断定できない
  - output: passed gate、failed gate owner、rerun command、defer する unrelated failure の根拠を記録する

- [ ] P2-C2ao TODO state update gate を固定する
  - input: merge 済み brief、completed task、superseded leaf、new follow-up、blocked/unblocked decision
  - check order: 完了済みを CHANGELOG へ移すか、TODO に `completed by` / `superseded by` を残すか、follow-up が intake stop rules を満たすか
  - reject condition: 完了していない task の checkbox 更新、発見方法なしの新規 TODO、重複 leaf の無制限追加
  - output: completed/superseded/unblocked/blocked-still/follow-up のいずれかを task に反映する
  - verification: `pnpm markdownlint-cli2 TODO.md`, `git diff --check`, 必要なら `rg -n "completed by|superseded by|unblocked by" TODO.md`

#### TODO state marker format

- [ ] P2-C3m `unblocked by` / `blocked-still` marker format を固定する
  - unblocked format: `unblocked by: <audit-brief-id> (<first implementation brief>; missing tests: <short list>)`
  - blocked format: `blocked-still: <reason> (next audit: <brief-id-or-none>; missing decision: <short decision>)`
  - use when: Wave 3 の unblock audit が終わり、implementation queue へ移すか blocked のまま残すか判断した場合
  - reject: audit output なしで blocked を外す、first failing test 候補なしで implementation へ移す、decision owner がない blocked-still
  - verification: `rg -n "unblocked by:|blocked-still:" TODO.md` で next action が読めること
  - adoption note: unblock audit 未実行のため marker は未適用。Wave 3 audit output が出るまで `completed by` を付けない

- [ ] P2-C3n marker cleanup pass を first tranche merge 後に実行する
  - trigger: Wave 1 の 1 件以上が merge され、`completed by` または `superseded by` が TODO.md に入り始めた後
  - check order: marker target id の存在、reason の具体性、verification の有無、follow-up の intake stop rules 適合、CHANGELOG 移動候補
  - reject: marker だけ増えて parent tranche の acceptance criteria が更新されていない状態
  - output: marker normalized、parent acceptance criteria updated、CHANGELOG move deferred、or marker removed
  - verification: `pnpm markdownlint-cli2 TODO.md`, `git diff --check`, marker search

#### Wave 1 implementation readiness checklist

- [ ] P2-C2ap Wave 1 着手前の worktree guard を固定する
  - check: `git status --short` で既存差分を確認し、worker に渡す write scope と無関係な差分を巻き戻さない
  - rule: worker は自分の brief 対象ファイルだけを変更し、integrator は対象外差分を unrelated として扱う
  - reject: unrelated dirty file の cleanup、format-all、他 worker 差分の巻き戻し、TODO.md 以外の docs 整理を同時に始める
  - output: handoff status に `pre-existing dirty files` と `files touched by this worker` を分けて記録する
  - verification: `git diff --name-only` と worker の changed files list が一致すること

- [ ] P2-C2aq Wave 1 focused test availability を着手前に確認する
  - target: `P2-C2f`, `P2-C2g`, `P2-C2h`, `P2-C2i`, `P2-C2j`
  - check: brief に書かれた focused test file / mise task / script entrypoint が実在するかを `rg --files` と task list で確認する
  - rule: test file がない場合は、実装前に最小 fixture test を作るか、実在する近接 test へ置き換える判断を handoff に残す
  - reject: 存在しない test command を status に成功扱いで書く、または test 不在のまま behavior change を merge ready にする
  - verification: focused test command、または replacement test rationale が handoff status に残ること

- [ ] P2-C2ar Wave 1 helper owner preflight を固定する
  - target helpers: query invalidation helper、release repo contract helper、quality script diagnostics helper、similarity report helper、data settings request revision helper
  - check: 既存 helper があるか、new helper が private で足りるか、barrel export が必要か、後続 brief が依存するかを実装前に決める
  - rule: helper owner が曖昧な場合は shared helper を作らず、brief-local helper で始める
  - reject: owner 未定の shared helper、意図しない public export、後続 tranche の API を先取りする abstraction
  - verification: handoff status に helper owner、public/private、dependent brief の有無が書かれていること

- [ ] P2-C2as Wave 1 merge order を固定する
  - first merge candidate: `P2-C2g`, `P2-C2h`, `P2-C2i` のうち scope が最小で focused test が実在するもの
  - solo merge: `P2-C2f` は query/cache helper owner なので、他 query/cache task と並列にせず単独 merge する
  - optional merge: `P2-C2j` は DB command semantics に触らない差分に閉じられる場合だけ Wave 1 に含める
  - reject: query helper と diagnostics/helper abstraction を同時に大きく変える merge、または `mise run check` 前に 2 件以上をまとめて完了扱いにする
  - verification: 2 件以上 merge 後に `mise run check` を実行し、失敗時は failed gate owner を記録する

- [ ] P2-C2at Wave 1 completion report template を固定する
  - format: task id、changed files、tests run、tests skipped with reason、helper owner、new marker、follow-up id、merge risk、next wave impact
  - use when: worker が Wave 1 brief を完了報告する時、または integrator が merge ready を判断する時
  - reject: 「完了」のみで changed files / tests / skipped reason がない報告
  - output: `completed by` marker を入れる場合は `P2-C3l` の format に合わせる
  - verification: handoff status と TODO marker の task id / verification result が一致すること

#### TODO expansion stop / implementation switch gates

- [ ] P2-C2av Wave 1 実装開始の go/no-go gate を固定する
  - go condition: `P2-C2ap`〜`P2-C2at` の readiness check が満たされ、既存 dirty files と worker write scope が分離されている
  - no-go condition: focused test が実在しない、helper owner が決まらない、dirty worktree の owner が不明、do-not-run-with に衝突する worker が既に動いている
  - output: go の場合は `P2-C2ab` の parallel group か solo group へ移り、no-go の場合は missing prerequisite を該当 readiness item に追記する
  - verification: `git status --short`, `rg --files`, focused test dry run または test availability rationale
  - defer: Wave 2/3/4 の実装判断は Wave 1 の completed marker が入ってから行う

- [ ] P2-C2aw first implementation candidate を 1 件だけ選んで実装へ移す
  - candidates: `P2-C2g` (`P1-Q3a`), `P2-C2h` (`P2-QT1`), `P2-C2i` (`P2-QT2`)
  - selection rule: write scope が最小、focused test が実在、既存 dirty files と衝突しない、helper owner が brief-local で済むものを選ぶ
  - reject: query/cache solo group の `P2-C2f` を他 Wave 1 helper と同時に始める、または `P2-C2j` が DB command semantics に触れる状態で始める
  - output: 選んだ candidate の handoff packet、expected files、focused test command、fallback plan
  - verification: 実装前に candidate brief と `P2-C2ag` の packet fields が一致すること

#### First implementation candidate selection

### 先行実装 queue

#### P1-Q4 実装 tranche

### TODO shard 方針

- [ ] P2 TODO shard の domain taxonomy を固定する
  - shard: `security-privacy`, `provider-sync`, `release-native`, `db-recovery`, `query-cache`, `reader-state`, `settings-state`, `a11y-keyboard`, `quality-tooling`
  - 完了条件: 各 TODO が priority、domain、work type、write scope、focused verification を持つ
  - 検証: 手動分類なら `rg -n "^- \\[ \\] P[123]" TODO.md` で未分類を確認し、script 化する場合は fixture test を追加する

- [ ] P2 shard 間の並列投入ルールを TODO.md 冒頭へ昇格する
  - ルール: Rust DB/provider と query/store は同時投入しない、reader state と a11y keyboard は同時投入しない、release/native と frontend-only tooling は並列可にする
  - 完了条件: 各先行 queue が parallel-safe / blocked-by / blocks を持ち、subagent へ渡す順序が明確になる
  - 検証: `TODO.md` の先行 queue から同じ write scope の同時 worker が出ないことを確認する

- [ ] P2 shard へ移した leaf TODO の `superseded by` 記法を決める
  - 目的: 重複 task を消す時に、検証観点や過去の判断理由を失わないようにする
  - 完了条件: leaf task を削る場合は親バッチ名、残す観点、削除理由、CHANGELOG へ移す条件を残す
  - 検証: query invalidation/auth failure/recovery/diagnostics/focus 系から 1 domain を選び、試験的に merge する

### Sync / App Runtime

### App Shell / Command Palette / Dev Intent

### Reader UI / Account Settings

### Dev / Tooling / E2E / Test Helpers

### Rust Provider / DB / Scheduler

- [ ] P3 repository fixture builder を account/feed/article/tag ごとに最小化する
  - 対象: `src-tauri/tests`, `src-tauri/src/infra/db/*_test.rs`
  - DB test fixture が ad hoc に増えると、account id や remote id、sort_order、timestamps の前提がテストごとに揺れて regression の原因を追いにくい
  - account/feed/article/tag/pending mutation の最小 fixture builder と、明示的に壊れた row を作る corruption helper を分ける

### Query / Store / Browser Runtime

- [ ] P3 query invalidation target matrix を repo contract test で drift 検出する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/__tests__/lib/query-invalidation.test.ts`, `src/__tests__/config/repo-contracts.test.ts`
  - query root が増えた時に invalidation target へ入れ忘れると、機能追加時の stale cache が後から発覚しやすい
  - `QUERY_KEY_ROOTS` と feed/article/sync completed invalidation matrix の snapshot を作り、意図的に除外する key は理由付き allowlist にする

### Reader Content / Feed Discovery / Security

- [ ] P1 Rust sanitizer version bump と saved article repair の release gate を作る
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - sanitizer policy を変えても `SANITIZER_VERSION` bump や repair path を忘れると、保存済み article が古い HTML policy のまま表示される
  - allowed tag/attribute 変更、version bump 漏れ、repair batch limit、repair failure retry、partial repair 後の起動の integration test を追加する

- [ ] P3 content sanitizer fixtures を web-platform-ish corpus として追加する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/__tests__/lib/html.test.ts`, `tests/fixtures`
  - sanitizer の個別 unit test は増えているが、実 feed 由来の壊れた HTML / media / tracking link の corpus がないと regression を検出しづらい
  - malformed publisher HTML、tracking link、responsive image、video/source、code block、Japanese text、emoji/entity の fixture corpus を用意する

### Release / Native / Keyboard / I18n / A11y

- [ ] P1 Tauri capability の external opener permission scope を URL schema と同期する
  - 対象: `src-tauri/capabilities/default.json`, `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`
  - `opener:allow-open-url` と `browser-webview` が同じ default capability にいるため、URL validation と permission scope がずれると外部 opener surface が広がりやすい
  - `http:`、`https:`、`mailto:`、`file:`、custom scheme、encoded newline、userinfo URL の allow/deny contract と capability snapshot を追加する

- [ ] P2 destructive confirm dialog の pending state / focus restore / thrown callback を固定する
  - 対象: `src/components/app-confirm-dialog.tsx`, `src/stores/ui-store.ts`, `src/hooks/use-delete-feed.ts`
  - confirm callback が async failure や throw を起こした時、dialog close、focus restore、toast 表示の owner が曖昧になりやすい
  - confirm throw、reject、double click、Escape during pending、target removed、focus ref null の component test を追加する

- [ ] P2 feed tree / account switcher / tag list の roving focus 境界を hidden/disabled row で固定する
  - 対象: `src/components/reader/feed-tree`, `src/components/reader/sidebar-account-switcher.tsx`, `src/components/reader/article-tag-picker-view.tsx`
  - keyboard navigation が hidden/disabled/deleted row を跨ぐと、focus と selected state が別 row を指す flake が起きやすい
  - hidden row、disabled account、deleted tag、collapsed folder、virtual row absence、Home/End/Arrow navigation の test を追加する
  - superseded by: P2-A11Y3 (covered by roving focus boundary contract; kept verification: hidden row, disabled account, deleted tag, Home/End navigation)

- [ ] P2 mobile single-pane layout の hidden pane tab order / focus restore を E2E contract にする
  - 対象: `e2e/app.spec.ts`, `src/components/app-shell.tsx`, `src/stores/ui-store.ts`
  - mobile single-pane で sidebar/settings/article/account pane を切り替える時、hidden pane に tab stop が残ると keyboard/a11y 操作が壊れる
  - pane switch、account setup、settings close、browser overlay close、back navigation、tab order snapshot の E2E を追加する

- [ ] P3 Japanese long-label screenshot smoke を settings / article toolbar / account detail に追加する
  - 対象: `e2e/storybook`, `src/locales/ja`, `src/components/settings`, `src/components/reader/article-toolbar-view.tsx`
  - 日本語 copy は英語より幅を取りやすく、compact toolbar や settings row で overflow / overlap を起こしても unit test では見えにくい
  - ja locale、narrow viewport、large text、button label overflow、account detail section、toolbar actions の screenshot smoke を追加する

- [ ] P3 visual regression smoke の対象を dense UI / a11y state に限定して追加する
  - 対象: `e2e/storybook`, `src/components/reader`, `src/components/settings`
  - 全画面 snapshot を増やすと保守が重いが、dense UI の overlap や hidden focus ring は通常の DOM assertion では検出しづらい
  - feed tree dense state、settings modal error state、command palette empty/result state、browser overlay error state、toast stack の小さな screenshot smoke を追加する

### Database / Updater / Window

- [ ] P1 database maintenance と updater install が共有する `syncing` flag の user-facing state を統一する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/commands/updater_commands.rs`, `src-tauri/src/commands/sync_commands.rs`, `src/hooks/use-updater.ts`
  - vacuum、sync、update install が同じ AtomicBool を使うため、UI には sync 中なのか maintenance/update 中なのか区別できない busy error が出やすい
  - vacuum中sync、sync中vacuum、install中sync、restart guard、busy message category、settings button disabled state の integration test を追加する

- [ ] P2 restart app command の sync/update guard と user confirmation を整理する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/lib/actions.ts`, `src/hooks/use-updater.ts`, `src/components/app-confirm-dialog.tsx`
  - `restart_app` は sync/update guard を取るが、frontend 側の pending mutation / unsaved settings / browser open の確認と切り離れている
  - update ready restart、manual restart action、settings dirty state、sync running、install running、restart failure の UX contract を追加する

- [ ] P2 window icon path の packaging / platform fallback を release smoke に入れる
  - 対象: `src/lib/window/windows.ts`, `src-tauri/tauri.conf.json`, `src-tauri/icons`, `tests/release-repo-contract.test.ts`
  - `setWindowIcon` は path 文字列を native に渡すため、packaged app と dev app で icon path 解決が違うと no-op/失敗になりやすい
  - dev path、packaged resource path、missing icon、Windows/macOS/Linux behavior、fallback log の release smoke を追加する

### Article List / Schema / Mute / Tags / Share

- [ ] P2 article list retained article ids の lifetime / size cap を account switch で固定する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/components/reader/hooks/article-list/use-article-list-view-state.ts`, `src/lib/articles/article-list.ts`
  - retained ids は selection 維持に効く一方、account/feed/tag 切替後に古い id が残ると invisible article や memory growth の原因になりやすい
  - account switch、feed delete、tag delete、search clear、max retained ids、selected article deleted の test を追加する

- [ ] P2 schema barrel export と per-schema test の追加漏れを repo contract で検出する
  - 対象: `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`, `src/__tests__/api/schemas`
  - 新しい schema file を足しても barrel export や schema-specific test を忘れると、runtime validation はあるが public import surface が揺れやすい
  - schema file inventory、barrel export、test file presence、intentional internal schema allowlist の repo contract を追加する

- [ ] P2 generated schema / target artifact が repo scan に混ざらない tooling boundary を整える
  - 対象: `.gitignore`, `.ignore`, `mise.toml`, `scripts/quality-baseline.ts`
  - `src-tauri/target` や generated doc が local scan に混ざると、rg/quality script/agent audit の noise が増えて本来の risk を見落としやすい
  - tracked/untracked artifact inventory、rg ignore、quality baseline ignore、CI cleanup、generated schema source-of-truth を整理する

- [ ] P2 preferences API schema と app schema の duplicate source-of-truth を縮める
  - 対象: `src/api/schemas/preferences.ts`, `src/schemas/preferences.ts`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - command DTO schema と app preference schema が別ファイルにあるため、option追加時に DTO は通るが store/UI validation が落ちる drift が起きやすい
  - schema-derived type、default preference parity、unknown key、legacy value migration、settings option fixture の contract を追加する

- [ ] P2 browser webview command schema の geometry integer rounding を DPI/zoom で固定する
  - 対象: `src/api/schemas/browser-webview.ts`, `src/api/schemas/commands.ts`, `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`
  - DOMRect は fractional pixel を返すが native webview bounds は integer に寄りやすく、DPI/zoom で 1px gap や overlap が出やすい
  - fractional rect、devicePixelRatio、zoom change、negative zero、min size、round/floor/ceil policy の contract test を追加する

- [ ] P2 feed integrity cleanup の dry-run / destructive run 差を UI warning と同期する
  - 対象: `src/api/schemas/feed-integrity.ts`, `src-tauri/src/commands/feed_commands.rs`, `src/components/settings/debug-settings.tsx`
  - orphan cleanup は destructive になり得るため、dry-run 結果と実 cleanup 結果が一致しない場合の user warning が必要になる
  - dry-run count、cleanup count mismatch、concurrent feed delete、DB busy、partial cleanup failure、undo不可 copy の contract を追加する

- [ ] P3 command/action naming の `sync-all` / `sync_all` / menu id 表記揺れを整理する
  - 対象: `src/lib/app-actions.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src-tauri/src/menu.rs`, `TODO.md`
  - kebab-case、snake_case、Rust menu id が混ざると search/grep 時に owner を見落としやすく、TODO や test 名も揺れやすい
  - action naming guide、conversion helper、test name convention、legacy alias allowlist を CLAUDE/rules か repo contract に追加する

- [ ] P3 article list hook type surface を controller params/result と pure helper types に分割する
  - 対象: `src/components/reader/article-list.types.ts`, `src/components/reader/hooks/article-list/*`, `src/lib/articles/article-list.ts`
  - article list の hook params/results と view props/helper types が近い場所に集まり、次の local props cleanup で衝突しやすい
  - controller contract、view-local props、pure helper input/output、test helper fixture type の配置方針を TODO から実装計画へ落とす

- [ ] P1 mute auto-mark-read の既存 article 一括更新を account scope / transaction cost で固定する
  - 対象: `src-tauri/src/commands/mute_keyword_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src/hooks/use-mute-keywords.ts`
  - keyword 作成・scope 変更・設定有効化時に全 account の既存 muted unread を mark read するため、大量記事や account 切替時に予想外の unread count 変化が起きやすい
  - selected account、all account、large dataset、partial failure、unread count repair、toast copy、query invalidation の integration test を追加する

- [ ] P2 mute keyword SQL clause builder の expression injection safety を repo contract にする
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/db/sqlite_tag.rs`
  - `build_mute_keyword_match_clause` は SQL expression 文字列を受け取るため、呼び出し元が user input を渡すと SQL injection boundary になり得る
  - allowed caller inventory、literal expression only、future caller lint、malformed expression fixture、query plan regression の contract を追加する

- [ ] P2 mute keyword invalid scope row を list failure にするか quarantine するか決める
  - 対象: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/commands/mute_keyword_commands.rs`, `src/components/settings/mute-settings.tsx`
  - DB に未知 scope が入ると `row_to_mute_keyword` で一覧全体が落ちるため、1件の破損 row が settings 全体の操作を妨げる可能性がある
  - unknown scope、delete broken row、repair UI、diagnostics-only warning、list partial success の方針を固定する

- [ ] P2 delete tag 後の selected state / article tag picker state cleanup を stale tag guard する
  - 対象: `src/hooks/use-tags.ts`, `src/components/reader/article-tag-picker-view.tsx`, `src/stores/ui-store.ts`
  - tag 削除時に selection は all に戻すが、tag picker や article tag chips 側に stale tag id が残ると次の assignment が失敗しやすい
  - selected tag delete、picker open中delete、article tags refetch、delete mutation failure、undo不可 toast の component/hook test を追加する

- [ ] P2 article external browser error category と clipboard error category の taxonomy を共通化する
  - 対象: `src/components/reader/article-browser-actions.ts`, `src/lib/runtime/clipboard.ts`, `src/lib/ui-errors.ts`
  - runtime unavailable / permission denied / invalid url / invalid text の分類が複数箇所にあり、copy/open/reading list で同じ error が違う toast になりやすい
  - shared classifier、category locale key、unknown command、plugin unavailable、permission denied、validation failure の parity test を追加する

- [ ] P2 article selection not-found state を browser-only fallback と account switch で固定する
  - 対象: `src/components/reader/hooks/article/use-article-view-selection.ts`, `src/components/reader/article-view-state.tsx`, `src/stores/ui-store.ts`
  - selectedArticleId が filteredArticles から消えた時に not-found / browser-only / empty summary が分岐するため、account/feed/tag/search 切替で一瞬誤 state が出やすい
  - account switch、feed delete、tag filter、browser mode with stale article、retained ids、refetch loading の component test を追加する

- [ ] P2 article view summary の latest article / feed count を muted/search/filter state と分離する
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/hooks/article/use-article-view-selection.ts`, `src/__tests__/lib/article-view.test.ts`
  - empty state summary は filteredArticles 由来なので、mute/search/filter 適用後に feed/folder/tag 全体 summary なのか visible summary なのか意味が曖昧になりやすい
  - muted article、search active、read filter、folder empty、tag empty、latest invalid date、summary label copy の test を追加する

- [ ] P2 article remote image URL policy と mail/share URL policy の差を明文化する
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/article-share-menu.tsx`, `src/components/reader/article-content-view.tsx`
  - remote image は https only、share/open は http(s)、mailto は mailto を使うため、URL policy が機能ごとに違う理由を test と copy に残さないと修正時に混ざりやすい
  - https image、http article URL、protocol-relative image、credential URL、mailto share、invalid URL toast の policy test を追加する

- [ ] P2 shared form controls の disabled/loading aria contract を destructive actions と同期する
  - 対象: `src/components/shared/form-action-buttons.tsx`, `src/components/shared/destructive-dialog-footer.tsx`, `src/components/shared/decision-button.tsx`
  - loading 中の destructive action button が aria-disabled / disabled / focusable のどれになるか統一しないと keyboard 操作で二重 submit しやすい
  - pending submit、double click、Enter key、Escape key、aria-busy、focus restore、tooltip label の shared component test を追加する

- [ ] P3 story export registry と shared component stories の required coverage を repo contract にする
  - 対象: `tests/helpers/storybook-story-export-registry.ts`, `src/components/shared/*.stories.tsx`, `src/__tests__/components/shared-stories.test.tsx`
  - shared component を追加しても story/test registry へ載せ忘れると、visual/a11y smoke の対象から漏れやすい
  - shared component inventory、story presence、required states、intentional no-story allowlist、renamed story id の contract を追加する

- [ ] P3 settings fixture と schema option fixture の owner を一本化する
  - 対象: `tests/helpers/settings-fixtures.ts`, `src/__tests__/components/settings-preference-option-schema-parity.test.tsx`, `src/schemas/preferences.ts`
  - settings option の fixture が test helper と schema test に分散すると、新しい preference 追加時に片方だけ更新されやすい
  - option id、default value、UI label、schema enum、legacy key、fixture owner の repo contract を追加する

- [ ] P3 migration file numbering / feature ownership を generated changelog で検出する
  - 対象: `src-tauri/migrations`, `tests/release-repo-contract.test.ts`
  - migration が増えるほど番号衝突、説明不足、feature owner 不明が起きやすく、DB rollback/backup 判断が遅れる
  - sequential numbering、duplicate version、description suffix、destructive migration marker、fixture DB upgrade smoke を追加する

### Feed / Folder / Storage / Settings Data

- [ ] P1 feed folder optimistic update の rollback を multi-query / account switch で固定する
  - 対象: `src/hooks/use-update-feed-folder.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/feed-tree`
  - feed folder 移動は全 feeds query を optimistic に書き換えるため、account 切替や refetch と重なると別 account の feed まで rollback される risk がある
  - multiple account feeds queries、account switch during mutate、folder deleted、feed deleted、rollback after refetch、success invalidation failure の test を追加する

- [ ] P2 createFolderIfNeeded の duplicate create retry / selectedFolderId drift を fixed point にする
  - 対象: `src/components/reader/feed-folder-flow.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/components/reader/add-feed-dialog.tsx`
  - add feed flow で folder 作成と feed 作成が連続するため、folder 作成成功後に feed 作成が失敗した時の再実行で duplicate folder を作りやすい
  - create folder success + add feed failure、retry same name、selectedFolderId changed、account switch、folder create validation error の flow test を追加する

- [ ] P2 JSON parse helper の throwing/null boundary を CLAUDE rules と test で固定する
  - 対象: `src/schemas/parse.ts`, `src/schemas/storage.ts`, `src/api/tauri-commands.ts`, `CLAUDE.md`
  - `parseJsonWithSchema` と `parseJsonWithSchemaOrNull` が共存しており、runtime boundary で throwing helper を使うと unhandled exception になりやすい
  - localStorage recovery、IPC response validation、test fixture strict parse、invalid schema、malformed JSON、rule doc の usage matrix を追加する

- [ ] P2 settings action button の disabled-only feedback を destructive/data actions で補う
  - 対象: `src/components/settings/shared/settings-action-button.tsx`, `src/components/settings/data-settings-view.tsx`, `src/components/settings/account-detail/danger-zone-view.tsx`
  - destructive/data action が disabled の時に理由が UI に出ないと、sync/vacuum/update 中の操作不可が failure と誤認されやすい
  - disabled reason label、aria-describedby、busy state、tooltip/inline note、keyboard focus behavior の component test を追加する

### GReader / Sync Flow / Account Setup

- [ ] P1 GReader pagination continuation loop の incomplete sync recovery を sync_state と接続する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/repository/sync_state.rs`
  - continuation が繰り返す・page limit に到達する場合に Network error で止まるが、次回 sync で cursor を進める/戻す方針が曖昧だと feed が永久に stale になりやすい
  - repeated continuation、max pages、max stream ids、partial ids、cursor保存/破棄、次回 retry warning の integration test を追加する

- [ ] P1 GReader item timestamp usec の overflow / negative / future clock を cursor policy にする
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`
  - `timestampUsec` / updated / published から cursor を作るため、provider の異常値で since cursor が壊れると以降の delta sync が欠落しやすい
  - negative usec、i64 max近辺、future timestamp、missing timestamp、published fallback、cursor rollback の contract test を追加する

- [ ] P2 GReader label remote id normalization と folder duplicate policy を folder sync と揃える
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - label id を percent decode して display label に寄せるため、slash を含む label、同名 label、encoded Unicode で remote folder id と local folder が衝突しやすい
  - encoded slash、invalid percent、empty label、duplicate labels、Unicode label、existing local folder name collision の sync test を追加する

- [ ] P2 provider metadata URL normalizer と frontend URL policy の差分を providerごとに fixture 化する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/lib/feed/feed.ts`, `src/components/shared/feed-favicon.tsx`
  - provider 側で site/icon/article URL を normalize し、frontend でも host/open policy を持つため、片側だけ URL を受け入れる状態が増えやすい
  - http/https、protocol-relative、relative URL、userinfo、unicode host、tracking query、icon URL の parity fixture を追加する

- [ ] P2 pending mutation push の per-mutation delete timing を remote partial failure で固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/repository/pending_mutation.rs`, `src-tauri/src/infra/provider/traits.rs`
  - pending mutation は1件ずつ push 成功後に削除するため、途中 failure で前半だけ remote 適用済みになるが、UI には partial push 状態が見えにくい
  - first success second failure、delete failure after push、duplicate retry、remote id missing、axis別 partial success の integration test を追加する

- [ ] P2 sync_flow sanitizer repair batch が毎回同じ 500 件で詰まらない ordering を固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, `src-tauri/src/infra/sanitizer.rs`
  - outdated sanitized articles を 500 件だけ repair するため、失敗行や ordering が固定されないと毎回同じ記事で止まり続ける可能性がある
  - deterministic order、repair failure skip/stop、batch progress、version bump後複数起動、large DB の integration test を追加する

- [ ] P2 sync_flow Step 6 unread count recalc が sync 前 feeds snapshot に限定される影響を検証する
  - 対象: `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/commands/sync_providers.rs`
  - Step 4 前に取得した feeds に対して unread count を recalculation するため、sync 中に追加/削除された feed の count repair が漏れる可能性がある
  - remote subscription added、feed deleted during sync、folder move during sync、local feed added、post-sync feed list refresh の test を追加する

- [ ] P2 article search normalization と backend search SQL の Unicode/length parity を固定する
  - 対象: `src/hooks/use-articles.ts`, `src/components/reader/hooks/article-list/use-article-list-search.ts`, `src-tauri/src/commands/article_commands.rs`
  - frontend は NFKC + whitespace collapse + 128文字 cap を持つが、backend search 側の normalization と違うと日本語/全角検索で結果が揺れやすい
  - full-width text、combining mark、emoji、multiple spaces、128文字超、backend raw query cap の parity test を追加する

- [ ] P2 article cache optimistic patch が account id 推定に失敗した時の fallback を明文化する
  - 対象: `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/hooks/article`
  - cached article の account id を feeds/accountArticles/starredArticles から推定するため、cache miss や stale feed cache では account scoped invalidation が漏れやすい
  - missing feed cache、article in multiple scoped queries、deleted feed、stale accountArticles、fallback all-account invalidation の test を追加する

- [ ] P2 article read/star mutation の optimistic insertIfMissing policy を mode/filter と同期する
  - 対象: `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/article-list-body.tsx`
  - read/star mutation が missing article を cache に挿入する場合、unread/starred/recent/search の query mode に合わない item が混ざる可能性がある
  - unread mode read=true、starred mode unstar、recent query insert、search query insert、tag query insert の cache contract を追加する

- [ ] P2 account selection fallback と query enabled state を deleted/disabled account で固定する
  - 対象: `src/lib/account/account-selection.ts`, `src/stores/ui-store.ts`, `src/hooks/use-accounts.ts`, `src/hooks/create-query.ts`
  - selected account が削除/disabled になった時に query enabled と selection fallback がずれると、deleted account の feeds/articles query が走り続ける
  - selected deleted、selected disabled、all accounts fallback、no accounts、account setup session active の hook/store test を追加する

- [ ] P2 sync progress event account id と account selection の stale mapping を UI adapter で検証する
  - 対象: `src/lib/sync/sync-progress-event.types.ts`, `src/stores/ui-store.ts`, `src/components/reader/sidebar-sync-feedback.ts`
  - sync progress は account id を含むが、進行中に account が rename/delete されると sidebar feedback が orphan progress を表示し続ける可能性がある
  - account rename、account delete、unknown account id、all-account sync、partial failure、progress completion cleanup の test を追加する

- [ ] P2 sync result feedback の warnings/errors aggregation を account/action owner 別に整理する
  - 対象: `src/lib/sync/sync-result-feedback.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src/api/schemas/sync-result.ts`
  - sync result の warnings/errors が account 単位と feed 単位で混ざると、toast が長くなり原因 account を特定しにくい
  - multiple accounts、same warning dedupe、feed-level error、credential error、scheduler warning、toast truncation の test を追加する

- [ ] P3 provider capability matrix を account kind 追加時の required tests として固定する
  - 対象: `src-tauri/src/domain/provider.rs`, `src-tauri/src/infra/provider/traits.rs`, `src/components/settings/add-account/services.ts`
  - provider kind が増えると remote state/folders/delta sync/background browser 等の capability 影響が広く、追加時に漏れが出やすい
  - capability snapshot、service picker option、credential fields、sync path selection、pending mutation support、settings copy の repo contract を追加する

- [ ] P3 sync/provider test fixture の HTTP response builder を status/header/body 別に標準化する
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/tests`
  - provider tests が ad hoc response を作ると、rate-limit/auth/network/schema error の比較が難しくなる
  - status fixture、header fixture、JSON malformed fixture、pagination fixture、token redaction fixture の builder を用意する

### Browser WebView / Runtime Diagnostics

- [ ] P1 browser webview initialization script の user preference injection safety を contract 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/schemas/preferences.ts`, `src/components/settings/shortcuts-settings.tsx`
  - shortcut preference から initialization script の JSON/string を組み立てるため、quote/newline/control char が script boundary を壊さない保証が必要
  - shortcut with quote、newline、backslash、unicode、invalid binding、script JSON escaping、bridge installed sentinel の test を追加する

- [ ] P2 browser webview placeholder URL path の Windows-only navigation state を parity 化する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src-tauri/src/browser_webview.rs`, `src/components/reader/browser-webview-state.ts`
  - Windows では initial URL に `about:blank` を使うため、current_url と snapshot.url の比較が他 platform と違い、navigate skip/duplicate history が起きやすい
  - placeholder initial URL、navigate same target、about:blank page-load ignore、history back/forward、platform mock parity の test を追加する

- [ ] P2 browser webview focus restore failure を close flow / pending action queue と同期する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/actions.ts`, `src/components/reader/hooks/browser/use-browser-view-runtime.ts`
  - close 時に host window focus restore が失敗しても close を継続するため、pending next/prev action が keyboard focus 不在のまま流れる可能性がある
  - focus host failure、webview close failure、pending action flush、Windows grace window、main webview missing の integration test を追加する

- [ ] P2 browser preview bridge message の URL equality を redirect/canonical URL で再検証する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/reader/hooks/browser`
  - bridge message は action と URL が snapshot と一致する時だけ受けるため、redirect 後 URL や percent encoding 差で shortcut が効かなくなる可能性がある
  - redirected URL、trailing slash、percent encoding、hash change、unsupported action、stale URL の bridge test を追加する

- [ ] P2 browser preview focus override script の site compatibility / security boundary を検証する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/components/settings/reading-settings-view.tsx`, `src/__tests__/schemas/preferences-schema-contract.test.ts`
  - focus override は embedded page の visibility/focus APIs を差し替えるため、サイト側の media playback/analytics/keyboard handling を壊す可能性がある
  - keep focus on/off、visibilitychange listener、non-configurable property、site script error、setting copy、disable fallback の test/実機検証 TODO にする

- [ ] P2 browser webview diagnostics payload の coordinate privacy / size cap を固定する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/runtime/diagnostics.ts`, `src/components/settings/debug-settings.tsx`
  - diagnostics は bounds/scale/native bounds を event/log に出すため、巨大値や画面構成情報を support log へ載せる範囲を決める必要がある
  - huge coordinate、negative coordinate、multi-monitor scale、native bounds unavailable、payload truncation、diagnostics toggle の test を追加する

- [ ] P2 Tauri listener group の partial subscription failure を listener owner ごとに surface する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `src/components/reader/hooks/browser`, `src/hooks/use-updater.ts`
  - `Promise.all` は individual catch で ready に進むため、一部 event listener だけ登録失敗しても UI は動作可能に見えて stale state になりやすい
  - one subscription fail、all fail、disposed before resolve、cleanup throw、runtime unavailable、owner label diagnostics の test を追加する

- [ ] P2 Tauri listener failure once flag の runtime recovery / test isolation を統一する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, `tests/helpers/tauri-runtime.ts`, `src/__tests__/lib/tauri-event-listeners.test.ts`
  - listener failure は once event で通知されるため、runtime が復旧した後や test 間で flag が残ると本来の warning を見落としやすい
  - reset helper、runtime becomes available、runtime becomes unavailable、multiple listener groups、afterEach cleanup の contract を追加する

- [ ] P2 URL redaction regex の http token 境界を markdown/log punctuation で強化する
  - 対象: `src/api/tauri-commands.ts`, `src/lib/runtime/diagnostics.ts`, `src-tauri/src/domain/error.rs`
  - URL-like token redaction が whitespace 区切りに寄ると、Markdown link、括弧、句読点、複数 URL で query token が残る可能性がある
  - markdown URL、parentheses、Japanese punctuation、multiple URLs、fragment/query/userinfo、invalid URL の parity test を追加する

- [ ] P2 platform store in-flight load が stale result で newer recovery を上書きしないよう generation 化する
  - 対象: `src/stores/platform-store.ts`, `src/lib/window/window-chrome.ts`, `src/__tests__/stores/platform-store.test.ts`
  - platform load は in-flight promise を共有するため、runtime unavailable 後の recovery や mock切替で古い default platform が新しい platform を上書きする可能性がある
  - unavailable then available、available then unavailable、mock toggle、parallel load、reset helper の store test を追加する

- [ ] P2 desktop overlay titlebar fallback の userAgentData / navigator.platform drift を UI layout contract にする
  - 対象: `src/lib/window/window-chrome.ts`, `src/components/app-shell.tsx`, `src/components/storybook/viewport-fixtures.ts`
  - platform kind unknown の間に macOS 判定を navigator で補うため、Chrome UA reduction や test mock の差で titlebar inset が1 frameずれやすい
  - userAgentData platform、navigator.platform missing、unknown platform in Tauri、web mock、mac/win/linux screenshot smoke の test を追加する

- [ ] P2 app stacking z-index constants の modal/toast/browser overlay collision を contract 化する
  - 対象: `src/lib/window/window-chrome.ts`, `src/components/app-shell.tsx`, `src/components/shared/app-toast-view.tsx`
  - browser overlay z-40、dialog/command palette z-50、toast z-100 が定数化されているが、Debug HUD や future popover が入ると collision しやすい
  - browser overlay + settings modal、command palette + toast、debug hud + dialog、native titlebar drag region、popover z-index の visual smoke を追加する

- [ ] P2 runtime error guard の browser webview fallback events を expected failure と区別する
  - 対象: `e2e/helpers/runtime-error-guard.ts`, `e2e/app.spec.ts`, `src/components/reader/hooks/browser`
  - browser fallback は意図的に console warn/error を出す場面があるため、E2E guard が本物の regression と expected fallback を混同しやすい
  - expected fallback scope、unexpected pageerror、console warn allowlist、attached diagnostics payload、screenshot timing の E2E policy を追加する

- [ ] P2 tauri dev config と release config の capability/window drift を schema test で固定する
  - 対象: `src-tauri/tauri.dev.conf.json`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`, `src/__tests__/schemas/tauri-config-identifiers.test.ts`
  - dev/release config が増えると window label、capability、security、updater 設定が片方だけ変わり、dev で動くが release で壊れる状態になりやすい
  - main window label、browser webview label、CSP、capability path、updater active、identifier parity の test を追加する

- [ ] P3 browser webview command tests の platform matrix を generated fixtures へ寄せる
  - 対象: `src/__tests__/api/browser-webview-command-contract.test.ts`, `src/__tests__/components/browser-webview-sync-helpers.test.ts`, `tests/helpers/navigator-platform.ts`
  - Windows/macOS/unknown platform の fixture が散ると placeholder URL、bounds unit、titlebar inset の test が抜けやすい
  - platform fixture builder、bounds unit cases、placeholder URL cases、navigator mock cleanup、DPI fixture を追加する

- [ ] P3 diagnostics event names / payload schema を central registry 化する
  - 対象: `src-tauri/src/browser_webview.rs`, `src/lib/runtime/diagnostics.ts`, `src/api/schemas/browser-webview.ts`
  - diagnostics/fallback/state event name が Rust/frontend に分散しており、rename 時に listener と emitter が片方だけ変わる risk がある
  - event name registry、payload schema parity、unknown event allowlist、test helper emit fixture の配置を決める

- [ ] P1 OPML import の private host validation を DNS resolution / encoded host まで広げる
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/normalizer.rs`
  - OPML import は host string ベースで private/loopback を判定するため、DNS rebinding、encoded IP、IPv4-mapped IPv6、punycode で SSRF guard が抜ける可能性がある
  - decimal/octal IPv4、IPv4-mapped IPv6、punycode localhost、DNS public-to-private、redirect後private host の shared validation test を追加する

- [ ] P2 OPML import nested folder の flattening policy を UI copy と test で明文化する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`, `src/components/settings/data-settings-view.tsx`
  - parser は outline stack の直近 folder だけを使うため、nested folder 階層は flatten されるが user には失われる情報が見えにくい
  - nested folder、empty folder outline、feed outline with children、deep hierarchy、import summary warning の policy test を追加する

- [ ] P2 OPML export の account name/title sanitization と error redaction を固定する
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/opml.rs`, `src/components/settings/data-settings-view.tsx`
  - export title は account name 由来で XML sanitize されるが、generate error の詳細は log にのみ出るため、invalid XML char や長大 account name の扱いを固定したい
  - invalid XML char、long account name、emoji、control char、generate error log redaction、download/copy UI failure の test を追加する

- [ ] P2 OPML export ordering の folder/feed stable sort を locale-independent にする
  - 対象: `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/infra/opml.rs`
  - feed title sort は Rust string cmp なので locale 非依存だが、日本語/大小文字/emoji の ordering が UI 表示順と異なる可能性がある
  - same title id tie-breaker、Japanese title、case ordering、folder sort_order tie、orphan folder_id fallback の export snapshot を追加する

- [ ] P2 preference value byte limit と frontend validation の UTF-8 boundary を揃える
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/schemas/preferences.ts`, `src/components/settings`
  - backend は 1024 UTF-8 bytes、frontend は文字数/enum validation に寄りがちなので、日本語・emoji を含む値が UI では通るが save で落ちやすい
  - ASCII 1024、Japanese byte length、emoji surrogate、shortcut 128 bytes、debug URL length、toast copy の test を追加する

- [ ] P2 preference runtime side effect の apply-after-save 失敗を key ごとに分類する
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/stores/preferences-store.ts`, `src-tauri/src/menu.rs`
  - `debug_browser_hud` や `language` は保存後に runtime side effect を持つため、DB save 成功・side effect 失敗時の rollback/visible failure 方針が必要
  - language menu rebuild failure、debug HUD toggle failure、future side effect、DB save success + apply failure、retry behavior の contract を追加する

- [ ] P2 shortcut preference backend validation と settings collision validation の責務を分ける
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`
  - backend は control char/length だけを見るため、重複 shortcut や unsupported modifier は frontend 側で止める必要がある
  - backend accepts syntax、frontend rejects collision、unsupported modifier、empty key、legacy shortcut id、save bypass の contract を追加する

- [ ] P2 selected_account_id preference の backend allowlist と UI store owner を整理する
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/stores/ui-store.ts`, `src/stores/preferences-store.ts`
  - selected account は preference table に保存可能だが UI store state とも重なり、削除済み account id が永続化されると起動時 query が stale になりやすい
  - deleted account、disabled account、no accounts、preference cleanup、startup selection restore の test を追加する

- [ ] P2 platform dev runtime options の env alias precedence を frontend dev intent parser と同期する
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src/dev/intent.ts`, `src/dev/use-resolved-dev-intent.ts`
  - Rust は env alias の最初の non-empty/valid 値を返すため、frontend parser の priority とズレると dev scenario が別状態で起動する
  - primary blank alias set、primary invalid alias valid、both valid、unknown intent、frontend parse fallback の dev test を追加する

- [ ] P2 dev web URL env validation と browser URL schema の private host policy を合わせる
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src/api/schemas/commands.ts`, `src/dev/use-dev-intent.ts`
  - dev web URL は http(s) のみ確認するが private host/localhost は dev では許可されるべきで、本番 URL policy と混ぜるとテストが壊れやすい
  - localhost allowed、private IP allowed/blocked policy、file/javascript rejected、uppercase scheme、encoded newline の dev-only contract を追加する

- [ ] P2 dev window dimension env の max 10000 と frontend viewport fixtures を同期する
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src/dev/web-preview-geometry.ts`, `src/components/storybook/viewport-fixtures.ts`
  - Rust は width/height を個別に 10000 cap で読むため、frontend dev geometry や Storybook viewport と上限がずれると巨大 window/canvas test が flaky になる
  - width only、height only、10000 boundary、10001 reject、negative/float reject、viewport fixture parity の test を追加する

- [ ] P2 `get_platform_info` default/current platform と TS schema mock parity を release gate にする
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src/api/schemas/platform-info.ts`, `src/__tests__/schemas/platform-mock-parity.test.ts`
  - Rust PlatformInfo の capability 追加時に TS schema/default mock が古いままだと platform store が response validation error になる
  - new capability missing、unknown platform kind、unsupported feature false default、mock generator、schema barrel export の contract を追加する

- [ ] P2 tauri command return contract の null/string/bool/count response を Rust command list と同期する
  - 対象: `tests/tauri-command-return-contract.test.ts`, `src/api/tauri-commands.ts`, `src-tauri/src/commands/mod.rs`
  - command 追加時に response schema が Null/String/Bool/Count のどれか間違っていても、runtime まで気づきにくい
  - command registry extraction、response schema mapping、no-args command、renamed command、deprecated command allowlist を追加する

- [ ] P2 DB backup cleanup の retention / path redaction / restore message を migration fixture で固定する
  - 対象: `src-tauri/src/infra/db/backup.rs`, `src-tauri/src/infra/db/connection.rs`, `src-tauri/src/infra/db/migration.rs`
  - migration backup は失敗時の最後の復旧手段なので、cleanup retention や error message に local path/token が出ない保証が必要
  - keep latest 3、cleanup failure warning、restore failure、redacted backup path、manual restore instruction の Rust test を追加する

- [ ] P2 migration fresh DB path と existing DB backup path の reconcile side effects を分ける
  - 対象: `src-tauri/src/infra/db/connection.rs`, `src-tauri/src/infra/db/migration.rs`, `src-tauri/tests`
  - fresh DB と existing DB で backup有無は違うが、reconcile_article_content_text/unread_counts は両方で走るため、fresh init と migration repair の責務が混ざりやすい
  - fresh DB、existing no migration、migration success、migration failure restore、reconcile failure の integration test を追加する

- [ ] P2 OPML/import/export UI action の progress/cancel/large file policy を data settings へ追加する
  - 対象: `src/components/settings/data-settings.tsx`, `src-tauri/src/commands/opml_commands.rs`, `src/api/schemas/commands.ts`
  - large OPML import/export は同期 command として走るため、settings close や account switch 中に long-running operation の状態が見えにくい
  - large OPML、settings close during import、account switch、cancel不可 copy、success summary、partial duplicate skip summary の UX contract を追加する

- [ ] P3 OPML parser/exporter corpus を実 reader OPML variants で増やす
  - 対象: `src-tauri/src/infra/opml.rs`, `tests/fixtures/opml`
  - OPML は reader ごとに属性名・folder構造・encoding が揺れるため、handwritten unit だけだと実 import failure を拾いづらい
  - FreshRSS、Feedly、Inoreader legacy、NetNewsWire、nested folder、invalid XML char の fixture corpus を追加する

- [ ] P3 preference command allowlist を generated table として settings docs/rules に反映する
  - 対象: `src-tauri/src/commands/preference_commands.rs`, `src/schemas/preferences.ts`, `CLAUDE.md`
  - preference 追加時の手順が暗黙だと backend allowlist、frontend schema、settings UI、i18n、tests の更新漏れが繰り返される
  - add preference checklist、allowed key生成、schema default、locale key、settings option parity を rules 化する

- [ ] P1 FreshRSS 認証情報更新を connection verification 必須 contract にする
  - 対象: `src-tauri/src/commands/account_commands.rs`, `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`
  - `update_account_credentials` と `test_account_connection` が分離しているため、壊れた server_url/username/password を保存して次回 sync まで failure が遅延しやすい
  - save-before-test、test-before-save、keyring unavailable、verification stale、settings toast の contract を追加する

- [ ] P1 Keyring credential rollback を旧 password 復元 policy にする
  - 対象: `src-tauri/src/commands/account_commands.rs`, `src-tauri/src/infra/keyring_store.rs`
  - credential update 後に DB update が失敗すると rollback が delete になり、既存 credential を失う可能性がある
  - old password read success、old password read failure、set new success + DB failure、rollback failure warning、retry UX の Rust test を追加する

- [ ] P1 `add_local_feed` duplicate race が既存 feed を rollback delete しない contract を作る
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/infra/db/sqlite_feed.rs`
  - duplicate URL check と `ON CONFLICT(account_id, url) DO UPDATE` の間で競合すると、既存 feed を更新してから rollback path で削除する事故が起き得る
  - concurrent duplicate insert、existing feed update conflict、initial sync failure rollback、unread count recalc failure の integration test を追加する

- [ ] P1 Feed landing stale request が現在選択を上書きしないよう latest-only にする
  - 対象: `src/hooks/use-feed-landing.ts`, `src/stores/ui-store.ts`, `src/__tests__/hooks/use-feed-landing.test.tsx`
  - stale 判定前に selection update が走る経路があり、遅い古い request が新しい landing 後に selected feed だけ上書きし得る
  - slow old request、fast new request、account switch、missing feed fallback、toast suppression の hook test を追加する

- [ ] P2 `update_feed_display_settings` の raw query key usage を query key helper に寄せる
  - 対象: `src/hooks/use-update-feed-display-mode.ts`, `src/lib/query/query-invalidation.ts`
  - raw `["feeds"]` を使う optimistic update は query key helper の変更に追従できず、account scope や future filters の invalidation 漏れになりやすい
  - account scoped feeds、all accounts cache、rollback、helper rename、display mode query matrix の test を追加する

- [ ] P2 article read/star optimistic patch が filtered query membership を更新する policy を決める
  - 対象: `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`, `src/components/reader/hooks/article-list`
  - `is_read` / `is_starred` の field patch だけだと unread/starred/search/tag list に残るべきでない article が refetch まで表示される
  - unread list removal、starred list insert/remove、search result、tag filtered list、failed mutation rollback の hook test を追加する

- [ ] P2 account detail manual sync の late result を selected account generation で guard する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts`, `src/components/settings/account-detail/toast.ts`
  - sync 開始後に settings account を切り替えると、古い account の result/toast/status が現在画面へ混ざる可能性がある
  - account switch during sync、delete during sync、sync failure、toast owner、status invalidation owner の test を追加する

- [ ] P2 account connection test の thrown error と Result failure の surface を揃える
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`, `src/api/tauri-commands.ts`
  - `Result.isFailure` は toast/invalidate されるが throw path は pending cleanup だけになり、runtime/schema failure の feedback が欠けやすい
  - command rejection、schema validation failure、runtime unavailable、test account not found、pending cleanup の hook test を追加する

- [ ] P2 mute keyword delete confirm の stale rule DTO を id-based guard にする
  - 対象: `src/components/settings/mute-settings.tsx`, `src/components/settings/mute-settings-view.tsx`
  - confirm state が rule DTO 全体を保持するため、refetch や別操作で rule が消えた後も古い文言/target の confirm が残り得る
  - delete dialog open、rule refetch removed、scope update during dialog、confirm not-found、toast copy の component test を追加する

- [ ] P2 feed tree pointer drag の window listener 再登録を drag session lifecycle で固定する
  - 対象: `src/components/reader/hooks/feed-tree/use-feed-tree-drag.ts`, `src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts`
  - pointer drag callback が preview/hover state に依存し、drag 中に window listener が再登録されやすい
  - drag start、hover folder、preview update、drop/cancel、listener add/remove count、pointer capture loss の hook test を追加する

- [ ] P2 account switch 時の sidebar expanded folder state reset と storage restore 順序を固定する
  - 対象: `src/stores/ui-store.ts`, `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/constants/storage.ts`
  - account switch 直後に old account の expanded folder state が一瞬残り、後追い restore/prune と競合し得る
  - account switch、old folder ids、storage unavailable、restore generation、expanded state flicker の test を追加する

- [ ] P2 command palette data の render phase storage write を effect boundary へ逃がす
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-data.ts`, `src/components/reader/hooks/command-palette/use-command-history.ts`
  - `useMemo` 中の history normalization が localStorage write を呼び、React render phase side effect として StrictMode や test isolation で問題化しやすい
  - StrictMode double render、storage write count、invalid history normalize、storage unavailable、command palette reopen の test を追加する

- [ ] P2 `seed-dev-db-from-prod` backup timestamp collision を防ぐ
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts`
  - 秒精度 timestamp の backup/staging path が同一秒再実行で衝突し、退避済み DB を上書きする可能性がある
  - same-second rerun、existing backup dir、existing staging dir、atomic rename、collision message の script test を追加する

- [ ] P2 `seed-dev-db-from-prod` の backup/staging symlink safety を source/destination と同じ水準にする
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts`
  - source/destination は symlink や unsafe path を見るが、backup/staging 側の既存 symlink/衝突 path は contract が薄い
  - symlink backup dir、symlink staging dir、path traversal、cleanup failure、restore failure の script test を追加する

- [ ] P2 Storybook preview background token と CSS theme token の drift を repo contract で検出する
  - 対象: `.storybook/preview.ts`, `src/styles/global.css`, `src/__tests__/components`
  - preview 側に theme canvas 色が手書きされ、CSS token 更新時に Storybook だけ旧背景になる可能性がある
  - light canvas、dark canvas、token rename、preview parameter、global css source-of-truth の contract を追加する

- [ ] P2 `renderStory` helper の global preview parameters/decorators 適用範囲を固定する
  - 対象: `tests/helpers/render-story.tsx`, `.storybook/preview.ts`, `src/__tests__/components/*stories*.test.tsx`
  - unit test の story render は meta/story decorators 中心で、global preview と実 Storybook 表示の前提がずれやすい
  - global decorators applied/not applied policy、parameters inheritance、theme background、mock provider ordering の test を追加する

- [ ] P2 story export registry が CSF story ではない object export を誤検出しないようにする
  - 対象: `tests/helpers/storybook-story-export-registry.ts`, `src/components/**/*.stories.tsx`
  - 配列以外の object export を story と扱うため、helper constants や config object が named story として通る可能性がある
  - object config export、story object with render、function story、default export ignore、allowlist の test を追加する

- [ ] P2 Storybook smoke を dense/narrow viewport fixture と接続する
  - 対象: `e2e/storybook/ui-reference-canvas-smoke.spec.ts`, `src/components/storybook/viewport-fixtures.ts`
  - iframe load smoke だけでは dense UI / narrow viewport の崩れを拾いにくく、既存 viewport fixture が smoke gate に接続されていない
  - narrow viewport、dense settings、reader toolbar、overflow clipping、screenshot threshold の E2E smoke を追加する

- [ ] P2 command DTO field extraction を serde rename / nested DTO に強くする
  - 対象: `src/__tests__/api/schemas.test.ts`, `src/__tests__/api/browser-webview-command-contract.test.ts`, `src-tauri/src/commands/dto.rs`
  - Rust struct field を regex で拾う contract は serde rename や nested DTO 追加時に false positive/negative になりやすい
  - serde rename、flatten/nested DTO、optional field、renamed field、camelCase transform の schema contract を追加する

- [ ] P3 sidebar expanded folder storage failure を warning-once diagnostics に接続する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/lib/runtime/diagnostics.ts`
  - startup sync / command history storage には failure warning があるが、sidebar expanded folder storage は silent fallback になりやすい
  - localStorage unavailable、parse failure、write quota exceeded、warning once reset、diagnostics redaction の test を追加する

- [ ] P3 diagnostics reporter module globals の reset helper coverage を棚卸しする
  - 対象: `src/hooks/create-query.ts`, `src/lib/query/query-invalidation.ts`, `src/lib/runtime/diagnostics.ts`, `tests/helpers`
  - store/timer 系とは別に module global reporter が増えており、test reset 漏れで後続 test の reporter が差し替わったまま残る可能性がある
  - reporter install/reset、test isolation、parallel test、default reporter restoration、leaked reporter detection を追加する

- [ ] P3 package.json parse failure を `{}` fallback ではなく明示 schema error にする
  - 対象: `src/__tests__/schemas/package-scripts.test.ts`, `package.json`
  - package parse failure を `{}` に丸めると後続 assertion が謎 failure になり、JSON 破損の原因位置が遠くなる
  - invalid JSON、missing scripts、wrong scripts type、error message path、repo contract helper の test を追加する

- [ ] P3 type-surface helper が `export interface` / re-export を見落とさないようにする
  - 対象: `tests/helpers/type-surface.ts`, `tests/type-surface-contract.test.ts`
  - helper が `export type` 中心だと interface や barrel re-export の public surface が移動判断から漏れる
  - export interface、export type、re-export、namespace export、type-only barrel の fixture test を追加する

- [ ] P2 `Cmd/Ctrl+,` legacy settings shortcut が user custom shortcut を迂回する方針を決める
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`
  - `open_settings` を別キーにしても legacy `Cmd/Ctrl+,` が常に有効で、shortcut の移動/無効化と実動作がずれる
  - custom open_settings key、blank override、native menu accelerator、text input target、settings UI copy の contract を追加する

- [ ] P2 `focus_sidebar` shortcut が keyboard focus まで戻す contract を作る
  - 対象: `src/hooks/use-keyboard.ts`, `src/lib/reader-focus.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - ArrowLeft 経路は selected sidebar target へ focus するが shortcut action は sidebar を開くだけで、focus が article/list に残りやすい
  - sidebar closed、selected feed missing、account pane open、mobile layout、focus target not found の test を追加する

- [ ] P2 menu action callback の synchronous throw を diagnostics boundary に閉じ込める
  - 対象: `src/hooks/use-menu-events.ts`, `src/lib/actions.ts`, `src/lib/runtime/diagnostics.ts`
  - payload guard 後の known action が同期 throw した場合に Tauri event callback から例外が漏れ、listener lifecycle と user feedback が曖昧になる
  - executeAction throw、unknown action、diagnostics redaction、listener survival、debug trace の test を追加する

- [ ] P2 unread badge が query loading 中に一時 clear される挙動を固定する
  - 対象: `src/hooks/use-badge.ts`, `src/hooks/use-feeds.ts`, `src/hooks/use-account-unread-count.ts`
  - `feeds` / `accountUnreadCount` が `undefined` の間も `undefined` badge を適用するため、account switch や refetch 中に Dock badge がちらつく可能性がある
  - initial loading、account switch、refetch error、preference change、stale badge retention/clear policy の hook test を追加する

- [ ] P2 unread badge count の integer / max cap / negative contract を決める
  - 対象: `src/hooks/use-badge.ts`, `src/api/schemas/feed.ts`, `src/api/schemas/feed-article-summary.ts`
  - 正の finite number だけを条件にしており、小数・巨大値・schema drift 時に native `setBadgeCount` へ渡す値の仕様が曖昧
  - decimal count、safe integer max、huge count cap、negative count、NaN/null schema failure の test を追加する

- [ ] P2 unread badge runtime unavailable と command failure の diagnostics category を分ける
  - 対象: `src/hooks/use-badge.ts`, `src/lib/runtime/diagnostics.ts`
  - dynamic import unavailable、`getCurrentWindow` failure、`setBadgeCount` reject が同じ unavailable 扱いに寄り、browser dev no-op と native regression を切り分けにくい
  - browser dev、Tauri import failure、window API missing、setBadgeCount rejection、once suppression の test を追加する

- [ ] P2 app icon theme と DOM theme の system media listener source-of-truth を一本化する
  - 対象: `src/hooks/use-app-icon-theme.ts`, `src/stores/preferences-store.ts`, `src/lib/runtime/match-media-listener.ts`
  - root theme 適用と app icon 適用がそれぞれ `matchMedia` を購読し、fallback/cleanup 差で DOM theme と runtime app icon がずれる可能性がある
  - system dark change、listener add/remove failure、theme transition failure、platform capability late load、icon request ordering の test を追加する

- [ ] P1 seed-dev-db-from-prod の install failure 時に backup restore する contract を作る
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - Dev DB destination を削除した後に staging copy が失敗すると、backup はあるが自動復元されず Dev DB が欠ける可能性がある
  - destination cleanup後の copy failure、partial wal/shm copy、backup restore success/failure、staging cleanup、error message の script test を追加する

- [ ] P1 seed-dev-db-from-prod の dev app data override を basename / marker file で守る
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - `ULTRA_RSS_DEV_APP_DATA_DIR` が任意の非 production 風 directory を指せるため、誤設定時に別データを置換する事故を防ぎにくい
  - dev basename required、marker file、explicit force flag、prod/dev overlap、symlink parent の script test を追加する

- [ ] P1 preference 保存失敗時の optimistic UI rollback / dirty state policy を固定する
  - 対象: `src/stores/preferences-store.ts`, `src/components/settings`, `src/__tests__/stores/preferences-store.test.ts`
  - `setPref` が失敗しても UI 値を維持するため、永続値との差分が settings close / app restart まで見えなくなりやすい
  - save reject、schema failure、latest-only failure、rollback/dirty badge、retry action、toast copy の store/component test を追加する

- [ ] P2 discovery と local provider の private-host validation helper を共有化する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/infra/http_client.rs`
  - DNS/IP 判定が別々に増えると、片側だけ DNS rebinding や IPv6 private range 対応が進む risk がある
  - IPv4 private、IPv6 unique local、localhost alias、DNS resolve failure、redirect validation の shared fixture を追加する

- [ ] P2 sanitizer `srcset` parser の comma / descriptor edge case を corpus 化する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `tests/fixtures/sanitizer`
  - 独自 srcset split は data URL comma や異常 descriptor に弱く、safe/unsafe candidate の保持境界が将来変更で崩れやすい
  - comma in URL、empty descriptor、duplicate descriptor、control char、uppercase scheme、huge srcset の sanitizer fixture を追加する

- [ ] P2 platform capability と dev runtime option の env snapshot helper を共有する
  - 対象: `src-tauri/src/commands/platform_commands.rs`, `src-tauri/src/platform/mod.rs`, `src/dev/intent.ts`
  - env truthy 判定、URL 判定、alias 優先順が platform/dev intent で別々に増えると dev/release behavior がずれやすい
  - env alias precedence、truthy/falsy、invalid URL、runtime unavailable、mock parity の contract test を追加する

- [ ] P2 native menu updater availability と menu enabled state を release config に接続する
  - 対象: `src-tauri/src/menu.rs`, `src-tauri/src/commands/updater_commands.rs`, `src/lib/actions.ts`
  - updater disabled build でも check update menu が常時有効だと、native menu が no-op / failure action を露出する可能性がある
  - updater enabled、updater disabled、menu item state、action failure toast、release config drift の test を追加する

- [ ] P2 invalid account row quarantine を diagnostics / recovery action へ出す
  - 対象: `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/commands/account_commands.rs`, `src/components/settings/accounts-nav-view.tsx`
  - invalid row を warn で隠すと UI 上は account が消えたように見え、復旧導線や support log との接続が弱い
  - invalid kind、missing name、quarantine count、diagnostics event、settings recovery copy の contract test を追加する

- [ ] P2 Windows tasklist CSV parser を quoted/localized output で固定する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - `tasklist /FO CSV` の行 regex だけだと quoted CSV、localized header、似た exe 名の誤検知/見落としが起きやすい
  - quoted app name、localized output、Ultra RSS Reader Helper、case variant、empty tasklist の script test を追加する

- [ ] P2 Unix `pgrep -f` fallback の false positive を command line boundary で固定する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - script 引数や unrelated install path に app 名が含まれるだけで running app と誤検知すると、seed 操作が不要に止まる
  - app bundle path、script argument、deleted process、exact name miss、full command match boundary の script test を追加する

- [ ] P2 repo-contract parser を single quote / comments / block list に強くする
  - 対象: `tests/helpers/repo-contract-parser.ts`, `tests/helpers/repo-contract-parser.test.ts`, `src/__tests__/config/repo-contracts.test.ts`
  - YAML-ish 抽出が inline list / simple top-level key 前提だと、workflow や labeler の書式変更を silent miss しやすい
  - single quote、inline comment、block list、nested key、multiline scalar の parser fixture を追加する

- [ ] P2 repo contract 用 markdown/yaml 抽出 helper の重複を一本化する
  - 対象: `src/__tests__/config/repo-contracts.test.ts`, `tests/helpers/repo-contract-parser.ts`, `tests/helpers/repo-contract-parser.test.ts`
  - helper が test file 内と shared helper に分散すると、片方だけ強化されて gate の意味がずれる
  - markdown link extraction、yaml list extraction、workflow section extraction、shared helper import、fixture coverage を追加する

- [ ] P2 docs nested markdown の broken relative link も repo contract で拾う
  - 対象: `src/__tests__/config/repo-contracts.test.ts`, `docs`, `.claude/rules`
  - docs 直下と rules 直下中心の link check だと、nested docs 追加時に relative link が壊れても gate を抜ける可能性がある
  - nested docs、parent relative link、anchor-only link、ignored external link、generated docs exclude の contract を追加する

- [ ] P2 Storybook helper export allowlist を一箇所の registry に寄せる
  - 対象: `tests/helpers/storybook-story-export-registry.ts`, `src/__tests__/config/repo-contracts.test.ts`, `src/components/**/*.stories.tsx`
  - UI reference canvas や helper export の allowlist が複数箇所にあると、story 追加時に片方だけ更新される drift が起きやすい
  - allowed helper export、disallowed object export、registry owner、config contract、error message の test を追加する

- [ ] P2 Storybook index parser が `type: story` 以外を UI reference と混同しないようにする
  - 対象: `e2e/storybook/storybook-index-payload.ts`, `e2e/storybook/ui-reference-canvas-smoke.spec.ts`
  - index payload の `id` だけを見ると docs/virtual/future entry を story として扱い、UI reference smoke の対象がずれる可能性がある
  - docs entry、story entry、unknown type、missing type、future shape の parser fixture を追加する

- [ ] P2 Storybook webServer timeout を cold start / CI variance の repo contract にする
  - 対象: `playwright.storybook.config.ts`, `src/__tests__/config/repo-contracts.test.ts`, `package.json`
  - Storybook の cold start が変動した時に timeout 設定が暗黙だと、CI flaky の原因が app 側 regression と混ざりやすい
  - timeout value、reuseExistingServer false、storybook command、port、CI/local variance の contract を追加する

- [ ] P2 fixture の article-tag relation duplicate / orphan policy を固定する
  - 対象: `tests/helpers/fixtures.ts`, `tests/helpers/reader-fixtures.ts`, `tests/helpers/fixtures.test.ts`
  - `sampleArticleTags` の参照整合だけでは duplicate pair や orphan cleanup の前提が薄く、tag 系 test が壊れた fixture に依存しやすい
  - duplicate pair、orphan article、orphan tag、stable order、fixture builder invariant の test を追加する

- [ ] P3 fixture seed を JSON-like 値だけに制限する gate を追加する
  - 対象: `tests/helpers/fixture-types.ts`, `tests/helpers/fixtures.test.ts`, `tests/helpers/typed-test-factories.ts`
  - `structuredClone` 前提の seed に Date/Map/function が入ると clone/readonly helper の意味が壊れる
  - Date value、Map value、function value、undefined field、JSON-like allowlist の type/runtime fixture test を追加する

- [ ] P3 root-level YAML 追加時に lint 対象へ入るかの repo contract を決める
  - 対象: `.yamllint`, `mise.toml`, `src/__tests__/config/repo-contracts.test.ts`
  - YAML gate が `.github/` と `.yamllint` 中心だと、将来 root-level yaml を足した時に lint 対象外のまま残りやすい
  - root yaml、nested yaml、generated yaml exclude、mise lint task、CI parity の contract を追加する

- [ ] P2 command history entry に account scope / feed context を含めるか決める
  - 対象: `src/components/reader/hooks/command-palette/use-command-history.ts`, `src/components/reader/hooks/command-palette/use-command-palette-data.ts`, `src/components/reader/command-palette-history.ts`
  - `article:<id>` だけの保存だと account switch や feed移動後の recent article 復元が current context 依存になる
  - account switch、deleted article、moved feed、duplicate id、history migration の command palette test を追加する

- [ ] P2 command palette feed landing success 側の selection / scroll / history contract を固定する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/hooks/use-feed-landing.ts`
  - failure guard はあるが success 時にどの selection と scroll restore と history add が残るべきかが薄く、request race で UX が揺れやすい
  - slow success、newer request success、scroll restore、history write failure、toast suppression の hook test を追加する

- [ ] P2 shortcut 記録値の大小文字 / modifier 正規化 parity を固定する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`, `src/__tests__/lib/keyboard-shortcuts.test.ts`
  - `Cmd+K` と `Cmd+Shift+K`、単キー大文字、Ctrl/Mac 表示差で duplicate 判定と実発火が drift しやすい
  - lowercase/uppercase、shift modifier、platform display、duplicate detection、storage migration の test を追加する

- [ ] P2 `?` shortcuts help と custom shortcut の衝突方針を settings に出す
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/hooks/use-shortcuts-settings-view-props.ts`
  - `?` は固定 shortcut として残っており、ユーザー設定キーとの衝突が settings UI に出ない
  - custom `?` binding、shift slash、help action override、reset default、UI collision warning の test を追加する

- [ ] P2 browser webview navigation command 連打を latest-only にする
  - 対象: `src/components/reader/hooks/browser/use-browser-view-actions.ts`, `src/components/reader/browser-webview-state.ts`, `src-tauri/src/commands/browser_webview_commands.rs`
  - back/forward/reload に in-flight guard がないと、遅い native response が新しい URL/loading state を上書きする可能性がある
  - double back、reload then navigate、forward disabled drift、late response、fallback state の hook/native contract を追加する

- [ ] P2 malformed browser event diagnostics を event payload shape 別に分ける
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/api/schemas/browser-webview.ts`
  - malformed payload が eventName 単位の once warning だけだと、state/fallback/diagnostics どの payload が欠けたか調査しにくい
  - malformed state、malformed fallback、malformed diagnostics、once key、redacted payload summary の hook test を追加する

- [ ] P2 account credentials editor の draft revision と pending save 再帰を contract 化する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`
  - pending save 中に draft が変わると promise 後に再帰 commit するため、account switch/unmount/test connection との絡みで古い draft を保存しやすい
  - draft change during save、account switch、unmount、test connection pending、save failure retry の hook test を追加する

- [ ] P2 account delete 後の selected account preference 保存失敗 surface を固定する
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`, `src/stores/preferences-store.ts`, `src/stores/ui-store.ts`
  - 削除 account が `selected_account_id` の場合に preference 保存へ進むが、保存失敗時の fallback account と UI state の整合が未固定
  - selected account delete、setPref failure、fallback account missing、settings close、toast copy の component/store test を追加する

- [ ] P2 article list selected-row clear の loading/refetch race を guard する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-effects.ts`, `src/components/reader/hooks/article/use-article-view-selection.ts`
  - `filteredArticles` に選択記事が一瞬いないだけで clear すると、search/tag/account refetch 中に not-found 表示へ飛びやすい
  - loading true、refetch success、account switch、search clear、stale selection guard の hook test を追加する

- [ ] P2 retained article snapshot の title/read/star 鮮度更新方針を固定する
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article/use-article-status-actions.ts`, `src/hooks/use-articles.ts`
  - retained article は missing source の snapshot を戻すため、mutation 後の title/read/star が source 再取得まで古いまま残る可能性がある
  - read mutation、star mutation、title update after sync、snapshot refresh、failed mutation rollback の test を追加する

- [ ] P3 article date/group fallback の invalid date 表示方針を明文化する
  - 対象: `src/lib/articles/article-list.ts`, `src/lib/articles/article-view.ts`, `src/lib/datetime.ts`
  - parse不能な `published_at` が raw group/表示へ流れると provider payload drift 時に UI 表示が不安定になる
  - invalid date、blank date、future date、timezone fallback、group label copy の helper/component test を追加する

- [ ] P3 actions settings の hidden preference と UI 表示 parity を棚卸しする
  - 対象: `src/components/settings/hooks/use-actions-settings-view-props.tsx`, `src/schemas/preferences.ts`, `src/components/reader/article-toolbar-view.tsx`
  - hidden default にある action preference と settings UI に出る項目がずれると、toolbar action 追加時に schema/default/UI の差分が残りやすい
  - hidden action preference、visible copy action、toolbar action追加、default reset、schema option parity の test を追加する

- [ ] P2 app icon request queue の recursion / repeated failure policy を固定する
  - 対象: `src/hooks/use-app-icon-theme.ts`, `src/lib/window/windows.ts`
  - pending request を再帰的に drain するため、連続 theme change や setIcon failure が続いた時の ordering・diagnostics・stack safety が暗黙
  - rapid light/dark changes、setIcon rejects、same request dedupe、unmount during drain、microtask scheduling の hook test を追加する

- [ ] P2 window always-on-top failure を runtime diagnostics policy に接続する
  - 対象: `src/hooks/use-window-always-on-top.ts`, `src/lib/window/windows.ts`, `src/lib/runtime/diagnostics.ts`
  - unsupported は silent、それ以外は `console.warn` 直書きで、production diagnostics / once / redaction policy から外れている
  - unsupported no-op、permission failure、stale request、Tauri import failure、diagnostics policy id の test を追加する

- [ ] P2 browser webview navigation failure 後に bounds だけ適用済みになる挙動を固定する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - 既存 webview 更新は先に bounds を適用してから navigate するため、navigate 失敗時に URL state は戻っても bounds だけ変わる可能性がある
  - set_bounds success + navigate failure、bounds rollback/no rollback policy、surface issue、pending bounds flush の test を追加する

- [ ] P2 embedded browser log URL redaction を path token / signed URL まで広げる
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src/lib/runtime/diagnostics.ts`
  - query/userinfo/fragment は落としても path に token や signed URL 風の値が入ると timeout/fallback logs へ残る可能性がある
  - signed path token、UUID path、safe host only、multiline URL、redaction snapshot の Rust/TS test を追加する

- [ ] P2 feed integrity report を sync/maintenance 中に読んでよいか policy 化する
  - 対象: `src-tauri/src/commands/article_commands.rs`, `src/components/settings/data-settings.tsx`
  - cleanup は maintenance guard を取るが report は reader lock だけで読み、sync 中の transient orphan count を UI に出すかが曖昧
  - sync in progress、vacuum in progress、cleanup in progress、stale report copy、retry action の contract を追加する

- [ ] P2 Windows dispatch の dev env alias forwarding を frontend dev intent と同期する
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/windows-command-dispatch.ts`, `src/dev/intent.ts`
  - Windows/WSL dispatch は一部 env だけ forward し、`VITE_ULTRA_RSS_DEV_*` alias や window size env が frontend dev intent とずれる可能性がある
  - primary alias、legacy alias、window width/height、blank env、WSL forwarding の script test を追加する

- [ ] P2 dispatch wrapper の signal forwarding を child process group / listener cleanup で固定する
  - 対象: `scripts/tauri-cli-dispatch.ts`, `scripts/windows-command-dispatch.ts`
  - `child.kill(signal)` と `process.on` だけでは shell/PowerShell 経由の孫プロセス残りや repeated invocation の listener 蓄積が起きやすい
  - SIGINT、SIGTERM、child exit before signal、listener removal、process group fallback の script test を追加する

- [ ] P2 stale macOS dev bundle cleanup failure で Tauri dev 起動全体を止めない policy にする
  - 対象: `scripts/tauri-cli-dispatch.ts`
  - stale bundle cleanup の `rm` failure が dev command 全体の failure になり、権限/ロックで古い app bundle を消せないだけで開発起動が止まる
  - cleanup permission denied、locked bundle、warning-only policy、explicit strict mode、dev start continuation の script test を追加する

- [ ] P2 `seed-dev-db-from-prod` の process/DB handle check 後 race を再確認する
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts`
  - 起動中/handle check 後から DB copy までに app が起動すると、dev DB 置換と runtime open handle が競合し得る
  - check-then-open race、copy failure restore、second handle check、retry message、dry-run parity の script test を追加する

- [ ] P2 dev mock article seed の today/yesterday を reset 時点で再生成する
  - 対象: `src/dev/mock-data.ts`, `src/dev/mocks.ts`
  - mock article の `now` / `yesterday` が module load 固定で、長時間 dev session や reset 後に「今日の記事」が古いままになる
  - reset after day rollover、fake timers、relative labels、published_at ordering、fixture deterministic seed の test を追加する

- [ ] P2 dev mock external opener を real `window.open` から観測可能 mock に分離する
  - 対象: `src/dev/mocks.ts`, `src/lib/browser/webview-history.ts`, `src/__tests__/dev`
  - mock IPC 内で直接 `window.open` すると Storybook/browser dev/test で意図しない tab 生成や popup blocker 差分が出る
  - open_in_browser、add_to_reading_list、popup blocked、recorded opener calls、test cleanup の dev mock contract を追加する

- [ ] P2 dev mock browser embed support invalid URL fallback を本体 URL policy と揃える
  - 対象: `src/dev/mocks.ts`, `src-tauri/src/commands/article_commands.rs`
  - dev mock は URL parse 失敗時に embeddable true を返し、本体では invalid URL が拒否されるため browser preview failure path を見落としやすい
  - invalid URL、private URL、mailto/file URL、blocked host fixture、mock/body parity の test を追加する

- [ ] P2 dev mock account sync status を unknown/deleted account で failure or warning にする
  - 対象: `src/dev/mocks.ts`, `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts`
  - `accountId` を parse するだけで healthy status を返すため、削除済み account や存在しない account の UI 分岐が dev mock で再現できない
  - unknown account、deleted account、disabled account、connection error、mock diagnostics の test を追加する

- [ ] P2 `tests/helpers/tauri-mocks` の mutation commands を stateful fixture にする範囲を決める
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/fixtures.ts`
  - list 系が毎回 sample fixture を返し mutation 系は null を返すだけなので、mark/read/star 後の再取得や count 変化を helper が隠す可能性がある
  - mark read、toggle star、delete feed、tag mutation、fixture reset boundary の helper contract を追加する

- [ ] P2 repo contract parser の YAML inline list を single quote / comment / bracket 込みで固定する
  - 対象: `tests/helpers/repo-contract-parser.ts`, `tests/helpers/repo-contract-parser.test.ts`
  - inline list parser が simple regex と double quote strip に寄っており、single quote、inline comment、quoted bracket で repo contract が誤判定しやすい
  - single quoted label、inline comment、quoted `]`、empty list、multiline fallback の test を追加する

- [ ] P3 unknown native menu id を diagnostics に出す
  - 対象: `src-tauri/src/menu.rs`, `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`
  - `resolve_menu_action` が `None` の場合 silent return するため、menu id rename や platform 差で click no-op になった原因を追いにくい
  - unknown menu id、known id、diagnostics once、redacted payload、release log level の Rust/TS contract を追加する

- [ ] P3 `matchMedia()` 自体が throw する環境の app icon fallback を固定する
  - 対象: `src/hooks/use-app-icon-theme.ts`, `src/lib/runtime/match-media-listener.ts`
  - `matchMedia` の存在確認はあるが呼び出しを try しておらず、throwing implementation の browser/test environment で app icon hook が落ち得る
  - missing matchMedia、throwing matchMedia、listener add failure、fallback icon、diagnostics once の test を追加する

- [ ] P3 window event listener の `instanceof` guard が cross-realm event を落とすか決める
  - 対象: `src/lib/window/window-events.ts`, `src/__tests__/lib/window-events.test.ts`
  - `KeyboardEvent` / `CustomEvent` を current realm の `instanceof` で判定しており、iframe/test helper/embedded context 由来 event の扱いが未契約
  - iframe keyboard event、cross-realm custom event、plain object event、security error、fallback guard の test を追加する

- [ ] P3 dev scenario registry diagnostics を test/report に露出する
  - 対象: `src/dev/scenarios/registry.ts`, `src/dev/scenarios/import-registry.ts`, `src/__tests__/dev`
  - duplicate id/title/keyword diagnostics を計算しているが list/get flow で使われず、scenario 追加時の診断が死蔵されやすい
  - duplicate id、duplicate title、duplicate keyword、report output、CI contract の test を追加する

- [ ] P1 Data settings VACUUM in-flight を modal lifecycle から切り離す
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/components/settings/data-settings.tsx`, `src-tauri/src/commands/database_commands.rs`
  - modal unmount で local `vacuumingRef` がリセットされ、close/reopen 後に最初の VACUUM が完了する前でも再実行できる可能性がある
  - close during vacuum、reopen、duplicate click、command busy、toast/size refresh contract の test を追加する

- [ ] P1 add feed の folder assignment failure を partial success として扱う
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/lib/feed-folder-flow.ts`, `src/lib/feed-query-cache.ts`
  - `addLocalFeed` 成功後に `updateFeedFolder` が失敗すると、feed は作られるが期待 folder に入らない状態で dialog が閉じ得る
  - add success + folder failure、refetch display、toast、retry/move action、query invalidation の contract test を追加する

- [ ] P1 article tag picker createTag failure の notification/input retention を固定する
  - 対象: `src/components/article/article-tag-chips.tsx`, `src/components/article/article-tag-picker-view.tsx`, `src/hooks/use-tags.tsx`
  - create tag mutation の failure path が view contract に出ておらず、duplicate/network/schema failure 時の入力保持と通知が曖昧
  - duplicate、network failure、schema failure、input retention、toast、pending state の test を追加する

- [ ] P2 Data settings `setSettingsLoading` と modal common loading を同期する
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src/components/settings/settings-modal-view.tsx`, `src/stores/ui-store.ts`
  - controller param は存在するが db info/vacuum/open log の進行状態と modal 共通 loading 表示が連動していない
  - database info、vacuum、open log、close/nav、stuck loading の test を追加する

- [ ] P2 VACUUM success toast の saved bytes stale `totalSize` policy を決める
  - 対象: `src/components/settings/hooks/use-data-settings-controller.ts`, `src-tauri/src/commands/database_commands.rs`
  - `sizeBefore = totalSize` が stale または未取得の場合、saved bytes 表示が誤解を招く可能性がある
  - unknown size、failed initial info、concurrent refresh、negative saved、huge saved の test を追加する

- [ ] P2 Data settings action row label と action label を分離する
  - 対象: `src/components/settings/data-settings-view.tsx`, `src/components/settings/data-settings.tsx`, `src/components/settings/settings-page-view.tsx`
  - row label と button label が同じ値を共有しており、processing 表示で row の意味まで変わる可能性がある
  - stable row label、loading action label、aria name、snapshot、long ja text の test を追加する

- [ ] P2 Actions settings switch に per-row aria label contract を追加する
  - 対象: `src/components/settings/actions-settings-view.tsx`, `src/components/settings/hooks/use-actions-settings-view-props.tsx`
  - 全 row が共通 `toggleLabel` に依存しており、action が増えた時に accessible name が曖昧になる
  - copy link、open browser、multiple toggles、accessible name、locale parity の test を追加する

- [ ] P2 Actions settings registry と toolbar visibility の parity を固定する
  - 対象: `src/components/settings/hooks/use-actions-settings-view-props.tsx`, `src/components/article/hooks/use-article-toolbar-controls.tsx`, `src/schemas/preferences.ts`
  - settings に出る action と toolbar が参照する action が分かれており、schema/default/hidden action の drift が起きやすい
  - registry、hidden/default、toolbar action、locale option、test parity を追加する

- [ ] P2 Settings modal setup lock を store action boundary にも適用する
  - 対象: `src/components/settings/hooks/use-settings-modal-view-props.tsx`, `src/stores/ui-store.ts`, `src/lib/actions.ts`
  - view は close/nav をブロックするが、command palette/native menu/dev scenario など store action 経由の遷移は別経路になり得る
  - setup syncing、native menu、command palette、dev scenario、action no-op feedback の test を追加する

- [ ] P2 Settings modal `deletedAccountIds` と refetch account disappearance の整合を取る
  - 対象: `src/components/settings/settings-modal.tsx`, `src/hooks/use-accounts.ts`, `src/stores/ui-store.ts`
  - local deleted ids は明示削除時だけ更新されるため、sync/refetch で account が消えた path と挙動がずれる可能性がある
  - account disappears by refetch、close/reopen、saved selected account、add flow、snapshot の test を追加する

- [ ] P2 Subscriptions index search/sort return state inclusion policy を決める
  - 対象: `src/components/subscriptions/hooks/use-subscriptions-index-state.ts`, `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions/subscriptions-index-page.tsx`
  - hook 内に search/sort state がある一方で返却 state に含めないため、復帰・URL・navigation contract が曖昧
  - search restored/not restored、sort restored/not restored、account scope、scroll reset、back from detail の test を追加する

- [ ] P2 Subscriptions index missing folder id grouping policy を固定する
  - 対象: `src/lib/subscriptions/subscriptions-index.ts`, `src/components/subscriptions/subscriptions-index-page.tsx`
  - feed の `folder_id` が folders に存在しない場合、folderId と null name の組み合わせで no-folder 風 group が複数化し得る
  - deleted folder、folder query failure、stale feed folder_id、no-folder merge/separate、label の test を追加する

- [ ] P2 Subscriptions detail recent articles の tie-breaker を固定する
  - 対象: `src/lib/subscriptions/subscriptions-index.ts`, `src/__tests__/lib`
  - `published_at` が同一の場合 compare が 0 になり、preview order が入力順依存になる
  - same timestamp、id/title fallback、invalid date、stable sort、locale の test を追加する

- [ ] P2 add feed discovery close/reopen stale result generation guard を追加する
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/components/add-feed/hooks/use-add-feed-dialog-controller.ts`, `src/components/add-feed/add-feed-dialog-state.ts`
  - latest 判定が URL/lifecycle 寄りで、同じ URL を close/reopen した時に古い discovery result を受け入れる可能性がある
  - close pending、same URL reopen、different account、late success、late error の test を追加する

- [ ] P2 add feed submit pending 中の close/unmount post-processing policy を固定する
  - 対象: `src/components/add-feed/hooks/use-add-feed-dialog-actions.ts`, `src/components/add-feed/add-feed-dialog-view.tsx`, `src/components/add-feed/add-feed-dialog.tsx`
  - view では cancel disabled だが、外部 close や parent unmount は起こり得るため completion dispatch/onOpenChange の扱いが未契約
  - submit pending unmount、parent close、late success/failure、toast duplication、loading cleanup の test を追加する

- [ ] P2 rename feed dialog folder update failure の saved 判定を見直す
  - 対象: `src/lib/feed-edit-submit.ts`, `src/components/rename-feed/hooks/use-rename-feed-dialog-controller.ts`, `src/components/rename-feed/rename-feed-dialog-view.tsx`
  - rename/display が成功して folder move だけ失敗した場合に、保存済み扱いと UI/toast の整合が崩れる可能性がある
  - folder-only failure、rename+folder failure、display+folder failure、close/stay policy、toast の test を追加する

- [ ] P2 folder select `__new__` sentinel collision を防ぐ
  - 対象: `src/components/feed-dialog/folder-select-view.tsx`, `src/components/feed-dialog/use-folder-selection.ts`, `src/components/feed-dialog/feed-dialog-form.types.ts`
  - sentinel が folder id と同じ value 空間にあり、backend id が `__new__` の場合に create/select が衝突する
  - folder id `__new__`、unknown selected folder、missing option、create disabled、backend id policy の test を追加する

- [ ] P2 selected folder deleted while dialog open の fallback/submit policy を決める
  - 対象: `src/components/feed-dialog/folder-select-view.tsx`, `src/lib/feed-folder-flow.ts`, `src/components/feed-dialog/use-folder-selection.ts`
  - 選択中 folder が refetch で消えた場合、missing selected value が stale id のまま submit され得る
  - folder deleted、refetch、stale submit、not found toast、auto reset の test を追加する

- [ ] P2 tag context menu delete confirm の pending guard/loading を追加する
  - 対象: `src/components/tags/delete-tag-dialog-view.tsx`, `src/components/tags/tag-context-menu.tsx`, `src/components/sidebar/sidebar-tag-section.tsx`
  - delete dialog に loading prop がなく、confirm handler 側の double-click guard が view contract に現れていない
  - double confirm、pending close、error retry、reader sidebar context menu、selected tag cleanup の test を追加する

- [ ] P2 settings tags edit/delete dialog の stale tag id guard を追加する
  - 対象: `src/components/settings/tags-settings.tsx`, `src/components/tags/rename-tag-dialog-view.tsx`, `src/components/tags/delete-tag-dialog-view.tsx`
  - dialog 開始時の tag DTO を保持するため、refetch で対象 tag が消えた場合の rename/delete path が未契約
  - dialog open then removed、rename/delete not-found、UI close/stay、toast、stale color/name の test を追加する

- [ ] P2 mute keyword add in-flight guard を disabled state 以外にも置く
  - 対象: `src/components/settings/mute-settings.tsx`, `src/components/settings/mute-settings-view.tsx`, `src/hooks/use-mute-keywords.tsx`
  - `handleAdd` に in-flight ref がなく、view disabled だけでは Enter spam や double click を完全には防げない
  - Enter spam、double click、slow mutation、duplicate backend failure、input reset の test を追加する

- [ ] P2 app-wide queryClient singleton lifecycle reset policy を決める
  - 対象: `src/lib/query/query-client.ts`, `src/App.tsx`, `src/stores/ui-store.ts`
  - account deletion/dev scenario/reset-like operation 時に cache retention/removal の責務が中央化されていない
  - account delete、dev reset、selected account change、persisted preferences、cache whitelist の test を追加する

- [ ] P2 runtime diagnostics policy の `toast` field execution path を実装または削除する
  - 対象: `src/lib/runtime/diagnostics.ts`, `src/stores/ui-store.ts`
  - policy に `toast: user-action-only` があるが logger は console 中心で、ユーザー通知される条件が実装 contract になっていない
  - user action diagnostics、background diagnostics、toast suppression、policy test、UI store dependency を追加する

- [ ] P2 command history storage warning を diagnostics/redaction に統合する
  - 対象: `src/hooks/use-command-history.ts`, `src/lib/runtime/diagnostics.ts`
  - DEV-only console warning が runtime diagnostics と分かれており、production behavior と redaction 方針が揺れやすい
  - localStorage unavailable、quota、malformed JSON、redaction、production behavior の test を追加する

- [ ] P3 SettingsPageView inline text action の aria-label required contract を決める
  - 対象: `src/components/settings/settings-page-view.tsx`, `src/components/settings/settings-page.types.ts`
  - inline input + button の関係で action aria label が必要になる場面があるが、type 上は optional のまま
  - missing aria、generated label、existing controls、TS type、a11y test を追加する

- [ ] P3 mute keyword scope select invalid value diagnostics を追加する
  - 対象: `src/components/settings/mute-settings-view.tsx`, `src/api/schemas/mute-keyword.ts`, `src/lib/runtime/diagnostics.ts`
  - unknown select value を UI 側で silent no-op にすると、schema drift や fixture 破損に気づきにくい
  - invalid payload、schema drift、warning once、UI no-op、test を追加する

- [ ] P3 createQuery composite key support policy を決める
  - 対象: `src/hooks/create-query.ts`, `src/lib/query/query-invalidation.ts`
  - helper が single string id 前提のため、account+mode+filter など composite key が必要な query が helper 外へ逃げやすい
  - composite key RFC、generated query、manual query exception、invalidation matrix、type tests を追加する

- [ ] P3 command history length cap の grapheme/UTF-8 policy を決める
  - 対象: `src/schemas/storage.ts`, `src/constants`
  - UTF-16 `slice` ベースの cap は surrogate pair や combining sequence を分割し得る
  - emoji、combining mark、UTF-8 bytes、display length、max entry の test を追加する

- [ ] P3 i18n supported locales と language preference enum の parity を固定する
  - 対象: `src/lib/i18n-resources.ts`, `src/schemas/preferences.ts`, `src/components/settings/hooks/use-general-settings-view-props.ts`
  - UI option は supported languages、schema は hard-coded enum のため、locale 追加時に保存値と fallback がずれやすい
  - add locale fixture、schema enum、settings option、resources、fallback の test を追加する

- [ ] P1 `keep_read_items_days` purge の実行契約を manual/startup/scheduler で揃える
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/service/sync_scheduler.rs`
  - purge が scheduler path 中心だと、manual sync 中心・scheduler 未解禁・startup only の利用で既読記事が溜まり続ける可能性がある
  - manual all sync後purge、startup sync後purge、scheduler disabled、keep_read_items_days=0、purge failure result の test を追加する

- [ ] P1 native browser `closed` event を URL/generation で current overlay に紐づける
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-events.ts`, `src/components/reader/hooks/browser/use-browser-view-event-bridge.ts`
  - `closed` event に current owner 判定がないと、旧 child webview の遅延 close event が新しい overlay を閉じる可能性がある
  - A open -> B switch -> A close event ignored、current close accepted、malformed close payload、missing payload policy の test を追加する

- [ ] P1 browser unmount cleanup の `closeBrowserWebview` を stale controller から守る
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-cleanup.ts`
  - controller unmount 時の close が無条件だと、portal/scope remount や StrictMode 的な再作成で新しい webview を閉じるリスクがある
  - stale controller cleanup、StrictMode double mount、already-closed error、new URL after unmount、close suppression の test を追加する

- [ ] P2 scheduler `retry_after_seconds` を error message parse から構造化 metadata へ寄せる
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/domain/error.rs`
  - backoff が `retry_after_seconds=` という message 断片に依存し、provider copy 変更や user-visible 文言混入で retry timing が壊れやすい
  - markerなし、複数marker、巨大値、数字以外suffix、偶然marker、structured retry metadata 優先の test を追加する

- [ ] P2 remote subscription URL fallback merge が別 remote feed を上書きしない契約を作る
  - 対象: `src-tauri/src/service/sync_flow.rs`
  - `find_by_remote_id` が外れた後に `find_by_url` で既存 feed を再利用するため、remote_id 変更や同 URL 別 subscription が混ざると意図しない merge になり得る
  - remote_id changed same URL、two remote subs same URL、existing local feed same URL、remote_id conflict、title/folder overwrite policy の test を追加する

- [ ] P2 remote subscription missing `folder_remote_id` 時の folder 保持/解除 policy を固定する
  - 対象: `src-tauri/src/service/sync_flow.rs`
  - `folder_remote_id` が存在するのに folder 解決できない場合に `folder_id=None` へ落ちると、一時的な folder API 欠落で feed が root へ移動し得る
  - folder sync omitted、folder API failure後subscription sync、unknown folder_remote_id、existing folder保持、explicit remote folder removal の test を追加する

- [ ] P2 main-stage portal target missing 時の browser fallback geometry を固定する
  - 対象: `src/components/reader/browser-view.tsx`, `src/components/reader/browser-webview-sync-helpers.ts`
  - `scope="main-stage"` の portal root が無い時に inline 描画へ落ちると、main-stage geometry のまま content pane へ載って bounds がずれ得る
  - portal root missing、portal root late attach、content-pane fallback geometry、overlay root relative bounds の test を追加する

- [ ] P2 native browser `stateChanged` payload を requested URL/closed state で reject する
  - 対象: `src/components/reader/browser-webview-state.ts`, `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts`
  - stale `stateChanged` が close 後や URL 切替後に届くと、navigation/loading state が現在の reader 状態へ混入しやすい
  - close後 stateChanged ignore、URL切替後旧 payload ignore、can_go_back/can_go_forward stale update 抑止 の test を追加する

- [ ] P2 retry web preview の late reject/success を current URL に限定する
  - 対象: `src/components/reader/hooks/browser/use-browser-view-actions.ts`
  - `handleRetry` は fire-and-forget で、retry 中に overlay close/URL switch すると古い toast や surface issue が出る可能性がある
  - retry A 中に B へ切替、retry 中 close、late reject toast 抑止、latest retry だけ issue 表示 の test を追加する

- [ ] P2 browser overlay close motion の `matchMedia` / timer failure を固定する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - reduced motion 判定と close delay timer が runtime API に依存し、timer unavailable 時の close 完了順序が崩れやすい
  - matchMedia throws、setTimeout throws、clearTimeout throws、unmount during close delay、close completion の test を追加する

- [ ] P2 browser toolbar accepted-feedback timer の runtime failure/unmount cleanup を固定する
  - 対象: `src/components/reader/browser-overlay-chrome.tsx`
  - back/reload の spinner feedback が `window.setTimeout` 前提で、timer failure や unmount 時に active feedback が残る可能性がある
  - setTimeout throw、clearTimeout throw、action promise reject、unmount before timer、rapid back/reload の test を追加する

- [ ] P2 browser bounds の non-finite `scaleFactor` を reject する
  - 対象: `src/lib/browser/browser-webview.ts`
  - `scaleFactor` が NaN/Infinity/negative の場合、width/height 判定をすり抜けて native bounds に非有限値が流れる可能性がある
  - NaN/Infinity/negative/zero scaleFactor、devicePixelRatio malformed、fractional rect rounding、empty_bounds の test を追加する

- [ ] P2 iframe webview-history helper の document/runtime unavailable を contract 化する
  - 対象: `src/lib/browser/webview-history.ts`
  - browser preview helper が `document.querySelector` 前提で、Storybook/test/browser-only runtime の boundary failure が `Result` 以外へ漏れ得る
  - document undefined、querySelector throws、cross-origin history throws、contentWindow null、src setter throws の test を追加する

- [ ] P2 overlay viewport width の malformed `innerWidth` と resize cleanup を固定する
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-viewport-width.ts`, `src/lib/browser/browser-viewer-geometry.ts`
  - `innerWidth` が NaN/Infinity/negative の場合に geometry fallback へ倒さないと、chrome/stage layout が崩れ得る
  - NaN/Infinity/negative innerWidth、resize after unmount、listener bind failure、cleanup failure の test を追加する

- [ ] P2 shortcut runtime modifier policy を platform と同期する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/hooks/use-keyboard.ts`
  - resolver が `metaKey || ctrlKey` を同じ modifier と扱うため、macOS Ctrl/Cmd、Windows/Linux Meta/Ctrl の実動作と表示・native menu がずれやすい
  - mac Ctrl+K vs Cmd+K、Windows Ctrl+K vs Meta+K、custom shortcut modifier、native-menu-owned shortcut parity の test を追加する

- [ ] P2 article list stale selected article cleanup を loading transition と empty source で固定する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-effects.ts`, `src/components/reader/hooks/article-list/use-article-list-sources.ts`
  - loading が false になった瞬間に selected id が `filteredArticles` から消えると、retained article/refetch transition の順序次第で選択が落ちやすい
  - source refetch中、empty feed、retained selected article、search on/off、feed delete後 clear timing の test を追加する

- [ ] P2 sidebar feed drop target の folder ownership を contract 化する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-tree-props.ts`
  - drag/drop が stale render や test helper 経由で別 account folder/missing folder id を `moveFeedToFolder` へ渡せる可能性がある
  - missing folder id、same account folder、different account folder、folder list refetch 中、drop failure feedback の test を追加する

- [ ] P2 sidebar feed selection の open-first-article failure surface を決める
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`
  - `open_first_article_on_feed_selection` 有効時の `void openFeedLanding(feedId)` failure が hook 内で見えず、削除済み feed や記事 0 件の UX が揺れやすい
  - feed not found、no article、landing fetch reject、starred tree context、account switch 中 request owner の test を追加する

- [ ] P2 command palette article selection を account/feed freshness で guard する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/components/reader/hooks/command-palette/use-command-palette-data.ts`
  - palette 検索結果や recent article が account switch 直前のものだと、現在 account に存在しない feed/article を選び得る
  - account switch while palette open、stale search result、recent article missing feed、feed deleted by refetch、select no-op/toast policy の test を追加する

- [ ] P2 command palette dev scenario failure を stale palette session で抑止する
  - 対象: `src/components/reader/hooks/command-palette/use-command-palette-handlers.ts`, `src/components/reader/hooks/command-palette/use-command-palette-runtime.ts`
  - dev scenario reject が palette close 後でも toast されると、別 scenario や account switch 後に古い failure が現在操作の失敗に見える
  - scenario A reject after B starts、palette close/reopen、account switch、runtime unavailable、toast owner id の test を追加する

- [ ] P2 dev scenario async runners を run generation で latest-only にする
  - 対象: `src/dev/scenarios/runner.ts`, `src/dev/scenarios/helpers.ts`
  - feed-first/tag-view scenario が複数 IPC 後に UI state/query cache を更新するため、後続 scenario 開始後に古い完了が UI を上書きし得る
  - feed-first中にtag-view開始、account list delay、listFeeds reject、late query cache write、late selectFeed/selectTag suppression の test を追加する

- [ ] P2 dev scenario query cache seeding の partial failure policy を固定する
  - 対象: `src/dev/scenarios/helpers.ts`
  - accounts/feeds/articles/tags を順に query cache へ書くため、途中失敗時に半端な dev cache が残り次の scenario や reader 表示へ混入し得る
  - listFeeds failure after accounts cached、listArticles failure after feed cached、tag counts failure、failure toast、cache rollback/keep policy の test を追加する

- [ ] P2 command palette prefix search の IME/full-width prefix policy を決める
  - 対象: `src/components/reader/hooks/command-palette/use-command-search.ts`, `src/__tests__/hooks/use-command-search.test.ts`
  - prefix が ASCII `>`/`@`/`#` 前提のため、日本語入力中や全角記号、ゼロ幅文字で意図せず通常検索へ落ちる可能性がある
  - full-width prefix、zero-width space、leading newline/tab、IME composing input、prefix-only query の test を追加する

- [ ] P2 Tauri default mocks の pagination behavior を command schema と揃える
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/tauri-mocks.test.ts`, `src/api/schemas/commands.ts`
  - default mock が offset/limit を十分反映しないと、paging UI の test が default mock では false green になり得る
  - list_articles offset/limit、list_account_articles offset/limit、recent/search slicing、invalid pagination schema、custom handler precedence の test を追加する

- [ ] P3 OPML export の large account performance を snapshot/limit で見える化する
  - 対象: `src-tauri/src/commands/opml_commands.rs`
  - folder ごとに `remaining_feeds.remove(index)` する構造は大きい feed 数で O(n^2) 寄りになり、large OPML export の UI 固まりにつながりやすい
  - 1k/5k feeds export smoke、many folders、all orphan feeds、stable order、time budget/allocation regression guard を追加する

- [ ] P3 reader fixture seed に cross-account/folder/tag article coverage を増やす
  - 対象: `tests/helpers/reader-fixtures.ts`, `tests/helpers/fixtures.test.ts`
  - default sample articles が特定 feed に寄ると、shared mock 利用 test で foldered feed、second account、tag projection の抜けが起きやすい
  - foldered feed article、second account article、tagged article per tag、read/unread/starred distribution、default mock parity の test を追加する

- [ ] P3 `renderStory` coverage owner を一本化する
  - 対象: `tests/helpers/render-story.test.tsx`, `tests/helpers/fixtures.test.ts`, `tests/helpers/render-story.tsx`
  - helper 専用 test と fixtures test に契約が分散しており、helper 変更時に片方だけ更新されると意図が読み取りにくくなる
  - renderStory behavior 専用 suite 集約、fixtures test scope 分離、duplicate test inventory、export/import smoke を追加する

- [ ] P3 async flush helpers の fake timer / missing RAF policy を固定する
  - 対象: `tests/helpers/async-flush.ts`, `src/__tests__/hooks`
  - `flushMacrotask` は real timer、`flushRaf` は rAF 前提のため、fake timer 使用中や rAF 未定義環境で hang/throw しやすい
  - fake timers with `advanceTimersByTimeAsync`、RAF missing、RAF mocked sync/async、helper timeout diagnostics、Vitest cleanup の test を追加する

- [ ] P3 `createHookDataResult` の partial query result shape を明示する
  - 対象: `tests/helpers/typed-test-factories.ts`, `src/__tests__/hooks`
  - `{ data } as TResult` だけを返す helper は、hook が `isFetched`/`isPending`/`isError` を見るようになった時に runtime shape とずれたまま通り得る
  - data-only helper allowed use、query status required helper、isFetched dependent hook、loading/error variants、type-level helper split の test を追加する

- [ ] P2 preferences load と `setPref` optimistic update の race を latest-only にする
  - 対象: `src/stores/preferences-store.ts`, `src/schemas/preferences.ts`, `src/__tests__/stores`
  - `loadPreferences()` の取得中に user が設定を変更すると、遅れて返った backend prefs が optimistic state を上書きする可能性がある
  - load pending中setPref、same key update、different key update、backend stale response、persist failure、theme/language side effect の test を追加する

- [ ] P2 preferences load failure 後の fallback state と persisted mirror の整合を固定する
  - 対象: `src/stores/preferences-store.ts`, `src/constants/storage.ts`, `src/schemas/preferences.ts`
  - load failure 時に fallback side effect は適用するが `prefs` は空のまま loaded になり、UI 表示・theme mirror・次回 setPref の起点が揺れやすい
  - getPreferences reject、mirrored theme present、empty prefs loaded、first setPref after failure、reload recovery の test を追加する

- [ ] P2 language preference apply を request generation で latest-only にする
  - 対象: `src/stores/preferences-store.ts`, `src/lib/ui/ui-language.ts`, `src/lib/i18n.ts`
  - `i18n.changeLanguage()` は async なので、language を連続変更した時に古い promise の reject/log が最新操作の failure に見えやすい
  - ja->en rapid change、system->ja rapid change、old promise reject、navigator language change、latest-only diagnostics の test を追加する

- [ ] P2 shortcut reset-all と locked `open_settings` の bypassed custom value policy を決める
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/schemas/preferences.ts`
  - UI では `open_settings` が locked でも backend/import/dev tools 経由で custom 値が入ると、reset-all が locked action を戻すべきかが曖昧
  - bypassed custom open_settings、reset all、single reset disabled、conflict detection、legacy Cmd/Ctrl comma parity の test を追加する

- [ ] P2 shortcut conflict message の locale/platform 変更時 refresh を固定する
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/components/settings/hooks/use-shortcuts-settings-view-props.ts`
  - conflict message は保存時点の translated label / platform display を文字列で保持するため、言語や platform kind が変わると stale 表示になり得る
  - conflict then language change、platform kind change、recording restart、reset shortcut、message recompute policy の test を追加する

- [ ] P2 feed favicon external endpoint privacy policy を設定/ドキュメントと同期する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/lib/feed/feed.ts`, `DESIGN.md`
  - Google favicon endpoint に feed/site host を送るため、privacy-sensitive mode や offline/use-proxy 方針が未定だとユーザーの購読先が外部へ漏れ得る
  - favicon enabled/disabled policy、private host、localhost、grayscale option、offline fallback、docs/settings copy の task に分割する

- [ ] P2 feed favicon failed src cache を host/siteUrl change で reset する
  - 対象: `src/components/shared/feed-favicon.tsx`, `src/__tests__/components/feed-favicon.test.tsx`
  - `failedFaviconSrc` は component state なので、同じ row が別 feed に再利用された時の failure cache reset 契約が必要
  - same component new feed、same host same src、different host、size change requestSize、error then success の test を追加する

- [ ] P2 `DevRuntimeOptionsSchema` の strictness / future option policy を決める
  - 対象: `src/api/schemas/platform-info.ts`, `src-tauri/src/commands/platform_commands.rs`
  - dev runtime options だけ余剰 key を許すと、Rust 側 dev-only option 追加や typo が silently accepted になり drift を検知しづらい
  - extra key rejection/allow policy、missing required key、null dimension、invalid dimension、future option drift の test を追加する

- [ ] P2 browser webview bounds schema に上限と coordinate policy を追加する
  - 対象: `src/api/schemas/commands.ts`, `src/lib/browser/browser-webview.ts`, `src-tauri/src/commands/browser_webview_commands.rs`
  - bounds が正数中心で上限がなく、極端な `width/height/x/y` が native webview geometry に流れ得る
  - huge bounds、negative x/y policy、zero size、NaN/Infinity、logical/physical unit omission の test を追加する

- [ ] P2 updater event payload `.passthrough()` の drift detection policy を決める
  - 対象: `src/api/schemas/update-info.ts`, `src/hooks/use-updater.ts`, `src-tauri/src/commands/updater_commands.rs`
  - updater event payload が余剰 key を許すため、Tauri event payload drift が UI 側で検知されず旧/新 fields が混在しやすい
  - extra key policy、percent < 0 / > 100、missing session_id、ready/progress payload parity の test を追加する

- [ ] P2 `SyncResultSchema` の total/succeeded/failed 整合を検証する
  - 対象: `src/api/schemas/sync-result.ts`, `src/lib/sync/sync-result-feedback.ts`, `src-tauri/src/commands/sync_commands.rs`
  - `synced: true` かつ failure あり、`succeeded > total` などの矛盾 DTO を UI が成功扱いする余地がある
  - succeeded > total、failed nonempty with synced true、total mismatch、warning retry fields consistency の test を追加する

- [ ] P2 `safeInvoke` unknown runtime error の UserVisible 化を分類する
  - 対象: `src/api/tauri-commands.ts`, `src/lib/runtime/diagnostics.ts`, `src/lib/ui-errors.ts`
  - Tauri unavailable、plugin missing、unknown thrown object がすべて UserVisible message になると diagnostics-only と操作失敗の切り分けが弱い
  - non-Error object、empty string、plugin missing、runtime unavailable mapping、redaction applied once の test を追加する

- [ ] P2 Storybook QueryClient provider の unmount cache cleanup を固定する
  - 対象: `src/components/storybook/story-query-client-provider.tsx`, `src/__tests__/components/story-query-client-provider.test.tsx`
  - Storybook 用 QueryClient が unmount 時に `clear()` されないと、Canvas remount や decorator nesting で cache/timer が残り得る
  - provider unmount clears query cache、mutation cache cleanup、two story renders isolated、retry disabled remains の test を追加する

- [ ] P2 `renderStory` の nested parameters merge を Storybook と揃える
  - 対象: `tests/helpers/render-story.tsx`, `tests/helpers/render-story.test.tsx`
  - args/parameters/globals の shallow merge が Storybook の nested parameters merge とずれ、a11y/viewport/layout test が実 Storybook と違う結果になり得る
  - nested `parameters.viewport` merge、decorator update preserving nested keys、story override vs meta defaults の test を追加する

- [ ] P2 dev mock mute keyword filter を backend body extraction と揃える
  - 対象: `src/dev/mocks.ts`, `src-tauri/src/infra/db/sqlite_mute_keyword.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - dev mock が sanitized HTML 文字列をそのまま lower-case includes すると、backend の本文抽出/summary fallback とずれて browser preview だけ通る
  - HTML tag text、entity encoded text、summary fallback、title/body/title_and_body parity の test を追加する

- [ ] P2 dev scenario module validation を metadata shape まで広げる
  - 対象: `src/dev/scenario-runtime.ts`, `src/dev/scenarios/types.ts`, `src/dev/scenarios/registry.ts`
  - dev scenario module validation が function 有無中心だと、壊れた scenario metadata が command palette へ流れやすい
  - invalid scenario id、blank title、non-array keywords、throwing list、partial module の test を追加する

- [ ] P2 subscriptions workspace 中の article/feed navigation が背後の reader state を更新する方針を決める
  - 対象: `src/stores/ui-store.ts`, `src/components/app-layout.tsx`, `src/lib/actions.ts`
  - workspace open 中も store action は reader selection/content を更新でき、close 後に意図しない記事へ飛ぶ可能性がある
  - subscriptions open 中 navigate article/feed、command event、workspace close restore policy、native menu action の test を追加する

- [ ] P2 sidebar starred count map を adopted account snapshot と同期する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sources.ts`, `src/components/reader/hooks/sidebar/use-sidebar-feed-tree.ts`
  - feeds/folders/counts は snapshot adoption される一方、`starredCountByFeedId` が raw starred articles 由来だと account switch/refetch 中に別 account count が載り得る
  - account switch中 stale starredArticles、adopted feed snapshot、starred smart view tree、count loading の test を追加する

- [ ] P2 sidebar selected account label と adopted feed tree の世代ずれを固定する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-sources.ts`, `src/components/reader/sidebar-header-view.tsx`
  - selected account name は raw accounts、feed tree は adopted snapshot のため、accounts refetch 遅延で header と tree が別世代表示になり得る
  - accounts stale + feeds adopted、account rename during switch、selected account missing、fallback label の test を追加する

- [ ] P2 hidden pane focus manager の unmount restore contract を追加する
  - 対象: `src/components/app-layout.tsx`, `src/hooks/use-layout.ts`
  - hidden 時に tabindex を書き換えた subtree が subscriptions layout などで unmount される経路の focusability restore が薄い
  - mobile hidden pane -> subscriptions open/close、lazy child追加、tabindex restore、unmount cleanup の test を追加する

- [ ] P2 account pane focus request に generation/cleanup を追加する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-controller.ts`
  - `requestAnimationFrame`/`setTimeout` が account list/layout/account count 変更後も残ると、別 pane へ遅れて focus し得る
  - focus account list then layout switch、account deleted before timeout、unmount cleanup、RAF unavailable の test を追加する

- [ ] P2 sidebar visibility fallback が feed tree loading 中に `selectAll` へ倒れる契約を見直す
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-feed-section-controller.ts`, `src/components/reader/hooks/sidebar/use-sidebar-visibility-fallback.ts`
  - `firstFeedId` が loading 中 `null` だと hidden smart/tag fallback が feed ではなく all を選び、load 完了後も戻らない可能性がある
  - hide tags/starred while feeds loading、first feed appears later、no feeds account、fallback reason の test を追加する

- [ ] P2 article search loading state が stale search results を現行 query と扱わないようにする
  - 対象: `src/components/reader/hooks/article-list/use-article-list-view-state.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`
  - `searchResults !== undefined` なら `isSearching` でも loading にならず、query change 直後に旧結果を現行 query の結果として表示し得る
  - query A result後 query B fetching、account switch中 search、empty result transition、selected cleanup の test を追加する

- [ ] P2 search mode の primary loading と source/search fetching の責務を分ける
  - 対象: `src/components/reader/hooks/article-list/use-article-list-data.ts`, `src/components/reader/hooks/article-list/use-article-list-effects.ts`
  - search 表示中に source data と search data のどちらが現行か不明な瞬間があり、空状態や selected cleanup が早く走る可能性がある
  - source refetch + search fetching、selected article in old search result、query clear during refetch、empty state delay の test を追加する

- [ ] P3 stale remote folder retention を subscription sync の期待値として固定する
  - 対象: `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_folder.rs`
  - remote folders は upsert 中心なので、provider から消えた folder が残る場合の feed assignment / UI 表示方針が曖昧
  - remote folder deleted、folder API temporarily empty、feed still references old folder、manual local folder、warning vs cleanup policy の test を追加する

- [ ] P3 `listArticles` / `listAccountArticles` overloaded positional args を object params へ寄せる候補を作る
  - 対象: `src/api/tauri-commands.ts`, `src/hooks`, `src/components/reader/hooks/article-list`
  - overloaded positional args は `listArticles(feedId, 20, 50)` と `listArticles(feedId, true, 20, 50)` の読み間違いを誘発しやすい
  - all overload shapes、boolean+offset/limit、numeric first arg、invalid negative offset、object-param migration plan の test を追加する

- [ ] P3 storybook story export registry の object helper export 誤検出を防ぐ
  - 対象: `tests/helpers/storybook-story-export-registry.ts`, `src/__tests__/components/storybook-story-export-registry.test.ts`
  - named story 判定が object export に広すぎると、metadata/helper object を story 扱いして Storybook 実行との差分が出る
  - object helper export rejected、story object must have render/args/name/tags policy、allowlist object helper の test を追加する

- [ ] P3 dev web preview geometry fixture と HTML artifact の contract を強める
  - 対象: `src/dev/web-preview-geometry.ts`, `dev-web-preview-geometry.html`, `src/__tests__/dev`
  - geometry fixture の path / rail CSS variable / colors が fixture 内だけにあり、実 HTML との contract が文字列 contains 以上に薄い
  - generated HTML path link parity、CSS variables applied once、rail labels present、nested origin URL resolution の test を追加する

- [ ] P3 Sidebar feed/tags section open state の remount persistence policy を決める
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-runtime.ts`, `src/components/app-layout.tsx`
  - section collapse state が hook-local のため、subscriptions workspace や layout remount でユーザーの閉じた状態が戻る
  - collapse feeds/tags -> workspace open/close、wide/mobile switch、sidebar unmount/remount、storage owner の test を追加する

- [ ] P1 Tauri capability generated schema と default capability の drift を release gate にする
  - 対象: `src-tauri/capabilities/default.json`, `src-tauri/gen/schemas/*-schema.json`, `src/__tests__/config/repo-contracts.test.ts`
  - capability を編集しても generated schema / permission description が更新されないと、release build まで権限差分を見落としやすい
  - capability permission追加、schema stale、platform-specific schema差分、release config include、CI failure message の contract を追加する

- [ ] P1 updater signing secret missing 時の artifact publish stop 条件を固定する
  - 対象: `.github/workflows/release.yml`, `src-tauri/tauri.release.conf.json`, `tests/release-repo-contract.test.ts`
  - signing secret が無い状態で build artifact や draft release が部分作成されると、install できない release が公開手前に残りやすい
  - missing private key、missing password、matrix partial failure、draft release cleanup、preflight failure message の workflow contract を追加する

- [ ] P1 labeler / PR insights workflow の write permission を fork PR policy で見直す
  - 対象: `.github/workflows/labeler.yml`, `.github/workflows/pr-insights-labeler.yml`, `.github/labeler.yml`
  - PR 由来 workflow に write 権限があるため、fork PR や bot PR の実行条件を固定しないと運用・security review のたびに判断が揺れる
  - fork PR、dependabot PR、same-repo PR、permissions minimum、label write failure の repo contract を追加する

- [ ] P1 issue template の release-readiness label 運用と GitHub labeler を同期する
  - 対象: `.github/ISSUE_TEMPLATE/*.yml`, `.github/labeler.yml`, `.github/workflows/labeler.yml`
  - template では release-readiness を案内するが labeler/source-of-truth と連動していないと、起票時点の分類が保守者依存になる
  - feature/bug/test/maintenance template、label existence、labeler glob、manual label note、missing label failure の contract を追加する

- [ ] P2 GitHub Actions cache key に Node/pnpm/mise version drift を含める
  - 対象: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `mise.toml`, `package.json`
  - cache key が lockfile 中心だと Node 24 固定や pnpm version 変更後に古い store が残り、engine warning や install failure の切り分けが遅れる
  - node version change、pnpm version change、mise tool change、lockfile unchanged、cache restore key の repo contract を追加する

- [ ] P2 `pnpm-lock.yaml` の transitive duplicate major を supply-chain TODO として棚卸しする
  - 対象: `pnpm-lock.yaml`, `package.json`, `scripts/quality-baseline.ts`
  - `lru-cache` や `signal-exit` など複数 major が残ると、依存更新時の CVE triage と bundle size 判断が属人化しやすい
  - duplicate major inventory、direct/transitive分類、known acceptable allowlist、lockfile drift report の script task を追加する

- [ ] P2 package manager / engine contract を CI image と local mise の両方で検証する
  - 対象: `package.json`, `mise.toml`, `.github/workflows/ci.yml`, `src/__tests__/config/repo-contracts.test.ts`
  - local Node 24 と CI setup がずれると engine warning は出ても lint/test が通り、後続 agent が別 Node で作業しやすい
  - node major mismatch、pnpm mismatch、mise missing、CI setup-node version、engine-strict policy の contract を追加する

- [ ] P2 release workflow matrix artifact naming を platform/arch/signature で固定する
  - 対象: `.github/workflows/release.yml`, `src-tauri/tauri.release.conf.json`, `tests/release-repo-contract.test.ts`
  - macOS/Windows/Linux artifact 名が action default に寄ると、install verification や updater manifest 対応で対象 artifact を取り違えやすい
  - mac arm64/x64、Windows installer、signature sidecar、draft asset name、manual verification checklist の contract を追加する

- [ ] P2 release note generation が prerelease / build metadata を本文に反映する contract を作る
  - 対象: `.codex/skills/release/SKILL.md`, `.github/workflows/release.yml`, `CHANGELOG.md`
  - prerelease tag を許可する一方で release note の注意書きや draft/prerelease flag が固定されていないと、公開種別を読み違えやすい
  - stable、alpha/beta/rc、build metadata、draft copy、CHANGELOG section の release task を追加する

- [ ] P2 Tauri app identifier と dev/prod data directory の collision を repo contract にする
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/tauri.dev.conf.json`, `src-tauri/tauri.release.conf.json`, `scripts/seed-dev-db-from-prod.ts`
  - dev/prod identifier が近く、seed script や keyring service 名が依存するため、config drift がデータ破壊につながりやすい
  - dev identifier、release identifier、app name、keyring service、data dir resolver の test を追加する

- [ ] P2 Android/iOS icon assets の stale generated set を release smoke で検出する
  - 対象: `src-tauri/icons`, `src-tauri/tauri.conf.json`, `tests/release-repo-contract.test.ts`
  - desktop app でも mobile icon set が repo にあり、source icon 更新時に一部解像度だけ古いまま残ると package metadata が不整合になる
  - required icon list、missing density、stale timestamp/hash policy、unused icon cleanup、tauri icon command note の contract を追加する

- [ ] P2 CSS token と Storybook reference specimen の required token coverage を固定する
  - 対象: `src/styles/global.css`, `src/components/storybook`, `src/__tests__/components/ui-reference-specimen-registry.test.ts`
  - token 追加時に reference canvas へ specimen がないと、UI review で semantic token の実見た目を確認できない
  - new semantic token、removed token、state token、surface token、reference specimen mapping の test を追加する

- [ ] P2 Base UI wrapper の `data-slot` contract を primitive ごとに固定する
  - 対象: `src/components/ui`, `src/__tests__/components/ui-reference-settings-canvas.test.tsx`
  - UI reference tests が一部 slot を見るだけだと、wrapper refactor 時に `data-slot` が消えて design/debug tooling が壊れやすい
  - button/select/dialog/tooltip/scroll-area/skeleton slot、asChild、disabled/loading state の component contract を追加する

- [ ] P2 `DESIGN.md` / `.claude/rules` の UI rule と actual tokens の drift を検出する
  - 対象: `DESIGN.md`, `.claude/rules`, `src/styles/global.css`, `src/__tests__/config/repo-contracts.test.ts`
  - rules に残った古い radius/spacing/color 方針が実 CSS と違うと、別 agent が古い rule に従って UI を戻しやすい
  - radius scale、semantic color names、motion constants、forbidden palette notes、docs link の contract を追加する

- [ ] P2 `AGENTS.md` thin-router contract と CLAUDE.md rule links の drift を gate にする
  - 対象: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/README.md`, `src/__tests__/config/repo-contracts.test.ts`
  - agent guidance の入口が複数あるため、AGENTS.md が厚くなるか CLAUDE.md link が壊れると別 agent の作業基準が割れる
  - read order、thin router phrase、rules index link、missing linked rule、duplicate policy の repo contract を追加する

- [ ] P2 Markdown lint exclude glob と generated docs / target docs の追加漏れを検出する
  - 対象: `mise.toml`, `src/__tests__/config/repo-contracts.test.ts`, `src-tauri/target/doc`
  - target docs や generated markdown が増えた時に lint 対象へ混ざると、TODO追記や docs変更の検証が unrelated failure になりやすい
  - target doc exclude、generated docs exclude、new worktree exclude、markdownlint args、Windows run parity の contract を追加する

- [ ] P2 `parseJsonWithSchemaOrNull` 呼び出し元の silent fallback owner を棚卸しする
  - 対象: `src/schemas/parse.ts`, `src/schemas/storage.ts`, `src/stores/preferences-store.ts`
  - malformed JSON を null に潰す helper は便利だが、fallback owner が明確でないと data corruption を silent cleanup してしまう
  - storage cleanup owner、preference load owner、command history owner、diagnostics owner、throwing boundary との使い分け task を追加する

- [ ] P2 schema `.strict()` / `.passthrough()` の選択理由を schema ごとに repo contract 化する
  - 対象: `src/api/schemas`, `src/schemas`, `src/__tests__/api/schemas.test.ts`
  - DTO schema が strict と passthrough で混在しており、backend trusted / frontend guard の境界が schema 追加時に揺れやすい
  - command response strict、event payload passthrough、dev options strict、storage cleanup、unknown enum の schema policy test を追加する

- [ ] P2 `AppErrorSchema` の message length と newline/control char policy を backend と同期する
  - 対象: `src/api/schemas/error.ts`, `src-tauri/src/commands/dto.rs`, `src/lib/ui-errors.ts`
  - backend AppError message がそのまま toast/diagnostics に流れるため、長文・改行・control char の扱いを揃えないと UI 崩れや log injection になり得る
  - huge message、multiline、control char、URL token、user-visible vs diagnostics の Rust/TS contract を追加する

- [ ] P2 `CountResponseSchema` の safe integer / max cap を Rust count DTO と同期する
  - 対象: `src/api/schemas`, `src-tauri/src/commands/dto.rs`, `src/hooks/use-badge.ts`
  - count response を TS number で受けるため、Rust 側 usize/i64 の巨大値が safe integer を超える場合の UI 表示が未契約
  - max safe integer、negative impossible、overflow fixture、badge cap、toast copy の schema test を追加する

- [ ] P2 API schema barrel export の dead schema / missing schema を knip 以外で検出する
  - 対象: `src/api/schemas/index.ts`, `src/api/tauri-commands.ts`, `src/__tests__/api/schemas.test.ts`
  - schema 追加時に barrel export や command usage へ接続されないと、knip baseline 更新まで死蔵 schema に気づきにくい
  - exported unused schema、used unexported schema、command response without schema、deprecated schema allowlist の repo contract を追加する

- [ ] P3 `.github/release.yml` と release workflow の responsibilities を整理する
  - 対象: `.github/release.yml`, `.github/workflows/release.yml`, `.codex/skills/release/SKILL.md`
  - GitHub release drafter config と actual release workflow の責務が近く、どちらが notes/categories/assets を持つかが曖昧になりやすい
  - release notes owner、category labels、manual draft flow、unused config detection の docs/contract task を追加する

- [ ] P3 issue template body の required checkbox と PR template quality gate を同期する
  - 対象: `.github/ISSUE_TEMPLATE/*.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `AGENTS.md`
  - issue 側の verification items と PR template/DoD がずれると、task 起票時と完了時の期待値が違うものになる
  - typecheck/lint/test/format labels、manual verification、release impact、Storybook impact の repo contract を追加する

- [ ] P3 generated Tauri schema files を source edit しないルールを repo contract にする
  - 対象: `src-tauri/gen/schemas`, `CLAUDE.md`, `src/__tests__/config/repo-contracts.test.ts`
  - generated schema を人手で編集すると次回 generate で消えるが、agent が巨大 JSON を修正対象にしやすい
  - generated file banner、write-scope rule、schema regeneration command、diff review warning の docs/contract task を追加する

- [ ] P3 UI reference canvas の日本語/英語 dual-locale smoke を最小化して追加する
  - 対象: `src/components/storybook`, `src/__tests__/components/ui-reference-settings-canvas.test.tsx`
  - 現状の reference canvas は日本語長文や英語短文の片方に寄りがちで、locale 切替時の overflow を事前に見つけにくい
  - Japanese long labels、English labels、button min width、toolbar overflow、settings row height の focused smoke を追加する

- [ ] P3 `MemoryStorage` test shim と browser Storage spec の差分を明文化する
  - 対象: `tests/setup.ts`, `src/__tests__/helpers/test-setup-storage.test.ts`
  - test shim が browser Storage と完全一致しない場合、quota/security error や key ordering の test が false green になりやすい
  - property access、key ordering、quota unsupported、SecurityError fallback、clear/remove semantics の helper contract を追加する

- [ ] P3 `resolveLayout` の `contentMode` 未使用を compact empty pane contract として整理する
  - 対象: `src/hooks/use-layout.ts`, `src/stores/ui-store.ts`
  - `focusedPane === "content"` なら `contentMode: empty` でも content pane を維持するため、compact/mobile の空画面遷移が意図か事故か曖昧
  - compact focused content + contentMode empty/browser/reader、clearArticle、closeBrowser parity の test を追加する

- [ ] P3 account switcher focus restore の RAF unavailable fallback を追加する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-account-switcher.ts`
  - focus restore が `requestAnimationFrame` を直接呼ぶため、test/jsdom polyfill 欠落や unusual WebView で落ちる可能性がある
  - requestAnimationFrame missing、close with restoreFocus、unmount before frame、fallback sync focus の test を追加する

- [ ] P2 mailto subject/body truncation を grapheme-safe にする
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/__tests__/components/article-share-menu.test.tsx`
  - `slice(0, maxLength)` は surrogate pair や combining mark を分割し、メールクライアントに壊れた subject/body を渡し得る
  - emoji title、combining mark title、CJK long body、URL truncation、encoded mailto length の test を追加する

- [ ] P2 mailto open failure を share/copy runtime error taxonomy に寄せる
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/api/tauri-commands.ts`, `src/lib/ui-errors.ts`
  - mailto は `openExternalUrl` の error.message をそのまま toast するため、copy/open/reading-list と同じ runtime unavailable や invalid URL の分類がずれやすい
  - opener unavailable、invalid mailto、permission denied、runtime unavailable、redacted URL toast の test を追加する

- [ ] P2 old unread confirm 後の target deletion / scope drift を latest count と mutationで固定する
  - 対象: `src/components/reader/hooks/feed-actions/use-old-unread-read-action.ts`, `src-tauri/src/commands/article_commands.rs`
  - confirm 表示後に feed/folder/tag/account が削除または切替されると、再 count はしても mutation の target owner と UI feedback が曖昧
  - target deleted before confirm、scope changed、account switch、latest count not found、mutation error toast の test を追加する

- [ ] P2 old unread context menu presets を backend allowed range と同期する
  - 対象: `src/components/reader/old-unread-context-menu-items.tsx`, `src/api/schemas/commands.ts`, `src-tauri/src/commands/article_commands.rs`
  - UI preset は 7/30/90 固定だが backend days range と別定義なので、将来 preset 追加時に schema/Rust validation とずれやすい
  - preset inventory、0/negative days rejection、max days、localized label、schema/Rust parity の test を追加する

- [ ] P2 native menu async action failure を action boundary の toast/diagnostics に揃える
  - 対象: `src/lib/actions.ts`, `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`
  - menu 起点の fullscreen/browser navigation/update/sync が console.error 中心だと、ユーザー操作として失敗したのに feedback が出ない path が残る
  - fullscreen failure、browser back failure、update check failure、sync failure、toast vs diagnostics-only policy の test を追加する

- [ ] P2 browser close buffered action を consecutive action queue として固定する
  - 対象: `src/lib/actions.ts`, `src/stores/ui-store.ts`, `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - `pendingBrowserCloseAction` は単一 slot なので、close animation 中に next/prev/feed action が連打されると最後だけ残る設計が意図か曖昧
  - rapid next/prev、feed then article、Escape close、flush once、drop vs last-wins policy の test を追加する

- [ ] P2 OPML parser の root namespace / case sensitivity policy を固定する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - parser は raw element name `opml` / `outline` を見るため、namespace 付き OPML や case variant を拒否/許可する方針が fixture 化されていない
  - namespaced opml、uppercase OPML、outline namespace、body-less opml、root before XML decl noise の test を追加する

- [ ] P2 OPML parser の deep nesting / stack growth limit を決める
  - 対象: `src-tauri/src/infra/opml.rs`
  - outline stack は無制限に伸びるため、巨大/悪意ある OPML で memory/CPU を使い、import UI が固まる可能性がある
  - 100/1000 nested folders、max depth rejection、error copy、partial feed discard、streaming parser memory の test を追加する

- [ ] P2 OPML attribute decoding の invalid key/value lossy policy を固定する
  - 対象: `src-tauri/src/infra/opml.rs`
  - attribute key は lossy UTF-8、value は unescape error で fail するため、壊れた OPML の skip/fail boundary が分かりにくい
  - invalid UTF-8 attr key、invalid value entity、duplicate invalid attr、lossy key ignored、malformed XML error の test を追加する

- [ ] P2 OPML generator の replacement character policy を import round-trip と同期する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - XML 1.0 invalid char を U+FFFD に置換するため、export -> import で title/url が変わることを user-visible summary と test に残す必要がある
  - invalid title char、invalid folder char、invalid URL char、round-trip title changed、export warning/summary policy の test を追加する

- [ ] P2 workflow pin checker の quoted `uses:` / inline comment parsing を固定する
  - 対象: `scripts/check-workflow-pins.mjs`, `.github/workflows`, `tests/release-repo-contract.test.ts`
  - regex が unquoted `uses:` 中心なので、quoted value や inline comment 付き action ref を見逃す可能性がある
  - single quoted uses、double quoted uses、inline comment、reusable workflow、local action exception の test を追加する

- [ ] P2 workflow pin checker が composite/local actions と reusable workflow を誤検出しないようにする
  - 対象: `scripts/check-workflow-pins.mjs`, `.github/workflows`
  - すべての `uses:` に 40-char SHA を要求すると、`./.github/actions/*` や org 内 reusable workflow の扱いが未定で false positive / bypass が起きやすい
  - local composite action、relative path、owner/repo workflow、docker action、SHA-pinned external action の test を追加する

- [ ] P2 CI quality-gate が skipped/cancelled matrix job を failure とする理由を step summary に出す
  - 対象: `.github/workflows/ci.yml`, `tests/release-repo-contract.test.ts`
  - matrix job が skipped/cancelled/timed_out の時に summary が粗いと、どの OS/phase の failure か triage が遅れやすい
  - skipped job、cancelled job、timed_out job、matrix OS label、summary markdown の workflow contract を追加する

- [ ] P2 CI native-smoke の debug build artifact/log retention を failure 時だけ収集する
  - 対象: `.github/workflows/ci.yml`, `docs/incident-runbook.md`
  - native smoke が macOS/Windows で落ちた時に debug app/log artifact が残らないと、再現が CI runner 依存になりやすい
  - failure-only upload、log redaction、artifact retention days、macOS/windows path、no artifact on success の contract を追加する

- [ ] P2 release workflow manual dispatch tag existence / annotated tag object を明示検証する
  - 対象: `.github/workflows/release.yml`, `.codex/skills/release/SKILL.md`, `tests/release-repo-contract.test.ts`
  - manual dispatch は tag fetch 後に dereference するが、annotated tag object metadata や missing tag の error copy が明確でない
  - missing tag、annotated tag、lightweight tag、tag object mismatch、error message の workflow fixture を追加する

- [ ] P2 release workflow signing secret missing 時の failure copy / dry-run path を整理する
  - 対象: `.github/workflows/release.yml`, `docs/release-manual-verification.md`
  - signing secrets がない fork/maintainer run で tauri-action まで進むと、失敗理由が signing なのか build なのか分かりにくい
  - missing private key、missing password、fork event、dry-run preflight、masked error copy の workflow contract を追加する

- [ ] P2 Base UI menu item async onClick の rejection handling を shared menu policy にする
  - 対象: `src/components/reader/article-share-menu.tsx`, `src/components/reader/*context-menu*.tsx`, `src/lib/runtime/diagnostics.ts`
  - async `onClick` が component ごとに try/catch されるため、Base UI 側で rejection が握り潰される path の user feedback が揺れやすい
  - copy rejection、reading list rejection、mailto rejection、context menu mutation rejection、diagnostics once の test を追加する

- [ ] P3 context menu `data-action-id` naming と analytics/debug trace を repo contract にする
  - 対象: `src/components/reader/*context-menu*.tsx`, `src/lib/debug/debug-input-trace.ts`
  - `data-action-id` が kebab/suffix/manual string に分散しており、debug HUD や tests で action を追う時に rename 漏れが出やすい
  - action id inventory、submenu day suffix、delete/rename ids、debug trace label、test selector stability の contract を追加する

- [ ] P3 OPML parser/generator corpus を checked-in fixture directory に分離する
  - 対象: `src-tauri/src/infra/opml.rs`, `tests/fixtures`, `docs/feed-content-privacy.md`
  - OPML variants が Rust unit 内 string に散ると、実 reader 由来の fixture 追加や privacy review がやりにくい
  - fixture directory、redacted real OPML、round-trip fixtures、invalid fixture naming、privacy checklist の task に分割する

- [ ] P2 article reader scroll position retention policy を決める
  - 対象: `src/components/reader/hooks/article`, `src/stores/ui-store.ts`
  - article 切替、feed 切替、browser overlay close、account switch で scroll を残すか戻すかが曖昧だと閲覧復帰が不安定になる
  - same article revisit、新規 article reset、browser close return、account switch、reduced motion の期待値を固定する

- [ ] P2 toast / live-region announcement queue を設計する
  - 対象: `src/components/app-shell.tsx`, `src/stores/ui-store.ts`
  - persistent toast、error toast、auto-dismiss toast が短時間で置換されると screen reader へ重要メッセージが届かない
  - rapid toasts、persistent toast then auto toast、close action、aria-live text、duplicate suppression を固定する

- [ ] P2 native titlebar drag region と interactive controls の overlap を検証する
  - 対象: `src/components/app-shell.tsx`, `src/components/reader/browser-overlay-chrome.tsx`, global CSS
  - compact layout や browser overlay 中に drag strip が toolbar/settings/browser controls を覆うとクリック不能になる
  - settings open、browser overlay、compact account pane、top toolbar controls、pointer-events の実機確認を追加する

- [ ] P2 app update restart prompt と dirty form / pending mutation の衝突を防ぐ
  - 対象: `src/hooks/use-updater.ts`, `src/components/settings`, `src/components/add-feed`
  - update restart が add feed、credential edit、settings setup sync の途中で走ると入力や mutation 結果を失う
  - add feed pending、credential draft dirty、settings setup sync、restart confirm、cancel flow の期待値を固定する

- [ ] P2 private data reset order を credentials / DB / localStorage / query cache で固定する
  - 対象: settings data reset flow、credential commands、query client
  - reset が途中失敗すると keyring、DB、localStorage、query cache のどれかだけ残り、次回起動で ghost state になる
  - keyring delete failure、DB cleanup failure、storage cleanup、query cache clear、app reload の contract を追加する

- [ ] P2 query retry default policy を command side effect と read query で分ける
  - 対象: `src/lib/query/query-client.ts`, `src/hooks/create-query.ts`, `src/api/tauri-commands.ts`
  - validation/auth/permission error まで retry すると toast 重複や副作用の再実行につながる
  - validation error no retry、network retry、auth no retry、permission no retry、diagnostics labeling を固定する

- [ ] P2 app boot root missing error を fallback UI と telemetry-free log に寄せる
  - 対象: `src/main.tsx`, `index.html`
  - root element drift 時に console error だけだと production blank screen の原因がユーザーに伝わらない
  - root missing、duplicate root、render throw、safe fallback text、no telemetry side effect の test を追加する

- [ ] P2 Windows WebView2 loader copy warning を release smoke failure に昇格する
  - 対象: `src-tauri/build.rs`, release workflow
  - loader missing/copy failure が cargo warning のままだと Windows release だけ起動不能になる
  - missing source、unsupported arch、copy failure、CI release behavior、artifact contains loader の check を追加する

- [ ] P2 Rust provider test HTTP server の port isolation / shutdown contract を作る
  - 対象: `src-tauri/src/infra/provider/*` tests
  - fixed port や server shutdown 漏れがあると parallel test で flake し、provider boundary の regression を隠す
  - port `0` binding、parallel tests、shutdown、request timeout、panic cleanup の helper 化を行う

- [ ] P2 sanitizer dependency update contract を allowed tags / attrs snapshot で固定する
  - 対象: article sanitizer、`ammonia` dependency 周辺
  - sanitizer dependency 更新で allowed tags/attrs が変わると article 表示・privacy・search text が同時に変わる
  - allowed tags、allowed attrs、blocked protocol、style stripping、search text parity の fixture を追加する

- [ ] P2 GitHub issue templates の YAML schema / required fields contract を追加する
  - 対象: `.github/ISSUE_TEMPLATE`, repo automation
  - issue template の dropdown/options/labels が壊れると triage と TODO 取り込みの品質が落ちる
  - required fields、dropdown options、label mentions、blank template、YAML parse の lightweight check を追加する

- [ ] P2 docs / skills path references の link resolution check を追加する
  - 対象: `CLAUDE.md`, `.claude/rules`, `.codex/skills`, `.agents/skills`
  - agent-facing docs が古い skill path や存在しない rule を参照すると、次の自動実装で誤った手順に流れる
  - local skill path、rule link、relative path、moved file、thin router docs の check を追加する

- [ ] P2 bundled icon / asset provenance と third-party attribution を棚卸しする
  - 対象: `src-tauri/icons`, app assets, release docs
  - generated asset や外部 asset の source/license が不明なままだと release review で止まりやすい
  - source asset record、generated sizes、license note、release artifact contains expected icons の check に分ける

- [ ] P3 Tailwind arbitrary values inventory と token 化候補を整理する
  - 対象: `src/**/*.tsx`, CSS
  - arbitrary width/height/z-index/color が増えると design token と responsive constraints のレビューが効かなくなる
  - layout-critical、motion-critical、z-index、one-off allowed、token candidate に分類する

- [ ] P3 Storybook a11y addon violations を focused allowlist 付き gate にする
  - 対象: `.storybook`, storybook tests
  - addon を入れていても allowlist と focused story がないと、違反検知が noise になって CI gate へ上げられない
  - known violation allowlist、critical components、dialog stories、keyboard stories、CI smoke の単位に分ける

- [ ] P3 React test helpers の `MutationObserver` / `ResizeObserver` cleanup を共通化する
  - 対象: `src/__tests__`, test setup
  - observer mock の cleanup が test ごとに違うと、後続 test の resize/layout 判定が flake する
  - setup helper、afterEach cleanup、observer callback ordering、fake timers、StrictMode double invoke の確認を追加する

- [ ] P1 OS keyring orphan credential cleanup を account delete / rename / reset と同期する
  - 対象: `src-tauri/src/infra/keyring_store.rs`, account commands, settings data reset
  - account 削除や rename 後に古い credential entry が残ると、復元・debug・reset の時に ghost account として再浮上する
  - delete success、delete keyring failure、rename rollback、reset partial failure、orphan inventory の contract を追加する

- [ ] P1 article link opener の `rel` / URL redaction / private host policy を固定する
  - 対象: article content rendering、external opener、URL schemas
  - sanitized HTML 内の link が opener policy を迂回すると、token URL や private host を外部に開く可能性がある
  - `target=_blank`、`rel=noopener noreferrer`、credential URL、private host、malformed href、relative href の fixture を追加する

- [ ] P2 `robots` / provider block response を sync backoff と user action で分ける
  - 対象: local provider sync、`src-tauri/src/service/sync_scheduler.rs`, sync result UI
  - 403/429/451/503 を同じ failure として扱うと、backoff・toast・manual retry の意味がずれる
  - 403 forbidden、429 retry-after、451 unavailable legal、503 temporary、manual retry allowed の期待値を固定する

- [ ] P2 feed item GUID collision policy を account/feed boundary で固定する
  - 対象: article repository、local provider normalizer、sync flow
  - 異なる feed で同じ GUID、空 GUID、URL 変更があると article merge や unread/star が壊れる
  - same GUID different feed、empty GUID fallback、URL-only identity、title-only feed、feed URL changed の contract を追加する

- [ ] P2 article canonical URL と feed entry link の normalization policy を決める
  - 対象: provider normalizer、article schemas、external opener
  - tracking query、fragment、relative link、HTML entity decode の扱いが未固定だと dedupe と opener がずれる
  - query retention、fragment retention、relative link base、HTML entity decode、invalid URL fallback を固定する

- [ ] P2 sync scheduler system sleep / clock jump recovery を contract 化する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, startup/sync-on-wake
  - macOS sleep や手動時刻変更後に next_sync/backoff が過去・未来へ飛ぶと sync が止まるか連打される
  - sleep resume、clock backward、clock forward、backoff expired during sleep、manual sync after resume を固定する

- [ ] P2 app local time / UTC persistence の boundary を DB fields ごとに棚卸しする
  - 対象: domain models、SQLite repositories、date helpers
  - DB persisted date が UTC なのか local string なのか混在すると sort、sync、review stale day が環境依存になる
  - `created_at`、`updated_at`、`published_at`、`last_sync_at`、`next_retry_at` の timezone contract を書く

- [ ] P2 clipboard copy payload の size cap / permission denied / newline policy を固定する
  - 対象: `src/lib/runtime/clipboard.ts`, `copy_to_clipboard` command, share actions
  - 巨大 text、改行混在、権限拒否、runtime unavailable を generic failure にすると復旧と redaction が難しい
  - size cap、CRLF normalization、permission denied、runtime unavailable、redacted diagnostics を追加する

- [ ] P2 filesystem path normalization を log/backup/export/settings で共通化する
  - 対象: log commands、database backup/export commands、Tauri path helpers
  - symlink、non-UTF8 path、reserved name、case-insensitive collision の扱いが command ごとに違うと platform bug になる
  - symlink、non-UTF8、Windows reserved name、case collision、path redaction の matrix を作る

- [ ] P2 atomic file write policy を export / backup / dev credential store で揃える
  - 対象: OPML export、DB backup、dev credential file store
  - 途中失敗で target file を半端に残すと、次回 import/restore/debug で正常ファイルとして扱われる
  - temp file、fsync、rename failure、existing file collision、cleanup failure の contract を追加する

- [ ] P2 Node / pnpm / mise toolchain drift を local gate で検出する
  - 対象: `mise.toml`, `package.json`, CI workflow, setup docs
  - Node 24 前提なのに Node 25 で warning のまま進むと、local green と CI green がずれる
  - Node version、pnpm version、Corepack behavior、CI cache key、developer warning の check を追加する

- [ ] P2 React StrictMode double invoke で native command wrapper が二重実行されないか棚卸しする
  - 対象: hooks that invoke Tauri commands in effects、query/mutation wrappers
  - effect mount 時の command 実行が StrictMode で二重になり、sync/check/update/open が重複する可能性がある
  - startup sync、updater check、platform info、log dir opener、browser webview create の inventory を作る

- [ ] P2 React Query cache persistence しない前提を reload/boot contract として固定する
  - 対象: query client、startup loaders、settings/account state
  - reload 後に query cache が空になる前提が implicit だと、future persistence 導入時に stale account/feed が混ざる
  - reload empty cache、startup refetch、account deleted、offline boot、query key versioning の contract を追加する

- [ ] P2 locale pluralization / count formatting を unread/feed/article count で固定する
  - 対象: `src/locales/*`, reader/sidebar/settings count labels
  - interpolation parity だけでは 0/1/2/large count、日本語/英語の複数形、桁区切りが検出できない
  - zero、one、many、large number、negative fallback、locale switch の copy test を追加する

- [ ] P2 article content image loading policy を privacy / performance として固定する
  - 対象: article renderer、sanitizer、browser/external opener policy
  - remote image を即読みするか、lazy/load block するかが曖昧だと IP leak と巨大画像 performance 問題になる
  - `loading=lazy`、referrer policy、blocked private image URL、broken image、huge dimensions の fixture を追加する

- [ ] P2 mock data に実在ドメインを使う場合の network isolation policy を決める
  - 対象: `src/dev/mock-data.ts`, dev mocks, storybook
  - mock URL が実在ドメインだと、画像・favicon・browser open が accidental network access になる
  - example domain、real domain allowlist、favicon mock、external opener stub、storybook isolation の方針を固定する

- [ ] P2 Tauri permission/capability の generated allowlist を command ownership ごとに分割する
  - 対象: Tauri capabilities、command registry、release contract
  - 1 つの capability snapshot だけだと、reader/browser/settings/debug のどの機能が権限を必要とするか追えない
  - browser、settings、debug/log、database、updater、share command group に分けて drift test を追加する

- [ ] P2 release artifact notarization / quarantine behavior を macOS manual verification に入れる
  - 対象: release workflow、`docs/release-manual-verification.md`
  - dmg を download した後の quarantine、Gatekeeper、notarization 表示を見ないと配布後に初回起動で止まる
  - downloaded dmg、first launch、Gatekeeper dialog、codesign detail、notarization status の check を追加する

- [ ] P3 dependency license inventory を pnpm/Cargo 両方で生成可能にする
  - 対象: `package.json`, `src-tauri/Cargo.toml`, release docs
  - JS/Rust の片方だけ license 棚卸しすると、release review や store 配布で抜ける
  - pnpm licenses、cargo licenses、unknown license、dual license、generated report location の task に分ける

- [ ] P3 markdownlint 対象 file count / ignore pattern drift を repo contract にする
  - 対象: markdownlint config、`TODO.md`, docs, generated dirs
  - generated markdown や temporary docs が lint 対象に混ざると、TODO 追加だけで unrelated lint が落ちる
  - target file count、ignore dirs、generated docs、skill docs、root markdown の check を追加する

- [ ] P3 dev scenario fixture freshness を UI route / command schema と同期する
  - 対象: `src/dev/scenarios`, dev mocks, command schemas
  - scenario は便利だが、command schema や route rename から遅れるとデバッグ時だけ壊れる
  - scenario id registry、command coverage、route existence、mock data owner、screenshot smoke の task に分ける

- [ ] P1 XML entity expansion / external entity policy を feed parser boundary で固定する
  - 対象: `src-tauri/src/infra/provider/local.rs`, feed parser dependency, parser fixtures
  - RSS/Atom/OPML の XML parsing が entity expansion や external entity をどう扱うか未固定だと、巨大展開・外部参照・parse hang の原因になる
  - nested entity、external entity、DOCTYPE、large text node、parser timeout/size cap の fixture を追加する

- [ ] P1 IDNA / punycode / IPv6 zone identifier の private host 判定を URL schema 全体で固定する
  - 対象: URL schema、feed discovery、OPML import、external opener
  - `xn--` host、Unicode host、IPv6 zone id、mixed-case host が command ごとに違うと SSRF guard と opener policy がずれる
  - IDNA host、Unicode host、IPv6 zone id、localhost alias、percent-encoded host、trailing dot の contract を追加する

- [ ] P1 release build で `DEV_CREDENTIALS` / dev mock / debug scenario が有効化されない gate を作る
  - 対象: `scripts/lib/windows-dispatch.ts`, `src/dev`, Tauri release config
  - dev credential や dev scenario が release artifact に到達すると credential handling と privacy boundary が壊れる
  - release env、dev config、debug scenario import、mock runtime install、artifact smoke の check を追加する

- [ ] P2 article/feed/folder/tag/account name の Unicode bidi / confusable display policy を決める
  - 対象: domain validation、settings forms、reader/sidebar display
  - RTL override、zero-width、confusable 文字が入ると feed name や action target が spoof され、delete/rename 確認で誤認しやすい
  - bidi control、zero-width joiner、NFKC confusable、trim display、confirmation label の policy を追加する

- [ ] P2 batch read/star/mute mutations の transaction chunking policy を決める
  - 対象: article commands、repository mutation methods、reader bulk actions
  - 大量記事を一括更新する時に 1 transaction/分割/partial success の方針が曖昧だと UI と DB がずれる
  - large batch、chunk failure、partial rollback、query invalidation、progress feedback の task に分ける

- [ ] P2 migration transactional DDL / partial migration failure recovery を明文化する
  - 対象: `src-tauri/src/infra/db/migration.rs`, migration files
  - SQLite DDL と data migration の途中失敗後に再起動しても安全かが曖昧だと、復旧不能な半端 schema が残る
  - DDL failure、data copy failure、schema_version unchanged、backup rollback、retry migration の fixture を追加する

- [ ] P2 background sync battery / CPU guard を repeated failure と many-account で固定する
  - 対象: `src-tauri/src/service/sync_scheduler.rs`, sync settings, diagnostics
  - 多数 account が失敗し続けると backoff があっても wake/check/log が増えて desktop app の常駐負荷になる
  - many accounts、continuous auth failure、network offline、scheduler sleep、log rate limit の contract を追加する

- [ ] P2 offline/online signal と native network error classification の関係を決める
  - 対象: frontend runtime boundary、sync trigger UI、domain network error
  - `navigator.onLine` と Rust HTTP error が食い違うと、manual sync button や toast が誤った復旧案を出す
  - online false、online true but DNS failure、captive portal、manual retry、sync scheduler の期待値を固定する

- [ ] P2 CSP dev/prod drift を script/style/connect/font で release gate 化する
  - 対象: Tauri config、Vite dev config、release smoke
  - dev HMR 用 CSP と production CSP がずれると、release だけ blank screen または不要に広い permission になる
  - script-src、style-src、connect-src、font-src、dev HMR exception、release artifact CSP の check を追加する

- [ ] P2 article HTML table / code block / pre layout overflow を reader visual contract にする
  - 対象: article content view CSS、sanitized HTML fixtures
  - wide table、long code line、preformatted text が pane 外へ出ると reader/browser overlay/control と重なる
  - wide table、long URL、long code line、mobile width、copy/select behavior の visual fixture を追加する

- [ ] P2 image/fallback favicon cache eviction を account/feed deletion と同期する
  - 対象: favicon/image cache helpers、feed deletion flow、storage cleanup
  - feed 削除後に favicon/image failure cache が残ると、同じ URL 再追加時に古い失敗状態を引き継ぐ
  - feed delete、feed URL change、account delete、cache TTL、manual refresh の contract を追加する

- [ ] P2 locale resource lazy load failure を app boot / settings language switch で固定する
  - 対象: i18n setup、settings language actions、app shell fallback
  - locale JSON load/parse failure 時に raw key 表示、blank UI、old locale 維持のどれにするか未固定だと復旧しにくい
  - missing locale file、invalid JSON、switch failure、old locale retention、diagnostics once の test を追加する

- [ ] P2 platform permission denied を file/dialog/keyring/clipboard ごとに user action copy へ落とす
  - 対象: Tauri command wrappers、runtime error taxonomy、settings/debug UI
  - permission denied を generic error にすると、macOS privacy settings や Windows policy の復旧案が出せない
  - file access denied、dialog denied、keyring denied、clipboard denied、action-specific copy の matrix を作る

- [ ] P2 updater downloaded artifact cleanup を cancel / failed install / app restart で固定する
  - 対象: updater hook、updater commands、release docs
  - download 済み artifact が cancel や failed install 後に残ると、次回 check/install が stale artifact を使う可能性がある
  - cancel、download failure、install failure、restart before install、cleanup diagnostics の contract を追加する

- [ ] P2 Tauri event listener leak を route transition / settings modal / browser overlay で計測する
  - 対象: `src/lib/runtime/tauri-event-listeners.ts`, app shell hooks, browser overlay hooks
  - route/modal/overlay の開閉で listener が積み上がると、sync progress や browser event が重複処理される
  - route transition、settings open/close、browser open/close、account switch、StrictMode の listener count test を追加する

- [ ] P2 command palette action execution を stale selection / closed palette / modal open で固定する
  - 対象: command palette controller/actions、global action dispatcher
  - palette close と action 実行の間に selection や modal state が変わると、意図しない account/feed/action が走る
  - stale selection、palette closed before resolve、modal already open、async action failure、focus restore の contract を追加する

- [ ] P3 dependency update smoke を React Query / Zustand / Tauri / Vite の breaking behavior ごとに分類する
  - 対象: `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.lock`, quality baseline
  - lockfile 更新で runtime behavior が変わる dependency と pure dev dependency を同じ扱いにすると review が粗くなる
  - query caching、store equality、Tauri API、Vite dev server、test runner の smoke task に分ける

- [ ] P3 generated fixture / snapshot size budget を repo contract にする
  - 対象: tests fixtures、storybook snapshots、report outputs
  - fixture や report が肥大化すると lint/check が遅くなり、TODO 追加や small refactor の feedback loop が悪化する
  - max fixture size、snapshot count、report artifact ignore、large corpus directory、review exception の policy を追加する

- [ ] P1 app shutdown 中の background sync / DB write / browser webview cleanup を drain する contract を作る
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/service/sync_scheduler.rs`, browser webview tracker, DB commands
  - window close や restart 中に sync/DB write/webview close が走ると、WAL・query cache・native webview state が中途半端に残る
  - close requested、restart app、sync in-flight、DB write in-flight、browser webview open、timeout forced exit の contract を追加する

- [ ] P1 startup database init panic を recoverable startup error UI へ寄せる
  - 対象: `src-tauri/src/lib.rs`, DB init, startup fallback UI
  - `panic!` で起動失敗するとログを読めないユーザーに復旧手順が届かず、migration/permission/disk full の切り分けができない
  - migration error、permission denied、disk full、backup exists、redacted path、support copy の期待値を固定する

- [ ] P1 release build に debug-only MCP bridge plugin が混入しない repo contract を追加する
  - 対象: `src-tauri/src/lib.rs`, Tauri release config, release smoke
  - debug 専用 plugin が release artifact に入ると、不要な local port や inspection surface を配布してしまう
  - debug build includes bridge、release build excludes bridge、capability diff、open port smoke、artifact symbol/config check を追加する

- [ ] P1 Tauri command blocking DB work を `spawn_blocking` / async boundary で分類する
  - 対象: `src-tauri/src/commands`, repository access, `AppState` DB mutex
  - async command 内で重い SQLite 処理を直接実行すると、runtime worker を詰まらせて sync・updater・webview events が遅延する
  - list/search/export/vacuum/import/repair command の blocking classification と focused benchmark を追加する

- [ ] P2 main window close confirmation と dirty/pending state registry を native close event へ接続する
  - 対象: `src-tauri/src/lib.rs`, app shell dirty-state registry, settings/add-feed flows
  - OS の close button は frontend navigation guard を通らないため、dirty form や pending mutation を落とす可能性がある
  - native close requested、dirty settings、add feed pending、sync pending、restart requested、force close の flow を固定する

- [ ] P2 window size/position restore を multi-monitor / disconnected monitor / negative coordinates で固定する
  - 対象: Tauri window config, platform store, startup focus restore
  - 外部 monitor を外した後の保存位置や negative coordinate を復元すると、window が画面外に出る
  - disconnected monitor、negative x/y、DPI change、maximized state、fullscreen state、safe fallback center の contract を追加する

- [ ] P2 native file dialog extension / overwrite confirmation policy を import/export/backup で揃える
  - 対象: OPML import/export、DB backup/restore UI、Tauri dialog usage
  - open/save dialog の拡張子・既存 file overwrite・cancel handling がばらつくと、ユーザーデータを誤上書きしやすい
  - `.opml`/`.xml` filter、existing file overwrite、cancel result、directory selected、extension auto-append の policy を追加する

- [ ] P2 app data directory rename / bundle identifier migration path を明文化する
  - 対象: `src-tauri/tauri*.conf.json`, startup data dir, release docs
  - bundle identifier を変えると OS app data dir が変わり、既存 DB/credentials/log が見えなくなる
  - old identifier detection、DB migration prompt、credential migration impossible copy、log path note、rollback の contract を追加する

- [ ] P2 `AppState` mutex poisoning を command surface 全体で同じ error に揃える
  - 対象: `commands::*`, `AppState`, DB/browser tracker mutex access
  - 一部 command だけ poisoned mutex を panic/unwrap すると、単一 command failure が app 全体 failure に広がる
  - DB mutex、browser tracker mutex、pending update mutex、syncing flag、diagnostics category の matrix を作る

- [ ] P2 recent article history limit と persistent storage / DB history の役割を整理する
  - 対象: `src-tauri/src/domain/constants.rs`, `record_article_view`, reader history UI
  - hardcoded 50 件の意味が未明確だと、履歴 UI や storage cleanup で期待がずれる
  - max count、duplicate article revisit、account delete、feed delete、clear history、migration の contract を追加する

- [ ] P2 release app first-run permission prompts を manual verification checklist に入れる
  - 対象: `docs/release-manual-verification.md`, packaged app smoke
  - file dialog、keyring、clipboard、network などの初回 permission prompt を見ないと、配布後の初回 UX が確認できない
  - first keyring access、first file dialog、first clipboard copy、first network sync、denied permission の checklist を追加する

- [ ] P2 OS sleep中の updater download / file export / DB backup を cancellation-aware にする
  - 対象: updater hook、export/backup commands、runtime lifecycle
  - laptop sleep で long-running file/network operation が中断すると、partial artifact や stale progress が残る
  - sleep during download、sleep during export、sleep during backup、resume cleanup、progress reset の contract を追加する

- [ ] P2 release artifact quarantine path と app translocation の data dir / log dir 影響を検証する
  - 対象: macOS packaged app verification, app path/log path helpers
  - 未 notarized/未移動 app が translocation されると、resource path や log/app data dir の見え方が変わる可能性がある
  - DMG direct launch、Applications launch、quarantine present、translocated path、log dir open の check を追加する

- [ ] P2 Windows hidden console policy と crash visibility の両立を検証する
  - 対象: `src-tauri/src/main.rs`, Windows release smoke, logging
  - release で console window を消す設定は必要だが、startup panic 時の recovery surface が log/UI にないと完全に無音で落ちる
  - hidden console、startup panic、log written、message box/fallback UI、exit code の manual check を追加する

- [ ] P2 production log timezone strategy を UTC/local のどちらにするか support docs と同期する
  - 対象: `src-tauri/src/lib.rs`, log docs, support workflow
  - release log が local time だと timezone をまたぐ報告で sync/update 時刻の突合が難しくなる
  - local timezone、UTC alternative、DST boundary、log filename/time display、support copy の policy を決める

- [ ] P3 Windows dispatch env allowlist を dev credential 以外の future env 追加に備えて schema 化する
  - 対象: `scripts/lib/windows-dispatch.ts`, dev scripts
  - env forwarding が ad hoc だと、future secret env を WSL->Windows へ漏らすか、必要 env を渡し忘れる
  - allowlist schema、secret denylist、path env、dev-only env、test fixture の task に分ける

- [ ] P3 release/debug feature flag inventory を generated report にする
  - 対象: `cfg(debug_assertions)`, `DEV_*` env, dev modules, Tauri configs
  - debug/release 分岐が増えると、どの機能がどの build に入るかレビューしにくい
  - Rust cfg、Vite env、dev module import、Tauri dev config、release artifact expected absence を一覧化する

- [ ] P1 file drop / drag-and-drop import surface を URL validation と同じ security boundary にする
  - 対象: Tauri window events、OPML import UI、file path handling
  - OS の file drop が dialog flow を迂回すると、拡張子・サイズ・symlink・private path の validation を抜ける可能性がある
  - dropped OPML、dropped directory、symlink file、huge file、multiple files、cancel/ignore feedback の contract を追加する

- [ ] P1 single-instance / second-launch behavior を sync/update/dirty state と接続する
  - 対象: Tauri app lifecycle、window focus restore、update restart、dirty-state registry
  - 2 回目起動時に既存 window を focus するだけか、URL/action を渡すかが未固定だと、sync 中や dirty form 中に state が壊れる
  - second launch、hidden/minimized window、dirty settings、sync in-flight、update pending、focus failure の contract を追加する

- [ ] P1 stale update install と DB migration version の compatibility gate を作る
  - 対象: updater flow、DB migration、release metadata
  - 古い downloaded update を後で install すると、現在 DB schema と想定 migration path がずれる可能性がある
  - downloaded version age、current app newer、DB schema newer、install blocked、redownload required の contract を追加する

- [ ] P2 sync result warning cap と aggregation order を many-feed failure で固定する
  - 対象: sync result DTO、frontend sync feedback、diagnostics
  - 数百 feed の失敗を全部 toast/log に出すと UI と log が埋まり、逆に cap すると重要エラーが落ちる
  - warning cap、first error priority、auth vs parse order、per-feed summary、details drilldown の contract を追加する

- [ ] P2 article tag relation uniqueness を DB constraint / frontend optimistic state で固定する
  - 対象: tag repository、article tag picker、tests
  - 同じ article/tag relation が二重登録されると count、picker chips、remove 操作が壊れる
  - duplicate tag_article、optimistic duplicate、untag one of duplicates、count query、DB unique constraint の contract を追加する

- [ ] P2 window drag region と file drop region の pointer event priority を検証する
  - 対象: app shell CSS、native titlebar overlay、drag/drop handlers
  - titlebar drag、browser overlay、file drop overlay が同じ上部領域を使うと、クリック/ドラッグ/drop の優先順位が壊れる
  - titlebar drag、toolbar click、file hover、drop cancel、browser overlay open の visual/manual check を追加する

- [ ] P2 long-running operation progress event monotonicity を import/export/sync/update で揃える
  - 対象: sync progress events、OPML import/export UI、updater events
  - progress が戻る、100% 後に error、session id なしで別操作に混ざると UI が信用できなくなる
  - monotonic percent、session id、100 then error、cancel, restart after failure の contract を追加する

- [ ] P2 memory pressure / OOM risk を large feed import と article render で smoke 化する
  - 対象: local provider parser、OPML import、article content view
  - 巨大 feed や巨大 HTML を parse/render した時に body cap だけでは JS/Rust memory pressure を検出できない
  - large feed entries、large article HTML、many images、large OPML、render abort/fallback の smoke を追加する

- [ ] P2 test suite parallelism と shared global state の isolation policy を明文化する
  - 対象: Vitest setup、Rust tests、global diagnostics/reset helpers
  - parallel test が localStorage、window globals、OnceLock、env vars を共有すると flake が増える
  - env var isolation、OnceLock reset、localStorage reset、fake timers、Rust test threads の policy を追加する

- [ ] P2 Rust integration tests の filesystem temp dir cleanup failure を diagnostics 化する
  - 対象: `src-tauri/tests`, temp DB/keyring fixtures
  - temp dir cleanup が失敗しても見えないと、次回 test や disk usage に影響する
  - temp dir owner、Windows open handle、cleanup failure warning、test retry、artifact retention の task に分ける

- [ ] P2 CI failure artifact retention を frontend/Rust/native smoke ごとに分類する
  - 対象: `.github/workflows/ci.yml`, release workflow, test outputs
  - 失敗時に必要な log/screenshot/DB fixture が残らないと、remote failure を再現できない
  - Vitest logs、Rust test logs、native app logs、screenshots、DB backup artifact、retention days の matrix を作る

- [ ] P2 app action telemetry-free audit log を local diagnostics として持つか決める
  - 対象: app action dispatcher、diagnostics reporter、debug HUD
  - action failure の再現には sequence が必要だが、telemetry なし方針なら local-only・redacted・size-capped の設計が必要
  - local-only log、redaction、size cap、action id、account/feed omission、support copy の decision を追加する

- [ ] P2 user-facing error copy の support code / diagnostics id 方針を決める
  - 対象: `AppError` schema、toasts、dialogs、runtime diagnostics
  - 詳細を隠すほど問い合わせ時の特定が難しくなるため、secret を出さずに照合できる短い code/id が必要か判断する
  - stable error code、diagnostics id、copy in ja/en、log correlation、no secret detail の policy を追加する

- [ ] P3 repository method naming と SQL operation kind の suffix を整理する
  - 対象: `src-tauri/src/repository`, `src-tauri/src/infra/db`
  - `list/find/get/count/save/update` の境界が揺れると、transaction/read-write classification と test naming が追いにくい
  - read-only、write、upsert、bulk、maintenance、raw SQL owner の naming inventory を作る

- [ ] P3 fixture domain names を RFC reserved domains へ寄せる移行計画を作る
  - 対象: `src/dev/mock-data.ts`, tests fixtures, docs screenshots
  - 実在ドメイン fixture が多いと accidental network access と権利/表示変更の影響を受ける
  - `example.com`、`example.jp`、`.test`、allowed real domains、screenshot text の migration plan を作る

- [ ] P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する
  - 対象: `TODO.md`, similarity report, task triage scripts
  - TODO が増え続けると同じ risk を別名で積みやすくなり、優先度判断が鈍る
  - normalized heading、priority bucket、file target overlap、similarity threshold、completed task pruning の report を追加する

- [ ] P1 release rollback / downgrade install を DB schema compatibility として禁止または明示復旧にする
  - 対象: updater flow、release metadata、DB migration
  - 新しい DB schema を触った後に古い app を起動すると、migration downgrade 非対応で data loss や起動不能になる
  - app downgrade detection、schema newer than app、rollback blocked copy、manual restore path、support message の contract を追加する

- [ ] P1 provider response trust boundary を `trusted backend` / `untrusted feed` で型と sanitizer に分ける
  - 対象: provider DTO、article sanitizer、schema-boundary rule
  - FreshRSS/GReader API response と任意 RSS/Atom response を同じ trust level で扱うと、validation/sanitization の責務が曖昧になる
  - trusted API DTO、untrusted feed HTML、provider metadata、error payload、schema strictness の decision を書く

- [ ] P1 credential-bearing URL を persistence boundary で reject する
  - 対象: feed URL、server URL、article URL、history、OPML export
  - `https://user:pass@example.com/feed` のような URL が DB/OPML/history に保存されると、redaction 以前に漏洩面が増える
  - feed add、OPML import、article link、browser history、debug dump、export の reject/redact policy を固定する

- [ ] P1 app log / diagnostics の maximum total size と emergency truncation を固定する
  - 対象: log plugin setup、runtime diagnostics、support dump
  - 連続 failure で log/diagnostics が肥大化すると disk pressure と support copy failure が起きる
  - total log cap、per-event cap、diagnostics ring buffer、truncation marker、copy failure fallback の contract を追加する

- [ ] P2 OS accessibility settings の high contrast / forced colors / increased contrast を design token と同期する
  - 対象: `DESIGN.md`, CSS tokens, app shell, settings/reader views
  - dark/light と reduced-motion だけだと、OS high contrast や forced colors で操作要素の境界が消える
  - forced colors、prefers-contrast、focus ring、selected row、disabled state、browser overlay の visual check を追加する

- [ ] P2 zoom / text scaling 200% で dense reader/settings controls の overflow を検証する
  - 対象: reader article list、settings forms、command palette、dialogs
  - desktop webview の zoom/text scaling で固定高さ row や toolbar button が重なると、accessibility と操作性が落ちる
  - 125/150/200% zoom、large font、narrow width、toolbar icons、form labels の visual smoke を追加する

- [ ] P2 reduced data / low power mode 相当の remote image・background sync 方針を決める
  - 対象: article image loading、sync scheduler、settings
  - OS や user preference で低通信/省電力を求める場合、remote images と background sync をどう抑えるか未固定
  - remote image load、favicon fetch、automatic sync、manual override、settings copy の decision を追加する

- [ ] P2 privacy-preserving feed favicon fetch の referer / user-agent / cache policy を固定する
  - 対象: favicon helpers、feed metadata display、HTTP defaults
  - favicon 取得が article/feed fetch と別経路になると、referer・user-agent・private host guard がずれる
  - no referer、user-agent、private host reject、cache TTL、failure cache、manual refresh の contract を追加する

- [ ] P2 imported OPML account ownership を cross-account duplicate / move flow で固定する
  - 対象: OPML import、feed repository、settings account selection
  - 別 account に同じ feed URL を import する時の duplicate 判定と folder ownership が曖昧だと feed が欠落する
  - same URL different account、same URL same account、folder same name different account、account switch during import、export scope の contract を追加する

- [ ] P2 provider account kind 追加時の migration checklist を template 化する
  - 対象: provider traits、account settings、schema/tests
  - 新 provider を足す時に credential、capability、sync cursor、folder/tag semantics の漏れが出やすい
  - credential model、folder model、tag model、read/star support、cursor support、test fixture checklist を追加する

- [ ] P2 reader search ranking / snippet policy を FTS query syntax と user copy で固定する
  - 対象: FTS search SQL、reader search UI、locale copy
  - FTS syntax error、phrase query、prefix query、snippet escaping の方針が未固定だと search UX が壊れる
  - quote query、special operators、prefix query、empty result, snippet escaped HTML、ranking tie の contract を追加する

- [ ] P2 native notification を導入する場合の permission / privacy / quiet hours policy を先に決める
  - 対象: future notification feature、sync result feedback、settings
  - sync/update/error を native notification に出す場合、feed title や account 名が lock screen に出る可能性がある
  - permission prompt、lock screen privacy、quiet hours、account name redaction、disable setting の decision を追加する

- [ ] P2 system tray / background resident mode を導入する前の lifecycle contract を作る
  - 対象: future tray feature、sync scheduler、window close behavior
  - close で終了する app と tray 常駐 app では shutdown drain、sync scheduler、dirty form guard が変わる
  - close hides window、quit exits app、sync while hidden、update restart、dirty state prompt の decision を追加する

- [ ] P2 custom protocol / deep link を導入する場合の URL schema と single-instance routing を先に決める
  - 対象: future protocol feature、app action dispatcher、single-instance handling
  - external URL から app action を起動できるようにすると、private host/open settings/import などの validation が必要になる
  - protocol allowlist、action mapping、single-instance route、malformed link、security prompt の decision を追加する

- [ ] P2 browser webview state と article reader state の same-origin assumptions を明文化する
  - 対象: browser webview tracker、article content view、URL/open policies
  - embedded browser は remote origin、article content は sanitized local DOM という前提が崩れると focus/script/security boundary が曖昧になる
  - remote origin、local sanitized content、focus bridge、history tracking、script injection allowed surface の contract を追加する

- [ ] P2 storage quota exhausted 時の cascading failure を preferences/sidebar/history/debug で検証する
  - 対象: localStorage-backed helpers、preferences store、runtime diagnostics
  - quota exceeded が一箇所で起きた後に warning storage も書けず、同じ failure が連鎖する可能性がある
  - preferences save、sidebar expanded folders、command history、diagnostics warning-once、recovery UI の contract を追加する

- [ ] P2 frontend schema parse failure の fallback data が UI action を enable しない contract を作る
  - 対象: `src/schemas`, Tauri command wrappers, view models
  - parse failure 時に empty fallback を使うと、本来 disabled にすべき destructive action が enabled になる可能性がある
  - account list parse failure、feed list parse failure、preference parse failure、empty fallback、disabled action の test を追加する

- [ ] P2 Rust test `cfg(test)` と production-only code path の coverage gap を inventory 化する
  - 対象: `src-tauri/src/lib.rs`, `cfg(not(test))` blocks, integration tests
  - plugin setup、startup lifecycle、log setup などが `cfg(not(test))` で外れると unit test だけでは release regression を拾えない
  - plugin setup、log setup、focus restore、scheduler start、cleanup logs、release smoke owner の inventory を作る

- [ ] P2 generated schema drift を PR review comment ではなく failing gate へ昇格する条件を決める
  - 対象: generated Tauri schemas、API schemas、CI
  - generated artifact drift が review 依存だと、release 直前に capability/schema mismatch が出る
  - generated file changed、source changed no generated update、CI failure, intentional update label、regeneration command の policy を追加する

- [ ] P3 TODO priority aging policy を作る
  - 対象: `TODO.md`, `.claude/rules/quality-policy.md`
  - P1/P2 が増え続けると、古い高優先度が埋もれて実際の優先度を失う
  - created batch marker、last reviewed date、stale P1 escalation、P3 archive、completed-to-CHANGELOG の運用を決める

- [ ] P3 risk TODO を implementation / contract test / manual verification / rule update へ自動分類する
  - 対象: `TODO.md`, task triage tooling
  - risk 指摘が多いほど「何から実装するか」が見えにくくなるため、作業種別で並列投入しやすくする
  - heading parser、target path extraction、priority extraction、work type classifier、worker batch export の script を追加する

- [ ] P1 release artifact SBOM / provenance / checksum を生成・検証する gate を作る
  - 対象: release workflow、`package.json`, `src-tauri/Cargo.lock`, release docs
  - 署名だけでは依存関係や生成元を追えず、配布後の supply-chain 問い合わせに答えにくい
  - JS/Rust SBOM、artifact checksum、workflow run id、source commit、draft release attachment の contract を追加する

- [ ] P1 updater manifest と release asset の signature / checksum / platform mapping を双方向検証する
  - 対象: updater manifest、release workflow、release manual verification
  - manifest が別 asset や別 arch を指すと、署名済みでも誤 artifact を配る可能性がある
  - macOS arm64、Windows x64、asset filename、signature file、checksum mismatch、missing platform の gate を追加する

- [ ] P1 backup/export file の privacy level と encryption decision を明文化する
  - 対象: DB backup、OPML export、support dump、docs
  - DB backup や support dump は article/feed/account metadata を含むため、OPML と同じ感覚で共有されると privacy leak になる
  - DB backup、OPML export、diagnostics dump、log zip、encryption required/optional、warning copy の policy を追加する

- [ ] P1 uninstall / reinstall / app data removal の data retention contract を作る
  - 対象: installer/uninstaller docs、app data dir、credentials/keyring
  - app を削除しても DB/log/keyring が残るかどうかが未固定だと、privacy と復旧の期待がずれる
  - macOS app delete、Windows uninstall、reinstall same version、reinstall newer version、manual data removal の checklist を追加する

- [ ] P2 Tauri/macOS sandbox entitlements と file/network/keychain access の将来方針を整理する
  - 対象: Tauri config、release packaging、keyring/file/network commands
  - sandbox や store 配布を考えると、現状の file dialog・keyring・network access が entitlements と合うか早めに分けておく必要がある
  - network client、keychain/keyring、user-selected files、app data dir、external opener の entitlement matrix を作る

- [ ] P2 per-domain sync politeness / concurrency cap を local RSS provider で固定する
  - 対象: local provider sync、sync scheduler、HTTP defaults
  - 同じ host の feed を多数購読していると、manual/all sync で短時間に大量 request を投げる可能性がある
  - same-host concurrency、global concurrency、manual sync override、backoff sharing、user-agent contact docs の policy を追加する

- [ ] P2 provider redirect chain の auth header stripping を same-origin / cross-origin で固定する
  - 対象: GReader/FreshRSS HTTP client、local provider HTTP client
  - redirect 先に Authorization header が残ると、provider credential が別 origin に送られる
  - same-origin redirect、cross-origin redirect、scheme downgrade、userinfo URL、diagnostics redaction の contract を追加する

- [ ] P2 DNS cache / repeated private host resolution の time-of-check/time-of-use policy を決める
  - 対象: private host guard、feed discovery、local provider fetch
  - validation 時と実 fetch 時で DNS 結果が変わると、private host guard が bypass される
  - resolve before fetch、redirect re-resolve、TTL/caching、DNS failure retry、rebinding fixture の policy を追加する

- [ ] P2 local DB encryption at rest を採用しない/する decision record を作る
  - 対象: DB storage、credential storage、privacy docs
  - keyring は credential を守るが、DB には feed/article/history が残るため、暗号化しない理由または将来方針を明文化する必要がある
  - threat model、OS disk encryption reliance、portable backup、search performance、migration cost の decision を追加する

- [ ] P2 OPML export に privacy summary comment を入れる/入れない decision を作る
  - 対象: OPML generator、export docs
  - OPML は共有されやすいが購読傾向や folder 名を含むため、生成物に注意書きを入れるか決めておく
  - comment included/omitted、round-trip compatibility、reader import tolerance、locale copy、user warning の decision を追加する

- [ ] P2 pointer target minimum size を compact toolbar / tree row / tag chip で棚卸しする
  - 対象: reader toolbar、feed tree、tag chips、settings action buttons
  - compact UI でクリック target が小さすぎると、desktop でも誤操作が増える
  - icon button size、row action affordance、tag chip remove、dense sidebar、touch trackpad tolerance の matrix を作る

- [ ] P2 destructive action undo unavailable warning を delete account/feed/tag/history で揃える
  - 対象: destructive dialogs、settings/subscriptions/tag flows
  - rollback 不能な削除で copy がばらつくと、ユーザーが recoverable と誤解する
  - delete account、delete feed、delete tag、clear history、cleanup orphans、backup recommendation の copy contract を追加する

- [ ] P2 user-created names の maximum display width と tooltip policy を dense list で決める
  - 対象: feed tree、account switcher、tag chips、settings lists
  - 長い feed/account/tag 名が layout を押し広げるか、省略されすぎると action target の識別が難しくなる
  - max width、ellipsis、tooltip/title、middle truncation、bidi-safe display の policy を追加する

- [ ] P2 command/action id の public persistence boundary を preference/history/debug で分類する
  - 対象: app action ids、shortcut preferences、command history、debug traces
  - action id を rename すると preference/history/debug が壊れるため、永続化される id と内部 id を分ける必要がある
  - persisted ids、internal-only ids、migration map、debug label、removed action の contract を追加する

- [ ] P2 stale query cache after app version upgrade を schema version / query key version で検出する
  - 対象: React Query keys、startup boot、schema migrations
  - reload 前後や future persistence 導入時に古い query shape が残ると、view model parse が壊れる
  - app version bump、schema version bump、query key version、cache clear、fallback disabled UI の policy を追加する

- [ ] P2 test fixture real date values を frozen clock / relative date policy へ寄せる
  - 対象: tests fixtures、reader/subscription review tests、Rust fixtures
  - 実日付 fixture が現在日に近づくと stale day、grouping、review warning の期待値が時間で変わる
  - frozen clock、relative date builder、timezone fixture、future date、DST boundary の migration plan を作る

- [ ] P2 release notes と in-app updater message の user-visible change classification を同期する
  - 対象: release notes workflow、updater UI、CHANGELOG
  - release note では修正済みでも updater UI が generic だと、ユーザーが update urgency を判断できない
  - security/privacy fix、data migration、manual action required、known issue、rollback impossible の copy policy を追加する

- [ ] P3 dependency update review を runtime / dev-only / build-only / transitive risk に分類する
  - 対象: `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.lock`
  - dependency 更新を一律に見ると、runtime security と test-only churn の優先度が混ざる
  - runtime dependency、dev tool、build tool、transitive duplicate、security advisory の review checklist を作る

- [ ] P3 local developer machine state を check に混ぜない reproducibility audit を行う
  - 対象: `mise.toml`, scripts, test setup, release scripts
  - local app running、ports occupied、existing DB、env vars、global pnpm store が check 成否に影響すると第三者再現性が落ちる
  - port state、app process、env vars、home directory files、global cache、timezone/locale の audit を追加する

- [ ] P3 TODO.md から issue / worker prompt を生成する export format を決める
  - 対象: `TODO.md`, task triage tooling, subagent workflow
  - TODO が増えた後に手作業で worker へ渡すと、優先度・検証・スコープが落ちやすい
  - markdown section parser、P1/P2 filter、target files、test plan inference、worker prompt template の task を追加する

- [ ] P1 update/install failure 後の app binary / DB schema / pending update state の三者整合を固定する
  - 対象: updater hook、updater commands、DB migration、startup boot
  - binary は旧版のまま DB だけ migration 済み、または pending update state だけ残ると復旧不能に見える
  - install failure、restart failure、schema migrated、pending update cleared、manual redownload の contract を追加する

- [ ] P1 support dump 生成前に user consent / redaction preview を必須にするか決める
  - 対象: Debug HUD、diagnostics export、support workflow
  - redaction があっても dump の中身をユーザーが確認できないと、購読傾向や環境情報を意図せず共有する可能性がある
  - preview screen、copy summary、redacted fields list、cancel flow、large dump truncation の decision を追加する

- [ ] P1 feed fetch abuse prevention を manual sync / auto sync / discovery で分ける
  - 対象: local provider HTTP client、feed discovery、sync scheduler
  - discovery と sync が同じ host に集中すると、ユーザー操作でも provider 側から abuse と見なされる可能性がある
  - per-host rate、manual burst、auto sync batch、discovery retry、429/403 suppression の contract を追加する

- [ ] P1 corrupted preference row が startup/menu/settings を連鎖的に壊さない quarantine policy を作る
  - 対象: preference repository、startup menu prefs、settings store
  - 1 行の不正 preference で menu rebuild や settings 全体が fallback すると、ユーザーが修復できない
  - unknown key、invalid value、oversized value、menu fallback、settings quarantine/reset の contract を追加する

- [ ] P2 installer upgrade 前後の app data backup recommendation を user-facing flow にする
  - 対象: release notes、manual verification、settings data export
  - data migration を含む release で事前 backup 導線がないと、失敗時にユーザーが戻れない
  - migration release、backup prompt、skip copy、backup failure、restore docs link の policy を追加する

- [ ] P2 release artifact provenance を PR / tag / workflow run の三点で照合する
  - 対象: release workflow、PR template、release manual verification
  - tag と artifact の source commit、PR、workflow run がずれると、何を配ったか追跡できない
  - tag SHA、workflow run id、PR merge commit、artifact checksum、release note commit range の gate を追加する

- [ ] P2 app settings export/import を導入する前の schema version / secret exclusion policy を作る
  - 対象: preferences schema、settings data page、credential store
  - 設定 export に credentials や environment-specific paths が混ざると privacy leak と import 事故につながる
  - schema version、credential excluded、local paths excluded、unknown keys、downgrade import の decision を追加する

- [ ] P2 feed parser error sample を support-safe に保存するか決める
  - 対象: local provider parser、diagnostics、support dump
  - parse failure の再現には response sample が有効だが、記事本文や private feed content を保存すると privacy risk になる
  - no sample、redacted prefix、hash only、content-type/status only、user opt-in の decision を追加する

- [ ] P2 provider credential verification request の side effect を account create/update と分離する
  - 対象: account setup、test connection commands、provider HTTP client
  - 接続確認が remote server 側で session/cookie/last-login を更新する場合、保存前の試行が side effect になる
  - verify before save、verify after save、cookie discarded、rate limit、failed verify logging の contract を追加する

- [ ] P2 external browser open queue を rapid clicks / double shortcuts で idempotent にする
  - 対象: `open_in_browser`, app actions, keyboard/menu handlers
  - 同じ article を連打すると複数 browser tab や duplicate Reading List action が出て、ユーザー操作の副作用が大きい
  - double click、key repeat、menu+shortcut race、same URL dedupe window、failure retry の policy を追加する

- [ ] P2 long article virtualization を導入する前の selection/search highlight contract を作る
  - 対象: article content view、search highlight、reader scroll restoration
  - 将来 virtualization を入れると scroll restore、text selection、search highlight、image loading の前提が変わる
  - selection preservation、find-in-article、scroll anchor、image lazy load、print/share future scope の decision を追加する

- [ ] P2 app-level recovery action を error category ごとに整理する
  - 対象: `AppError`, toasts/dialogs, settings debug actions
  - すべての失敗が「再試行」だけだと、permission denied、auth failure、corrupt DB、network offline の復旧が混ざる
  - retry、open settings、open log dir、restore backup、reset local state、contact support の action matrix を作る

- [ ] P2 stale support/debug logs を private data reset と uninstall docs に接続する
  - 対象: log dir、settings data reset、docs
  - DB/credentials を消しても古い logs/support dumps が残ると privacy reset として不完全になる
  - private data reset、manual log deletion、support dump deletion、uninstall docs、failure warning の contract を追加する

- [ ] P2 provider-specific max feed count / article count assumptions を account settings に出すか決める
  - 対象: provider traits、sync scheduler、settings account detail
  - 大量 feed/account で性能が落ちる場合、暗黙 limit のままだと user support が難しい
  - max feeds guidance、max articles guidance、warning threshold、performance diagnostics、no hard limit copy の decision を追加する

- [ ] P3 Rust/TS cross-language enum drift を generated table で見える化する
  - 対象: domain enums、API schemas、frontend constants
  - provider kind、sync status、display mode、error category などの enum が増えると手動 parity test だけでは漏れる
  - Rust enum list、TS schema list、locale labels、unknown fallback、dead variant の report を追加する

- [ ] P3 repository SQL strings を migration-defined table/column inventory と照合する tooling を作る
  - 対象: `src-tauri/src/infra/db`, migrations, repo contract tests
  - column rename や migration 追加後に raw SQL string が古いままでも compiler が拾えない
  - table names、column names、index names、raw SQL parser limits、intentional dynamic SQL allowlist の report を追加する

- [ ] P3 TODO risk register を domain owner 別に shard する計画を作る
  - 対象: `TODO.md`, future task files
  - 1 ファイルに全 risk が積み上がると、reader/settings/release/provider の担当ごとの実行単位が見えにくい
  - reader、settings、provider、release、quality、security/privacy の shard policy と移行手順を決める

- [ ] P1 remote feed content 由来の filename/path suggestion を絶対に使わない contract を作る
  - 対象: OPML export、backup/export dialogs、article share future scope
  - feed title や article title を file name suggestion に使うと、path separator/control char/RTL spoof で危険な保存名になる
  - feed title、account name、article title、control chars、path separators、safe default filename の policy を追加する

- [ ] P2 account recovery flow を credential reset / server URL fix / cache clear の三系統に分ける
  - 対象: account detail settings、sync error UI、diagnostics
  - すべての account failure を「認証情報更新」に寄せると、server URL typo や stale cache の復旧が遠回りになる
  - credential reset、server URL edit、test connection、sync_state clear、pending mutation quarantine の flow を整理する

- [ ] P2 provider-side deleted feed / folder の local retention policy を account kind ごとに固定する
  - 対象: GReader/FreshRSS sync、local repository、subscriptions UI
  - remote で消えた feed/folder を local に残すか消すかが曖昧だと、復活・削除・OPML export の期待値が揺れる
  - remote deleted feed、remote deleted folder、local starred article、pending mutation、manual resubscribe の contract を追加する

- [ ] P2 sync scheduler fairness を many-account / one-slow-account で固定する
  - 対象: sync scheduler、provider fetch loop
  - 1 つの遅い account が他 account の sync を遅らせると、全体の鮮度が落ちる
  - one slow account、many small accounts、manual sync priority、timeout, fairness order の contract を追加する

- [ ] P2 partial sync success の freshness indicator を feed/account/article list で揃える
  - 対象: sync result UI、account detail、sidebar/feed list
  - 一部 feed だけ成功した時に account 全体を fresh と見せると、ユーザーが未更新 feed に気づけない
  - all success、partial success、all failed、stale feed count、last successful feed sync の display policy を追加する

- [ ] P2 support/debug copy に stable app/environment fingerprint を secretなしで含めるか決める
  - 対象: diagnostics dump、support workflow、runtime platform info
  - OS/version/app build がないと問い合わせ再現が難しいが、hostname/path/user名を含めると privacy risk になる
  - app version、commit hash、OS family、arch、locale、timezone offset、excluded hostname の decision を追加する

- [ ] P2 offline-first stale content banner を account/feed/article view で出すか決める
  - 対象: reader UI、sync status、network error taxonomy
  - network failure 中でも古い記事は読めるため、error toast だけでは stale content を見ていることが分かりにくい
  - offline detected、last sync age、manual sync failed、per-feed stale、banner dismiss の policy を追加する

- [ ] P2 keyboard-only recovery actions を error dialog/toast/settings debug で検証する
  - 対象: error surfaces、settings debug actions、toasts
  - 復旧導線が mouse 前提だと、キーボード操作ユーザーが backup restore/open log/retry に到達できない
  - retry button、open settings、open log dir、restore backup、dismiss toast、focus restore の E2E check を追加する

- [ ] P2 screen reader labels for destructive dialogs に対象名と不可逆性を必ず含める
  - 対象: delete account/feed/tag/history dialogs
  - 見出しや本文に対象名があっても、button label だけでは screen reader の action が曖昧になる
  - accessible name、target name、irreversible warning、loading state、failure retry の contract を追加する

- [ ] P2 import/export progress cancellation の confirmation timing を固定する
  - 対象: OPML import/export、DB backup/restore、settings data future flow
  - cancel を押した瞬間に partial file/partial DB state が残る場合、確認なし cancel は危険になる
  - safe cancel、unsafe cancel confirm、partial file cleanup、transaction rollback、post-cancel summary の contract を追加する

- [ ] P2 feed discovery result trust level を UI 表示と add action で分ける
  - 対象: feed discovery、add feed dialog、URL validation
  - discovery で見つかった title/url をそのまま trusted と扱うと、spoofed title や mixed-content URL を add してしまう
  - discovered title display、final URL validation、private URL reject、duplicate URL, user confirmation の contract を追加する

- [ ] P2 malformed provider account config を settings 表示可能な quarantine state にする
  - 対象: account repository、settings account detail、sync scheduler
  - account row が壊れた時に list failure で settings に入れないと、ユーザーが削除/修復できない
  - invalid provider kind、invalid server URL、missing credential ref、settings read-only view、delete/quarantine action の contract を追加する

- [ ] P2 release hotfix flow を normal release と別 checklist にする
  - 対象: release skill/docs、release workflow、CHANGELOG
  - 緊急修正では検証を短縮しがちなので、最低限落とせない gate を通常 release と分ける
  - security hotfix、data corruption hotfix、CI minimum gates、manual smoke、rollback note の checklist を追加する

- [ ] P2 bug report issue template に privacy-safe diagnostics attachment guidance を追加する
  - 対象: `.github/ISSUE_TEMPLATE/02-bug.yml`, support docs
  - ユーザーが log や DB をそのまま添付すると subscription/credential 周辺が漏れる可能性がある
  - attach logs guidance、do not attach DB、redaction steps、support dump preferred、private contact note の copy を追加する

- [ ] P2 internal dev mock data が product metrics / screenshots に混ざらないよう source label を出す
  - 対象: dev mocks、debug HUD、screenshots/storybook
  - mock data と実データが画面上で区別できないと、レビューやドキュメントで誤解される
  - dev data label、storybook badge、debug HUD source、screenshot naming、release build absence の contract を追加する

- [ ] P3 flaky test quarantine policy を TODO / issue / skip annotation で統一する
  - 対象: tests、quality policy、CI
  - flake を場当たり的に skip すると、未解決リスクが TODO と CI のどちらにも残らない
  - skip annotation format、TODO link、owner、expiry date、retry evidence、unskip gate の policy を追加する

- [ ] P3 risk TODO の acceptance criteria template を定型化する
  - 対象: `TODO.md`, future task generator
  - TODO が多くなるほど「完了条件」が曖昧な項目が増え、実装 worker が scope を広げすぎる
  - 対象、問題、分割、focused test、manual verification、defer 明記の template を作る

- [ ] P1 error fallback が destructive action を隠さず disabled にする共通 contract を作る
  - 対象: settings data actions、account/feed/tag destructive dialogs、query parse fallback
  - エラー時に空配列や default state へ倒すと、対象不明の delete/reset が enabled になる危険がある
  - account load failure、feed load failure、tag load failure、settings parse failure、disabled action reason の test を追加する

- [ ] P2 empty state が permission/auth/network/schema failure を同じ「空」として見せないようにする
  - 対象: reader lists、subscriptions index、settings account views
  - failure を empty と表示すると、ユーザーがデータ消失と誤解するか、復旧 action を見つけられない
  - true empty、auth failure、network failure、schema parse failure、permission denied の copy/state matrix を作る

- [ ] P2 stale warning/banner の dismiss persistence を account/feed/session scope で決める
  - 対象: stale content banner、sync warnings、settings diagnostics
  - 一度閉じた warning が別 account/feed でも消えると重要な failure を見落とし、逆に毎回出ると無視される
  - session dismiss、account scoped dismiss、feed scoped dismiss、new error reopens、manual reset の contract を追加する

- [ ] P2 provider API version / server product detection を capability と diagnostics に接続する
  - 対象: GReader/FreshRSS provider、test connection、account detail
  - FreshRSS 互換 API の実装差がある場合、capability を server version/product から分けないと sync failure が増える
  - product header、version endpoint、missing capability、unknown server、diagnostics label の contract を追加する

- [ ] P2 auth token expiry / refresh semantics を provider ごとに明文化する
  - 対象: GReader/FreshRSS auth flow、credential store、sync scheduler
  - token/session が期限切れになる provider で再ログイン/credential reuse/backoff の方針が未固定だと auth storm になる
  - token expired、refresh success、refresh failure、credential invalid、manual reauth required の contract を追加する

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

- [ ] P2 context menu target drift を right-click position / keyboard context menu で固定する
  - 対象: article list、feed tree、tag list context menus
  - context menu を開いた後に selection/refetch が変わると、表示対象と実行対象がずれる
  - pointer target snapshot、keyboard context target、refetch while open、target deleted、action disabled の contract を追加する

- [ ] P2 tooltip / title attribute に secret or full URL を出さない privacy contract を作る
  - 対象: feed URL display、account detail、debug/settings tooltips
  - visible text を redaction しても tooltip/title に full URL や path が残ると漏れる
  - feed URL tooltip、server URL tooltip、log path tooltip、article URL tooltip、copy action の redaction test を追加する

- [ ] P2 stale closure in settings save handlers を form revision で guard する
  - 対象: settings forms、account credentials editor、shortcut settings
  - 保存 promise が返る前に別 field を編集すると、古い success/failure が新しい draft state を上書きする可能性がある
  - edit while saving、save success stale、save failure stale、retry latest draft、dirty state の contract を追加する

- [ ] P2 large account switch の query cancellation / stale render budget を計測する
  - 対象: account switcher、reader query hooks、article list/feed tree rendering
  - 記事・feed が多い account 間で切替えると、旧 account の query result や render work が残りやすい
  - old query cancel、new account skeleton、stale result reject、render duration budget、memory budget の smoke を追加する

- [ ] P2 search query syntax help を backend FTS escaping policy と同期する
  - 対象: reader search UI、FTS query builder、locale copy
  - ユーザーが quote/operator を入力した時の扱いが不明だと、検索失敗を bug と誤解する
  - literal search、phrase search、operator escaped、syntax error copy、help text の contract を追加する

- [ ] P2 release note known-issue と TODO risk のリンク方針を決める
  - 対象: release notes、CHANGELOG、TODO.md
  - 未解決の P1/P2 を抱えた release で known issue を書くべきか、internal TODO に留めるべきか判断基準が必要
  - user-visible risk、internal-only risk、data loss risk、workaround exists、TODO reference の policy を追加する

- [ ] P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する
  - 対象: `TODO.md`, task triage tooling
  - 目視だけでは P1/P2 の並列投入順を保ちにくい
  - priority parse、target parse、domain bucket、dependency hint、JSON export の script を追加する

- [ ] P3 risk TODO の重複 close / merge workflow を決める
  - 対象: `TODO.md`, CHANGELOG, future issue export
  - 類似タスクを統合する時に片方を消すだけだと、過去の判断理由や検証観点が失われる
  - merge marker、superseded by、completed by、CHANGELOG move、issue link の運用を決める
