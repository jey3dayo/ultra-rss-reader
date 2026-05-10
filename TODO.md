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

### 実装投入用 圧縮バッチ

- [ ] P1 Security / Privacy fixture corpus gate を作る
  - 親バッチ: sanitizer、URL private host、XML entity、tooltip/title redaction、backup/export privacy を個別 TODO から束ねる
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/commands/opml_commands.rs`, `src/lib/runtime/diagnostics.ts`, article content tests
  - 完了条件: untrusted feed HTML、IDNA/IPv6/private host、DOCTYPE/entity、URL token、backup/export privacy level が fixture corpus として再利用できる
  - 検証: sanitizer Rust tests、OPML/feed discovery URL validation tests、`pnpm exec vitest run src/__tests__/components/article-content-view.test.tsx`
  - defer: DB restore UI、release artifact signing、future notification/tray/deep link は別バッチへ残す

- [ ] P1 Provider auth / capability / sync safety を一本化する
  - 親バッチ: auth header/cookie no-store、auth failure storm、credential rotation 中 sync 停止、capability downgrade、server URL change 時 sync_state/pending mutation migration を束ねる
  - 対象: `src-tauri/src/infra/provider`, `src-tauri/src/service/sync_scheduler.rs`, account commands/settings、pending mutation repository
  - 完了条件: 401/403 storm は backoff/circuit breaker で止まり、credential edit 中は sync/replay が止まり、capability/server URL 変更時に queue と UI が stale にならない
  - 検証: provider Rust tests、`sync_scheduler` focused tests、account settings/account detail focused tests
  - defer: per-domain crawl politeness と provider account kind 追加 checklist は provider 運用バッチへ残す

- [ ] P1 Release / updater provenance gate を先に固める
  - 親バッチ: updater release config、manifest/asset mapping、SBOM/provenance/checksum、debug-only 混入禁止、hotfix checklist を束ねる
  - 対象: `.github/workflows/release.yml`, `tests/release-repo-contract.test.ts`, `src-tauri/tauri*.conf.json`, release docs
  - 完了条件: tag/workflow/artifact/checksum/manifest/platform mapping が照合され、release build に dev mock/MCP bridge/`DEV_CREDENTIALS` が混入しない
  - 検証: `pnpm exec vitest run tests/release-repo-contract.test.ts`, workflow static contract、必要なら `mise run ci`
  - defer: notarization/SmartScreen/manual first-run prompts は manual verification バッチへ残す

- [ ] P1 DB migration / rollback / runtime recovery を復旧導線として設計する
  - 親バッチ: downgrade install、stale update install、startup DB init panic、runtime corruption、restore preview、destructive recovery dry-run を束ねる
  - 対象: `src-tauri/src/infra/db/migration.rs`, DB commands、startup DB error handling、settings data page
  - 完了条件: future schema/failed migration/downgrade/corruption が user-visible recovery state へ落ち、restore 後に query cache/localStorage/selected account が整合する
  - 検証: migration integration tests、database command tests、settings data focused tests
  - defer: DB encryption decision と uninstall/reinstall retention は privacy/docs バッチへ残す

- [ ] P1 Query invalidation / cache owner 統一バッチを実装する
  - 親バッチ: query invalidation fire-and-forget、add feed invalidation、query key account normalization、mutation invalidation diagnostics、query retry policy を束ねる
  - 対象: `src/lib/query`, `src/hooks`, reader feed/tag/article mutation hooks
  - 完了条件: query key helper 経由に揃い、account scope/all account/deleted account の invalidation failure が owner 別 diagnostics として出る
  - 検証: add feed/delete feed/tag update/article read-star/mute keyword/sync completed の focused vitest
  - defer: reader selection/search stale state は reader state バッチへ残す

- [ ] P2 Settings latest-only / dirty-state / destructive fallback バッチを組む
  - 親バッチ: preferences optimistic rollback、settings save stale closure、credential rotation、VACUUM in-flight、error fallback destructive action disabled、empty state failure 分離を束ねる
  - 対象: settings forms、account credentials editor、settings data actions、preferences store
  - 完了条件: revision/generation で latest-only が固定され、load/parse failure 時は destructive action が理由付き disabled になる
  - 検証: settings/account detail focused vitest、data settings action tests、preferences store tests
  - defer: native close confirmation と update restart dirty form guard は app lifecycle バッチへ残す

#### P2 Settings 実装 tranche

- [ ] P2-S2 settings form save handlers を form revision で guard する
  - worker prompt: account name/credential、shortcut、tag/mute、preference form の save promise が返る前に draft が変わった場合、古い success/failure が新しい draft/dirty state を上書きしないようにする
  - 対象: settings form hooks、`src/components/settings/hooks/account-detail/*`, `src/components/settings/shortcuts-settings.tsx`, tags/mute settings hooks
  - 完了条件: edit while saving、save success stale、save failure stale、retry latest draft、dirty state が form ごとに同じ revision pattern を使う
  - 検証: account detail/shortcuts/tags/mute focused vitest
  - supersedes: `P2 stale closure in settings save handlers を form revision で guard する`, `P2 account credentials editor の draft revision と pending save 再帰を contract 化する`

- [ ] P2-S4 settings dirty-state registry を account/tag/shortcut/preferences で共通化する
  - worker prompt: settings modal close/navigation/update restart の前に見る dirty-state registry を作る前提で、account credentials、tag edit、shortcut edit、sync preferences、preferences save pending の owner を整理する
  - 対象: settings modal hooks、account/tag/shortcut/preferences form hooks、future app lifecycle guard
  - 完了条件: 各 form が dirty/pending/blocking reason を同じ shape で返し、native close confirmation は別 app lifecycle batch へ渡せる
  - 検証: settings modal/account/tag/shortcut focused tests
  - supersedes: `P2 settings form dirty-state registry を account/tag/shortcut/preferences で共通化する`

- [ ] P2-S5 settings fallback が failure を empty state と誤表示しないようにする
  - worker prompt: account/feed/tag/preference parse/load failure を空配列や default state に潰した時、destructive action が enabled にならず、理由付き disabled / recovery action へ落ちる contract を作る
  - 対象: settings data actions、account/feed/tag destructive dialogs、query/schema parse fallback、settings empty states
  - 完了条件: true empty、auth failure、network failure、schema parse failure、permission denied が UI state と disabled reason で区別される
  - 検証: settings/account detail/tags/data settings focused tests、schema parse fallback tests
  - supersedes: `P1 error fallback が destructive action を隠さず disabled にする共通 contract を作る`, `P2 empty state が permission/auth/network/schema failure を同じ「空」として見せないようにする`

- [ ] P2 Reader stale state / focus / search バッチを組む
  - 親バッチ: article list sourcePlan stable key、retained article ids、search result source order、selection not-found、auto-mark timer、reader focus retry を束ねる
  - 対象: reader article list hooks、article selection/focus hooks、search hooks
  - 完了条件: query A の結果が query B に見えず、account switch/refetch/search 中に旧 focus/timer/selection が current state を上書きしない
  - 検証: article list/search/selection focused vitest、fake timer cleanup tests
  - defer: long article virtualization と visual overflow は UI/a11y バッチへ残す

#### P2 Reader 実装 tranche

- [ ] P2-R2 retained article ids / snapshot lifetime を account switch と size cap で固定する
  - worker prompt: retained article ids と retained article snapshot の lifetime、size cap、鮮度更新を account/feed/tag/search 切替と mutation 後に固定する
  - 対象: `src/lib/articles/article-retention.ts`, article list hooks、article view selection hook
  - 完了条件: invisible article や stale title/read/star snapshot が残り続けず、selected article deleted/feed delete/tag delete/search clear で期待通り prune される
  - 検証: `pnpm exec vitest run src/__tests__/lib/article-retention.test.ts src/__tests__/hooks/use-article-view-selection.test.tsx src/__tests__/components/article-view-state.test.tsx`
  - supersedes: `P2 article list retained article ids の lifetime / size cap を account switch で固定する`, `P2 retained article snapshot の title/read/star 鮮度更新方針を固定する`

- [ ] P2-R3 search result source order と stale search loading state を query owner で分ける
  - worker prompt: query A result 後 query B fetching、account switch 中 search、unread sort、folder scoped search、empty result transition で古い search result を現行 query と扱わないようにする
  - 対象: `src/components/reader/hooks/article-list/use-article-list-search.ts`, `src/hooks/use-articles.ts`, `src/lib/reader/reader-query.ts`
  - 完了条件: search ranking preserved/unread sort enabled/retained selected article/missing result article の policy が explicit になる
  - 検証: `pnpm exec vitest run src/__tests__/components/use-article-list-search.test.tsx src/__tests__/lib/reader-query.test.ts src/__tests__/hooks/use-articles.test.tsx`
  - supersedes: `P2 search result source order と unread sort の組み合わせを explicit policy にする`, `P2 article search loading state が stale search results を現行 query と扱わないようにする`

- [ ] P2-R4 selection not-found / selected-row clear を loading transition と account switch で guard する
  - worker prompt: filteredArticles に選択記事が一瞬いないだけで selected row を clear しないよう、loading/refetch/account switch/search clear/feed delete/tag filter/browser-only fallback を generation で固定する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-effects.ts`, `src/components/reader/hooks/article/use-article-view-selection.ts`, `src/components/reader/article-view-state.tsx`
  - 完了条件: true not-found と transient refetch/loading が区別され、browser-only fallback と retained article が current source にだけ効く
  - 検証: `pnpm exec vitest run src/__tests__/hooks/use-article-view-selection.test.tsx src/__tests__/components/article-view-state.test.tsx src/__tests__/components/article-list-body.test.tsx`
  - supersedes: `P2 article selection not-found state を browser-only fallback と account switch で固定する`, `P2 article list selected-row clear の loading/refetch race を guard する`, `P2 article list stale selected article cleanup を loading transition と empty source で固定する`

- [ ] P2-R5 auto-mark timer と reader focus retry を account/article switch で cancellation-aware にする
  - worker prompt: auto-mark read timer、mutation callback ordering、reader focus retry、article search focus retry が account/article switch、unmount、RAF/timer unavailable、active editing target で古い side effect を適用しないようにする
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`, `src/lib/reader-focus.ts`, article list navigation/focus hooks
  - 完了条件: stale view mode、article switch、account switch、timer unavailable、requestAnimationFrame throw、INPUT/TEXTAREA/contenteditable focus 中の late focus が test で固定される
  - 検証: `pnpm exec vitest run src/__tests__/hooks/use-article-auto-mark.test.tsx src/__tests__/lib/reader-focus.test.ts src/__tests__/components/use-article-list-navigation.test.tsx`
  - supersedes: `P2 article auto-mark read timer を view mode / account switch / mutation callback ordering で固定する`, `P2 reader focus retry generation を account/article switch と unmount cleanup で検証する`, `P2 article search focus retry を search close / account switch / unmount で leak-free にする`

- [ ] P2 Dialog / keyboard / accessibility foundation バッチを組む
  - 親バッチ: aria-hidden/inert stack、destructive dialog labels、roving focus、IME composition、global/native menu modal block、screen reader landmarks、focus visible、color-only status を束ねる
  - 対象: app shell、settings modal、command palette、feed tree、article list、shared dialogs/popovers
  - 完了条件: nested top-layer の Escape/Tab/focus restore が安定し、screen reader/keyboard-only で復旧 action と destructive action を識別できる
  - 検証: focused component tests、keyboard E2E smoke、必要なら native app manual check
  - defer: high contrast/zoom visual matrix は visual regression バッチへ残す

#### P2 A11y / Keyboard 実装 tranche

- [ ] P2-A11Y1 dialog / popover / browser overlay の top-layer stack contract を固定する
  - worker prompt: settings modal、confirm dialog、command palette、tag picker、browser overlay が重なった時の aria-hidden/inert、Escape order、Tab wrap、restore focus を shared top-layer contract として固定する
  - 対象: `src/components/ui/dialog.tsx`, settings modal、command palette、article tag picker、browser overlay shortcuts/focus hooks
  - 完了条件: nested dialog、popover inside dialog、browser overlay then dialog、modal then palette の背後 tab stop と screen reader exposure が復活しない
  - 検証: `pnpm exec vitest run src/__tests__/components/dialog.test.tsx src/__tests__/components/settings-modal.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/hooks/use-browser-overlay-shortcuts.test.tsx`
  - supersedes: `P2 dialog / popover の aria-hidden / inert stack contract を追加する`, `P2 focus trap escape hatch を modal/popover/browser overlay の nested top-layer で検証する`, `P2 browser overlay Escape と global keyboard の priority contract を作る`

- [ ] P2-A11Y4 global/native keyboard shortcut と IME composition の block policy を統一する
  - worker prompt: global keyboard、native menu action、shortcut recorder、shortcut help、browser overlay shortcut が modal/top-layer、input/combobox、IME composing、Alt/Option、Dead/Unidentified key を同じ policy で扱うようにする
  - 対象: `src/hooks/use-keyboard.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/lib/keyboard/global-shortcut-targets.ts`, shortcuts settings、menu events
  - 完了条件: IME 入力中や modal open 中に reader action が発火せず、custom shortcut と native menu/help 表示の drift が test で見える
  - 検証: `pnpm exec vitest run src/__tests__/hooks/use-keyboard.test.tsx src/__tests__/lib/keyboard-shortcuts.test.ts src/__tests__/lib/global-shortcut-targets.test.ts src/__tests__/components/shortcuts-settings.test.tsx`
  - supersedes: `P2 global keyboard handler の modal/top-layer block 判定を store state 依存から contract 化する`, `P2 IME composition 中の global keyboard / account pane shortcut 抑止を統一する`, `P1 Alt/Option 修飾キーが plain shortcut として発火しない contract を作る`, `P2 shortcut recorder の IME composing / Dead / Unidentified key を無視する`

- [ ] P2-A11Y5 landmark / focus visible / color-only status の baseline を reader/settings/subscriptions で固定する
  - worker prompt: reader panes、settings modal、subscriptions index、sync/account/feed/tag status について landmark/heading、focus visible、color-only 禁止、screen reader progress announcement の baseline を作る
  - 対象: app shell、reader panes、settings modal、subscriptions index、status UI、DESIGN.md
  - 完了条件: keyboard-only と screen reader で現在位置、進行中/失敗、selected/focused/disabled の区別が色だけに依存しない
  - 検証: focused component tests、small visual/a11y smoke、必要なら native app manual check
  - supersedes: `P2 screen reader landmark / heading structure を reader/settings/subscriptions で固定する`, `P2 focus visible token と keyboard-only operation を dense controls 全体で検証する`, `P2 color-only status indication を sync/account/feed/tag states で禁止する`, `P2 screen reader announcement for sync/update progress を noisy queue にならないよう固定する`

- [ ] P2 Quality / TODO tooling バッチを実装する
  - 親バッチ: quality-baseline JSON extraction、similarity threshold validation、toolchain drift、TODO priority/domain/work type extraction、重複 grouping、worker prompt export を束ねる
  - 対象: `scripts/quality-baseline.ts`, `scripts/similarity-report.ts`, future TODO triage script, `mise.toml`
  - 完了条件: P1/P2 の domain bucket と実装順を machine-readable に抽出でき、quality gate 自体の tool version/output drift を検出できる
  - 検証: script fixture tests、`pnpm markdownlint-cli2 TODO.md`, `mise run quality:react-doctor:diff`, `mise run report:similarity`
  - defer: TODO shard への実移行は、parser/export が安定してから別バッチで行う

#### P2 Quality / TODO tooling 実装 tranche

- [ ] P2-QT3 TODO.md priority/domain/work-type parser を machine-readable にする
  - worker prompt: `TODO.md` の heading、priority、domain bucket、target files、work type、focused verification、dependency hint を JSON export できる parser を作る
  - 対象: future `scripts/todo-triage.ts`, `TODO.md`, parser fixture tests
  - 完了条件: P1/P2/P3、`P1-Q*`、`P2-*` tranche、`supersedes` が structured data として取り出せる
  - 検証: parser fixture tests、`pnpm markdownlint-cli2 TODO.md`, `git diff --check`
  - supersedes: `P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する`, `P3 TODO priority aging policy を作る`

- [ ] P2-QT4 risk TODO の duplicate grouping / superseded workflow を tooling 化する
  - worker prompt: normalized heading、priority bucket、file target overlap、similarity threshold、`supersedes` / `superseded by` / `completed by` を使って重複候補を report する
  - 対象: future TODO triage script, `scripts/similarity-report.ts`, `TODO.md`, CHANGELOG workflow
  - 完了条件: leaf task を削る前に、親バッチへ回収された検証観点と merge 理由を report できる
  - 検証: duplicate TODO fixture tests、similarity report fixture、manual sample on query/auth/recovery/focus domains
  - supersedes: `P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する`, `P3 risk TODO の重複 close / merge workflow を決める`

- [ ] P2-QT5 worker prompt / issue export format を P1/P2 tranche から生成する
  - worker prompt: TODO tranche から worker prompt、対象ファイル、禁止 scope、検証 command、parallel-safe hint を抜き出し、subagent や issue へ渡せる Markdown/JSON を生成する
  - 対象: future TODO export script, `TODO.md`, subagent workflow docs
  - 完了条件: P1-Q1〜Q5、P2 Settings/Reader/A11y の tranche を domain shard ごとに export できる
  - 検証: export fixture tests、sample export review、`pnpm markdownlint-cli2 TODO.md`
  - supersedes: `P3 TODO.md から issue / worker prompt を生成する export format を決める`, `P2 TODO shard の domain taxonomy を固定する`

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

- [ ] P2-C5 TODO intake stop rules を CLAUDE.md へ昇格するか 1 tranche 運用後に判断する
  - worker prompt: TODO.md 冒頭の intake stop rules を first tranche 実装で使い、日常ルールへ昇格すべきか、TODO 固有の運用メモに留めるかを判断する
  - 対象: `TODO.md`, 必要なら `CLAUDE.md`
  - 完了条件: 新しい risk TODO 追加時に、既存 tranche 回収、domain shard、acceptance criteria、発見方法の確認が実際に使えることを確認し、昇格判断を記録する
  - 検証: `pnpm markdownlint-cli2 TODO.md`, `git diff --check`; `CLAUDE.md` を触る場合は repo rule と重複しないか確認する
  - defer: ルール文言の細かい bikeshed は避け、実装投入を止めない粒度にする

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

- [ ] P2-C2f `P1-Q5a` query-cache first tranche brief を固定する
  - task id: `P1-Q5a`
  - domain shard: `query-cache`
  - write scope: query invalidation helper、add feed/delete feed hooks、feed/sidebar related focused tests
  - do-not-run-with: `P1-Q5b`, `P1-Q5c`, other query helper shape changes
  - worker prompt: add/delete feed 後の feed list、folder/sidebar、article list、account scoped query invalidation を matrix 化し、fire-and-forget failure が diagnostics に出る helper 経由へ寄せる
  - acceptance criteria: add feed success、delete feed success、delete selected feed、deleted account scope、invalidation reject の expected query owner が test で読める
  - focused tests: add/delete feed focused vitest、query invalidation helper test、必要なら sidebar/feed tree focused test
  - forbidden scope: query key normalization 全体、createMutation diagnostics redesign、provider sync completed owner へ広げない
  - handoff note: 先に現状の query key owner を短く inventory し、実装差分は helper と add/delete feed path に閉じる

- [ ] P2-C2g `P1-Q3a` release-native first tranche brief を固定する
  - task id: `P1-Q3a`
  - domain shard: `release-native`
  - write scope: release workflow static contract、Tauri config reference、updater release config gate、release repo contract tests
  - do-not-run-with: `P1-Q3c`, updater manifest/asset mapping rewrite、release workflow 大改修
  - worker prompt: release workflow が意図した Tauri config/updater config を必ず参照していることを static contract test で固定し、tag/release build で dev config が混入しない gate を作る
  - acceptance criteria: workflow path、config path、updater enabled/config usage、dev-only config exclusion が fixture ではなく実ファイル参照で検証される
  - focused tests: `pnpm exec vitest run tests/release-repo-contract.test.ts`
  - forbidden scope: SBOM/provenance、manifest checksum mapping、manual hotfix checklist、notarization 手順へ広げない
  - handoff note: 既存 release skill/PR gate と重複しないよう、テスト名は「どの config を使っているか」に寄せる

- [ ] P2-C2h `P2-QT1` quality-tooling first tranche brief を固定する
  - task id: `P2-QT1`
  - domain shard: `quality-tooling`
  - write scope: React Doctor runner/report handling、quality script output、failure diagnostics
  - do-not-run-with: `P2-QT3`, TODO parser/export format work、large mise task rewrite
  - worker prompt: React Doctor 系 script の失敗を stdout 文字列依存で握りつぶさず、exit code、stderr、missing command、timeout を structured diagnostics として返す
  - acceptance criteria: tool missing、non-zero exit、empty report、malformed report、timeout の扱いが fixture test で分かる
  - focused tests: quality script fixture tests、`mise run quality:react-doctor:diff` が存在する場合は dry run
  - forbidden scope: React 実装指摘の追加、TODO.md 大量追記、similarity script の redesign へ広げない
  - handoff note: まず script entrypoint と package/mise task の現物を inventory し、存在しない command は新設ではなく fallback 方針から決める

#### Ready-to-dispatch second tranche briefs

- [ ] P2-C2k `P1-Q1a` security-privacy second tranche brief を固定する
  - task id: `P1-Q1a`
  - domain shard: `security-privacy`
  - write scope: Rust sanitizer fixtures、saved article repair gate、article content focused tests
  - do-not-run-with: `P1-Q1b`, `P1-Q1c`, shared URL/XML fixture work
  - worker prompt: untrusted feed HTML、tracking media/link、壊れた markup、allowed tag/attr drift を sanitizer corpus にまとめ、policy drift 時の saved article repair/version gate を test で固定する
  - acceptance criteria: sanitizer accept/reject/redact、saved article repair trigger、frontend post-process privacy が同じ fixture corpus で説明できる
  - focused tests: sanitizer Rust tests、sync flow repair tests、article content/html focused vitest
  - forbidden scope: feed discovery URL guard、OPML XML boundary、reader UI redesign、DB restore UI へ広げない
  - handoff note: corpus の fixture directory/name を先に決め、policy 変更ではなく現状 contract の固定から始める

- [ ] P2-C2l `P1-Q1d` diagnostics second tranche brief を固定する
  - task id: `P1-Q1d`
  - domain shard: `security-privacy`
  - write scope: runtime diagnostics redaction、support copy helper、toast/log payload tests
  - do-not-run-with: provider auth redaction helper shape を変える `P1-Q2e` と shared redaction helper を同時編集しない
  - worker prompt: diagnostics/support copy/toast/log で URL token、server path、account name、raw payload が漏れないよう structured object redaction を固定する
  - acceptance criteria: string message、object payload、nested error、URL query/token、unknown payload の redaction expected が test で読める
  - focused tests: runtime diagnostics tests、toast/log helper tests、必要なら article content privacy tests
  - forbidden scope: telemetry/audit log 導入、provider HTTP policy、support bundle UI redesign へ広げない
  - handoff note: provider 固有 secret は `P1-Q2e` へ寄せ、ここでは runtime 汎用 redaction surface に閉じる

- [ ] P2-C2m `P1-Q2e` provider-sync second tranche brief を固定する
  - task id: `P1-Q2e`
  - domain shard: `provider-sync`
  - write scope: provider diagnostics redaction、auth token/server URL no-store checks、account settings focused tests
  - do-not-run-with: `P1-Q2a`〜`P1-Q2d`, scheduler/pending mutation behavior changes
  - worker prompt: provider auth token、cookie、server URL、username/account identifier が diagnostics/toast/log/support copy に raw で出ないことを contract 化する
  - acceptance criteria: auth failure、server URL validation failure、credential edit failure、sync diagnostics の raw secret/server URL redaction が test で確認できる
  - focused tests: provider diagnostics Rust/TS tests、account detail/settings focused tests、runtime diagnostics redaction test
  - forbidden scope: auth storm backoff、credential rotation pause、pending mutation quarantine、provider capability redesign へ広げない
  - handoff note: 汎用 redaction helper と衝突する場合は `P1-Q1d` の helper shape を確認してから最小 adapter にする

- [ ] P2-C2n `P2-R1` reader-state second tranche brief を固定する
  - task id: `P2-R1`
  - domain shard: `reader-state`
  - write scope: article list sourcePlan、data hook dependency key、article list/search focused tests
  - do-not-run-with: `P2-R2`, `P2-R3`, `P2-R4`, broad article list selection/search rewrites
  - worker prompt: article list の `sourcePlan` と data hook dependency を stable key 化し、同じ semantic query で不要 refetch せず、account/feed/search 変更時だけ正しく更新される contract を作る
  - acceptance criteria: same sourcePlan identity churn、account switch、feed switch、search query change、filter reset の expected fetch/cache behavior が test で読める
  - focused tests: article list hook tests、article list/search focused vitest、必要なら query key helper tests
  - forbidden scope: selection retention、virtualization、auto-mark read、reader layout/polish へ広げない
  - handoff note: stable key の shape は後続 `P2-R2`〜`P2-R4` が使う前提で、private helper と test fixture を小さく残す

- [ ] P2-C2o `P2-A11Y1` a11y-keyboard second tranche brief を固定する
  - task id: `P2-A11Y1`
  - domain shard: `a11y-keyboard`
  - write scope: dialog/popover/browser overlay top-layer stack、focus trap/inert/escape handling tests
  - do-not-run-with: `P2-A11Y4`, shortcut/menu event priority changes、large shared dialog redesign
  - worker prompt: dialog、popover、browser overlay が同時に出た時の top-layer order、focus trap、Escape、outside click、inert/aria-hidden を contract 化する
  - acceptance criteria: modal over popover、browser overlay over reader、Escape close order、Tab trap、background inert の expected behavior が test で読める
  - focused tests: settings modal/dialog tests、command palette/popover tests、browser overlay focused tests
  - forbidden scope: destructive dialog copy、roving focus、global shortcut/IME handling、visual redesign へ広げない
  - handoff note: 既存 component API を大きく変えず、top-layer の owner と close priority を helper/test で固定する

- [ ] P2-C2p `P2-S1` settings-state second tranche brief を固定する
  - task id: `P2-S1`
  - domain shard: `settings-state`
  - write scope: preferences store、preferences schema、language/theme runtime apply failure tests
  - do-not-run-with: `P2-S2`, form revision guard、settings dirty-state registry
  - worker prompt: preferences load と `setPref` optimistic update の race を request generation で latest-only にし、persist failure と runtime apply failure の rollback policy を key ごとに固定する
  - acceptance criteria: initial load failure、older save failure、latest save failure、runtime side effect failure、retry latest value の expected state/toast が test で読める
  - focused tests: `pnpm exec vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/schemas/preferences-schema-contract.test.ts`
  - forbidden scope: account credential forms、shortcut/tag/mute form dirty-state、settings modal close guard へ広げない
  - handoff note: `P2-S3` の data settings lifecycle と並列可だが、shared toast/diagnostics helper を触る場合は変更範囲を明記する

#### Blocked tranche unblock briefs

- [ ] P2-C2q `P1-Q2a` auth storm unblock audit を固定する
  - task id: `P1-Q2a`
  - domain shard: `provider-sync`
  - unblock scope: provider error classification、sync scheduler retry/backoff、account disabled/reauth state、既存 scheduler tests
  - audit prompt: 401/403/network/timeout/provider malformed response が scheduler でどう分類され、どこで retry が止まるかを code audit し、auth storm の再現 test plan へ落とす
  - unblock condition: auth failure の circuit breaker owner、retry ceiling、user-visible state、focused test target が決まる
  - do-not-run-with: `P1-Q2b`, `P1-Q2c`, scheduler/pending mutation behavior changes
  - output: 実装前 inventory、missing tests、最初の failing test 候補、defer する provider-specific policy

- [ ] P2-C2r `P1-Q2b` credential rotation unblock audit を固定する
  - task id: `P1-Q2b`
  - domain shard: `provider-sync`
  - unblock scope: account credential edit flow、sync scheduler pause/resume、pending mutation replay、account detail hooks
  - audit prompt: credential edit 中に sync/replay が走る経路、保存成功/失敗時の queue owner、古い credential での replay 再開条件を code audit する
  - unblock condition: edit revision、pause owner、resume trigger、pending mutation quarantine の test plan が決まる
  - do-not-run-with: `P1-Q2a`, `P1-Q2c`, account settings form revision rewrite
  - output: race diagram、対象 hook/command、focused test list、実装時に触らない UI scope

- [ ] P2-C2s `P1-Q2c` server URL/provider kind migration unblock audit を固定する
  - task id: `P1-Q2c`
  - domain shard: `provider-sync`
  - unblock scope: account server URL/provider kind edit、sync_state repository、pending mutation account/provider identity、settings validation
  - audit prompt: server URL または provider kind が変わった時に stale sync_state/pending mutation が残る経路を inventory し、quarantine/migration/delete の判断点を整理する
  - unblock condition: identity change の定義、既存 queue の扱い、rollback policy、repository focused test target が決まる
  - do-not-run-with: `P1-Q2a`, `P1-Q2b`, pending mutation schema rewrite
  - output: repository current behavior、unsafe transition list、migration policy options、first failing test 候補

- [ ] P2-C2t `P1-Q4a` DB migration/downgrade unblock audit を固定する
  - task id: `P1-Q4a`
  - domain shard: `db-recovery`
  - unblock scope: migration runner、schema_version/user_version、startup DB init、failed migration handling、downgrade install behavior
  - audit prompt: future schema、partial migration、failed migration、downgrade install がどの error surface に落ちるかを code audit し、recovery contract test plan へ落とす
  - unblock condition: startup blocking error、recoverable error、destructive recovery required の分類と test fixture が決まる
  - do-not-run-with: `P1-Q4b`, DB connection/migration refactor、settings destructive recovery UI
  - output: migration state matrix、fixture DB requirements、focused Rust test list、manual native verification 要否

- [ ] P2-C2u `P1-Q4b` backup/restore integrity unblock audit を固定する
  - task id: `P1-Q4b`
  - domain shard: `db-recovery`
  - unblock scope: backup command、restore command、SQLite integrity_check、WAL checkpoint、restore preview/error handling
  - audit prompt: backup/restore 前後にどの integrity/WAL/foreign key check が走るか、失敗時に DB と UI state がどう残るかを code audit する
  - unblock condition: preflight、post-restore validation、rollback/reopen policy、frontend reconciliation owner が決まる
  - do-not-run-with: `P1-Q4a`, `P1-Q4d`, DB recovery UI implementation
  - output: command current behavior、missing fixture DB、restore failure matrix、first focused test 候補

- [ ] P2-C2v `P1-Q1b` feed discovery URL boundary unblock fixture を固定する
  - task id: `P1-Q1b`
  - domain shard: `security-privacy`
  - unblock scope: feed discovery URL parser、redirect handling、private host detection、DNS/IDNA/IPv6 fixtures
  - audit prompt: initial URL、redirect URL、base-resolved URL の validation point を inventory し、fixture-only commit で private host/redirect boundary を固定する
  - unblock condition: shared URL validation helper の owner、fixture directory、network-free test strategy、redirect policy が決まる
  - do-not-run-with: `P1-Q1c`, sanitizer fixture reshaping、provider HTTP policy redesign
  - output: URL fixture list、current validation gaps、first test-only diff plan、defer する DNS rebinding live check

- [ ] P2-C2w `P1-Q1c` OPML XML boundary unblock fixture を固定する
  - task id: `P1-Q1c`
  - domain shard: `security-privacy`
  - unblock scope: OPML import/export parser、XML entity/DOCTYPE policy、private URL validation reuse、round-trip stable ordering
  - audit prompt: OPML import/export の XML parser options、entity expansion、deep nesting、URL validation、escaping/stable ordering を fixture-only commit で固定できる範囲に分ける
  - unblock condition: XML parser boundary、private URL helper reuse、round-trip fixture、large/deep OPML limit の test plan が決まる
  - do-not-run-with: `P1-Q1b`, feed discovery URL helper changes、OPML UI import redesign
  - output: OPML fixture list、parser option inventory、first failing/snapshot test candidate、defer する import UX scope

#### Independent docs / manual verification briefs

- [ ] P2-C2x `P1-Q3e` release hotfix/manual verification brief を固定する
  - task id: `P1-Q3e`
  - domain shard: `release-native`
  - write scope: release skill/docs、manual verification checklist、hotfix vs normal release decision table
  - do-not-run-with: large release workflow rewrite、updater manifest mapping implementation、marketing/release note copy rewrite
  - worker prompt: normal release と hotfix release の分岐、macOS notarization/quarantine、Windows SmartScreen、first-run permission prompts、updater smoke を短い manual checklist に分ける
  - acceptance criteria: normal release、hotfix、rollback/republish、manual native smoke の入口が分かれ、各項目に OS、期待結果、証跡ログ/screenshot 条件がある
  - verification: `pnpm markdownlint-cli2 TODO.md`, release docs lint、必要なら `rg -n "manual verification|hotfix|SmartScreen|quarantine" TODO.md docs .codex/skills`
  - forbidden scope: workflow YAML 実装、artifact signing/provenance 実装、release note 本文生成へ広げない
  - handoff note: `P1-Q3a`/`P1-Q3c` の static gate 実装前でも進められるが、実ファイル名や artifact 名を先取りしすぎない

- [ ] P2-C2y `P2-A11Y5` landmark/focus-visible baseline brief を固定する
  - task id: `P2-A11Y5`
  - domain shard: `a11y-keyboard`
  - write scope: reader/settings/subscriptions の landmark、focus visible、color-only status baseline、a11y smoke checklist
  - do-not-run-with: broad visual redesign、top-layer/focus trap implementation、component library replacement
  - worker prompt: reader、settings、subscriptions の主要画面で landmark、focus-visible、status text/color-only 表現を確認する baseline checklist を作り、実装修正が必要な箇所は別 task へ切り出す
  - acceptance criteria: 画面ごとに main/nav/aside/status の期待、keyboard focus visible、color-only status 禁止、manual/a11y smoke の確認方法がある
  - verification: markdownlint、focused a11y smoke があれば実行、なければ checklist review と `rg -n "landmark|focus visible|color-only|aria-live" TODO.md src`
  - forbidden scope: CSS 全面調整、dialog/popover focus trap、roving focus、shortcut/IME handling へ広げない
  - handoff note: 実装が必要な発見は `P2-A11Y1`〜`P2-A11Y4` か新規 focused task に寄せ、baseline brief 自体は短く保つ

- [ ] P2-C2z `P2-C5` TODO intake rule promotion brief を固定する
  - task id: `P2-C5`
  - domain shard: `quality-tooling`
  - write scope: `TODO.md` 冒頭の intake stop rules、必要なら `CLAUDE.md` / `.claude/rules` の短い rule link
  - do-not-run-with: large CLAUDE.md rewrite、new TODO大量追加、TODO parser/export implementation
  - worker prompt: first tranche を 1 件運用した後、TODO intake stop rules が日常ルールとして効いたかを確認し、CLAUDE.md へ昇格するか TODO.md 固有の運用メモに留めるか判断する
  - acceptance criteria: 昇格する場合は CLAUDE.md に短い原則だけ置き、詳細は TODO.md または `.claude/rules` へ逃がす。昇格しない場合は理由と次の再評価タイミングが残る
  - verification: `pnpm markdownlint-cli2 TODO.md`, `git diff --check`; CLAUDE.md を触る場合は `rg -n "TODO intake|risk TODO|contract test|runtime boundary" CLAUDE.md .claude/rules TODO.md`
  - forbidden scope: TODO の大量整理、既存 rule の再設計、agent workflow 全体の書き換えへ広げない
  - handoff note: この brief は実装と並列可だが、CLAUDE.md を触る場合は他 agent の rule 更新と競合しないことを先に確認する

#### Parallel dispatch wave plan

- [ ] P2-C2aa Wave 0 docs/checklist lane を先に投げる
  - queue: `P2-C2x`, `P2-C2y`
  - purpose: release manual verification と a11y baseline を、実装差分を先取りしない checklist として固める
  - parallel-safe: `P1-Q3a`, `P2-A11Y1`, quality-tooling 実装と並列可
  - do-not-run-with: large release workflow rewrite、broad visual redesign、CLAUDE.md 大改修
  - merge gate: markdownlint、diff check、docs/checklist が実ファイル名を過剰に固定していないこと

- [ ] P2-C2ab Wave 1 first implementation lane を 3 並列 + 1 単独で投げる
  - parallel group: `P2-C2g` (`P1-Q3a`), `P2-C2h` (`P2-QT1`), `P2-C2i` (`P2-QT2`)
  - solo group: `P2-C2f` (`P1-Q5a`) は query helper owner なので単独で先に merge する
  - optional group: `P2-C2j` (`P2-S3`) は DB command semantics に触らない前提なら parallel group と並列可
  - do-not-run-with: `P1-Q5a` と `P1-Q5b`/`P1-Q5c`; `P1-Q3a` と `P1-Q3c`; `P2-S3` と `P1-Q4d`
  - merge gate: 各 focused test、`pnpm markdownlint-cli2 TODO.md`, `git diff --check`; 2 件以上 merge した後に `mise run check`

- [ ] P2-C2ac Wave 2 second implementation lane を first merge 後に投げる
  - parallel group: `P2-C2n` (`P2-R1`) と `P2-C2p` (`P2-S1`) は並列可
  - conditional group: `P2-C2k` (`P1-Q1a`) は `P1-Q1b`/`P1-Q1c` unblock fixture と同時に走らせない
  - redaction group: `P2-C2l` (`P1-Q1d`) と `P2-C2m` (`P1-Q2e`) は shared redaction helper を同時編集しない。片方を先に helper owner として merge する
  - a11y group: `P2-C2o` (`P2-A11Y1`) は `P2-A11Y4` と同時投入しない。`P2-C2y` の baseline checklist 後に始める
  - merge gate: focused tests + `mise run check`; shared helper を追加した場合は owner を TODO または code comment で明確にする

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

#### Leaf TODO close passes

- [ ] P2-C3f `query-cache` leaf close pass を実行する
  - source workflow: `P2-C3a`
  - search command: `rg -n "query invalidation|query key|createMutation|createQuery|mute keyword invalidation|sync completed" TODO.md`
  - close rule: `P1-Q5a`〜`P1-Q5e` の acceptance criteria に既に含まれる leaf は `superseded by: P1-Q5x` を付け、検証観点だけ親へ移す。親に入らないものは `P2-C4c` か blocked audit に回す
  - keep rule: concrete file target、再現イベント列、focused test 名を持つ leaf は、親 tranche 実装まで残してよい
  - verification: query/cache leaf が親 tranche、blocked audit、residual focused test のどれかに分類されていることを検索で確認する

- [ ] P2-C3g `provider-sync` leaf close pass を実行する
  - source workflow: `P2-C3b`
  - search command: `rg -n "auth failure|credential rotation|server URL|provider capability|pending mutation|backoff|401|403|lockout" TODO.md`
  - close rule: auth storm は `P1-Q2a`、credential edit/replay は `P1-Q2b`、server URL/provider identity は `P1-Q2c`、capability は `P1-Q2d`、redaction/no-store は `P1-Q2e` へ `superseded by` で寄せる
  - keep rule: provider scheduler/pending mutation の current behavior inventory が未完了の leaf は `P2-C2q`〜`P2-C2s` の unblock audit 完了まで残す
  - verification: provider leaf が scheduler、credential editor、pending mutation、diagnostics redaction の owner を持つことを確認する

- [ ] P2-C3h `db-recovery` leaf close pass を実行する
  - source workflow: `P2-C3c`
  - search command: `rg -n "migration|downgrade|backup|restore|corruption|integrity_check|WAL|recovery|selected account|localStorage" TODO.md`
  - close rule: migration/downgrade は `P1-Q4a`、backup/restore integrity は `P1-Q4b`、runtime corruption は `P1-Q4c`、destructive action は `P1-Q4d`、frontend reconciliation は `P1-Q4e` へ寄せる
  - keep rule: DB encryption、uninstall retention、settings export/import、future data portability は recovery leaf から外し、privacy/docs design task として残す
  - verification: recovery leaf が Rust DB、settings data UI、frontend reconciliation のどの owner か読めることを確認する

- [ ] P2-C3i `runtime-diagnostics` leaf close pass を実行する
  - source workflow: `P2-C3d`
  - search command: `rg -n "diagnostics|redaction|toast|safeInvoke|unhandled rejection|support dump|log" TODO.md`
  - close rule: runtime generic redaction は `P1-Q1d`、provider auth/server URL は `P1-Q2e`、tool output failure は `P2-QT1`、support dump privacy decision は privacy/docs task へ寄せる
  - keep rule: user-facing recovery copy、audit log/telemetry 導入判断、support dump consent は diagnostics implementation leaf と混ぜず design decision として残す
  - verification: diagnostics leaf が runtime redaction、provider redaction、tooling diagnostics、support/privacy decision のどれかに分類されていることを確認する

- [ ] P2-C3j `focus/a11y/reader-state` leaf close pass を実行する
  - source workflow: `P2-C3e`
  - search command: `rg -n "focus|keyboard|shortcut|IME|roving|Escape|Tab|aria|inert|landmark|color-only" TODO.md`
  - close rule: stale reader focus/timer は `P2-R5`、top-layer/focus trap は `P2-A11Y1`、roving focus は `P2-A11Y3`、keyboard/IME は `P2-A11Y4`、landmark/focus-visible/color-only は `P2-A11Y5` へ寄せる
  - keep rule: visual regression、high contrast、long article virtualization、future browser geometry は a11y leaf と混ぜず residual/manual verification task として残す
  - verification: focus/a11y leaf が reader state、top-layer、roving、keyboard、baseline のいずれかに分類されていることを確認する

#### TODO state marker format

- [ ] P2-C3k `superseded by` marker format を固定する
  - format: `superseded by: <target-id> (<reason>; kept verification: <short test/viewpoint>)`
  - use when: leaf の問題意識が親 tranche の acceptance criteria に含まれ、実装前に leaf を消すと検証観点だけ失われる場合
  - example: `superseded by: P1-Q5a (covered by add/delete feed invalidation matrix; kept verification: delete selected feed)`
  - reject: target id なし、reason なし、検証観点なし、複数 target を曖昧に列挙する marker
  - verification: `rg -n "superseded by:" TODO.md` で target id と reason が読めること

- [ ] P2-C3l `completed by` marker format を固定する
  - format: `completed by: <commit-or-pr-or-brief-id> (<verification command/result>; follow-up: <id-or-none>)`
  - use when: task の実装または docs/checklist 反映が完了したが、CHANGELOG 移動前に TODO 上で追跡したい場合
  - example: `completed by: P2-C2g (pnpm exec vitest run tests/release-repo-contract.test.ts passed; follow-up: none)`
  - reject: verification なし、follow-up 判断なし、実装未完了なのに checkbox だけ更新する状態
  - verification: `rg -n "completed by:" TODO.md` で実行済み command/result が読めること

- [ ] P2-C3m `unblocked by` / `blocked-still` marker format を固定する
  - unblocked format: `unblocked by: <audit-brief-id> (<first implementation brief>; missing tests: <short list>)`
  - blocked format: `blocked-still: <reason> (next audit: <brief-id-or-none>; missing decision: <short decision>)`
  - use when: Wave 3 の unblock audit が終わり、implementation queue へ移すか blocked のまま残すか判断した場合
  - reject: audit output なしで blocked を外す、first failing test 候補なしで implementation へ移す、decision owner がない blocked-still
  - verification: `rg -n "unblocked by:|blocked-still:" TODO.md` で next action が読めること

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

- [ ] P2-C2au TODO 追記を止める saturation gate を固定する
  - stop condition: Wave 0〜4、handoff packet、integrator gate、marker format、Wave 1 readiness が揃っている場合、新規 risk TODO の追加を原則止める
  - allowed additions: 実装中に再現した bug、focused test で落ちた contract gap、manual native verification でしか見えない差分、既存 tranche に回収できない boundary decision
  - reject: 既存 tranche に回収できるリスクの再列挙、発見方法なしの P2/P3 追加、domain shard なしの大項目追加
  - output: 新規追加ではなく、既存 brief の acceptance criteria / verification / defer へ追記する判断を先に記録する
  - verification: `TODO intake stop rules` と `P2-C3f`〜`P2-C3n` の close pass を参照していること

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

- [ ] P2-C2ax TODO-only loop の終了報告 template を固定する
  - format: coverage percent、remaining TODO-only work、next implementation candidate、known dirty files、recommended command gates
  - use when: TODO 追記ループを止めて実装へ切り替える判断を user / other agent に渡す時
  - reject: 「まだありそう」だけで、残りの TODO-only work と実装候補が分かれない報告
  - output: `TODO.md` 追加は pause、Wave 1 implementation start、leaf close pass start、CLAUDE.md promotion wait のいずれかを明記する
  - verification: final report が `TODO.md` の current wave / gate と矛盾しないこと

#### First implementation candidate selection

- [ ] P2-C2ay Wave 1 first candidate は `P2-C2g` (`P1-Q3a`) から始める
  - reason: `tests/release-repo-contract.test.ts` が実在し、release-native static contract は query/cache や quality-tooling の既存 dirty 差分と衝突しにくい
  - expected files: `tests/release-repo-contract.test.ts`, `.github/workflows/release.yml`, `src-tauri/tauri*.conf.json` の contract 参照。実装時は必要最小限の test/helper 変更に留める
  - focused test: `pnpm exec vitest run tests/release-repo-contract.test.ts`
  - preflight: `.github/workflows/release.yml` に既存 dirty 差分がある場合は owner を確認し、unrelated なら実装候補を `P2-C2h` へ切り替える
  - fallback candidate: `P2-C2h` は quality tooling dirty 差分が別 owner でなければ避ける。`P2-C2i` は similarity dirty 差分が落ち着くまで待つ
  - handoff packet: `P2-C2ag` の fields を使い、changed files / tests run / helper owner / follow-up TODO id を必ず返す
  - switch gate: query/cache dirty 差分が解消するまで `P2-C2f` は始めない。data settings dirty 差分が出るまで `P2-C2j` は optional のままにする

- [ ] P2-C2az TODO-only loop はここで pause し、次は Wave 1 実装または leaf close pass に切り替える
  - current coverage: TODO 追記でできる投入準備は 95% 以上。残りは実装中の発見、marker 実適用、CLAUDE.md 昇格判断
  - next action: `P2-C2ay` の preflight が通れば `P1-Q3a` を実装する。通らなければ `P2-C3f`〜`P2-C3j` の leaf close pass を 1 domain だけ実行する
  - do-not-continue: 新しい risk TODO の大量追加、未分類 P2/P3 追加、Wave 1 readiness と無関係な設計メモ追加
  - report template: coverage percent、selected candidate、known dirty files、go/no-go reason、next command を短く返す
  - verification: `pnpm markdownlint-cli2 TODO.md`, `git diff --check`, `git status --short`

### 先行実装 queue

- [ ] P1-Q1 Security / Privacy fixture corpus gate
  - 目的: untrusted feed HTML、private host URL、XML entity、secret-bearing URL、backup/export privacy を同じ fixture corpus で固定する
  - worker prompt: sanitizer/feed discovery/OPML/export/log redaction の fixture を作り、成功系追加ではなく reject/redact/diagnostics の contract test を先に増やす
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/commands/opml_commands.rs`, `src/lib/runtime/diagnostics.ts`, article content tests
  - 禁止: UI 表示変更、DB restore UI、release signing、future notification/tray/deep link へ広げない
  - 検証: sanitizer/feed discovery/OPML focused tests、`pnpm exec vitest run src/__tests__/components/article-content-view.test.tsx`

#### P1-Q1 実装 tranche

- [ ] P1-Q1a sanitizer fixture corpus と saved article repair gate を作る
  - worker prompt: untrusted feed HTML、tracking link/media、壊れた markup、allowed tag/attr drift を fixture 化し、sanitizer policy 変更時に version bump / repair path を要求する gate を作る
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`, article content tests
  - 完了条件: sanitizer dependency/policy drift、保存済み article repair、frontend post-process の privacy policy が同じ corpus で説明できる
  - 検証: sanitizer Rust tests、sync flow repair tests、`pnpm exec vitest run src/__tests__/components/article-content-view.test.tsx src/__tests__/lib/html.test.ts`
  - supersedes: `P1 Rust sanitizer version bump と saved article repair の release gate を作る`, `P3 content sanitizer fixtures を web-platform-ish corpus として追加する`

- [ ] P1-Q1b feed discovery SSRF / redirect / private host guard を URL corpus 化する
  - worker prompt: IDNA、punycode、IPv4-mapped IPv6、IPv6 zone identifier、DNS rebinding、redirect 後 private host、`<base>` href を shared URL validation fixture で固定する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, provider HTTP URL validation helpers, feed discovery tests
  - 完了条件: initial URL、redirect URL、base-resolved feed URL の private host policy が同じ helper と fixture を使う
  - 検証: feed discovery Rust tests、URL schema/private host fixture tests
  - supersedes: `P1 feed discovery SSRF guard を DNS rebinding / redirect / base tag で再検証する`, `P1 feed fetch redirect policy を cross-scheme / private host / loop で固定する`

- [ ] P1-Q1c OPML import/export の private URL / XML entity / escaping boundary を固定する
  - worker prompt: OPML import URL validation を discovery と同じ private host policy に寄せ、XML entity/DOCTYPE/deep nesting/escaping/stable ordering を import/export round-trip fixture で固定する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`, OPML import/export tests
  - 完了条件: RSS/Atom/OPML の XML entity expansion policy、OPML private URL reject、export escaping/stable ordering が同じ fixture directory で検証できる
  - 検証: OPML Rust tests、import/export round-trip fixtures、large/deep OPML fixture tests
  - supersedes: `P1 OPML import URL validation を discovery URL validation と同じ private host policy に寄せる`, `P1 XML entity expansion / external entity policy を feed parser boundary で固定する`

- [ ] P1-Q1e reader content link/image privacy と tooltip/title redaction を同期する
  - worker prompt: article content links/images、thumbnail URL、external opener、tooltip/title attribute が sanitizer media/link policy と同じ redaction/private host/userinfo policy を使うようにする
  - 対象: `src/components/reader/article-content-view.tsx`, `src/lib/content/html.ts`, feed URL/account detail tooltip surfaces
  - 完了条件: link opener、image loading、thumbnail display、tooltip/title、copy action のすべてで secret-bearing URL と private host URL の表示/遷移 policy が揃う
  - 検証: `pnpm exec vitest run src/__tests__/components/article-content-view.test.tsx src/__tests__/lib/html.test.ts`, tooltip/redaction focused tests
  - supersedes: `P1 reader content privacy policy の frontend post-process を sanitizer contract と同期する`, `P2 tooltip / title attribute に secret or full URL を出さない privacy contract を作る`

- [ ] P1-Q2 Provider auth storm / credential rotation safety
  - 目的: 壊れた credential や server URL 変更中に auto sync / pending mutation replay が走り続ける事故を止める
  - worker prompt: provider auth failure storm、credential edit pending、capability downgrade、server URL change を sync scheduler と queue contract で固定する
  - 対象: `src-tauri/src/infra/provider`, `src-tauri/src/service/sync_scheduler.rs`, account commands/settings、pending mutation repository
  - 禁止: provider kind 追加、UI redesign、per-domain crawl politeness へ広げない
  - 検証: provider Rust tests、sync scheduler focused tests、account settings/account detail focused tests

#### P1-Q2 実装 tranche

- [ ] P1-Q2a auth failure storm を backoff / circuit breaker で止める
  - worker prompt: repeated 401/403、invalid credential、manual retry、credential update reset を provider と sync scheduler の contract として固定し、auth failure が account lockout を誘発しないようにする
  - 対象: `src-tauri/src/infra/provider/greader.rs`, `src-tauri/src/infra/provider/traits.rs`, `src-tauri/src/service/sync_scheduler.rs`
  - 完了条件: auto sync は auth storm を止め、manual retry と credential 更新後の retry は明示的に再開できる
  - 検証: provider Rust tests、sync scheduler focused tests
  - supersedes: `P1 provider auth failure storm が account lockout を誘発しないよう backoff/circuit breaker を固定する`

- [ ] P1-Q2b credential rotation 中の sync / pending mutation replay を一時停止する
  - worker prompt: account credentials editor の draft/save pending と scheduler/replay を接続し、古い credential で sync や pending mutation push が走らないようにする
  - 対象: `src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts`, `src-tauri/src/service/sync_scheduler.rs`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - 完了条件: edit started、save pending、save success、save failure rollback、manual sync blocked の状態が test で固定される
  - 検証: `pnpm exec vitest run src/__tests__/hooks/use-account-detail-credentials-editor.test.tsx src/__tests__/hooks/use-account-detail-sync-controls.test.tsx`, pending mutation Rust tests
  - supersedes: `P1 account credential rotation 中の sync/pending mutation を一時停止する contract を作る`

- [ ] P1-Q2c account server URL / provider kind change 時に sync_state と pending mutation を quarantine する
  - worker prompt: server URL や provider kind を変更した account に古い cursor/backoff/pending mutation が残らないよう、clear/quarantine/reset の contract を account command で固定する
  - 対象: `src-tauri/src/commands/account_commands.rs`, `src-tauri/src/infra/db/sqlite_account.rs`, `src-tauri/src/infra/db/sqlite_pending_mutation.rs`
  - 完了条件: server URL changed、provider kind changed、cursor cleared、pending mutation cleared/quarantined、backoff reset が同じ integration test で説明できる
  - 検証: account command Rust tests、pending mutation repository tests、account detail focused tests
  - supersedes: `P2 account/server URL change 時の existing sync_state / pending mutation migration policy を決める`

- [ ] P1-Q2d provider capability downgrade を UI action と pending mutation queue に反映する
  - worker prompt: provider capability が read/star/tag/pending mutation support を失った時、settings/reader action と queued mutation が stale capability 前提で残らないようにする
  - 対象: `src-tauri/src/domain/provider.rs`, `src-tauri/src/infra/provider/traits.rs`, `src-tauri/src/repository/pending_mutation.rs`, account detail settings
  - 完了条件: capability removed、queued mutation exists、UI disables action、sync warning、manual cleanup の policy が固定される
  - 検証: provider trait tests、pending mutation tests、account detail/action availability focused tests
  - supersedes: `P2 provider capability downgrade を account settings / pending mutation queue と同期する`

- [ ] P1-Q3 Release artifact provenance / dev-only contamination gate
  - 目的: release asset、manifest、checksum、platform mapping、debug-only config の drift を static contract で止める
  - worker prompt: release workflow と Tauri config から release artifact mapping を抽出し、MCP bridge/dev mock/dev credential が production artifact に混入しない gate を作る
  - 対象: `.github/workflows/release.yml`, `tests/release-repo-contract.test.ts`, `src-tauri/tauri*.conf.json`, release docs
  - 禁止: notarization/SmartScreen/manual installer UX をこの worker で実装しない
  - 検証: `pnpm exec vitest run tests/release-repo-contract.test.ts`, workflow static contract、必要なら `mise run ci`

#### P1-Q3 実装 tranche

- [ ] P1-Q3b release artifact provenance を tag / workflow / checksum / SBOM で固定する
  - worker prompt: tag SHA、workflow run id、source commit、artifact checksum、JS/Rust dependency provenance、draft release attachment の contract を追加する
  - 対象: `.github/workflows/release.yml`, `package.json`, `src-tauri/Cargo.lock`, release docs
  - 完了条件: どの commit からどの artifact を作ったか、checksum/SBOM/provenance を release 後に追跡できる
  - 検証: release workflow static contract、release manual verification docs、必要なら `mise run ci`
  - supersedes: `P1 release artifact SBOM / provenance / checksum を生成・検証する gate を作る`, `P2 release artifact provenance を PR / tag / workflow run の三点で照合する`

- [ ] P1-Q3c updater manifest と release asset の signature / checksum / platform mapping を双方向検証する
  - worker prompt: latest.json/updater manifest が macOS arm64、Windows x64、Linux future scope の asset filename、signature sidecar、checksum、platform mapping と一致することを contract 化する
  - 対象: release workflow、updater manifest generation、`tests/release-repo-contract.test.ts`, release manual verification
  - 完了条件: manifest が別 arch/別 asset/欠落 signature を指す場合に CI または manual checklist で止まる
  - 検証: release repo contract、updater config schema tests、manual verification checklist
  - supersedes: `P1 updater manifest と release asset の signature / checksum / platform mapping を双方向検証する`, `P2 release workflow matrix artifact naming を platform/arch/signature で固定する`

- [ ] P1-Q3d release build の dev-only contamination gate を作る
  - worker prompt: `DEV_CREDENTIALS`、dev mocks、debug scenario、MCP bridge plugin、dev-only capability/config が production artifact に混入しない static/smoke gate を追加する
  - 対象: `src-tauri/src/lib.rs`, `src/dev`, `scripts/lib/windows-dispatch.ts`, Tauri release config, release contract tests
  - 完了条件: release build excludes bridge/dev mock/debug scenario が test で見え、debug build との差分が意図的に説明できる
  - 検証: repo contract tests、release smoke、必要なら native build smoke
  - supersedes: `P1 release build で DEV_CREDENTIALS / dev mock / debug scenario が有効化されない gate を作る`, `P1 release build に debug-only MCP bridge plugin が混入しない repo contract を追加する`

- [ ] P1-Q3e release hotfix / manual verification checklist を normal release と分ける
  - worker prompt: security hotfix、data corruption hotfix、minimum CI gates、manual smoke、rollback/downgrade note、notarization/SmartScreen/quarantine first-run check を通常 release と別 checklist にする
  - 対象: release skill/docs、`.github/workflows/release.yml`, CHANGELOG/release note docs、manual verification docs
  - 完了条件: hotfix でも落とせない gate と、manual にしか見えない OS packaging check が明確に分かれる
  - 検証: docs/release checklist review、release repo contract、manual verification dry run
  - supersedes: `P2 release hotfix flow を normal release と別 checklist にする`, `P2 release artifact notarization / quarantine behavior を macOS manual verification に入れる`, `P2 Windows installer code signing / SmartScreen reputation の manual verification を追加する`

- [ ] P1-Q4 DB migration / runtime corruption recovery contract
  - 目的: failed migration、downgrade、startup 後 corruption、restore 後 stale cache を recovery state として扱う
  - worker prompt: DB migration/runtime DB error を user-visible recovery category に分類し、destructive recovery は dry-run / confirmation 基準を先に固定する
  - 対象: `src-tauri/src/infra/db/migration.rs`, DB commands、startup DB error handling、settings data page
  - 禁止: DB encryption、uninstall retention、settings export/import の将来機能へ広げない
  - 検証: migration integration tests、database command tests、settings data focused tests

#### P1-Q4 実装 tranche

- [ ] P1-Q4c startup 後に検出した DB corruption を runtime recovery surface へ出す
  - worker prompt: 起動時は通ったが repository read/write で corruption を検出した場合に、単なる command error ではなく read-only degraded mode、integrity check action、backup restore suggestion へ分類する
  - 対象: repository error handling、`src-tauri/src/commands/database_commands.rs`, settings data page、runtime diagnostics
  - 完了条件: read corruption、write corruption、DB lock failure、permission denied、disk full が recovery category と user action に変換される
  - 検証: repository/database command tests、settings data focused tests、runtime diagnostics tests
  - supersedes: `P1 DB corruption detected after startup success の runtime recovery surface を設計する`, `P1 startup database init panic を recoverable startup error UI へ寄せる`

- [ ] P1-Q4e DB restore 後の query cache / localStorage / selected account reconciliation を固定する
  - worker prompt: restore 後に query cache、localStorage、selected account preference、expanded folder ids、command history が古い DB を参照しないよう reconciliation contract を作る
  - 対象: query client、`src/lib/account/account-selection.ts`, `src/schemas/storage.ts`, settings data restore flow
  - 完了条件: selected account missing、expanded folder missing、query cache clear、command history cleanup、restart required の policy が test で固定される
  - 検証: `pnpm exec vitest run src/__tests__/lib/account-selection.test.ts src/__tests__/schemas/storage.test.ts src/__tests__/components/use-data-settings-controller.test.ts`
  - supersedes: `P2 DB restore 後の query cache / localStorage / selected account reconciliation を固定する`, `P2 private data reset order を credentials / DB / localStorage / query cache で固定する`

- [ ] P1-Q5 Query invalidation owner / diagnostics unification
  - 目的: mutation 後の cache stale と fire-and-forget invalidation failure を owner 別 diagnostics に寄せる
  - worker prompt: add/delete feed、tag update、article read/star、mute keyword、sync completed を query key helper 経由に寄せ、account scope/all account/deleted account の失敗を分類する
  - 対象: `src/lib/query`, `src/hooks`, reader feed/tag/article mutation hooks
  - 禁止: reader selection/search stale state、settings dirty-state、query UI redesign へ広げない
  - 検証: add feed/delete feed/tag update/article read-star/mute keyword/sync completed の focused vitest

#### P1-Q5 実装 tranche

- [ ] P1-Q5b createMutation invalidation diagnostics に owner/query key を載せる
  - worker prompt: mutation 成功後の invalidation rejection を mutation 本体の失敗と混ぜず、owner、query key、toast/no-toast、strict/log-only を診断できる形にする
  - 対象: `src/hooks/create-mutation.ts`, `src/lib/query/query-invalidation.ts`, `src/lib/runtime/diagnostics.ts`
  - 完了条件: invalidation が失敗しても mutation result と diagnostics の責務が分かれ、どの owner が壊れたか test で読める
  - 検証: `pnpm exec vitest run src/__tests__/hooks/create-mutation.test.tsx src/__tests__/lib/query-invalidation.test.ts`
  - supersedes: `P2 createMutation invalidation failure diagnostics に owner/query key を含める`

- [ ] P1-Q5d mute/tag/article mutation invalidation matrix を固定する
  - worker prompt: mute keyword create/update/delete、tag update、article read/star の invalidation 範囲を matrix 化し、visible list、search result、tag count、unread count がずれないことを focused test で固定する
  - 対象: `src/hooks/use-mute-keywords.ts`, `src/hooks/use-tags.ts`, `src/hooks/use-articles.ts`, `src/lib/query/query-invalidation.ts`
  - 完了条件: folder view、tag view、search active、old unread view、auto-mark-read on/off の invalidation target が明示される
  - 検証: `pnpm exec vitest run src/__tests__/hooks/use-mute-keywords.test.tsx src/__tests__/hooks/use-tags.test.tsx src/__tests__/lib/query-invalidation.test.ts`
  - supersedes: `P2 mute keyword invalidation が article/tag count/search result まで届くか matrix 化する`

- [ ] P1-Q5e sync completed invalidation owner を manual/background sync で分ける
  - worker prompt: manual sync、startup/sync-on-wake、background scheduler completion の invalidation owner を分け、toast owner と diagnostics owner が混ざらないようにする
  - 対象: `src/lib/sync/manual-sync.ts`, `src/components/reader/hooks/sidebar/use-sidebar-sync.ts`, `src/lib/query/query-invalidation.ts`
  - 完了条件: account switch during sync、delete during sync、partial failure、event emit failure で stale query と user feedback が分かれる
  - 検証: `pnpm exec vitest run src/__tests__/lib/manual-sync.test.ts src/__tests__/hooks/use-sidebar-sync.test.ts src/__tests__/lib/query-invalidation.test.ts`
  - supersedes: sync completed / sidebar sync / account status invalidation 系の leaf TODO

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

- [ ] P1 sync-on-wake の visibilitychange listener を account snapshot / stale promise で固定する
  - 対象: `src/App.tsx`, `src/hooks/use-sidebar-sync.ts`, `src/lib/sync/startup-sync-storage.ts`
  - `visibilitychange` から sync-on-wake を fire-and-forget で起動しており、account list 更新や app unmount 後の late rejection が current UI state とずれやすい
  - hidden->visible 連打、account削除後の復帰、sync中の再復帰、late reject、listener cleanup の app test を追加する

### App Shell / Command Palette / Dev Intent

- [ ] P2 app shell lazy preload retry timer を route/session generation で guard する
  - 対象: `src/components/app-shell.tsx`, `src/__tests__/components/app-shell.test.tsx`
  - settings modal preload の失敗後に retry timer を持つため、modal close、component unmount、別 lazy chunk failure 後に古い retry が走る可能性がある
  - preload failure、retry success、unmount before retry、settings close/open、multiple lazy boundary failure の test を追加する

- [ ] P2 SettingsModalBoundary / LazyChunkBoundary error recovery を user action と telemetry に分ける
  - 対象: `src/components/app-shell.tsx`, `src/components/settings/settings-modal-view.tsx`
  - lazy chunk error は console.error と closeSettings に寄っており、user が再オープンできる状態か、diagnostics へ残すべき状態かが曖昧になっている
  - render throw、dynamic import reject、retry after close、settings state reset、toast/diagnostics 方針を固定する

- [ ] P2 Debug HUD copy failure を clipboard runtime category と統合する
  - 対象: `src/components/app-shell.tsx`, `src/lib/runtime/clipboard.ts`, `src/components/debug/*`
  - Debug HUD copy は独自 onError と console.error を持つため、article copy / share command と error category がずれると diagnostics 調査が分断される
  - invalid payload、large trace、clipboard unavailable、permission denied、sensitive target redaction の component test を追加する

- [ ] P2 dev scenario runner の fire-and-forget window resize / preview state を cancellation-aware にする
  - 対象: `src/dev/scenarios/helpers.ts`, `src/dev/use-dev-intent.ts`, `src/dev/scenarios/runner.ts`
  - dev scenario は `void applyDevWindowSize` や delayed preview state を持ち、scenario切替や app unmount 後に古い state を適用しやすい
  - scenario generation、window resize failure、delayed preview cancel、runner action error、toast dedupe の dev test を追加する

### Reader UI / Account Settings

- [ ] P2 add feed dialog invalidation list を query key helper へ寄せる
  - 対象: `src/__tests__/hooks/use-add-feed-dialog-actions.test.tsx`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`, `src/lib/query/query-invalidation.ts`
  - add feed 後に複数 query key を個別 invalidation しており、新しい reader query が増えると片方だけ stale になりやすい
  - feeds/search/articles/tag counts/account summaries の invalidation helper を作り、failure aggregation と toast の順序を固定する
  - superseded by: P1-Q5a (covered by add/delete feed invalidation matrix; kept verification: add feed dialog invalidation list and failure aggregation)

- [ ] P2 delete feed callback failure を mutation result と user-visible failure に分ける
  - 対象: `src/hooks/use-delete-feed.ts`, `src/__tests__/hooks/use-delete-feed.test.tsx`, `src/components/reader/feed-context-menu.tsx`
  - delete 自体の成功後に optional callback が throw した場合、mutation failure と UI cleanup failure のどちらとして扱うかが曖昧になっている
  - onSuccess throw、onError throw、invalidation reject、delete reject、dialog close callback の result contract を固定する

- [ ] P2 article auto-mark read timer を view mode / account switch / mutation callback ordering で固定する
  - 対象: `src/components/reader/hooks/article/use-article-auto-mark.ts`, `src/__tests__/hooks/use-article-auto-mark.test.tsx`
  - delayed auto-mark は timer、mutation callbacks、view mode を跨ぐため、article切替や account切替後に古い mutation callback が rollback を上書きしやすい
  - stale view mode、article switch、account switch、timer unavailable、onError ordering、multiple pending timers の test を追加する

### Dev / Tooling / E2E / Test Helpers

- [ ] P2 story-tauri-runtime と dev mocks の global descriptor install/restore を共通化する
  - 対象: `src/components/storybook/story-tauri-runtime.ts`, `src/dev/mocks.ts`, `tests/helpers/tauri-runtime.ts`
  - `window.__TAURI_INTERNALS__` や dev mock globals の Object.defineProperty が Storybook/dev/test に分散しており、restore漏れや descriptor 差で runtime 判定が壊れやすい
  - install/restore helper、existing descriptor preservation、readonly descriptor、partial mock、double install の test を追加する

- [ ] P2 resolved dev intent loader の late result を current intent generation で guard する
  - 対象: `src/dev/use-resolved-dev-intent.ts`, `src/dev/use-dev-intent.ts`, `src/dev/intent.ts`
  - runtime dev options load が fire-and-forget で走るため、URL intent や env intent が切り替わった後に古い load result が現在 state へ混ざる可能性がある
  - rapid intent change、load failure、unmount、delayed scenario run、toast dedupe の hook test を追加する

- [ ] P2 dev intent parser の Result.unwrap usage を malformed runtime option の failure surface にする
  - 対象: `src/dev/intent.ts`, `src/dev/use-resolved-dev-intent.ts`, `src/__tests__/dev/intent.test.ts`
  - dev intent parser は Result.unwrap を複数使っており、parse済み前提が崩れた時に dev-only console warning なのか scenario skip なのか分かりにくい
  - malformed JSON、unknown scenario、invalid window size、runtime options unavailable、partial option の Result surface を固定する

- [ ] P2 Storybook index payload parser の URL id extraction を malformed iframe URL で固定する
  - 対象: `e2e/storybook/storybook-index-payload.ts`, `src/__tests__/components/storybook-explorer-organization.test.ts`
  - Storybook index helper は iframe URL の id query を必須にしており、Storybook 側の payload形式変更で organization test が壊れた時に原因が分かりにくい
  - missing id、empty id、duplicate id、encoded id、non-string story fields、Storybook version drift の helper test を追加する

- [ ] P2 E2E runtime error guard が expected console.error と real regression を分けられるようにする
  - 対象: `e2e/helpers/runtime-error-guard.spec.ts`, `e2e/app.spec.ts`, `tests/helpers/app-error.ts`
  - pageerror / console.error を拾う guard は有用だが、意図的 error fixture と本物の runtime regression が混ざると E2E failure の triage が遅れる
  - allowlist scope、test-local expected error、unhandled rejection、console.warn扱い、screenshot添付の policy を追加する

- [ ] P2 measurable box helper の zero-size diagnostics を locator / viewport 情報付きにする
  - 対象: `e2e/helpers/measurable-box.ts`, `e2e/storybook/update-toast.spec.ts`, `e2e/app.spec.ts`
  - measurable box assertion は UI overlap / invisible state を検出する一方、failure message が対象 locator や viewport を持たないと再現に時間がかかる
  - locator label、viewport、boundingBox null、zero width/height、detached element の diagnostics を追加する

- [ ] P2 Tauri mocks の unhandled command failure を schema coverage と接続する
  - 対象: `tests/helpers/tauri-mocks.ts`, `tests/helpers/tauri-mocks.test.ts`, `src/api/schemas/commands.ts`
  - mock command 未実装時は `Unhandled Tauri mock command` で落ちるが、schema coverage / Rust command registry と同期しないと test helper だけ古くなる
  - missing mock、extra mock、schema missing、null response command、Result error response の contract test を追加する

- [ ] P2 app-error test helper を user-visible / retryable / diagnostics categories へ広げる
  - 対象: `tests/helpers/app-error.ts`, `src/lib/ui-errors.ts`, `src/api/tauri-commands.ts`
  - helper は UserVisible / Retryable だけを期待しており、diagnostics-only や validation category が増えると各 test が ad hoc assertion になりやすい
  - user-visible、retryable、diagnostics-only、validation、runtime-unavailable の helperを揃える

- [ ] P3 release repo contract test の TOML parser を multiline / quoted value に強くする
  - 対象: `tests/release-repo-contract.test.ts`, `mise.toml`, `.github/workflows/*`
  - release contract test が簡易文字列抽出に寄ると、mise task や workflow の書式変更だけで false positive / false negative が出やすい
  - multiline task、quoted string、missing pnpm cache、workflow name変更、Node version drift の fixture test を追加する

- [ ] P3 fixture negative type tests を compile-time smoke gate として切り出す
  - 対象: `tests/helpers/fixtures.test.ts`, `tests/helpers/render-story.test.tsx`, `tsconfig.json`
  - `ts-expect-error` を runtime test 内に置くと、型 contract なのか runtime behavior なのか読み取りにくい
  - type-only smoke test、runtime fixture test、legacy escape の配置を分け、不要になった suppression を検出しやすくする

### Rust Provider / DB / Scheduler

- [ ] P3 repository fixture builder を account/feed/article/tag ごとに最小化する
  - 対象: `src-tauri/tests`, `src-tauri/src/infra/db/*_test.rs`
  - DB test fixture が ad hoc に増えると、account id や remote id、sort_order、timestamps の前提がテストごとに揺れて regression の原因を追いにくい
  - account/feed/article/tag/pending mutation の最小 fixture builder と、明示的に壊れた row を作る corruption helper を分ける

### Query / Store / Browser Runtime

- [ ] P2 global action dispatcher の fire-and-forget error を action category 別 diagnostics に揃える
  - 対象: `src/lib/actions.ts`, `src/lib/runtime/diagnostics.ts`, `src/__tests__/lib/actions.test.ts`
  - `executeAction` は updater/browser/sync/window 操作を `void` で起動する箇所が多く、console.error だけだと native menu 起点の失敗が後から追いにくい
  - `sync-all`、`reload-webview`、`mouse-back`、`check-for-updates`、`toggle-fullscreen` の failure category と toast 有無を固定する

- [ ] P2 manual sync cooldown を wall-clock drift / trigger failure / subscriber cleanup で固定する
  - 対象: `src/lib/sync/manual-sync.ts`, `src/hooks/use-sidebar-sync.ts`, `src/__tests__/lib/manual-sync.test.ts`
  - cooldown は module-level timer と listener set を持つため、OS sleep、clock rollback、subscriber throw、test reset 漏れで UI の sync button state がずれやすい
  - clock rollback、sleep 復帰、Retryable failure、UserVisible failure、listener throw、unsubscribe during emit の test を追加する

- [ ] P2 updater download session と toast action の stale session guard を強化する
  - 対象: `src/hooks/use-updater.ts`, `src/api/schemas/update-info.ts`, `src/__tests__/hooks/use-updater.test.tsx`
  - update download は module-level `downloadInFlight` と `activeDownloadSessionId` に依存するため、古い progress/ready event や manual retry が現在 toast を上書きしやすい
  - stale session progress、ready before progress、download failure then retry、restart failure、listener dispose 後 event の hook test を追加する

- [ ] P2 updater startup check と manual check の shared in-flight result を caller 別 feedback に分ける
  - 対象: `src/hooks/use-updater.ts`, `src/lib/actions.ts`, `src/__tests__/hooks/use-updater.test.tsx`
  - startup check は silent failure、manual check は toast failure だが、同じ `checkInFlight` を共有するため、どちらの caller が結果を受け取るかで feedback が揺れやすい
  - startup+manual concurrent、manual+manual concurrent、startup failure、manual cancellation、runtime unavailable の test を追加する

- [ ] P2 reader focus retry generation を account/article switch と unmount cleanup で検証する
  - 対象: `src/lib/reader-focus.ts`, `src/components/reader/hooks/article-list/use-article-list-navigation.ts`, `src/__tests__/lib/reader-focus.test.ts`
  - focus retry は module-level generation と timeout を使うため、article switch や account switch 後に古い retry が別 row を focus する可能性がある
  - selected article deleted、account switch、sidebar smart view switch、unmount cleanup、requestAnimationFrame throw の test を追加する

- [ ] P2 window event binding cleanup を partial registration failure / duplicate binding で固定する
  - 対象: `src/lib/window/window-events.ts`, `src/hooks/use-keyboard.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - 複数 event listener をまとめて登録する helper は途中失敗時に cleanup するが、duplicate binding や remove failure の挙動が contract 化されていない
  - addEventListener throw、removeEventListener throw、duplicate listener、capture option mismatch、cleanup twice の test を追加する

- [ ] P2 browser webview bounds sync の listener-ready timeout と ResizeObserver storm を latest-only にする
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts`, `src/components/reader/hooks/browser/use-browser-webview-sync.ts`
  - listener ready 待ち、resize event、ResizeObserver が並ぶと、古い URL の resize が現在 URL の native webview に適用される可能性がある
  - listener timeout、rapid resize、URL switch during wait、ResizeObserver unavailable、cleanup after reject の hook test を追加する

- [ ] P2 browser webview focus-after-create failure を state applied / surface failure に分ける
  - 対象: `src/components/reader/hooks/browser/use-browser-webview-sync.ts`, `src/components/reader/browser-webview-state.ts`
  - create 成功後に focus だけ失敗した場合、browser state は適用済みなのに surface failure を出すため、retry/close の UX が不明瞭になりやすい
  - create success + focus failure、missing webview after focus、state apply skipped、pending bounds flush failure の contract test を追加する

- [ ] P2 subscriptions index の review clock interval を page visibility / fake timer contract にする
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/subscriptions/subscription-review-candidates.ts`
  - 1時間 interval で review status を更新するため、長時間 sleep 復帰や background tab で stale review labels が残りやすい
  - sleep 復帰、visibilitychange、fake timer、unmount cleanup、timezone/day boundary の component test を追加する

- [ ] P2 subscriptions index delete dialog の selected account/feed drift を mutation result と揃える
  - 対象: `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/hooks/use-delete-feed.ts`
  - delete dialog を開いた後に account switch や feed list refetch が入ると、dialog target と current rows の整合性が崩れやすい
  - account switch while dialog open、feed deleted by refetch、delete pending中の close、mutation success後の selected row restore をテストする

- [ ] P2 subscriptions index return state の account scope と scroll restore を schema 化する
  - 対象: `src/lib/subscriptions/subscriptions-workspace.types.ts`, `src/components/subscriptions-index/use-subscriptions-index-state.ts`, `src/stores/ui-store.ts`
  - return state は account id、selected feed、expanded groups、scrollTop を含むため、別 account に復帰した時の discard/restore ルールがずれやすい
  - account mismatch、deleted feed、collapsed group、negative scrollTop、large scrollTop、empty kept/deferred ids の test を追加する

- [ ] P2 UI store toast timer と persistent toast の競合を update/dialog toast で固定する
  - 対象: `src/stores/ui-store.ts`, `src/components/app-shell.tsx`, `src/hooks/use-updater.ts`
  - toast は module-level timer を持つため、persistent update toast と通常 toast が連続すると auto dismiss timer が古い toast を消す可能性がある
  - persistent toast後の通常 toast、通常 toast後のpersistent toast、clearToast、action click、store reset の test を追加する

- [ ] P2 UI store `handleAccountDeleted` の settings/account setup/browser state cleanup を contract 化する
  - 対象: `src/stores/ui-store.ts`, `src/components/settings`, `src/components/reader/hooks/browser`
  - account delete 時に selected account、settings detail、account setup session、browser state を同時に更新するため、どれかだけ古い account を参照しやすい
  - selected account delete、settings account delete、setup session account delete、browser open account delete、remaining account fallback の store test を追加する

- [ ] P2 preferences store の latest-only persist failure と optimistic UI rollback 方針を明文化する
  - 対象: `src/stores/preferences-store.ts`, `src/schemas/preferences.ts`, `src/__tests__/stores/preferences-store.test.ts`
  - preference save は optimistic UI を維持しつつ latest failure のみ toast するため、古い失敗を無視する方針と rollback しない方針を contract test で固定する必要がある
  - rapid same-key update、older failure ignored、latest failure toast、sync success after failure、unknown key passthrough の test を追加する

- [ ] P2 theme view transition cleanup を reduced-motion / thrown transition / late finished で固定する
  - 対象: `src/stores/preferences-store.ts`, `src/__tests__/lib/theme-appearance-state.test.ts`
  - `document.startViewTransition` と root class mutation は React 外の副作用なので、throw や late `finished` で transition class が残ると全画面表示に影響する
  - reduced motion、startViewTransition throw、finished reject、rapid theme switch、system theme listener cleanup の test を追加する

- [ ] P2 language preference apply failure を i18n runtime unavailable と settings toast 方針で固定する
  - 対象: `src/stores/preferences-store.ts`, `src/lib/ui/ui-language.ts`, `src/components/settings`
  - `i18n.changeLanguage` は fire-and-forget で失敗を console に寄せるため、保存成功だが UI language 未適用の状態が user に見えにくい
  - navigator.language throw、changeLanguage reject、unsupported language、backend save success/apply failure、reload後 fallback の test を追加する

- [ ] P3 query invalidation target matrix を repo contract test で drift 検出する
  - 対象: `src/lib/query/query-invalidation.ts`, `src/__tests__/lib/query-invalidation.test.ts`, `src/__tests__/config/repo-contracts.test.ts`
  - query root が増えた時に invalidation target へ入れ忘れると、機能追加時の stale cache が後から発覚しやすい
  - `QUERY_KEY_ROOTS` と feed/article/sync completed invalidation matrix の snapshot を作り、意図的に除外する key は理由付き allowlist にする

- [ ] P3 global store module-level runtime state の reset helper coverage を棚卸しする
  - 対象: `src/stores/ui-store.ts`, `src/stores/preferences-store.ts`, `src/lib/sync/manual-sync.ts`, `src/hooks/use-updater.ts`
  - module-level timer / in-flight promise / listener set が複数あり、test reset helper の漏れが別 test の flake として出やすい
  - toast timer、theme listener、preferences load promise、manual sync timer、update in-flight/download session の reset coverage を一覧化する

### Reader Content / Feed Discovery / Security

- [ ] P1 `ArticleContentView` の sanitized HTML brand 境界を runtime schema と repo contract で固定する
  - 対象: `src/components/reader/article-content-view.tsx`, `src/lib/content/html.ts`, `src/api/schemas/article.ts`, `src/__tests__/components/article-content-view.test.tsx`
  - `dangerouslySetInnerHTML` は `SanitizedArticleHtml` brand に依存しており、DTO 以外の string helper が広がると sanitizer boundary を迂回しやすい
  - `fromSanitizedArticleHtmlDto` 経由のみを原則にし、legacy test helper、mock data、article DTO schema、repo contract で unsafe string 流入を検出する

- [ ] P1 Rust sanitizer version bump と saved article repair の release gate を作る
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src-tauri/src/service/sync_flow.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - sanitizer policy を変えても `SANITIZER_VERSION` bump や repair path を忘れると、保存済み article が古い HTML policy のまま表示される
  - allowed tag/attribute 変更、version bump 漏れ、repair batch limit、repair failure retry、partial repair 後の起動の integration test を追加する

- [ ] P1 reader content privacy policy の frontend post-process を sanitizer contract と同期する
  - 対象: `src/lib/content/html.ts`, `src-tauri/src/infra/sanitizer.rs`, `src/__tests__/lib/html.test.ts`
  - Rust sanitizer 後に React 側で `referrerpolicy` や `rel` を付け直しているため、片側だけ変更されると link/image privacy contract が崩れやすい
  - `a[href]`、`img[src]`、`picture/source`、malformed HTML、DOMParser unavailable、already-set rel/referrerpolicy の parity test を追加する

- [ ] P1 feed discovery SSRF guard を DNS rebinding / redirect / base tag で再検証する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src-tauri/src/commands/feed_commands.rs`, `src/__tests__/components/add-feed-dialog.test.tsx`
  - discovery は initial URL と redirect URL の private host を検証するが、DNS rebinding、same-origin `<base>`、protocol-relative feed URL の扱いが security boundary になっている
  - public-to-private DNS、HTTPS->HTTP downgrade、same-origin base、cross-origin base ignore、protocol-relative URL、IPv6/private range の test を追加する

- [ ] P2 external URL schema の `mailto:` と native opener の redaction/validation contract を固定する
  - 対象: `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`, `src/components/reader/article-browser-actions.ts`
  - external opener は `mailto:` を許可し、browser webview/Reading List は http(s) のみなので、action ごとの URL policy が混ざると意図しない scheme を native に渡しやすい
  - `mailto:`、encoded newline、tab、uppercase scheme、userinfo URL、query token redaction、plugin opener error の test を追加する

- [ ] P2 `safeInvoke` response validation detail の secret redaction を nested issue と URL path で固定する
  - 対象: `src/api/tauri-commands.ts`, `src/__tests__/api/tauri-commands.test.ts`, `src/__tests__/api/command-args-validation.test.ts`
  - Zod issue detail を user-visible error に変換するため、path/message に URL token や credential-like value が入ると error toast に漏れる可能性がある
  - nested path、multiple issue truncation、URL userinfo、query token、Bearer/Basic header-like string、non-Error throwing value の redaction test を追加する

- [ ] P2 command args schema と Rust command validation の max length parity を contract 化する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/share_commands.rs`, `tests/tauri-command-return-contract.test.ts`
  - account/feed/folder/tag/clipboard/preference の上限値が TS と Rust に分散しており、片側だけ変えると frontend では通るが backend で落ちる入力が増える
  - `ACCOUNT_NAME_MAX_CHARS`、`FEED_TITLE_MAX_CHARS`、`FOLDER_NAME_MAX_CHARS`、`TAG_NAME_MAX_CHARS`、clipboard max、preference bytes の parity test を追加する

- [ ] P2 article thumbnail URL normalization を sanitizer media URL policy と合わせる
  - 対象: `src/lib/articles/article-view.ts`, `src/components/reader/article-content-view.tsx`, `src/__tests__/lib/article-view.test.ts`
  - content HTML 内 media は sanitizer が http(s) absolute のみ許可する一方、thumbnail は別 helper で normalize されるため、relative/data/private URL policy がずれやすい
  - relative URL、data URL、javascript URL、uppercase HTTP、userinfo URL、empty/whitespace URL の display contract を追加する

- [ ] P2 seed-dev-db-from-prod の backup/staging cleanup を crash-safe contract にする
  - 対象: `scripts/seed-dev-db-from-prod.ts`, `src/__tests__/scripts/seed-dev-db-from-prod.test.ts`
  - production DB copy は staging、backup、destination cleanup、install の順序に依存するため、途中失敗時の backup 残存と dev DB 復旧可能性を固定しておきたい
  - staging copy failure、backup copy failure、destination rm failure、install copy failure、staging cleanup failure、symlink race の script test を追加する

- [ ] P2 seed-dev-db-from-prod の running process / open handle detection を false positive/negative で固定する
  - 対象: `scripts/seed-dev-db-from-prod.ts`
  - app 起動中や DB handle open 中の copy を避ける guard は `pgrep` / `tasklist` / `lsof` に依存するため、platform ごとの失敗を安全側に倒す必要がある
  - pgrep permission error、process not found、tasklist localized output、lsof timeout、WAL/SHM handle、foreign process name collision の test を追加する

- [ ] P2 log directory opener の privacy checklist と diagnostics redaction を support workflow へ接続する
  - 対象: `src-tauri/src/commands/log_commands.rs`, `src/lib/runtime/diagnostics.ts`, `src/components/settings/debug-settings.tsx`
  - log dir を開く操作は user が app.log を共有する導線になるため、account/feed/article URL や local path の redaction policy が UI に見えないと事故りやすい
  - open failure、permission failure、privacy checklist 表示、URL/user path redaction、backup DB warning の component/Rust contract を追加する

- [ ] P3 content sanitizer fixtures を web-platform-ish corpus として追加する
  - 対象: `src-tauri/src/infra/sanitizer.rs`, `src/__tests__/lib/html.test.ts`, `tests/fixtures`
  - sanitizer の個別 unit test は増えているが、実 feed 由来の壊れた HTML / media / tracking link の corpus がないと regression を検出しづらい
  - malformed publisher HTML、tracking link、responsive image、video/source、code block、Japanese text、emoji/entity の fixture corpus を用意する

### Release / Native / Keyboard / I18n / A11y

- [ ] P1 Tauri capability の external opener permission scope を URL schema と同期する
  - 対象: `src-tauri/capabilities/default.json`, `src/api/schemas/commands.ts`, `src/api/tauri-commands.ts`
  - `opener:allow-open-url` と `browser-webview` が同じ default capability にいるため、URL validation と permission scope がずれると外部 opener surface が広がりやすい
  - `http:`、`https:`、`mailto:`、`file:`、custom scheme、encoded newline、userinfo URL の allow/deny contract と capability snapshot を追加する

- [ ] P1 CSP の `img-src http:` を reader privacy policy として明文化する
  - 対象: `src-tauri/tauri.conf.json`, `src-tauri/src/infra/sanitizer.rs`, `src/components/reader/article-content-view.tsx`
  - 記事画像のために `http:` image load を許すなら、mixed content / referrer / tracking image の扱いを sanitizer と frontend post-process で揃える必要がある
  - http image allowed/blocked 方針、`referrerpolicy`、tracking pixel、upgrade-insecure の扱い、CSP drift の repo contract test を追加する

- [ ] P2 `browser-webview` capability の command surface を最小権限 snapshot にする
  - 対象: `src-tauri/capabilities/default.json`, `src/components/reader/hooks/browser`, `tests/release-repo-contract.test.ts`
  - browser webview が main webview と同じ permission 群を持つと、将来 browser 側 script や navigation surface が増えた時に影響範囲を判断しづらい
  - webview 別 capability、window commands、clipboard/opener permission、browser geometry command の必要最小権限を snapshot 化する

- [ ] P2 native menu action id と frontend `AppAction` の parity test を追加する
  - 対象: `src-tauri/src/menu.rs`, `src/lib/app-actions.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - native menu 経由の action と keyboard/global action が別定義なので、片方だけ rename/追加されると menu click が no-op になりやすい
  - menu id、resolved frontend action、unknown action payload、disabled runtime action、shortcut definition の parity test を追加する

- [ ] P2 native menu shortcut hint と user customizable shortcut の表示方針を固定する
  - 対象: `src-tauri/src/menu.rs`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`
  - menu label に default shortcut hint が含まれる一方、settings 側で shortcut を変更できるため、表示と実動作がずれる可能性がある
  - default-only 表示にするか runtime rebuild するか決め、custom shortcut 設定後の menu hint / keyboard action parity を検証する

- [ ] P2 native menu checked state と frontend preference migration の互換性を contract 化する
  - 対象: `src-tauri/src/menu.rs`, `src/schemas/preferences.ts`, `src/stores/preferences-store.ts`
  - sort/view/filter の menu checked state は preference payload に依存するため、旧 key や unknown value が混ざると UI と native menu の選択状態がずれやすい
  - old key migration、unknown sort、unchecked fallback、preference save failure、native menu rebuild の parity test を追加する

- [ ] P2 menu event payload diagnostics の redaction / truncation を固定する
  - 対象: `src/hooks/use-menu-events.ts`, `src/lib/runtime/diagnostics.ts`, `src/__tests__/hooks/use-menu-events.test.tsx`
  - menu event payload は `String(payload)` で diagnostics に載るため、長大 payload や URL/token を含む custom object が debug trace に漏れる可能性がある
  - throwing `toString`、long string、URL query token、object payload、unknown action、once key の redaction test を追加する

- [ ] P2 custom keyboard shortcut collision detection を settings save 前に入れる
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/schemas/preferences.ts`, `src/components/settings/shortcuts-settings.tsx`
  - 同じ key/modifier を複数 action に割り当てられると、global handler の探索順に依存して user intent と違う action が発火しやすい
  - duplicate shortcut、reserved shortcut、empty shortcut、platform modifier、reset-to-default の validation / UI contract を追加する

- [ ] P2 keyboard shortcut の platform modifier 表示と native accelerator 表記を同期する
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src-tauri/src/menu.rs`, `src/components/settings/shortcuts-settings.tsx`
  - frontend は `⌘` などの表示、native menu は `CmdOrCtrl` などの accelerator 表記を使うため、macOS/Windows/Linux で説明と実動作がずれやすい
  - mac/win/linux display、CmdOrCtrl parsing、Option/Alt、Shift case、menu label hint の snapshot を追加する

- [ ] P2 global keyboard handler の modal/top-layer block 判定を store state 依存から contract 化する
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/settings`, `src/components/reader/command-palette.tsx`
  - settings/confirm/command palette の store flag だけで block すると、nested popover や future dialog が開いた時に背後の reader action が動く可能性がある
  - modal stack、popover open、confirm dialog、tag picker、Escape propagation、top-layer fallback の component test を追加する

- [ ] P2 IME composition 中の global keyboard / account pane shortcut 抑止を統一する
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/subscriptions-index/subscriptions-index-page.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - 一部 handler は `isComposing` を見るが global keyboard path は target 判定中心なので、日本語入力中に Vim-like shortcut が発火する risk がある
  - compositionstart/end、keydown `isComposing`、account pane route、sidebar route、contenteditable/input/textarea の test を追加する

- [ ] P2 Rust native menu i18n と frontend locale copy の意味 drift を検出する
  - 対象: `src-tauri/src/menu_i18n.rs`, `src/locales/en`, `src/locales/ja`, `src/__tests__/lib/i18next-locale-contract.test.ts`
  - native menu label は Rust 側、settings/shortcut help は frontend 側にあり、同じ action の日本語/英語表現が別々にずれやすい
  - menu action label、shortcut label、sync/settings/browser action copy、locale fallback の review snapshot を追加する

- [ ] P2 Storybook / test i18n setup が missing key を fail-fast にできる範囲を決める
  - 対象: `tests/helpers/i18n-setup.ts`, `.storybook`, `src/__tests__/components`
  - Storybook や component test で missing key が key 文字列のまま通ると、locale regression を視覚確認まで見逃しやすい
  - strict i18n wrapper、expected missing key allowlist、story smoke、test-local namespace setup の方針を追加する

- [ ] P2 destructive confirm dialog の pending state / focus restore / thrown callback を固定する
  - 対象: `src/components/app-confirm-dialog.tsx`, `src/stores/ui-store.ts`, `src/hooks/use-delete-feed.ts`
  - confirm callback が async failure や throw を起こした時、dialog close、focus restore、toast 表示の owner が曖昧になりやすい
  - confirm throw、reject、double click、Escape during pending、target removed、focus ref null の component test を追加する

- [ ] P2 feed tree / account switcher / tag list の roving focus 境界を hidden/disabled row で固定する
  - 対象: `src/components/reader/feed-tree`, `src/components/reader/sidebar-account-switcher.tsx`, `src/components/reader/article-tag-picker-view.tsx`
  - keyboard navigation が hidden/disabled/deleted row を跨ぐと、focus と selected state が別 row を指す flake が起きやすい
  - hidden row、disabled account、deleted tag、collapsed folder、virtual row absence、Home/End/Arrow navigation の test を追加する

- [ ] P2 mobile single-pane layout の hidden pane tab order / focus restore を E2E contract にする
  - 対象: `e2e/app.spec.ts`, `src/components/app-shell.tsx`, `src/stores/ui-store.ts`
  - mobile single-pane で sidebar/settings/article/account pane を切り替える時、hidden pane に tab stop が残ると keyboard/a11y 操作が壊れる
  - pane switch、account setup、settings close、browser overlay close、back navigation、tab order snapshot の E2E を追加する

- [ ] P2 release workflow permission / action pinning の drift gate を増やす
  - 対象: `.github/workflows`, `tests/release-repo-contract.test.ts`
  - release/update artifact を扱う workflow は権限と action pinning の drift が supply-chain risk になりやすく、通常 lint だけでは検出しづらい
  - `permissions` minimum、third-party action SHA pinning、upload artifact scope、release token scope、cache key drift の contract を追加する

- [ ] P2 release artifact manual verification に updater signature / app identifier check を追加する
  - 対象: `docs/release-manual-verification.md`, `.codex/skills/release/SKILL.md`, `src-tauri/tauri.release.conf.json`
  - DMG 起動確認だけだと updater signature、bundle identifier、latest.json endpoint の不一致を見逃しやすい
  - latest.json signature、bundle id、codesign team、quarantine behavior、first launch log、update check smoke を release checklist に追加する

- [ ] P3 Japanese long-label screenshot smoke を settings / article toolbar / account detail に追加する
  - 対象: `e2e/storybook`, `src/locales/ja`, `src/components/settings`, `src/components/reader/article-toolbar-view.tsx`
  - 日本語 copy は英語より幅を取りやすく、compact toolbar や settings row で overflow / overlap を起こしても unit test では見えにくい
  - ja locale、narrow viewport、large text、button label overflow、account detail section、toolbar actions の screenshot smoke を追加する

- [ ] P3 visual regression smoke の対象を dense UI / a11y state に限定して追加する
  - 対象: `e2e/storybook`, `src/components/reader`, `src/components/settings`
  - 全画面 snapshot を増やすと保守が重いが、dense UI の overlap や hidden focus ring は通常の DOM assertion では検出しづらい
  - feed tree dense state、settings modal error state、command palette empty/result state、browser overlay error state、toast stack の小さな screenshot smoke を追加する

### Database / Updater / Window

- [ ] P1 Rust `u64` DTO を TS `number` で受ける schema の safe integer policy を決める
  - 対象: `src/api/schemas/database-info.ts`, `src/api/schemas/common.ts`, `src/api/schemas/*`, `src-tauri/src/commands/*`
  - DB size、count、timestamp usec など Rust 側が `u64` の値を frontend で `number` として扱うと、`Number.MAX_SAFE_INTEGER` 超過時に丸められる
  - safe integer 上限、string 化する DTO、BigInt を使わない範囲、Zod `safe()`、Rust test fixture の parity を整理する

- [ ] P1 database maintenance と updater install が共有する `syncing` flag の user-facing state を統一する
  - 対象: `src-tauri/src/commands/database_commands.rs`, `src-tauri/src/commands/updater_commands.rs`, `src-tauri/src/commands/sync_commands.rs`, `src/hooks/use-updater.ts`
  - vacuum、sync、update install が同じ AtomicBool を使うため、UI には sync 中なのか maintenance/update 中なのか区別できない busy error が出やすい
  - vacuum中sync、sync中vacuum、install中sync、restart guard、busy message category、settings button disabled state の integration test を追加する

- [ ] P2 updater pending handle clear と manual check/download の race を contract 化する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`, `src/__tests__/hooks/use-updater.test.ts`
  - check 開始時に pending update を clear するため、manual check と download が近接すると cached handle が消える/古くなる race が起きやすい
  - check中download、download中check、stale pending metadata、no update after cached update、retry after failure の Rust/frontend test を追加する

- [ ] P2 update event emit failure の log-only 方針を frontend session recovery と合わせる
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/hooks/use-updater.ts`, `src/lib/runtime/diagnostics.ts`
  - progress/ready event emit は log-only なので、listener dispose や window close で event が落ちても frontend が download state を回復できる必要がある
  - progress emit failure、ready emit failure、listener disposed、app restart before ready、session id mismatch、manual status refresh の test を追加する

- [ ] P2 restart app command の sync/update guard と user confirmation を整理する
  - 対象: `src-tauri/src/commands/updater_commands.rs`, `src/lib/actions.ts`, `src/hooks/use-updater.ts`, `src/components/app-confirm-dialog.tsx`
  - `restart_app` は sync/update guard を取るが、frontend 側の pending mutation / unsaved settings / browser open の確認と切り離れている
  - update ready restart、manual restart action、settings dirty state、sync running、install running、restart failure の UX contract を追加する

- [ ] P2 always-on-top / fullscreen window state の preference と runtime drift を検出する
  - 対象: `src/lib/window/windows.ts`, `src/hooks/use-window-always-on-top.ts`, `src/stores/preferences-store.ts`
  - preference 保存と native window state 適用が別々に失敗すると、settings 表示と実 window state がずれる可能性がある
  - set failure、get failure、startup apply、manual toggle、fullscreen conflict、runtime unavailable の hook/store test を追加する

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

- [ ] P2 command schema registry と Rust command registry の missing/extra を双方向に検出する
  - 対象: `src/api/schemas/commands.ts`, `src-tauri/src/commands/mod.rs`, `src/__tests__/api/command-args-validation.test.ts`
  - Tauri command の追加時に TS args schema か mock handler を忘れると、frontend call まで drift が見えない
  - Rust command list抽出、TS registry、mock registry、no-args command allowlist、deprecated command の parity test を追加する

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

- [ ] P2 mute keyword invalidation が article/tag count/search result まで届くか matrix 化する
  - 対象: `src/hooks/use-mute-keywords.ts`, `src/lib/query/query-invalidation.ts`, `src/__tests__/hooks/use-mute-keywords.test.tsx`
  - mute keyword は visible article list、unread count、tag counts、search results に影響するが invalidation が log-only なので漏れが stale UI になりやすい
  - create/update/delete、auto-mark on/off、search active、tag view、folder view、old unread view の invalidation matrix を追加する
  - superseded by: P1-Q5d (covered by mute/tag/article invalidation matrix; kept verification: search active, tag view, folder view, old unread view)

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

- [ ] P2 article search focus retry を search close / account switch / unmount で leak-free にする
  - 対象: `src/components/reader/hooks/article-list/use-article-list-search.ts`, `src/__tests__/components/use-article-list-search.test.tsx`
  - focus retry は RAF と timeout を併用するため、search close や account switch 後に古い focus が復活すると keyboard flow が乱れる
  - close before RAF、account switch before timeout、unmount cleanup、requestAnimationFrame unavailable、focus throws の test を追加する

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

- [ ] P2 safeInvoke response validation redaction を command name / args detail と切り分ける
  - 対象: `src/api/tauri-commands.ts`, `src/lib/ui-errors.ts`, `src/__tests__/api/tauri-commands.test.ts`
  - response validation error は Zod issue detail を含むため、schema path と runtime value のどこまでを user/log に出すか明確にしないと data leak と調査不能の両方が起きる
  - command name、args validation、response validation、nested path、URL token、omitted issues、console vs toast detail の test を追加する

- [ ] P2 safeInvoke args validation が `args` undefined の時に schema を bypass する方針を contract 化する
  - 対象: `src/api/tauri-commands.ts`, `src/api/schemas/commands.ts`, `src/__tests__/api/command-args-validation.test.ts`
  - `options.args && args ? ... : args` のため、schema 付き command に undefined args を渡すと validation を通らず invoke へ進む可能性がある
  - schema required args + undefined、empty object、optional args command、no-args command、runtime invoke error の test を追加する

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

- [ ] P2 dev runtime mocks と real Tauri runtime 判定の mutually exclusive contract を作る
  - 対象: `src/lib/window/window-chrome.ts`, `src/dev/mocks.ts`, `tests/helpers/tauri-runtime.ts`, `src/components/storybook/story-tauri-runtime.ts`
  - `__DEV_BROWSER_MOCKS__` / `__ULTRA_RSS_BROWSER_MOCKS__` / `__TAURI_INTERNALS__` の組み合わせで runtime 判定が変わるため、Storybook/dev/test で混在すると実 command を叩く risk がある
  - both mocks true、mock + tauri internals、real tauri only、cleanup restore、storybook decorator の contract test を追加する

- [ ] P2 Storybook query client runtime provider が Tauri mock failure を test isolation で漏らさないようにする
  - 対象: `src/components/storybook/story-query-client-provider.tsx`, `src/components/storybook/story-tauri-runtime.ts`, `tests/helpers/tauri-mocks.ts`
  - story ごとの query client と Tauri mock が共有状態を持つと、前 story の failed command/cache が次の story に残り visual smoke が flaky になる
  - story unmount、query cache clear、mock command reset、failed invoke、parallel stories の test を追加する

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

- [ ] P2 build.rs / Windows manifest / generated schema の release-only failure を local gate へ寄せる
  - 対象: `src-tauri/build.rs`, `src-tauri/windows-test-manifest.xml`, `tests/release-repo-contract.test.ts`
  - build script や Windows manifest は macOS dev では見えにくく、release/CI でだけ壊れる設定 drift になりやすい
  - manifest path、Windows resource metadata、schema generation input、release config include、cross-platform smoke の contract を追加する

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

- [ ] P1 release tag が `main` 由来であることを workflow gate にする
  - 対象: `.github/workflows/release.yml`, `.codex/skills/release/SKILL.md`, `.claude/commands/release.md`
  - workflow は tag SHA の一致を見るが、tag target が `origin/main` に含まれるかは固定していないため、手元 release 手順と CI 実行条件がずれ得る
  - annotated tag、lightweight tag、non-main tag、main fast-forward、workflow failure message の contract を追加する

- [ ] P1 release workflow の prerelease/build metadata と draft 設定を semver policy に合わせる
  - 対象: `.github/workflows/release.yml`, `.codex/skills/release/SKILL.md`, `tests/release-repo-contract.test.ts`
  - tag pattern は prerelease/build metadata を許可するが release action は `prerelease: false` 固定で、実 release の公開種別が曖昧
  - `v1.2.3-alpha.1`、`v1.2.3+build.1`、stable、draft/pre-release flag、release note template の repo contract を追加する

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

- [ ] P2 command args registry と Rust command 引数名の parity を追加する
  - 対象: `src/api/schemas/commands.ts`, `tests/helpers/tauri-command-contract.ts`, `src-tauri/src/commands/*_commands.rs`
  - frontend args registry と Rust command 関数の引数名対応が未固定で、rename 時に safeInvoke validation だけ通って runtime で missing args になり得る
  - snake_case/camelCase、optional args、no-args command、renamed command、deprecated allowlist の contract を追加する

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

- [ ] P1 Alt/Option 修飾キーが plain shortcut として発火しない contract を作る
  - 対象: `src/hooks/use-keyboard.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - resolver に `altKey` が渡らず meta/ctrl 以外は plain key fallback するため、Option+J などが `j` として article navigation を起こす可能性がある
  - alt+letter、alt+shift、option IME 入力、custom shortcut、ignored input target の keyboard contract を追加する

- [ ] P2 `Cmd/Ctrl+,` legacy settings shortcut が user custom shortcut を迂回する方針を決める
  - 対象: `src/lib/keyboard/keyboard-shortcuts.ts`, `src/components/settings/shortcuts-settings.tsx`
  - `open_settings` を別キーにしても legacy `Cmd/Ctrl+,` が常に有効で、shortcut の移動/無効化と実動作がずれる
  - custom open_settings key、blank override、native menu accelerator、text input target、settings UI copy の contract を追加する

- [ ] P2 `focus_sidebar` shortcut が keyboard focus まで戻す contract を作る
  - 対象: `src/hooks/use-keyboard.ts`, `src/lib/reader-focus.ts`, `src/__tests__/hooks/use-keyboard.test.tsx`
  - ArrowLeft 経路は selected sidebar target へ focus するが shortcut action は sidebar を開くだけで、focus が article/list に残りやすい
  - sidebar closed、selected feed missing、account pane open、mobile layout、focus target not found の test を追加する

- [ ] P2 native menu action に modal/top-layer block policy を適用する
  - 対象: `src/hooks/use-menu-events.ts`, `src/hooks/use-keyboard.ts`, `src/lib/actions.ts`
  - keyboard shortcut は modal open 時に block するが native menu event は `executeAction` へ直行するため、dialog 背後で destructive/global action が動く可能性がある
  - settings modal、confirm dialog、command palette、popover menu、allowed app-level action の contract を追加する

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

- [ ] P2 browser overlay Escape と global keyboard の priority contract を作る
  - 対象: `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts`, `src/hooks/use-keyboard.ts`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - overlay 側は `stopImmediatePropagation`、global 側は browser mode Escape を特殊扱いしており、listener 登録順変更で close/clear が揺れやすい
  - overlay open、global handler first、modal open、browser mode close、reader clear の keyboard test を追加する

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

- [ ] P2 `similarity-report` entrypoint 判定を `pathToFileURL` ベースにする
  - 対象: `scripts/similarity-report.ts`, `src/__tests__/scripts`
  - `file://${process.argv[1]}` 直書きだと repo path に空白や URL escape 対象文字が入る環境で CLI 本体が実行されない可能性がある
  - space path、unicode path、symlink path、direct execution、imported module no-run の test を追加する

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

- [ ] P3 text editing target 判定に ARIA combobox 系を含めるか決める
  - 対象: `src/lib/keyboard/global-shortcut-targets.ts`, `src/components/ui/command.tsx`, `src/components/settings/shortcuts-settings-view.tsx`
  - textbox/searchbox/select/contenteditable は守るが、custom select や search UI で使われがちな `role="combobox"` が global shortcut 対象になり得る
  - combobox、listbox、spinbutton、slider、contenteditable nested の keyboard contract を追加する

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

- [ ] P2 createMutation invalidation failure diagnostics に owner/query key を含める
  - 対象: `src/hooks/create-mutation.ts`, `src/lib/query/query-invalidation.ts`, `src/__tests__/hooks`
  - invalidation rejection が mutation error になっても、どの owner/query key が壊れたか診断しづらい
  - failing invalidation、mutation owner、query key、toast/no-toast、strict/log-only split の test を追加する
  - superseded by: P1-Q5b (covered by createMutation invalidation diagnostics; kept verification: mutation owner, query key, toast/no-toast split)

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

- [ ] P2 overlay close finalize の `requestAnimationFrame` unavailable/throw を contract 化する
  - 対象: `src/components/reader/hooks/article/use-article-browser-overlay-close.ts`
  - close finalize 内の rAF が失敗すると pending close action flush や focus restore が走らず、keyboard queue が残る可能性がある
  - rAF missing、rAF throws、reduced-motion close、pending action flush、inFlight reset の test を追加する

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

- [ ] P2 article list row auto-focus の late focus を active editing target で再検証する
  - 対象: `src/components/reader/hooks/article-list/use-article-list-effects.ts`
  - rAF 登録前には入力中判定していても、frame 実行までに検索 input などへ focus が移ると記事 row が focus を奪う可能性がある
  - focusedPane=list、frame 前 INPUT/TEXTAREA/contenteditable focus、row unmount、selected article change の test を追加する

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

- [ ] P2 shortcut recorder の IME composing / Dead / Unidentified key を無視する
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/components/settings/shortcuts-settings-view.tsx`, `src/__tests__/components/shortcuts-settings.test.tsx`
  - shortcut 記録中は global keyboard と別経路で、IME composition や `Dead` / `Unidentified` / `Process` key が custom shortcut として保存され得る
  - composing keydown、Dead key、Unidentified、Process、Escape cancel、recording state retained の test を追加する

- [ ] P2 shortcut recorder の Alt/Option 入力を recording lifecycle として固定する
  - 対象: `src/components/settings/shortcuts-settings.tsx`, `src/lib/keyboard/keyboard-shortcuts.ts`
  - `normalizeRecordedKey` は Alt を null にするが event は prevent/stop 済みで、ユーザーには無反応のまま recording が続く可能性がある
  - Alt+letter、Alt+Shift、Option IME、recording stays/cancels policy、conflict message、focus retention の test を追加する

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

- [ ] P1 `clearArticle` 後に mobile/compact が空の content pane に残らないようにする
  - 対象: `src/stores/ui-store.ts`, `src/hooks/use-layout.ts`
  - `clearArticle()` が `focusedPane` を戻さないため、mobile で記事を閉じると `contentMode: empty` でも content pane が表示され続け得る
  - mobile/compact article close、selected article not-found cleanup、browser close parity、focusedPane restore の test を追加する

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

- [ ] P2 native action focus helpers の RAF unavailable / focus throw を contract 化する
  - 対象: `src/lib/actions.ts`, `src/lib/reader-focus.ts`, `src/__tests__/lib`
  - `focusArticleListAfterClearingArticle` / `focusSidebarSelection` が rAF を直接使うため、rAF missing や target focus throw で action 全体が落ち得る
  - requestAnimationFrame missing、focus throws、target absent、clearArticle focus restore、sidebar focus restore の test を追加する

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

- [ ] P2 quality-baseline spawn failure / signal termination を explicit error にする
  - 対象: `scripts/quality-baseline.ts`, `mise.toml`, `src/__tests__/scripts`
  - `spawnSync` の `error` や signal termination を status だけで扱うと、pnpm missing / killed process / timeout の原因が baseline drift と混ざりやすい
  - command not found、SIGTERM、SIGKILL、timeout、stderr/stdout preservation の script test を追加する

- [ ] P2 quality-baseline JSON extraction を nested braces / log prefix で堅牢化する
  - 対象: `scripts/quality-baseline.ts`, `src/__tests__/scripts`
  - 最初の `{` から最後の `}` を抜く方式は、tool log に braces が混ざると別 JSON を parse し得る
  - log prefix with braces、multiple JSON objects、JSON array output、trailing warning、malformed compact JSON の test を追加する

- [ ] P2 similarity-report parse を Windows path / colon-containing symbol で固定する
  - 対象: `scripts/similarity-report.ts`, `src/__tests__/scripts/similarity-report.test.ts`
  - pair line parser が `path:line-range symbol` 前提なので、Windows drive letter や symbol 名に colon-like text があると path/symbol 分割が壊れやすい
  - Windows path、colon in symbol、space in path、missing symbol、CRLF output の test を追加する

- [ ] P2 similarity-report baseline counts と false-positive baseline の stale TODO 参照を検出する
  - 対象: `scripts/similarity-report.ts`, `TODO.md`, `.claude/rules/quality-policy.md`
  - false positive baseline の `todoName` が完了/削除済み TODO を参照しても report は通るため、分類だけ残って cleanup 対象が分かりにくくなる
  - missing TODO name、renamed TODO、present false positive、absent false positive、baseline update workflow の test を追加する

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

- [ ] P1 Debug HUD / support dump の secret redaction inventory を作る
  - 対象: `src/components/debug`, `src/lib/runtime/diagnostics.ts`, `src-tauri/src/commands/log_commands.rs`
  - debug dump や copy/export に account URL、token 付き URL、local path、subscription metadata が混ざるとサポート共有で漏れる
  - account URL token、diagnostics payload、log path、browser geometry URL、copy/export redaction の contract test に分ける

- [ ] P2 article reader scroll position retention policy を決める
  - 対象: `src/components/reader/hooks/article`, `src/stores/ui-store.ts`
  - article 切替、feed 切替、browser overlay close、account switch で scroll を残すか戻すかが曖昧だと閲覧復帰が不安定になる
  - same article revisit、新規 article reset、browser close return、account switch、reduced motion の期待値を固定する

- [ ] P2 keyboard repeat navigation throttle / queue policy を固定する
  - 対象: `src/hooks/use-keyboard.ts`, `src/components/reader/hooks/article-list/use-article-list-navigation.ts`
  - `j/k` や arrow 長押しで selection/focus が data refetch より先行すると stale row や pane mismatch が起きる
  - key repeat、long press、list end、refetch during repeat、focus target stale の focused test を追加する

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

- [ ] P1 IDNA / punycode / IPv6 zone identifier の private host 判定を URL schema 全体で固定する
  - 対象: URL schema、feed discovery、OPML import、external opener
  - `xn--` host、Unicode host、IPv6 zone id、mixed-case host が command ごとに違うと SSRF guard と opener policy がずれる
  - IDNA host、Unicode host、IPv6 zone id、localhost alias、percent-encoded host、trailing dot の contract を追加する

- [ ] P1 global error / unhandled rejection の redaction と user-facing recovery を固定する
  - 対象: `src/main.tsx`, `src/lib/runtime/diagnostics.ts`, app shell error boundary
  - render 外の promise rejection や event handler throw が console だけに流れると、blank UI や secret 混入 log を検出できない
  - unhandled rejection、window error、throwing reason、redaction、toast/reload fallback の contract を追加する

- [ ] P2 article/feed/folder/tag/account name の Unicode bidi / confusable display policy を決める
  - 対象: domain validation、settings forms、reader/sidebar display
  - RTL override、zero-width、confusable 文字が入ると feed name や action target が spoof され、delete/rename 確認で誤認しやすい
  - bidi control、zero-width joiner、NFKC confusable、trim display、confirmation label の policy を追加する

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

- [ ] P2 settings form dirty-state registry を account/tag/shortcut/preferences で共通化する
  - 対象: settings forms、update restart guard、navigation guard
  - form ごとに dirty 判定が違うと、restart/update/account switch 時に保存前変更を落とす
  - account credentials、tag edit、shortcut edit、sync preferences、modal close/navigation の matrix を作る

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

- [ ] P2 main window close confirmation と dirty/pending state registry を native close event へ接続する
  - 対象: `src-tauri/src/lib.rs`, app shell dirty-state registry, settings/add-feed flows
  - OS の close button は frontend navigation guard を通らないため、dirty form や pending mutation を落とす可能性がある
  - native close requested、dirty settings、add feed pending、sync pending、restart requested、force close の flow を固定する

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

- [ ] P1 provider auth header / cookie persistence を no-store policy として固定する
  - 対象: GReader/FreshRSS provider HTTP client、debug logging、HTTP fixtures
  - auth header や cookie が redirect/log/cache/retry error に残ると credential leak につながる
  - Authorization redaction、Set-Cookie ignored、Cookie not persisted、redirect strips auth、retry diagnostics の contract を追加する

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

- [ ] P2 command palette / menu / shortcut action availability を capability matrix にする
  - 対象: command palette actions、native menu、keyboard shortcuts、app action dispatcher
  - 同じ action が surface ごとに enabled/disabled 条件を持つと、modal中・browser中・no account 時の動きがずれる
  - no account、browser open、modal open、syncing、dirty form、offline の matrix を作る

- [ ] P2 keyboard shortcut persistence の migration path を renamed action id で固定する
  - 対象: shortcut preferences、app action ids、settings shortcuts
  - action id rename 後に古い custom shortcut が残ると、表示されない shortcut が発火するか、発火しなくなる
  - renamed action、deleted action、new default conflict、reset all、migration warning の contract を追加する

- [ ] P2 window drag region と file drop region の pointer event priority を検証する
  - 対象: app shell CSS、native titlebar overlay、drag/drop handlers
  - titlebar drag、browser overlay、file drop overlay が同じ上部領域を使うと、クリック/ドラッグ/drop の優先順位が壊れる
  - titlebar drag、toolbar click、file hover、drop cancel、browser overlay open の visual/manual check を追加する

- [ ] P2 memory pressure / OOM risk を large feed import と article render で smoke 化する
  - 対象: local provider parser、OPML import、article content view
  - 巨大 feed や巨大 HTML を parse/render した時に body cap だけでは JS/Rust memory pressure を検出できない
  - large feed entries、large article HTML、many images、large OPML、render abort/fallback の smoke を追加する

- [ ] P2 test suite parallelism と shared global state の isolation policy を明文化する
  - 対象: Vitest setup、Rust tests、global diagnostics/reset helpers
  - parallel test が localStorage、window globals、OnceLock、env vars を共有すると flake が増える
  - env var isolation、OnceLock reset、localStorage reset、fake timers、Rust test threads の policy を追加する

- [ ] P2 CI failure artifact retention を frontend/Rust/native smoke ごとに分類する
  - 対象: `.github/workflows/ci.yml`, release workflow, test outputs
  - 失敗時に必要な log/screenshot/DB fixture が残らないと、remote failure を再現できない
  - Vitest logs、Rust test logs、native app logs、screenshots、DB backup artifact、retention days の matrix を作る

- [ ] P2 app action telemetry-free audit log を local diagnostics として持つか決める
  - 対象: app action dispatcher、diagnostics reporter、debug HUD
  - action failure の再現には sequence が必要だが、telemetry なし方針なら local-only・redacted・size-capped の設計が必要
  - local-only log、redaction、size cap、action id、account/feed omission、support copy の decision を追加する

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

- [ ] P2 storage quota exhausted 時の cascading failure を preferences/sidebar/history/debug で検証する
  - 対象: localStorage-backed helpers、preferences store、runtime diagnostics
  - quota exceeded が一箇所で起きた後に warning storage も書けず、同じ failure が連鎖する可能性がある
  - preferences save、sidebar expanded folders、command history、diagnostics warning-once、recovery UI の contract を追加する

- [ ] P2 frontend schema parse failure の fallback data が UI action を enable しない contract を作る
  - 対象: `src/schemas`, Tauri command wrappers, view models
  - parse failure 時に empty fallback を使うと、本来 disabled にすべき destructive action が enabled になる可能性がある
  - account list parse failure、feed list parse failure、preference parse failure、empty fallback、disabled action の test を追加する

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

- [ ] P2 screen reader landmark / heading structure を reader/settings/subscriptions で固定する
  - 対象: app shell、reader panes、settings modal、subscriptions index
  - visual pane 構造が複雑なため、landmark と heading がないと screen reader で現在位置が分かりにくい
  - main/nav/complementary、modal heading、article heading、settings section heading、hidden pane の contract を追加する

- [ ] P2 focus visible token と keyboard-only operation を dense controls 全体で検証する
  - 対象: toolbar buttons、feed tree、article list、settings forms、command palette
  - mouse hover 前提の UI が増えると、keyboard-only 操作で focus ring が見えない箇所が残る
  - tab order、focus visible、selected vs focused、disabled controls、browser overlay controls の visual check を追加する

- [ ] P2 pointer target minimum size を compact toolbar / tree row / tag chip で棚卸しする
  - 対象: reader toolbar、feed tree、tag chips、settings action buttons
  - compact UI でクリック target が小さすぎると、desktop でも誤操作が増える
  - icon button size、row action affordance、tag chip remove、dense sidebar、touch trackpad tolerance の matrix を作る

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

- [ ] P2 release artifact provenance を PR / tag / workflow run の三点で照合する
  - 対象: release workflow、PR template、release manual verification
  - tag と artifact の source commit、PR、workflow run がずれると、何を配ったか追跡できない
  - tag SHA、workflow run id、PR merge commit、artifact checksum、release note commit range の gate を追加する

- [ ] P2 DB restore 後の query cache / localStorage / selected account reconciliation を固定する
  - 対象: DB restore flow、query client、ui/preferences stores
  - DB だけ巻き戻すと frontend 側に存在しない account/feed/tag の選択状態や cache が残る
  - selected account missing、expanded folder missing、query cache clear、command history cleanup、restart required の contract を追加する
  - superseded by: P1-Q4e (covered by DB restore frontend reconciliation; kept verification: selected account missing, query cache clear, restart required)

- [ ] P2 keyboard shortcut help の generated content と actual bindings を snapshot 化する
  - 対象: shortcuts help view、shortcut settings、app action registry
  - help に古い binding が残ると、custom shortcut や platform modifier の変更後に操作案内が嘘になる
  - default binding、custom binding、disabled action、platform modifier、locale copy の snapshot を追加する

- [ ] P2 screen reader announcement for sync/update progress を noisy queue にならないよう固定する
  - 対象: sync progress UI、updater UI、toast/live region
  - progress を細かく aria-live に流すと screen reader が操作不能になる一方、完了/失敗だけだと進行中が分からない
  - start、throttled progress、completion、failure、cancel、background sync suppressed の contract を追加する

- [ ] P2 color-only status indication を sync/account/feed/tag states で禁止する
  - 対象: reader/sidebar/settings status UI、DESIGN.md
  - 色だけで auth failure、syncing、muted、selected を示すと high contrast や色覚差で状態が伝わらない
  - icon/text pairing、aria label、high contrast、selected row、error state の visual/accessibility check を追加する

- [ ] P2 long article virtualization を導入する前の selection/search highlight contract を作る
  - 対象: article content view、search highlight、reader scroll restoration
  - 将来 virtualization を入れると scroll restore、text selection、search highlight、image loading の前提が変わる
  - selection preservation、find-in-article、scroll anchor、image lazy load、print/share future scope の decision を追加する

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

- [ ] P2 account recovery flow を credential reset / server URL fix / cache clear の三系統に分ける
  - 対象: account detail settings、sync error UI、diagnostics
  - すべての account failure を「認証情報更新」に寄せると、server URL typo や stale cache の復旧が遠回りになる
  - credential reset、server URL edit、test connection、sync_state clear、pending mutation quarantine の flow を整理する

- [ ] P2 provider capability downgrade を account settings / pending mutation queue と同期する
  - 対象: provider traits、pending mutation repository、settings account detail
  - provider version や設定変更で read/star/tag support が消えた時、queue と UI が古い capability 前提で残る
  - capability removed、queued mutation exists、UI disables action、sync warning、manual cleanup の contract を追加する
  - superseded by: P1-Q2d (covered by provider capability downgrade contract; kept verification: queued mutation exists and UI disables action)

- [ ] P2 keyboard-only recovery actions を error dialog/toast/settings debug で検証する
  - 対象: error surfaces、settings debug actions、toasts
  - 復旧導線が mouse 前提だと、キーボード操作ユーザーが backup restore/open log/retry に到達できない
  - retry button、open settings、open log dir、restore backup、dismiss toast、focus restore の E2E check を追加する

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

- [ ] P2 empty state が permission/auth/network/schema failure を同じ「空」として見せないようにする
  - 対象: reader lists、subscriptions index、settings account views
  - failure を empty と表示すると、ユーザーがデータ消失と誤解するか、復旧 action を見つけられない
  - true empty、auth failure、network failure、schema parse failure、permission denied の copy/state matrix を作る

- [ ] P2 stale warning/banner の dismiss persistence を account/feed/session scope で決める
  - 対象: stale content banner、sync warnings、settings diagnostics
  - 一度閉じた warning が別 account/feed でも消えると重要な failure を見落とし、逆に毎回出ると無視される
  - session dismiss、account scoped dismiss、feed scoped dismiss、new error reopens、manual reset の contract を追加する

- [ ] P2 account/feed/tag rename の optimistic UI と backend normalization 差分を固定する
  - 対象: rename account/feed/tag flows、repository validation、query cache
  - frontend 表示名と backend normalized name が違う場合、保存直後にちらつきや duplicate 判定ずれが起きる
  - trim、case fold、Unicode normalization、duplicate after normalization、optimistic rollback の contract を追加する

- [ ] P2 context menu target drift を right-click position / keyboard context menu で固定する
  - 対象: article list、feed tree、tag list context menus
  - context menu を開いた後に selection/refetch が変わると、表示対象と実行対象がずれる
  - pointer target snapshot、keyboard context target、refetch while open、target deleted、action disabled の contract を追加する

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

- [ ] P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する
  - 対象: `TODO.md`, task triage tooling
  - 目視だけでは P1/P2 の並列投入順を保ちにくい
  - priority parse、target parse、domain bucket、dependency hint、JSON export の script を追加する

- [ ] P3 risk TODO の重複 close / merge workflow を決める
  - 対象: `TODO.md`, CHANGELOG, future issue export
  - 類似タスクを統合する時に片方を消すだけだと、過去の判断理由や検証観点が失われる
  - merge marker、superseded by、completed by、CHANGELOG move、issue link の運用を決める
