---
paths:
  - "src/**/*.{ts,tsx}"
---

# Tauri IPC エラーハンドリング

## 制約

- 全ての Tauri invoke 呼び出しは `safeInvoke` 経由で行う（api/tauri-commands.ts に集約）
- 呼び出し元では `Result.pipe` + `Result.inspectError` でエラーを処理する
- fire-and-forget（戻り値を待たない）パターンでも最低限 `console.error` でログを残す
- ユーザーに見せるべきエラーは `showToast` または `window.alert` で通知する

## 根拠

Tauri IPC はプロセス間通信のため、ネットワークエラーや DB ロックエラーなど予期せぬ失敗が起こりうる。エラーを無視すると原因特定が困難になる。`@praha/byethrow` の Result 型で型安全にエラーをハンドリングする。

## 例

### 正しい

```typescript
// 結果を使う場合
Result.pipe(
  await triggerSync(),
  Result.inspect((data) => {
    /* 成功処理 */
  }),
  Result.inspectError((e) => console.error("Sync failed:", e)),
);

// fire-and-forget でもエラーをログ
setPreference(key, value).then((result) =>
  Result.pipe(
    result,
    Result.inspectError((e) => {
      console.error(`Failed to persist preference ${key}:`, e);
      useUiStore.getState().showToast(`Failed to save setting: ${e.message}`);
    }),
  ),
);
```

### 不正

```typescript
// エラーを完全に無視
await triggerSync();

// Result を unwrap して例外を投げる（React Query 内部以外では非推奨）
const data = Result.unwrap(await listFeeds(accountId));
```

## 例外

- React Query の `queryFn` 内では `.then(Result.unwrap())` で例外を投げてよい（React Query がエラーステートを管理するため）

## 強制

- [x] 手動レビュー

## 関連ルール

- `preferences-pattern.md`: preferences の書き込みは fire-and-forget パターンを使用
