# Remote State Reconciliation

リモート状態(既読・スター等)をローカル DB へ一括反映する reconciliation 処理の順序ルール。

## 制約

- `apply_remote_state` のような「リモート状態でローカルを上書きする」処理に渡す保護リスト(pending mutations 等)は、**apply と同一の DB ロック / トランザクション内で読み直す**
- ネットワーク越しの `pull_state()` など `.await` を含む処理の**前に**取ったスナップショットを apply に使い回さない
- push 済みでローカル queue から削除した mutation の ID は、リモートがまだ反映していない可能性があるため、同一 sync 内では保護リストへマージし続ける

## 根拠

`rust-async-mutex.md` に従い DB ロックを `.await` またぎで保持しないため、「保護リスト取得」と「apply」は別々のロックスコープになる。この間にネットワーク待ち(数秒)が挟まると、その窓でユーザーが記事を既読化した場合に保護されず、古いリモート状態(未読)で巻き戻される TOCTOU 競合になる。

実例: 本番アプリで「記事を読んでも既読にならない」不具合。sync の pull_state 中に読んだ記事が `apply_remote_state` で未読へ戻されていた(2026-07 修正、`sync_providers.rs` の `pending_remote_ids_by_axis()` 参照)。

## 例

### 正しい

```rust
let remote_state = provider.pull_state().await?; // no lock held
{
    let db_guard = lock_db(db)?;
    // apply 直前・同一ロック内で保護リストを読む
    let (pending_read, pending_starred) =
        pending_remote_ids_by_axis(db_guard.reader(), &account.id)?;
    let repo = SqliteArticleRepository::new(db_guard.writer());
    repo.apply_remote_state(&account.id, &state.read_ids, &state.starred_ids,
        &pending_read, &pending_starred)?;
}
```

### 不正

```rust
// .await の前に保護リストをスナップショット — pull 中の既読化が巻き戻る
let (pending_read, pending_starred) = read_pending(db)?;
let remote_state = provider.pull_state().await?;
apply(db, &remote_state, &pending_read, &pending_starred)?;
```

## テスト方針

- リモート応答の生成中(mockito の `with_body_from_request` 等)にローカル状態変更を注入し、apply 後も新しいユーザー意図が保持されることを固定する
- 回帰テスト例: `repair_greader_remote_state_keeps_article_marked_read_during_pull_state`

## 強制

- [x] 手動レビュー

## 関連ルール

- `rust-async-mutex.md`: ロックスコープ分割がこの競合の前提条件
- `async-side-effect-policy.md`: フロント側の stale completion / latest-only 方針
