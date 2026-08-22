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
// apply_remote_state_with_protection is the only sanctioned caller of
// apply_remote_state: it acquires the lock, re-reads the pending protection
// lists inside that same lock, then applies. Direct calls elsewhere are
// caught by the contract test below.
apply_remote_state_with_protection(
    db, &account.id, &state.read_ids, &state.starred_ids, &[], &[],
)?;
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
- 回帰テスト例: `repair_greader_remote_state_keeps_article_marked_read_during_pull_state`、
  `reconcile_greader_unread_state_keeps_article_marked_read_during_pull`(unread reconcile 経路)

## unread reconcile 経路(plan 021 で解消)

`commands/sync_providers/unread/mod.rs` の `reconcile_greader_unread_state_for_feed` は
かつて pending 読みと is_read 更新を別々の `lock_db` スコープで行っており、
`.await` を跨がないものの別ロック取得という同型の TOCTOU 窓が残っていた
(棚卸し: 2026-08-21, plan `plans/021-sync-session-lock.md`)。
現在は単一 `lock_db` スコープ内で `pending_remote_ids_by_axis` を再利用して読み直し、
is_read UPDATE と commit まで行う。

付随事項として、`reconcile_greader_unread_counts`(unread.rs)のループ前カウント
snapshot は「どの feed を reconcile するか」の選定にのみ使われ、巻き戻り保護そのものは
per-feed の pending 保護と最終 recalculate が担うため、選定漏れは次回 sync で回収される
(許容、ドキュメント化のみ)。

## 強制

- [x] contract test(`src/__tests__/config/sync-remote-state-lock-contract.node.test.ts`)
  - `.apply_remote_state(` の呼び出しを `apply_remote_state_with_protection`(helper)と
    infra 実装のテストモジュール(`sqlite_article/tests.rs`、trait 実装自体への
    テストコードからの呼び出しのみ許容)の2箇所に限定
  - `apply_remote_state_with_protection` の本体に `lock_db` と `pending_remote_ids_by_axis`
    が両方含まれることをピン
  - unread reconcile 本体で `lock_db` の取得が1回だけであることをピン
  - `pending_remote_ids_by_axis` の呼び出し元を helper と unread reconcile の2箇所に限定
  - 名前ベースのスキャンであり、rename・trait 経由呼び出し・別の生 SQL 経路はすり抜けうる
    事故防止の回帰ガード(完全な強制ではない)
- [x] 手動レビュー

## 関連ルール

- `rust-async-mutex.md`: ロックスコープ分割がこの競合の前提条件
- `async-side-effect-policy.md`: フロント側の stale completion / latest-only 方針
