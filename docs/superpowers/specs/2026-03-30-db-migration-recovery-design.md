# DB Migration Recovery Design

## Summary

DB マイグレーションを単一トランザクションで実行し、失敗時は自動バックアップからのリストアを試みたうえで fail-fast する。
起動エラーメッセージには、復旧結果、DB/バックアップの場所、手動リストア手順を含める。

## Goals

- migration SQL の途中失敗で DB が中間状態に陥らないようにする
- migration 実行前の自動バックアップを既存フローに組み込み、失敗時に自動リストアできるようにする
- リストア成功後も旧スキーマのままアプリを起動させず、明確なエラーで停止する
- ユーザーが状況を把握できるよう、起動エラーにバックアップ場所と手動リストア手順を含める
- 成功時のみ古いバックアップを少数世代で整理する

## Non-Goals

- 起動後 UI の専用ダイアログやウィザードを追加すること
- OS ごとの詳細なリストアコマンドを案内文に埋め込むこと
- migration journal や専用メタファイルを追加すること
- 既存 migration SQL ファイルの責務を再設計すること

## Current State

- `infra/db/connection.rs` は起動時に schema version を確認し、fresh DB でなければ migration 前にバックアップを作成する
- migration 失敗時はバックアップからの restore を試み、restore 成功後も `DomainError::Migration` を返して fail-fast する
- `infra/db/backup.rs` には DB 本体と `-wal` / `-shm` のバックアップ・リストア・世代整理がある
- `src-tauri/src/lib.rs` には migration 専用の初期化失敗メッセージ分岐があり、DB 削除を勧めない文言も一部入っている
- ただし `infra/db/migration.rs` の `run_migrations` は各 `execute_batch` を逐次実行しており、migration 全体を単一トランザクションでは包んでいない
- また `rusqlite::Error` は既定では `DomainError::Persistence` に変換されるため、migration 経路では明示的に `DomainError::Migration` に寄せる必要がある

## Design

### Approach

`transaction + backup + restore + fail-fast` を採用する。

- transaction: migration SQL の途中失敗で中間状態を作らない
- backup/restore: transaction だけでは吸収しきれないファイル単位の異常に備える
- fail-fast: 旧スキーマの DB でアプリを継続起動させない

この構成なら、既存の `DbManager` 初期化フローを大きく崩さずに TODO の 3 項目を満たせる。

### Responsibility Boundaries

- `infra/db/migration.rs`
  - migration 実行責務を持つ
  - 全バージョン適用を単一トランザクション内で行う
  - migration 由来の失敗を `DomainError::Migration` として返す
- `infra/db/connection.rs`
  - 起動時初期化の司令塔を維持する
  - `schema version 確認 -> バックアップ -> migration -> restore -> fail-fast` の順序を管理する
- `infra/db/backup.rs`
  - DB 本体と WAL/SHM の退避・復元だけを担当する
  - transaction 成否の判断は持たない
- `src-tauri/src/lib.rs`
  - 人間向けの初期化失敗メッセージを組み立てる

### Execution Flow

起動時の DB 初期化フローは次の通りとする。

1. DB を開いて `schema_version` を確認する
2. `current_version < LATEST_VERSION` かつ fresh DB でない場合だけバックアップを作成する
3. migration を単一トランザクションで実行する
4. 成功したらコミットし、古いバックアップを世代管理で整理する
5. 失敗したらトランザクションをロールバックする
6. rollback 後、transaction ハンドルと全 SQLite 接続を必ず解放する
7. バックアップがあれば restore を試みる
8. restore では DB 本体に加えて、必要なら `-wal` / `-shm` も復元または整理する
9. restore 成功後も起動を継続せず、migration failure として停止する

fresh DB の初回作成時は、バックアップを取らず transaction migration のみ実行する。
すでに最新 schema の DB では、バックアップも migration も no-op に近い現在挙動を維持する。

### Migration Transaction Strategy

`run_migrations` は migration 全体を 1 つのトランザクションに包む。

- `from_version` は transaction 開始前に読む
- `from_version` より新しい migration を順番に適用する
- 1 つでも失敗したら transaction 全体を rollback する
- 成功時のみ commit し、`to_version` を再取得して `MigrationResult` を返す

重要なのは、「各 SQL ファイルを個別 transaction にする」のではなく、「起動時に必要な残り migration 全体をまとめて 1 transaction」にする点である。
これにより、`v3 -> v5` のような複数段 migration でも途中状態を残さない。

### Error Handling

失敗パターンごとの扱いを固定する。

- バックアップ作成失敗
  - migration を開始しない
  - `DomainError::Migration` で停止する
- migration SQL 失敗
  - transaction を rollback する
  - rollback 後、transaction ハンドルと全接続を drop してから restore に進む
  - バックアップから restore を試みる
  - restore 成功後も fail-fast する
- restore 失敗
  - 「migration 失敗」と「restore 失敗」の両方が分かる `DomainError::Migration` を返す
- バックアップが存在しない
  - restore は行わず、その旨を含めて `DomainError::Migration` を返す

`rusqlite::Error` をそのまま `Persistence` に落とすと `lib.rs` 側で migration recovery 用の文言に分岐できない。
そのため migration 実行経路では、`rusqlite::Error` を `DomainError::Migration` に変換して返す。

restore 前の接続解放は実装上の必須条件とする。
`restore_backup` は DB 本体と `-wal` / `-shm` をファイルコピーで置き換えるため、writer や transaction が生きたままだと Windows ではロックで失敗しやすく、他 OS でも WAL 整合性を崩しうる。
そのため spec 上も、「rollback したので安全」ではなく「rollback 後に接続を解放してから restore する」ことを明示的な不変条件として扱う。

### User-Facing Error Message

起動時の migration 失敗メッセージには次を含める。

- migration に失敗したこと
- 自動リストアを試みた結果
- DB パス
- DB ファイルを削除しないこと
- アプリの更新またはサポート連絡を促す文言

加えて、バックアップに関する案内は状態で分岐する。

- バックアップが実在し、手動復旧に使える場合
  - バックアップファイルの場所を表示する
  - 手動リストア手順を表示する
- バックアップ作成失敗、または restore に使えるバックアップが存在しない場合
  - `Backup path` は表示しない
  - 手動リストア案内は出さず、「利用可能なバックアップがない」ことを明示する

文言イメージ 1: バックアップあり

```text
Failed to initialize database: Migration error: ...
Database path: ...
Backup path: ...
Automatic restore: succeeded and restored the database to v4.
Do not delete the database file.
If you need to restore manually, close the app and restore the backup set for the database file, including any matching -wal / -shm files if they exist.
Please update the application or contact support.
```

文言イメージ 2: バックアップなし

```text
Failed to initialize database: Migration error: ...
Database path: ...
Automatic restore: not available because no usable backup was created.
Do not delete the database file.
Please update the application or contact support.
```

OS ごとの具体コマンドは出さず、一般手順に留める。
今回の失敗は起動前に発生するため、起動後 UI に依存する導線は持たせない。

手動リストア手順は「DB 本体だけを置き換える」ではなく、「バックアップ一式を戻す」ことを案内する。
具体的には、バックアップされた DB 本体に加え、対応する `-wal` / `-shm` が存在する場合はそれらも復元対象とし、存在しない場合は現在の `-wal` / `-shm` を残さない前提で案内する。

### Backup Retention

自動バックアップは成功時のみ整理し、少数世代を保持する。

- keep 数は現状どおり 3 世代を前提とする
- migration 失敗時は問題解析や手動復旧に使えるよう、関連バックアップを削除しない
- 最新 schema で migration 不要の場合は新しいバックアップを作らない

## Alternatives Considered

### 1. Backup/Restore Only

transaction を追加せず、既存の backup/restore だけで守る案。
実装差分は小さいが、途中失敗で中間状態に陥るリスクを直接は潰せないため不採用。

### 2. Migration Journal

どの migration まで進んだかを別テーブルやメタファイルで追跡する案。
現在の規模には過剰であり、運用コストに見合わないため不採用。

## Testing

### Migration

- fresh DB が transaction migration で最新 version まで到達する
- すでに最新 schema の DB では no-op になる
- `v1 -> latest` や `v3 -> latest` の複数段 migration が成功する
- 途中 migration が失敗したとき、schema とデータが中間状態にならない

### Recovery

- fresh DB ではバックアップを作成しない
- 最新 schema の DB ではバックアップを作成しない
- migration 失敗時に restore が走り、元データと元 schema version が保たれる
- migration 失敗時に、restore 前に transaction と全接続が解放される
- restore 成功後も `DbManager::new` は fail-fast する
- restore 失敗時に、migration と restore の二重失敗が分かるエラーになる
- バックアップ作成失敗時に migration を開始しない

### User Message

- migration recovery 用メッセージが DB 削除を勧めない
- バックアップがある場合だけ、migration recovery 用メッセージにバックアップ場所が含まれる
- バックアップがある場合だけ、migration recovery 用メッセージに手動リストアの一般手順が含まれる
- バックアップがない場合は、その旨が明示され、存在しない `Backup path` を案内しない
- 手動リストア案内が `-wal` / `-shm` を含むバックアップ一式の復元前提になっている
- 非 migration エラーでは従来どおりの一般的な削除案内を維持する

## Risks

- SQLite DDL の transaction 挙動に依存するため、各 migration SQL が transaction 内実行可能であることを前提にする
- backup/restore はファイル操作を伴うため、権限不足やディスク容量不足では別系統の失敗が起きうる
- `Backup path` をメッセージに出す以上、エラー生成側で backup ファイル名を確実に把握できる設計に寄せる必要がある
