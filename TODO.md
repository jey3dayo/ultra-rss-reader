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

#### Tauri updater 署名鍵運用と rollout 方針の文書化

- [ ] priority: P3 / domain: release-native / work type: policy / documentation
  - created batch: 2026-06-13
  - 対象: `docs/` および `.claude/rules/` のみ(実装変更なし)
  - scope: auto-updater は採用済み(`tauri-plugin-updater` + Ed25519 署名、GitHub Release の `latest.json` endpoint、pubkey は `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` フィールドに焼き込み済み、鍵は 1Password に保管済み)。未文書化の運用ギャップを記録する:
    - (a) updater 署名鍵のローテーション手順と、鍵喪失・漏洩時に更新配信を継続する復旧手順(pubkey はアプリバイナリに焼き込まれるため、鍵を失うと既存ユーザーへ更新を届けられなくなる)
    - (b) staged rollout が無い(全ユーザーへ即時配信)ことを accepted-risk として明文化するか判断
  - acceptance criteria: 鍵ローテーション・喪失時の手順が `docs/` か `.claude/rules/` に記録され、staged rollout 不在の扱い(accepted-risk か将来 TODO か)が明文化される。実装変更は別 TODO に切り出す(defer 範囲)
  - focused verification: ドキュメントゲート(markdown format check)
  - 発見方法: 2026-06-13 プレモーテム分析(implementation-time checklist 分類)

### Article List / Schema / Mute / Tags / Share

### Feed / Folder / Storage / Settings Data

### GReader / Sync Flow / Account Setup

#### FreshRSS / GReader 双方向同期 conflict resolution contract test

- [ ] priority: P2 / domain: provider-sync / work type: contract test
  - created batch: 2026-06-13
  - 対象: `src-tauri/src/service/sync_flow.rs`、`src-tauri/src/service/sync_scheduler.rs`、`src-tauri/src/repository/pending_mutation.rs` のテストコード
  - scope: FreshRSS / GReader 双方向同期の競合解決規則を contract test として固定する。プロダクションコードの挙動変更はしない
  - 対象境界値:
    - (a) ローカル pending mutation(read / star)とリモート状態変更が衝突した場合にどちらが勝つか
    - (b) pending mutation 再送の冪等性(同じ mutation が二重適用されても状態が壊れない)
    - (c) 同期中断(部分失敗)後の再同期で状態が収束すること
  - acceptance criteria: 上記 (a)(b)(c) が test 名から読める focused test として追加され、現在の実装挙動が固定される。意図と異なる挙動が見つかった場合は修正せず別 TODO に切り出す(defer 範囲)
  - focused verification: `mise run check`(Rust tests 含む)
  - 発見方法: 2026-06-13 プレモーテム分析(focused test で発見・固定する分類)

### Browser WebView / Runtime Diagnostics
