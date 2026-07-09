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

- P3 local-sync auto-sync accepted debt (created batch: 2026-07-04)
  - priority: P3 / domain: provider-sync / work type: contract test + implementation / write scope: src-tauri local_account_sync service+commands
  - 手動 export 成功後に digest を更新せず、直後の auto-export が冗長 full snapshot を 1 回書く(収束するため許容中)。修正時は manual export 後に `save_export_digest` を呼ぶ
  - contract test 未整備: empty-operations の digest/export 挙動、auto-import の Err 分岐・rejected-only warning 分岐の単体カバー
  - merge レベル `rejected_operations` は auto path で warning にならず silent drop(手動 import では件数可視)。発見方法: focused test
  - pre-existing: `trigger_startup_sync` の warnings は SyncResult 返却のみで sync-warning event を emit しない(起動時は toast なし、次の scheduler cycle で toast される)

### App Shell / Command Palette / Dev Intent

### Reader UI / Account Settings

- P3 reader "next article" button no-op at last article (created batch: 2026-07-08)
  - priority: P3 / domain: reader-state / work type: implementation-time checklist + implementation / write scope: reader body 下部の次記事ボタン + 呼び出し元 hook(article/use-article-view-selection 系)
  - 「次の記事」ボタンが最後の記事でも表示され、クリックしても無反応(no-op)になる。末尾記事ではボタンを無効化または非表示にするか検討する
  - 理由: DESIGN.md の「押せそうで何も起きない」アンチパターンに軽く抵触する。ただしリスト文脈(次記事の有無)を reader body へ配線するコストがあるため要検討。発見方法: 実装時チェックリスト + 手動確認

- P2 recent smart view empty-state summary omits "recent" source (created batch: 2026-07-08)
  - priority: P2 / domain: reader-state / work type: implementation + contract test / write scope: src/lib/reader/reader-source-articles.ts + 呼び出し元(use-article-list-sources.ts, use-article-view-selection.ts)
  - `resolveReaderSourceArticles` が `recent` ソースを受け取れず fallback(account 全体)に落ちるため、「最近見た記事」スマートビューの空状態サマリ集計が正しくない可能性がある。表示・集計側のソース列挙を recent 対応に揃える。発見方法: focused test(`resolveReaderSourceArticles` の recent ケース)

- P3 local-sync enabled toggle polish (created batch: 2026-07-04)
  - priority: P3 / domain: settings-state / work type: implementation + contract test / write scope: use-account-detail-danger-zone + locales
  - 自動同期トグルの楽観更新は persist 失敗時にロールバックしない(既存 handleSaveLocalSyncFolder と parity、保存中は switch disabled + エラー toast あり)。failure-path test も未整備
  - トグル単体の即時保存が `account.local_sync_settings_saved`(「ローカル同期フォルダを保存しました」)を流用。専用 toast キー追加候補。発見方法: focused test

### Dev / Tooling / E2E / Test Helpers

### Rust Provider / DB / Scheduler

### Query / Store / Browser Runtime

### Reader Content / Feed Discovery / Security

### Release / Native / Keyboard / I18n / A11y

- P3 tauri-系 skill の配置先検討(created batch: 2026-07-10)
  - priority: P3 / domain: release-native / work type: 意思決定タスク(実装なし) / write scope: なし(検討のみ)
  - 現状 `~/.apm`(global apm.yml)にある `EpicenterHQ/epicenter/.agents/skills/tauri`、catalog の `tauri-icon-gen`、`tauri-webview-geometry` はこのリポジトリでしか使っていない。このリポジトリの repo-local `apm.yml` へ移すか、あるいは tauri 系 skill 専用の別リポジトリを新設して切り出すかを検討する
  - 発見方法: 検討のみのため N/A。決定後 `apm-repo-bootstrap` skill で移管作業を行う

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
