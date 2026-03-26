# byethrow Result型 本格採用設計

## 概要

`@praha/byethrow` の Result型APIを本格的に活用し、フロントエンド全体のエラーハンドリングを宣言的・統一的に改善する。

現状は `Result.isFailure()` / `Result.isSuccess()` の判定のみ使用しており、byethrow が提供する `try`, `pipe`, `map`, `mapError`, `unwrap`, `inspectError`, `assertSuccess` 等のAPIが未活用。

## 対象スコープ

TypeScriptフロントエンドのみ（Rust側は変更なし）。

## 改善カテゴリと詳細

### A. safeInvoke の改善（基盤レイヤー）

**対象**: `src/api/tauri-commands.ts` — `safeInvoke` 関数

**現状**:

```typescript
async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<Result.Result<T, AppError>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { type: "Success", value: data };
  } catch (error: unknown) {
    console.error(`[tauri-commands] ${cmd} failed:`, error);
    const appError: AppError =
      typeof error === "object" && error !== null && "type" in error
        ? (error as AppError)
        : { type: "UserVisible", message: String(error) };
    return { type: "Failure", error: appError };
  }
}
```

**改善方針**:

`Result.try` の `catch` ハンドラ内で直接 `AppError` を返す方式を採用する。`catch` でエラー変換とログ出力を一括で行うため、別途 `mapError` や `inspectError` を pipe する必要はない。

**改善後コード**:

```typescript
function toAppError(cmd: string, error: unknown): AppError {
  console.error(`[tauri-commands] ${cmd} failed:`, error);
  return typeof error === "object" && error !== null && "type" in error
    ? (error as AppError)
    : { type: "UserVisible", message: String(error) };
}

function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Result.ResultAsync<T, AppError> {
  return Result.try({
    try: () => invoke<T>(cmd, args),
    catch: (error) => toAppError(cmd, error),
  });
}
```

**変更点**:

- 戻り値の型が `Promise<Result.Result<T, AppError>>` → `Result.ResultAsync<T, AppError>` に変わる（実質的には同じ `Promise<Result<T, AppError>>`）
- エラー変換ロジックを `toAppError` ヘルパーに抽出し、テスト可能に
- try-catch ボイラープレートが完全に除去される

---

### B. React Query hooks の改善

**対象**: `src/hooks/use-accounts.ts`, `use-feeds.ts`, `use-articles.ts`

**現状**: 全6箇所で同一パターンを繰り返し

```typescript
const result = await listAccounts();
if (Result.isFailure(result)) throw result.error;
return result.value;
```

**改善方針**:

- `Result.unwrap` で1行化（失敗時は自動的にthrow）
- React Query は queryFn がthrowすればerror stateにするため、unwrapとの相性が良い
- `unwrap` は `Result<T, E>` から `T` を返し、Failure時は `E` をthrowする。現行の `throw result.error` と同じ挙動
- React Query の `error` に渡る型は `AppError` のまま維持される（`unwrap` がthrowするのは `error` フィールドの値そのもの）

**改善後コード例** (`useAccounts`):

```typescript
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => listAccounts().then(Result.unwrap()),
  });
}
```

**改善項目**:

| ID  | 箇所                        | 内容             | 使用API  |
| --- | --------------------------- | ---------------- | -------- |
| B1  | `useAccounts` queryFn       | `unwrap` で1行化 | `unwrap` |
| B2  | `useFeeds` queryFn          | 同上             | `unwrap` |
| B3  | `useArticles` queryFn       | 同上             | `unwrap` |
| B4  | `useSearchArticles` queryFn | 同上             | `unwrap` |
| B5  | `useMarkRead` mutationFn    | 同上             | `unwrap` |
| B6  | `useToggleStar` mutationFn  | 同上             | `unwrap` |

---

### C. コンポーネント内のResult処理改善

**対象**: Result を直接扱うコンポーネント（リファクタ後の新構造に対応）

**現状パターン（C1-C3共通）**:

```typescript
const result = await someCommand(args);
if (Result.isFailure(result)) {
  window.alert(`Failed: ${result.error.message}`);
  return;
}
// 成功時の処理
```

**改善方針**:

- `pipe` + `inspectError`（エラー通知）+ `inspect`（成功時処理）で宣言的に
- カテゴリA完了後に実施（`safeInvoke` が `ResultAsync` を返すようになった前提）

**改善項目**:

| ID  | 箇所 (ファイル)                                                            | 現状                      | 使用API                           |
| --- | -------------------------------------------------------------------------- | ------------------------- | --------------------------------- |
| C1  | `Sidebar.handleAddFeed` (`components/reader/sidebar.tsx:32`)               | isFailure → alert         | `pipe`, `inspectError`, `inspect` |
| C2  | `Sidebar.handleSync` (`components/reader/sidebar.tsx:48`)                  | isFailure → console.error | `inspectError` で1行化            |
| C3  | `AccountDetail.handleDelete` (`components/reader/settings-modal.tsx:182`)  | isFailure → alert         | `pipe`, `inspectError`, `inspect` |
| C4  | `AddAccountForm.handleSubmit` (`components/reader/settings-modal.tsx:257`) | isFailure → alert         | `pipe`, `inspectError`, `inspect` |
| C5  | `App.triggerSync` (`App.tsx:11`)                                           | isFailure → console.error | `inspectError` で1行化            |
| C6  | `BrowserView.handleOpenExternal` (`components/reader/browser-view.tsx:9`)  | Result戻り値を完全無視    | `inspectError` でエラー時ログ     |

**改善後コード例** (`Sidebar.handleAddFeed`):

```typescript
const handleAddFeed = async () => {
  if (!selectedAccountId) {
    window.alert("Please add an account first.");
    return;
  }
  const url = window.prompt("Enter feed URL:");
  if (!url) return;

  Result.pipe(
    await addLocalFeed(selectedAccountId, url),
    Result.inspectError((e) =>
      window.alert(`Failed to add feed: ${e.message}`),
    ),
    Result.inspect(() => qc.invalidateQueries({ queryKey: ["feeds"] })),
  );
};
```

---

### E. テストコードの改善

**対象**: `src/__tests__/api/tauri-commands.test.ts`

**現状**:

```typescript
expect(Result.isSuccess(result)).toBe(true);
if (Result.isSuccess(result)) {
  expect(result.value).toEqual(sampleAccounts);
}
```

**改善方針**:

- `Result.unwrap` で成功値を直接取得（Failure時はthrow → テスト失敗）
- `Result.unwrapError` でエラー値を直接取得（Success時はthrow → テスト失敗）
- `isSuccess` + if文ガードの冗長パターンを解消

| ID  | 箇所                      | 使用API       |
| --- | ------------------------- | ------------- |
| E1  | 成功ケースの検証（7箇所） | `unwrap`      |
| E2  | 失敗ケースの検証（1箇所） | `unwrapError` |

---

## 実装順序

| 順序 | カテゴリ           | 理由                                             |
| ---- | ------------------ | ------------------------------------------------ |
| 1    | A (safeInvoke)     | 基盤。全コマンドに影響するため最初に             |
| 2    | B (hooks)          | 6箇所の繰り返しパターン解消。Aの変更後に動作確認 |
| 3    | E (テスト)         | A/Bの変更でテストを更新する際に合わせて改善      |
| 4    | C (コンポーネント) | UIのエラーハンドリング改善。A完了が前提          |

## 設計判断

### ユーティリティヘルパーは作らない

hooks層の `unwrap` は1行で済むため、`unwrapQueryFn` のような専用ヘルパーは不要。
コンポーネント層の `pipe` + `inspectError` も3-5行程度で、抽象化のコストに見合わない。
YAGNI原則に従い、パターンが増えた時点で再検討する。

### React Query との統合方針

hooks層では引き続き `unwrap`（失敗時throw）を使い、React Query の error state に委ねる。
コンポーネント層（mutation の onSuccess/onClick ハンドラ等）では `pipe` で宣言的に処理する。
Result型をコンポーネントのpropsとして渡す設計は採用しない（過剰）。

### テストでの型ナローイング

byethrow の `assertSuccess` はエラー型が `never` の Result にしか使えない（型制約: `ResultMaybeAsync<any, never>`）。
テストの Result は `Result<T, AppError>` であり、エラー型が `never` ではないため `assertSuccess` は直接使えない。

代替案として `Result.unwrap` を使う:

```typescript
const result = await listAccounts();
const value = Result.unwrap(result); // 失敗時はthrow → テスト失敗
expect(value).toEqual(sampleAccounts);
```

エラーケースは `Result.unwrapError` で:

```typescript
const result = await listAccounts();
const error = Result.unwrapError(result); // 成功時はthrow → テスト失敗
expect(error.message).toBe("Connection failed");
```
