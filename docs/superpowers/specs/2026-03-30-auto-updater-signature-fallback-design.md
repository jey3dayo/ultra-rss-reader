# Auto Updater Signature Verification and Fallback Design

既存の [`2026-03-29-auto-updater-design.md`](./2026-03-29-auto-updater-design.md) を前提に、自動アップデートの署名検証、ダウンロード失敗時の扱い、フォールバック動作を明確化する。

対象 TODO:

- `tauri.conf.json` の updater 設定で公開鍵が正しく設定されていることを確認する
- ダウンロード中断時のリトライ/レジューム戦略を検討する
- アップデート失敗時のフォールバック動作をテストする

## Scope

今回の対象は以下に限定する。

- updater 公開鍵設定の検証方法を定義する
- ダウンロード失敗時のアプリ挙動を定義する
- 失敗時の UI メッセージと再試行導線を定義する
- 自動テストと手動検証の責務分担を定義する

今回の対象外:

- 旧バージョンへの明示的なロールバック機構
- HTTP Range を使ったレジュームダウンロード
- 独自の更新配布基盤

## Decisions

| 決定事項 | 選択 | 理由 |
| --- | --- | --- |
| ロールバックの定義 | 新版適用を中止し、現行版を継続利用する | Tauri updater の標準挙動と整合し、実装と運用が単純 |
| ダウンロード失敗時の再試行 | 自動再試行しない | 署名不一致や install failure に対して誤った再試行を避ける |
| ダウンロード中断時の再開 | レジュームしない。次回は先頭から再ダウンロード | 独自状態管理を持たず、壊れた途中状態を残さない |
| 公開鍵確認 | 設定値の存在確認 + リリース生成物で確認 | 静的設定だけでは実運用の署名不整合を防げない |
| フォールバック確認 | 自動テスト + 手動検証の二段構え | 署名不一致の完全自動化は環境依存が強い |

## Current Context

現状では以下がすでに入っている。

- [`src-tauri/tauri.conf.json`](../../../src-tauri/tauri.conf.json) に updater endpoint と `pubkey` が設定されている
- [`.github/workflows/release.yml`](../../../.github/workflows/release.yml) で `TAURI_SIGNING_PRIVATE_KEY` と `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` を `tauri-action` に渡している
- [`src-tauri/src/commands/updater_commands.rs`](../../../src-tauri/src/commands/updater_commands.rs) に `check_for_update` と `download_and_install_update` がある
- [`src/hooks/use-updater.ts`](../../../src/hooks/use-updater.ts) で起動時確認、進捗表示、完了通知を行っている

今回の設計は、この既存実装を置き換えるのではなく、失敗時の扱いを固定して堅牢化するものとする。

## Architecture

### 1. 公開鍵確認

公開鍵確認は 2 層で行う。

1. 設定確認
   - `src-tauri/tauri.conf.json` の `plugins.updater.endpoints` が空でないこと
   - `plugins.updater.pubkey` が空文字でないこと
2. 運用確認
   - リリース時に `latest.json` が生成されること
   - 署名付き updater artifact がドラフトリリースに添付されること

`tauri signer` にはこのリポジトリの現行 CLI で公開鍵から直接 verify するサブコマンドが見当たらない。そのため、署名整合性は updater 実行とリリース生成物で検証する。

### 2. ダウンロード失敗時の制御

[`src-tauri/src/commands/updater_commands.rs`](../../../src-tauri/src/commands/updater_commands.rs) の責務は次の通りとする。

- `DOWNLOADING` フラグは成功・失敗を問わず必ず解除する
- 失敗時は `AppError::UserVisible` を返し、フロントエンド側で説明可能な形にする
- 中断後の途中状態を再利用しない
- 次回の更新操作は `check_for_update` を経由し、新しい update handle を取り直す

`PendingUpdate` は「最後に成功した update check の結果を一時的に使い回す」ためのキャッシュに留める。失敗後に stale な handle を前提に再試行する設計にはしない。

### 3. フロントエンドのフォールバック UX

[`src/hooks/use-updater.ts`](../../../src/hooks/use-updater.ts) では、`downloadAndInstallUpdate` が失敗したときに単に「失敗した」と出すだけでなく、現行版継続を明示する。

想定メッセージ:

- `アップデートに失敗しました。現在のバージョンを引き続き使用します。`

再試行導線:

- 自動再試行はしない
- 必要ならトーストに `もう一度確認` アクションを付け、更新確認からやり直す
- あるいは既存のメニュー `Check for Updates...` を再利用する

重要なのは、失敗後に「アプリは壊れていない」「次回は最初からやり直す」が一貫してユーザーに伝わること。

## Data Flow

```text
起動 or 手動更新確認
  -> check_for_update
  -> update handle を PendingUpdate に保存
  -> download_and_install_update
  -> 成功:
       progress event
       -> install
       -> update-ready event
  -> 失敗:
       DOWNLOADING を解除
       -> UserVisible error を返す
       -> フロントで現行版継続トースト表示
       -> 次回は check_for_update から再開
```

## Error Handling

| ケース | バックエンド | フロントエンド | 結果 |
| --- | --- | --- | --- |
| ネットワーク断 | `AppError::UserVisible` または `Retryable` | 失敗トーストを表示 | 現行版継続 |
| ダウンロード中断 | 同上 | 失敗トーストを表示 | 現行版継続、次回は先頭から再ダウンロード |
| 署名検証失敗 | `AppError::UserVisible` | 検証失敗または更新失敗トーストを表示 | 現行版継続 |
| install failure | `AppError::UserVisible` | 失敗トーストを表示 | 現行版継続 |

エラー分類を細かく増やしすぎず、少なくとも UI 上は「現行版継続」という収束点を揃える。

## Testing

### 自動テスト

1. 設定検証
   - `src-tauri/tauri.conf.json` を読み、`plugins.updater.endpoints[0]` と `pubkey` が存在することを確認する
2. `use-updater` の失敗系
   - `downloadAndInstallUpdate` が失敗した場合に、現行版継続を示すトーストを表示する
   - `DOWNLOADING` の解除により次回操作が妨げられないことを確認する
3. 必要なら action 導線
   - `もう一度確認` を採用する場合は、その action が再チェック関数につながることを確認する

### 手動検証

1. 正常系
   - 署名付きドラフトリリースから更新できる
2. ダウンロード失敗系
   - 通信遮断などで更新失敗後も現行版が使い続けられる
3. 署名不整合系
   - 公開鍵不一致または不正署名の artifact に対して更新が適用されない
   - 失敗後も現行版が使い続けられる

### 完了条件

この TODO が完了したと見なす条件:

- updater 公開鍵の設定確認が自動テストまたはチェックコードで固定されている
- ダウンロード中断時に自動再試行もレジュームもしない方針がコードに反映されている
- 更新失敗後に現行版継続を明示する UI がある
- フォールバック動作を確認する自動テストと手動検証手順が揃っている

## File Changes

今回の実装で変更対象になる想定ファイル:

- `src-tauri/src/commands/updater_commands.rs`
- `src/hooks/use-updater.ts`
- `src/__tests__/hooks/use-updater.test.ts`
- `src/__tests__/api/tauri-commands.test.ts` または設定検証用テスト
- `src-tauri/tauri.conf.json` を参照する検証コード

設定値そのものを差し替えるのではなく、整合性確認と失敗時動作の固定が主目的である。
