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

- [ ] P2 `provider-sync`: startup sync / remote-state repair / automatic scheduler enable の結果契約を固定する
  - work type: startup lifecycle contract
  - write scope: startup sync command、remote-state repair marker、automatic sync enable path、startup sync storage tests
  - acceptance: startup sync 対象と repair-only 対象が混在しても、成功/部分失敗/全失敗の result、repair marker、automatic scheduler enable、last-trigger storage が矛盾しない
  - focused verification: preferred account missing、repair-only success with no startup accounts、startup account failure plus repair success、repair marker write failure、automatic sync enable skipped/allowed
  - defer: scheduler tick backoff や Retry-After policy は既存 provider-sync タスクへ残す

### App Shell / Command Palette / Dev Intent

### Reader UI / Account Settings

### Dev / Tooling / E2E / Test Helpers

- [ ] P3 `quality-tooling`: browser-only dev mock の destructive / external side effect parity を固定する
  - work type: dev runtime contract
  - write scope: browser-only dev mocks、test Tauri mocks、dev mock parity tests、external-opener diagnostics
  - acceptance: external opener、reading list、browser WebView、feed integrity cleanup、import 系 side effect が mock runtime で observable / dry-run-safe / explicitly unsupported のいずれかに分類され、未知 command は fail fast する
  - focused verification: schema-backed command without mock case、external open recorded、cleanup mock dry-run remains non-destructive、mock runtime reset、unknown command diagnostics
  - defer: live provider env tests と real Tauri IPC behavior は別タスクにする

### Rust Provider / DB / Scheduler

- [ ] P2 `provider-sync`: compressed feed response の decoded body limit と diagnostics を固定する
  - work type: performance/security contract
  - write scope: local provider HTTP client、feed discovery/fetch、response body limit、network diagnostics
  - acceptance: gzip/brotli の raw bytes が上限内でも展開後に巨大化する feed を、memory pressure 前に user-visible error へ落とす
  - focused verification: identity/gzip/brotli、decoded size over limit、partial decode error、diagnostic redaction、user-visible error copy
  - defer: streaming parser 導入や parser crate 変更は別タスクにする

- [ ] P2 `provider-sync`: GReader JSON response の decoded body cap と diagnostics を local feed body cap と同等にする
  - work type: performance/security contract
  - write scope: GReader provider HTTP calls、shared HTTP body limit helper、provider diagnostics、GReader provider tests
  - acceptance: 巨大または圧縮で膨らむ GReader JSON が parse 前に上限エラーになり、Authorization や server URL を diagnostics に漏らさない
  - focused verification: unread-count oversized JSON、stream contents oversized JSON、stream item IDs oversized JSON、gzip decoded-over-limit、malformed partial JSON、redacted error
  - defer: GReader pagination strategy や server-side rate-limit policy は別タスクにする

- [ ] P2 `provider-sync`: account/feed delete と background sync の concurrent mutation boundary を固定する
  - work type: race condition contract
  - write scope: account commands、feed commands、sync scheduler、sync flow repository writes、query invalidation
  - acceptance: delete 中の account/feed に対して in-flight sync が article/cache/retry state を書き戻しても削除済みデータが復活しない
  - focused verification: delete during fetch、delete before persist、sync completes after delete、retry state cleanup、frontend invalidation order
  - defer: multi-process DB lock redesign は別タスクにする

### Query / Store / Browser Runtime

- [ ] P2 `reader-state`: browser WebView event の load generation / requested URL 世代管理を close-reopen で固定する
  - work type: native event lifecycle contract
  - write scope: browser webview event bridge、browser state reducer、browser cleanup hook、Tauri event schemas
  - acceptance: close 後や別 URL 作成後に late `state-changed` / `fallback` / `closed` event が届いても、新しい browser state を stale event で上書きしない
  - focused verification: close then late state event、reopen same URL new generation、fallback from old URL、malformed event warning dedupe、listener cleanup
  - defer: WebView geometry/DPI policy は別タスクにする

- [ ] P3 `quality-tooling`: localStorage quota / unavailable cascade の surfaced warning 数を storage user ごとに固定する
  - work type: runtime diagnostics contract
  - write scope: preferences store、command history、sidebar expansion storage、runtime diagnostics suppression tests
  - acceptance: storage quota や SecurityError が 1 surface で起きても、別 surface の storage failure が過剰抑制または重複連打されない
  - focused verification: preferences write quota、command history write quota、sidebar expansion normalize failure、diagnostic once reset、user-visible fallback absence
  - defer: storage backend の IndexedDB 移行は別タスクにする

### Reader Content / Feed Discovery / Security

- [ ] P2 `security-privacy`: provider error redaction policy を local/GReader/discovery/test connection で横断固定する
  - work type: error surface contract
  - write scope: `DomainError` mapping、local provider、GReader provider、feed discovery、account connection test、toast/diagnostics
  - acceptance: URL query、userinfo、Authorization header、server error body の扱いが provider surface ごとに違っても credential や internal URL を漏らさない
  - focused verification: auth failure、429、500 body、network timeout、malformed URL、connection test failure の redacted message parity
  - defer: diagnostics export UI は support dump gate の別タスクにする

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

- [ ] P2 `release-native`: Tauri capability / permission / plugin drift を release gate と app runtime で二重化する
  - work type: release security contract
  - write scope: `src-tauri/capabilities`、Tauri config、release workflow checks、runtime command availability tests
  - acceptance: debug-only plugin/permission、browser-webview capability、updater/opener/clipboard permissions が workflow だけでなく repo test でも drift 検出される
  - focused verification: dev vs release config、MCP bridge permission absence、browser-webview capability minimality、unused command removal、release artifact config
  - defer: permission model の全面再設計は別タスクにする

- [ ] P3 `release-native`: always-on-top preference と fullscreen/native window state の再同期契約を固定する
  - work type: native runtime preference contract
  - write scope: window always-on-top hook、fullscreen actions、window helper tests、native manual verification notes
  - acceptance: `window_always_on_top=true` の状態で fullscreen toggle、native rejection、runtime drift が起きても最新 intent だけが適用され、警告だけで終わる drift を残さない
  - focused verification: preference on then fullscreen enter/exit、setAlwaysOnTop rejection、isFullscreen rejection、rapid preference toggle、unsupported platform error suppression
  - defer: window-state plugin 導入、座標/最大化/フルスクリーン復元は対象外

### Database / Updater / Window

- [ ] P2 `db-recovery`: startup migration recovery message と backup restore runbook の drift を防ぐ
  - work type: recovery documentation contract
  - write scope: startup error messages、backup path redaction、log/support checklist、database recovery tests
  - acceptance: migration failure、persistence failure、integrity failure の user-visible message が削除推奨や raw path leakage を再導入しない
  - focused verification: migrated-but-restored DB error、permission denied、integrity check failure、backup directory label、support checklist wording
  - defer: GUI restore wizard 実装は別タスクにする

- [ ] P2 `db-recovery`: feed integrity cleanup の dry-run / execute snapshot drift を固定する
  - work type: data cleanup contract
  - write scope: feed integrity report command、cleanup command、feed integrity schemas、subscriptions index cleanup UI/tests
  - acceptance: dry-run から execute までに feed/article state が変わっても、新しく紐付いた記事を削除せず、deleted/count mismatch を user-visible partial result として扱う
  - focused verification: dry-run then feed restored、dry-run then new orphan appears、cleanup transaction failure、deleted count exceeds dry-run count、UI invalidation failure
  - defer: full database repair wizard、migration recovery policy、manual backup restore UI は別タスクにする

### Article List / Schema / Mute / Tags / Share

- [ ] P2 `reader-state`: tag delete / rename 中の tag view・tag picker・command palette selection cleanup を固定する
  - work type: stale selection contract
  - write scope: tag commands/hooks、tag view source resolution、article tag picker、command palette resource groups
  - acceptance: 選択中 tag が delete/rename されても、tag view が missing tag を表示し続けず、picker と command palette の stale option が安全に閉じる
  - focused verification: delete selected tag、rename selected tag、picker open during delete、command palette open during tag update、query invalidation failure
  - defer: tag merge / bulk tag editing は別タスクにする

- [ ] P2 `settings-state`: mute keyword auto-mark-read と scope update の stale success rollback を query invalidation まで固定する
  - work type: async mutation contract
  - write scope: mute settings hooks、mute keyword commands、article list sources、query invalidation helpers
  - acceptance: 古い auto-mark/scope 更新の success/error が新しい設定値・article read state・toast を巻き戻さない
  - focused verification: scope update races、auto-mark toggle races、selected account switch、invalidation reject、retained article after mute filter change
  - defer: mute matching algorithm の Unicode 拡張は別タスクにする

- [ ] P2 `security-privacy`: article share actions の URL policy parity を copy/open/reading-list/mailto/native menu で固定する
  - work type: share action security contract
  - write scope: article browser actions、article share menu、native menu share actions、share command schemas、action tests
  - acceptance: credential URL、control character URL、unsupported scheme、private URL の扱いが copy link / external open / reading list / email share / native menu 経由でばらつかず、raw unsafe URL を clipboard や mailto body に流さない
  - focused verification: copy credential URL、copy javascript URL、email share invalid URL、native menu share with stale selected article、reading-list unsupported scheme、toast category parity
  - defer: share UI の表示順や provider-specific reading list 対応は別タスクにする

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

- [ ] P2 `security-privacy`: embedded browser shortcut bridge の platform 差と remote-page command reachability を固定する
  - work type: browser runtime security contract
  - write scope: browser WebView bridge、Windows postMessage bridge、non-Windows invoke bridge、capability contract tests
  - acceptance: non-Windows の `__TAURI_INTERNALS__.invoke` bridge と Windows の `postMessage` bridge が、action allowlist、URL/snapshot 一致、permission denial、stale page を同じポリシーで扱う
  - focused verification: remote page tries unsupported action、stale URL bridge message、encoded-equivalent URL、permission denied invoke、mouse back close fallback
  - defer: browser-webview capability minimality 全体は既存 release-native タスクへ残す

- [ ] P2 `release-native`: release provenance / checksum / dependency provenance upload の partial failure recovery を固定する
  - work type: release workflow contract
  - write scope: `.github/workflows/release.yml`、release provenance scripts、GitHub release upload steps、release repo contract tests
  - acceptance: checksum upload、dependency provenance upload、release provenance upload のどこかが失敗しても、再実行時に clobber 対象・欠落 asset・draft/prerelease 状態が判別できる
  - focused verification: missing checksum asset、one provenance asset missing、`gh release upload --clobber` failure、rerun after partial upload、draft release asset inventory
  - defer: artifact signing provider や SBOM format の変更は別タスクにする
