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

- priority: P2 / domain: reader-state / work type: contract test
  - 対象: macOS 埋め込みブラウザの `browser_preview_close_bridge_source` が注入する actionQueue / drainActionQueue / queueBridgeAction の実際のドレイン挙動(FIFO順・connectionDrainInFlightの解放・setTimeout(0)による直列化)を、生成された JS 文字列の部分一致ではなく実行時に検証するテストが無い
  - write scope: `src/__tests__/` 配下の新規テストファイル(生成スクリプトを抽出して jsdom 環境で評価する新しいハーネスが必要)
  - acceptance criteria: 連続キーダウン(異なるアクション2件以上)を模擬し、`location.href` への代入が正しい順序・件数で行われることをアサートする
  - focused verification: 新規 focused test。既存の `mise run test:unit:dom` に組み込む
  - defer 範囲: 現時点では手動実機確認(macOS, 連打含む)と静的コードレビューで正しさを確認済み。新規 jsdom 実行ハーネスの投資対効果が上がったタイミングで着手する
