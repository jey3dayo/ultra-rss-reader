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

#### Tauri updater adoption preflight

- [ ] priority: P3 / domain: release-native / work type: adoption preflight / policy
  - created batch: 2026-06-13
  - 対象: `docs/` および `.claude/rules/` のみ(preflight 記録ドキュメント、または accepted-risk rule 追記)
  - scope: 現状 auto-updater は未採用で配布は GitHub Release の手動取得のみ。P0 修正がユーザーへ確実に届く経路がない。Tauri updater 採用可否の判断材料を preflight として記録するか、採用しない場合は「手動配布のみ」を accepted-risk として `.claude/rules/` に明文化する
  - preflight で記録する項目:
    - updater 署名鍵の運用(鍵は 1Password に保管済み)
    - DB schema downgrade block との相互作用(更新後に旧バージョンへ戻れない制約)
    - rollout / rollback 方針
    - 採用しない場合の accepted-risk 明文化先
  - acceptance criteria: 採用可否の判断材料が揃った preflight ドキュメントが残るか、または「手動配布のみ」の accepted-risk が `.claude/rules/` に記録される。実装着手は別 TODO に切り出す(defer 範囲)
  - focused verification: ドキュメントゲート(markdown format check)
  - 発見方法: 2026-06-13 プレモーテム分析(implementation-time checklist 分類)

### Database / Updater / Window

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

#### FreshRSS / GReader 双方向同期 conflict resolution contract test

- [ ] priority: P2 / domain: provider-sync / work type: contract test
  - created batch: 2026-06-13
  - 対象: `src-tauri/` 内の sync service および pending mutation repository のテストコード
  - scope: FreshRSS / GReader 双方向同期の競合解決規則を contract test として固定する。プロダクションコードの挙動変更はしない
  - 対象境界値:
    - (a) ローカル pending mutation(read / star)とリモート状態変更が衝突した場合にどちらが勝つか
    - (b) pending mutation 再送の冪等性(同じ mutation が二重適用されても状態が壊れない)
    - (c) 同期中断(部分失敗)後の再同期で状態が収束すること
  - acceptance criteria: 上記 (a)(b)(c) が test 名から読める focused test として追加され、現在の実装挙動が固定される。意図と異なる挙動が見つかった場合は修正せず別 TODO に切り出す(defer 範囲)
  - focused verification: `mise run check`(Rust tests 含む)
  - 発見方法: 2026-06-13 プレモーテム分析(focused test で発見・固定する分類)

### Browser WebView / Runtime Diagnostics
