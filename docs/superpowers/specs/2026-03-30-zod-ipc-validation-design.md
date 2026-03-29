# Zod IPC Validation Design

## Summary

`as XXX` 型アサーションを排除し、Tauri IPC 境界（リクエスト・レスポンス両方）に Zod ランタイムバリデーションを導入する。

## Goals

- `tauri-commands.ts` の手書き DTO 型を Zod スキーマからの `z.infer` に置き換え、スキーマを Single Source of Truth にする
- `safeInvoke` にレスポンスバリデーションを統合し、Rust ↔ TS 間の型不整合をランタイムで検出する
- `dev-mocks.ts` / `tests/helpers/tauri-mocks.ts` の `as string` / `as boolean` キャストを引数スキーマの `parse` に置き換える
- `toAppError` の `as AppError` を `safeParse` に置き換える

## Non-Goals

- DOM/イベント系の `as HTMLElement` / `as Node` は対象外（DOM API の型制約上避けにくい）
- `as const` は対象外（TypeScript のリテラル型推論であり型アサーションではない）
- Rust 側からの自動コード生成（現在の規模には過剰）

## Architecture

### File Structure

```
src/api/schemas/
  account.ts         # AccountDtoSchema, AccountDto
  folder.ts          # FolderDtoSchema, FolderDto
  feed.ts            # FeedDtoSchema, FeedDto
  article.ts         # ArticleDtoSchema, ArticleDto
  tag.ts             # TagDtoSchema, TagDto
  discovered-feed.ts # DiscoveredFeedDtoSchema, DiscoveredFeedDto
  update-info.ts     # UpdateInfoDtoSchema, UpdateInfoDto
  error.ts           # AppErrorSchema, AppError
  commands.ts        # コマンド引数スキーマ（各コマンドの入力定義）
  index.ts           # barrel re-export
```

### Dependency Flow

```
src/api/schemas/*.ts  → zod を import、スキーマ定義
src/api/tauri-commands.ts → schemas/ からスキーマを import、z も import（配列/nullable 合成用）
src/dev-mocks.ts → schemas/ から引数スキーマを import
tests/helpers/tauri-mocks.ts → schemas/ から引数スキーマを import
```

## Detailed Design

### 1. DTO Schema Definition

各スキーマファイルで `z.object()` によるスキーマ定義と `z.infer` による型導出をセットで export する。

```ts
// src/api/schemas/account.ts
import { z } from "zod";

export const AccountDtoSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  server_url: z.string().nullable(),
  sync_interval_secs: z.number(),
  sync_on_wake: z.boolean(),
  keep_read_items_days: z.number(),
});

export type AccountDto = z.infer<typeof AccountDtoSchema>;
```

### 2. Command Args Schema

コマンド引数スキーマを `commands.ts` に集約する。各コマンドの `safeInvoke` 呼び出しで渡される引数オブジェクトの形状を定義する。

```ts
// src/api/schemas/commands.ts
import { z } from "zod";

export const listFoldersArgs = z.object({ accountId: z.string() });
export const listFeedsArgs = z.object({ accountId: z.string() });
export const listArticlesArgs = z.object({
  feedId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});
export const markArticleReadArgs = z.object({
  articleId: z.string(),
  read: z.boolean().optional(),
});
export const markArticlesReadArgs = z.object({
  articleIds: z.array(z.string()),
});
export const toggleArticleStarArgs = z.object({
  articleId: z.string(),
  starred: z.boolean(),
});
// ... 残りのコマンドも同様
```

### 3. safeInvoke Overload

リクエスト（args）とレスポンスの両方をバリデーションする。引数スキーマはオプションで、指定された場合は `invoke` 前に args を検証する。

```ts
// src/api/tauri-commands.ts
import type { z } from "zod";

type InvokeSchemas<R extends z.ZodType = z.ZodType> = {
  response: R;
  args?: z.ZodType;
};

function isSchemas(v: unknown): v is InvokeSchemas {
  return (
    typeof v === "object" &&
    v !== null &&
    "response" in v &&
    typeof ((v as Record<string, unknown>).response as Record<string, unknown>)
      ?.parse === "function"
  );
}

// スキーマあり（推奨）— リクエスト・レスポンス両方をバリデーション
function safeInvoke<R extends z.ZodType>(
  cmd: string,
  schemas: InvokeSchemas<R>,
  args?: Record<string, unknown>,
): Result.ResultAsync<z.output<R>, AppError>;

// スキーマなし（移行期の後方互換）
function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Result.ResultAsync<T, AppError>;

// 実装
function safeInvoke(
  cmd: string,
  schemasOrArgs?: InvokeSchemas | Record<string, unknown>,
  maybeArgs?: Record<string, unknown>,
): Result.ResultAsync<unknown, AppError> {
  const schemas = isSchemas(schemasOrArgs) ? schemasOrArgs : undefined;
  const args = isSchemas(schemasOrArgs) ? maybeArgs : schemasOrArgs;

  return Result.try({
    try: async () => {
      // リクエスト引数のバリデーション（invoke 前）
      const validatedArgs =
        schemas?.args && args ? schemas.args.parse(args) : args;
      const raw = await invoke(cmd, validatedArgs);
      // レスポンスのバリデーション（invoke 後）
      return schemas?.response ? schemas.response.parse(raw) : raw;
    },
    catch: (error) => toAppError(cmd, error),
  });
}
```

バリデーション失敗時: `schema.parse()` が `ZodError` を throw し、`catch` が `toAppError` で `UserVisible` エラーに変換する。`ZodError` の場合は `error.issues` から要約メッセージを生成し、デバッグに有用なログを残す。

```ts
// toAppError 内での ZodError 判定例
if (error instanceof Error && "issues" in error) {
  const zodErr = error as {
    issues: Array<{ path: (string | number)[]; message: string }>;
  };
  const detail = zodErr.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join(", ");
  console.error(`[tauri-commands] ${cmd} validation failed:`, detail);
  return {
    type: "UserVisible",
    message: `Response validation failed: ${detail}`,
  };
}
```

### 4. Command Function Migration

各コマンド関数でリクエスト・レスポンス両方のスキーマを渡す形に移行する。

```ts
// Before
export const listAccounts = () => safeInvoke<AccountDto[]>("list_accounts");
export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("list_articles", { feedId, offset, limit });

// After
import { z } from "zod";
import {
  AccountDtoSchema,
  ArticleDtoSchema,
  listArticlesArgs,
} from "@/api/schemas";

export const listAccounts = () =>
  safeInvoke("list_accounts", { response: z.array(AccountDtoSchema) });

export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_articles",
    {
      response: z.array(ArticleDtoSchema),
      args: listArticlesArgs,
    },
    { feedId, offset, limit },
  );
```

`void` 返却コマンドでも引数バリデーションが有用なケースがある。引数スキーマだけ渡したい場合:

```ts
export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke<void>(
    "mark_article_read",
    { response: z.void(), args: markArticleReadArgs },
    { articleId, read },
  );
```

移行期は従来の型パラメータ版も利用可能（後方互換）。

### 5. toAppError Migration

```ts
// Before
return typeof error === "object" && error !== null && "type" in error
  ? (error as AppError)
  : { type: "UserVisible", message: String(error) };

// After
import { AppErrorSchema } from "@/api/schemas";

const result = AppErrorSchema.safeParse(error);
return result.success
  ? result.data
  : { type: "UserVisible", message: String(error) };
```

### 6. Mock Migration

dev-mocks.ts と tests/helpers/tauri-mocks.ts で引数スキーマの `parse` を使い、`as` キャストを排除する。

#### 6a. dev-mocks.ts — 各 case で引数スキーマを parse

```ts
// Before
case "list_articles": {
  const feedId = args.feedId as string;
  return mockArticles.filter((a) => a.feed_id === feedId);
}

// After
import { listArticlesArgs } from "@/api/schemas";

case "list_articles": {
  const { feedId } = listArticlesArgs.parse(payload);
  return mockArticles.filter((a) => a.feed_id === feedId);
}
```

#### 6b. tests/helpers/tauri-mocks.ts — custom handler 経路でも引数バリデーション

現在の `setupTauriMocks` は custom handler にそのまま未検証の args を渡している。custom handler を呼ぶ前にコマンド引数スキーマでバリデーションを挟み、テスト経由の IPC request shape の回帰を検出する。

```ts
// Before
export function setupTauriMocks(handler?: MockHandler): void {
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    if (handler) {
      return handler(cmd, args);
    }
    return defaultHandler(cmd, args);
  });
}

// After
import { commandArgsSchemas } from "@/api/schemas";

// コマンド名 → 引数スキーマのマッピング
// commandArgsSchemas: Record<string, z.ZodType> を schemas/commands.ts から export

function validateArgs(cmd: string, payload: unknown): Record<string, unknown> {
  const schema = commandArgsSchemas[cmd];
  if (schema) {
    return schema.parse(payload) as Record<string, unknown>;
  }
  return (payload ?? {}) as Record<string, unknown>;
}

export function setupTauriMocks(handler?: MockHandler): void {
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = validateArgs(cmd, payload);
    if (handler) {
      return handler(cmd, args);
    }
    return defaultHandler(cmd, args);
  });
}
```

これにより:

- custom handler 経由でも引数バリデーションが自動的に実行される
- テストで不正な引数を渡すと即座に ZodError で失敗する
- `commandArgsSchemas` は `schemas/commands.ts` から `Record<string, z.ZodType>` として export する

mock はdev/test用なので `parse`（例外throw）を使用。`safeParse` にする必要はない。

## Migration Strategy

段階的に移行する:

1. `src/api/schemas/` にスキーマファイルを作成（DTO + コマンド引数 + `commandArgsSchemas` マッピング）
2. `safeInvoke` オーバーロードを追加（`InvokeSchemas` でリクエスト・レスポンス両対応、後方互換維持）
3. `toAppError` の `as AppError` を `safeParse` に置き換え
4. 各コマンド関数を1つずつスキーマ版に移行（引数スキーマ + レスポンススキーマ）
5. dev-mocks.ts の各 case で引数スキーマの `parse` に置き換え
6. tests/helpers/tauri-mocks.ts の `setupTauriMocks` に `validateArgs` を組み込み、custom handler 経路も検証対象にする
7. 手書き DTO 型を削除し、schemas/ からの re-export に切り替え

## Testing

- 既存テスト（Vitest）が全て通ることを確認
- `safeInvoke` のバリデーション失敗ケースのユニットテスト追加
- dev-mocks が引数スキーマ不一致時に例外を throw することの確認

## Affected Files

- `src/api/tauri-commands.ts` — safeInvoke 変更、DTO 型を schemas/ からの re-export に置き換え
- `src/api/schemas/` — 新規作成（10ファイル）
- `src/dev-mocks.ts` — 引数スキーマ使用に移行
- `tests/helpers/tauri-mocks.ts` — 引数スキーマ使用に移行
- `src/stores/preferences-store.ts` — 既存の Zod 使用は変更不要（既に適切）
