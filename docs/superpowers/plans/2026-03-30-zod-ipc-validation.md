# Zod IPC Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Replace `as XXX` type assertions at the Tauri IPC boundary with Zod runtime validation for both requests and responses.

Architecture: Create `src/api/schemas/` with per-DTO schema files and a command args registry. Refactor `safeInvoke` to accept an `InvokeSchemas` object for request+response validation. Migrate mock helpers to validate args through the same schemas.

Tech Stack: Zod 4.x (already installed), `@praha/byethrow` Result, Tauri IPC, Vitest

Spec: `docs/superpowers/specs/2026-03-30-zod-ipc-validation-design.md`

---

## File Map

| Action | Path                                       | Responsibility                                                   |
| ------ | ------------------------------------------ | ---------------------------------------------------------------- |
| Create | `src/api/schemas/account.ts`               | AccountDtoSchema + type                                          |
| Create | `src/api/schemas/folder.ts`                | FolderDtoSchema + type                                           |
| Create | `src/api/schemas/feed.ts`                  | FeedDtoSchema + type                                             |
| Create | `src/api/schemas/article.ts`               | ArticleDtoSchema + type                                          |
| Create | `src/api/schemas/tag.ts`                   | TagDtoSchema + type                                              |
| Create | `src/api/schemas/discovered-feed.ts`       | DiscoveredFeedDtoSchema + type                                   |
| Create | `src/api/schemas/update-info.ts`           | UpdateInfoDtoSchema + type                                       |
| Create | `src/api/schemas/error.ts`                 | AppErrorSchema + type                                            |
| Create | `src/api/schemas/commands.ts`              | All command args schemas + `commandArgsSchemas` registry         |
| Create | `src/api/schemas/index.ts`                 | Barrel re-export                                                 |
| Modify | `src/api/tauri-commands.ts`                | safeInvoke overload, toAppError migration, schema-based commands |
| Modify | `src/dev-mocks.ts`                         | Replace `as` casts with args schema parse                        |
| Modify | `tests/helpers/tauri-mocks.ts`             | Add validateArgs, update setupTauriMocks                         |
| Create | `src/__tests__/api/schemas.test.ts`        | Schema validation tests                                          |
| Modify | `src/__tests__/api/tauri-commands.test.ts` | Add validation failure tests                                     |

---

### Task 1: DTO Schema Files

### Files

- Create: `src/api/schemas/account.ts`
- Create: `src/api/schemas/folder.ts`
- Create: `src/api/schemas/feed.ts`
- Create: `src/api/schemas/article.ts`
- Create: `src/api/schemas/tag.ts`
- Create: `src/api/schemas/discovered-feed.ts`
- Create: `src/api/schemas/update-info.ts`
- Create: `src/api/schemas/error.ts`
- Test: `src/__tests__/api/schemas.test.ts`

- [ ] **Step 1: Write failing tests for all DTO schemas**

Create `src/__tests__/api/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AccountDtoSchema,
  AppErrorSchema,
  ArticleDtoSchema,
  DiscoveredFeedDtoSchema,
  FeedDtoSchema,
  FolderDtoSchema,
  TagDtoSchema,
  UpdateInfoDtoSchema,
} from "@/api/schemas";

describe("DTO schemas", () => {
  it("parses valid AccountDto", () => {
    const data = {
      id: "acc-1",
      kind: "local",
      name: "Local",
      server_url: null,
      sync_interval_secs: 3600,
      sync_on_wake: false,
      keep_read_items_days: 30,
    };
    expect(AccountDtoSchema.parse(data)).toEqual(data);
  });

  it("rejects AccountDto with missing fields", () => {
    expect(() => AccountDtoSchema.parse({ id: "acc-1" })).toThrow();
  });

  it("parses valid FolderDto", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };
    expect(FolderDtoSchema.parse(data)).toEqual(data);
  });

  it("parses valid FeedDto", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 5,
      display_mode: "normal",
    };
    expect(FeedDtoSchema.parse(data)).toEqual(data);
  });

  it("parses valid ArticleDto", () => {
    const data = {
      id: "art-1",
      feed_id: "feed-1",
      title: "Hello",
      content_sanitized: "<p>Hi</p>",
      summary: null,
      url: null,
      author: null,
      published_at: "2026-03-25T10:00:00Z",
      thumbnail: null,
      is_read: false,
      is_starred: false,
    };
    expect(ArticleDtoSchema.parse(data)).toEqual(data);
  });

  it("parses valid TagDto", () => {
    const data = { id: "tag-1", name: "Important", color: "#ff0000" };
    expect(TagDtoSchema.parse(data)).toEqual(data);
  });

  it("parses TagDto with null color", () => {
    const data = { id: "tag-1", name: "Important", color: null };
    expect(TagDtoSchema.parse(data)).toEqual(data);
  });

  it("parses valid DiscoveredFeedDto", () => {
    const data = { url: "https://example.com/feed.xml", title: "Blog" };
    expect(DiscoveredFeedDtoSchema.parse(data)).toEqual(data);
  });

  it("parses valid UpdateInfoDto", () => {
    const data = { version: "1.0.0", body: "Release notes" };
    expect(UpdateInfoDtoSchema.parse(data)).toEqual(data);
  });

  it("parses UpdateInfoDto with null body", () => {
    const data = { version: "1.0.0", body: null };
    expect(UpdateInfoDtoSchema.parse(data)).toEqual(data);
  });
});

describe("AppErrorSchema", () => {
  it("parses UserVisible error", () => {
    const data = { type: "UserVisible", message: "Something went wrong" };
    expect(AppErrorSchema.parse(data)).toEqual(data);
  });

  it("parses Retryable error", () => {
    const data = { type: "Retryable", message: "Network timeout" };
    expect(AppErrorSchema.parse(data)).toEqual(data);
  });

  it("rejects unknown error type", () => {
    expect(() =>
      AppErrorSchema.parse({ type: "Unknown", message: "?" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk vitest run src/__tests__/api/schemas.test.ts`
Expected: FAIL — cannot resolve `@/api/schemas`

- [ ] **Step 3: Create all schema files**

Create `src/api/schemas/account.ts`:

```ts
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

Create `src/api/schemas/folder.ts`:

```ts
import { z } from "zod";

export const FolderDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  name: z.string(),
  sort_order: z.number(),
});

export type FolderDto = z.infer<typeof FolderDtoSchema>;
```

Create `src/api/schemas/feed.ts`:

```ts
import { z } from "zod";

export const FeedDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  folder_id: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  site_url: z.string(),
  unread_count: z.number(),
  display_mode: z.string(),
});

export type FeedDto = z.infer<typeof FeedDtoSchema>;
```

Create `src/api/schemas/article.ts`:

```ts
import { z } from "zod";

export const ArticleDtoSchema = z.object({
  id: z.string(),
  feed_id: z.string(),
  title: z.string(),
  content_sanitized: z.string(),
  summary: z.string().nullable(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  published_at: z.string(),
  thumbnail: z.string().nullable(),
  is_read: z.boolean(),
  is_starred: z.boolean(),
});

export type ArticleDto = z.infer<typeof ArticleDtoSchema>;
```

Create `src/api/schemas/tag.ts`:

```ts
import { z } from "zod";

export const TagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type TagDto = z.infer<typeof TagDtoSchema>;
```

Create `src/api/schemas/discovered-feed.ts`:

```ts
import { z } from "zod";

export const DiscoveredFeedDtoSchema = z.object({
  url: z.string(),
  title: z.string(),
});

export type DiscoveredFeedDto = z.infer<typeof DiscoveredFeedDtoSchema>;
```

Create `src/api/schemas/update-info.ts`:

```ts
import { z } from "zod";

export const UpdateInfoDtoSchema = z.object({
  version: z.string(),
  body: z.string().nullable(),
});

export type UpdateInfoDto = z.infer<typeof UpdateInfoDtoSchema>;
```

Create `src/api/schemas/error.ts`:

```ts
import { z } from "zod";

const UserVisibleErrorSchema = z.object({
  type: z.literal("UserVisible"),
  message: z.string(),
});

const RetryableErrorSchema = z.object({
  type: z.literal("Retryable"),
  message: z.string(),
});

export const AppErrorSchema = z.discriminatedUnion("type", [
  UserVisibleErrorSchema,
  RetryableErrorSchema,
]);

export type AppError = z.infer<typeof AppErrorSchema>;
```

- [ ] **Step 4: Create barrel index**

Create `src/api/schemas/index.ts`:

```ts
export { AccountDtoSchema, type AccountDto } from "./account";
export { FolderDtoSchema, type FolderDto } from "./folder";
export { FeedDtoSchema, type FeedDto } from "./feed";
export { ArticleDtoSchema, type ArticleDto } from "./article";
export { TagDtoSchema, type TagDto } from "./tag";
export {
  DiscoveredFeedDtoSchema,
  type DiscoveredFeedDto,
} from "./discovered-feed";
export { UpdateInfoDtoSchema, type UpdateInfoDto } from "./update-info";
export { AppErrorSchema, type AppError } from "./error";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk vitest run src/__tests__/api/schemas.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/api/schemas/ src/__tests__/api/schemas.test.ts
rtk git commit -m "feat: add Zod DTO schemas for IPC validation"
```

---

### Task 2: Command Args Schemas

### Files

- Create: `src/api/schemas/commands.ts`
- Modify: `src/api/schemas/index.ts`
- Test: `src/__tests__/api/schemas.test.ts`

Reference `src/api/tauri-commands.ts:59-141` for all command function signatures.

- [ ] **Step 1: Add failing tests for command args schemas**

Append to `src/__tests__/api/schemas.test.ts`:

```ts
import {
  commandArgsSchemas,
  listArticlesArgs,
  markArticleReadArgs,
  toggleArticleStarArgs,
  addAccountArgs,
} from "@/api/schemas";

describe("command args schemas", () => {
  it("parses listArticlesArgs", () => {
    expect(listArticlesArgs.parse({ feedId: "f-1" })).toEqual({
      feedId: "f-1",
    });
  });

  it("parses listArticlesArgs with optional fields", () => {
    const result = listArticlesArgs.parse({
      feedId: "f-1",
      offset: 0,
      limit: 20,
    });
    expect(result).toEqual({ feedId: "f-1", offset: 0, limit: 20 });
  });

  it("rejects listArticlesArgs with missing feedId", () => {
    expect(() => listArticlesArgs.parse({})).toThrow();
  });

  it("parses markArticleReadArgs with optional read", () => {
    expect(markArticleReadArgs.parse({ articleId: "a-1" })).toEqual({
      articleId: "a-1",
    });
  });

  it("parses toggleArticleStarArgs", () => {
    const result = toggleArticleStarArgs.parse({
      articleId: "a-1",
      starred: true,
    });
    expect(result).toEqual({ articleId: "a-1", starred: true });
  });

  it("parses addAccountArgs", () => {
    const result = addAccountArgs.parse({ kind: "local", name: "Test" });
    expect(result).toEqual({ kind: "local", name: "Test" });
  });

  it("commandArgsSchemas maps command names to schemas", () => {
    expect(commandArgsSchemas["list_articles"]).toBeDefined();
    expect(commandArgsSchemas["mark_article_read"]).toBeDefined();
    expect(commandArgsSchemas["list_accounts"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk vitest run src/__tests__/api/schemas.test.ts`
Expected: FAIL — imports not found

- [ ] **Step 3: Create commands.ts**

Create `src/api/schemas/commands.ts`. Derive every schema from the function signatures in `src/api/tauri-commands.ts:59-141`:

```ts
import { z } from "zod";

// Query commands
export const listFoldersArgs = z.object({ accountId: z.string() });
export const listFeedsArgs = z.object({ accountId: z.string() });
export const listArticlesArgs = z.object({
  feedId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});
export const listAccountArticlesArgs = z.object({
  accountId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});
export const searchArticlesArgs = z.object({
  accountId: z.string(),
  query: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// Mutation commands
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
export const markFeedReadArgs = z.object({ feedId: z.string() });
export const markFolderReadArgs = z.object({ folderId: z.string() });

// Account commands
export const addAccountArgs = z.object({
  kind: z.string(),
  name: z.string(),
  serverUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});
export const updateAccountSyncArgs = z.object({
  accountId: z.string(),
  syncIntervalSecs: z.number(),
  syncOnWake: z.boolean(),
  keepReadItemsDays: z.number(),
});
export const renameAccountArgs = z.object({
  accountId: z.string(),
  name: z.string(),
});
export const deleteAccountArgs = z.object({ accountId: z.string() });

// Feed commands
export const discoverFeedsArgs = z.object({ url: z.string() });
export const addLocalFeedArgs = z.object({
  accountId: z.string(),
  url: z.string(),
});
export const createFolderArgs = z.object({
  accountId: z.string(),
  name: z.string(),
});
export const deleteFeedArgs = z.object({ feedId: z.string() });
export const renameFeedArgs = z.object({
  feedId: z.string(),
  title: z.string(),
});
export const updateFeedFolderArgs = z.object({
  feedId: z.string(),
  folderId: z.string().nullable(),
});
export const updateFeedDisplayModeArgs = z.object({
  feedId: z.string(),
  displayMode: z.string(),
});

// Utility commands
export const openInBrowserArgs = z.object({
  url: z.string(),
  background: z.boolean().optional(),
});
export const checkBrowserEmbedSupportArgs = z.object({ url: z.string() });
export const exportOpmlArgs = z.object({ accountId: z.string() });
export const setPreferenceArgs = z.object({
  key: z.string(),
  value: z.string(),
});
export const copyToClipboardArgs = z.object({ text: z.string() });
export const addToReadingListArgs = z.object({ url: z.string() });

// Tag commands
export const createTagArgs = z.object({
  name: z.string(),
  color: z.string().optional(),
});
export const renameTagArgs = z.object({
  tagId: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
});
export const deleteTagArgs = z.object({ tagId: z.string() });
export const tagArticleArgs = z.object({
  articleId: z.string(),
  tagId: z.string(),
});
export const untagArticleArgs = z.object({
  articleId: z.string(),
  tagId: z.string(),
});
export const getArticleTagsArgs = z.object({ articleId: z.string() });
export const listArticlesByTagArgs = z.object({
  tagId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

/**
 * Command name → args schema mapping.
 * Commands without args (list_accounts, list_tags, get_preferences, trigger_sync,
 * check_for_update, download_and_install_update, restart_app) are not listed.
 */
export const commandArgsSchemas: Record<string, z.ZodType> = {
  list_folders: listFoldersArgs,
  list_feeds: listFeedsArgs,
  list_articles: listArticlesArgs,
  list_account_articles: listAccountArticlesArgs,
  search_articles: searchArticlesArgs,
  mark_article_read: markArticleReadArgs,
  mark_articles_read: markArticlesReadArgs,
  toggle_article_star: toggleArticleStarArgs,
  mark_feed_read: markFeedReadArgs,
  mark_folder_read: markFolderReadArgs,
  add_account: addAccountArgs,
  update_account_sync: updateAccountSyncArgs,
  rename_account: renameAccountArgs,
  delete_account: deleteAccountArgs,
  discover_feeds: discoverFeedsArgs,
  add_local_feed: addLocalFeedArgs,
  create_folder: createFolderArgs,
  delete_feed: deleteFeedArgs,
  rename_feed: renameFeedArgs,
  update_feed_folder: updateFeedFolderArgs,
  update_feed_display_mode: updateFeedDisplayModeArgs,
  open_in_browser: openInBrowserArgs,
  check_browser_embed_support: checkBrowserEmbedSupportArgs,
  export_opml: exportOpmlArgs,
  set_preference: setPreferenceArgs,
  copy_to_clipboard: copyToClipboardArgs,
  add_to_reading_list: addToReadingListArgs,
  create_tag: createTagArgs,
  rename_tag: renameTagArgs,
  delete_tag: deleteTagArgs,
  tag_article: tagArticleArgs,
  untag_article: untagArticleArgs,
  get_article_tags: getArticleTagsArgs,
  list_articles_by_tag: listArticlesByTagArgs,
};
```

- [ ] **Step 4: Update index.ts to export commands**

Add to `src/api/schemas/index.ts`:

```ts
export {
  // Individual schemas (for safeInvoke args parameter)
  listFoldersArgs,
  listFeedsArgs,
  listArticlesArgs,
  listAccountArticlesArgs,
  searchArticlesArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  toggleArticleStarArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  addAccountArgs,
  updateAccountSyncArgs,
  renameAccountArgs,
  deleteAccountArgs,
  discoverFeedsArgs,
  addLocalFeedArgs,
  createFolderArgs,
  deleteFeedArgs,
  renameFeedArgs,
  updateFeedFolderArgs,
  updateFeedDisplayModeArgs,
  openInBrowserArgs,
  checkBrowserEmbedSupportArgs,
  exportOpmlArgs,
  setPreferenceArgs,
  copyToClipboardArgs,
  addToReadingListArgs,
  createTagArgs,
  renameTagArgs,
  deleteTagArgs,
  tagArticleArgs,
  untagArticleArgs,
  getArticleTagsArgs,
  listArticlesByTagArgs,
  // Registry
  commandArgsSchemas,
} from "./commands";
```

- [ ] **Step 5: Run tests**

Run: `rtk vitest run src/__tests__/api/schemas.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/api/schemas/commands.ts src/api/schemas/index.ts src/__tests__/api/schemas.test.ts
rtk git commit -m "feat: add command args schemas with registry"
```

---

### Task 3: safeInvoke + toAppError Refactor

### Files

- Modify: `src/api/tauri-commands.ts:1-56`
- Modify: `src/__tests__/api/tauri-commands.test.ts`

- [ ] **Step 1: Add failing test for validation failure**

Add to `src/__tests__/api/tauri-commands.test.ts`:

```ts
describe("safeInvoke response validation", () => {
  it("returns error when response shape is invalid", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        // Return wrong shape — missing required fields
        return [{ id: "acc-1" }];
      }
      return null;
    });

    const result = await listAccounts();
    expect(Result.isErr(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error.type).toBe("UserVisible");
    expect(error.message).toContain("validation failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/__tests__/api/tauri-commands.test.ts`
Expected: FAIL — listAccounts currently doesn't validate response, so it returns Ok with the bad data

- [ ] **Step 3: Refactor safeInvoke and toAppError**

Modify `src/api/tauri-commands.ts`. Replace the existing type definitions (lines 1-56) and update all command functions:

```ts
import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  AccountDtoSchema,
  type AccountDto,
  AppErrorSchema,
  type AppError,
  ArticleDtoSchema,
  type ArticleDto,
  DiscoveredFeedDtoSchema,
  type DiscoveredFeedDto,
  FeedDtoSchema,
  type FeedDto,
  FolderDtoSchema,
  type FolderDto,
  TagDtoSchema,
  type TagDto,
  UpdateInfoDtoSchema,
  type UpdateInfoDto,
  // Command args
  listFoldersArgs,
  listFeedsArgs,
  listArticlesArgs,
  listAccountArticlesArgs,
  searchArticlesArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  toggleArticleStarArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  addAccountArgs,
  updateAccountSyncArgs,
  renameAccountArgs,
  deleteAccountArgs,
  discoverFeedsArgs,
  addLocalFeedArgs,
  createFolderArgs,
  deleteFeedArgs,
  renameFeedArgs,
  updateFeedFolderArgs,
  updateFeedDisplayModeArgs,
  openInBrowserArgs,
  checkBrowserEmbedSupportArgs,
  exportOpmlArgs,
  setPreferenceArgs,
  copyToClipboardArgs,
  addToReadingListArgs,
  createTagArgs,
  renameTagArgs,
  deleteTagArgs,
  tagArticleArgs,
  untagArticleArgs,
  getArticleTagsArgs,
  listArticlesByTagArgs,
} from "@/api/schemas";

// Re-export types so existing consumers don't break
export type {
  AccountDto,
  AppError,
  ArticleDto,
  DiscoveredFeedDto,
  FeedDto,
  FolderDto,
  TagDto,
  UpdateInfoDto,
};
```

Replace `toAppError`:

```ts
function toAppError(cmd: string, error: unknown): AppError {
  // Handle ZodError with detailed diagnostics
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

  console.error(`[tauri-commands] ${cmd} failed:`, error);
  const result = AppErrorSchema.safeParse(error);
  return result.success
    ? result.data
    : { type: "UserVisible", message: String(error) };
}
```

Replace `safeInvoke`:

```ts
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

function safeInvoke<R extends z.ZodType>(
  cmd: string,
  schemas: InvokeSchemas<R>,
  args?: Record<string, unknown>,
): Result.ResultAsync<z.output<R>, AppError>;
function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Result.ResultAsync<T, AppError>;
function safeInvoke(
  cmd: string,
  schemasOrArgs?: InvokeSchemas | Record<string, unknown>,
  maybeArgs?: Record<string, unknown>,
): Result.ResultAsync<unknown, AppError> {
  const schemas = isSchemas(schemasOrArgs) ? schemasOrArgs : undefined;
  const args = isSchemas(schemasOrArgs) ? maybeArgs : schemasOrArgs;

  return Result.try({
    try: async () => {
      const validatedArgs =
        schemas?.args && args ? schemas.args.parse(args) : args;
      const raw = await invoke(cmd, validatedArgs);
      return schemas?.response ? schemas.response.parse(raw) : raw;
    },
    catch: (error) => toAppError(cmd, error),
  });
}
```

- [ ] **Step 4: Migrate all command functions to use schemas**

Replace all command functions in `src/api/tauri-commands.ts:58-141`. Each command that returns data gets a response schema; each command with args gets an args schema. Example patterns:

```ts
// No args, array response
export const listAccounts = () =>
  safeInvoke("list_accounts", { response: z.array(AccountDtoSchema) });

// Args + array response
export const listFolders = (accountId: string) =>
  safeInvoke(
    "list_folders",
    { response: z.array(FolderDtoSchema), args: listFoldersArgs },
    { accountId },
  );

// Args + void response (use z.null() since Tauri returns null for void)
export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke(
    "mark_article_read",
    { response: z.null(), args: markArticleReadArgs },
    { articleId, read },
  );

// Args + single DTO response
export const addAccount = (
  kind: string,
  name: string,
  serverUrl?: string,
  username?: string,
  password?: string,
) =>
  safeInvoke(
    "add_account",
    { response: AccountDtoSchema, args: addAccountArgs },
    { kind, name, serverUrl, username, password },
  );

// Nullable response
export const checkForUpdate = () =>
  safeInvoke("check_for_update", { response: UpdateInfoDtoSchema.nullable() });

// Record response (getTagArticleCounts returns Record<string, number>)
export const getTagArticleCounts = () =>
  safeInvoke("get_tag_article_counts", {
    response: z.record(z.string(), z.number()),
  });

// Boolean response
export const triggerSync = () =>
  safeInvoke("trigger_sync", { response: z.boolean() });

// String response
export const exportOpml = (accountId: string) =>
  safeInvoke(
    "export_opml",
    { response: z.string(), args: exportOpmlArgs },
    { accountId },
  );
```

Apply this pattern to ALL remaining command functions. Refer to the existing signatures at `src/api/tauri-commands.ts:59-141` for the complete list.

> **Note:** Tauri IPC は void コマンドで `null` を返すため、`z.null()` を使う。`z.void()` は `undefined` のみ受け付けるため使わないこと。Spec に `z.void()` と記載がある箇所は実装時に `z.null()` に読み替える。

- [ ] **Step 5: Run all tests**

Run: `rtk vitest run`
Expected: All PASS (including the new validation failure test)

- [ ] **Step 6: Commit**

```bash
rtk git add src/api/tauri-commands.ts src/__tests__/api/tauri-commands.test.ts
rtk git commit -m "feat: safeInvoke with Zod request+response validation"
```

---

### Task 4: dev-mocks Migration

### Files

- Modify: `src/dev-mocks.ts:1-334`

- [ ] **Step 1: Replace imports and top-level cast**

In `src/dev-mocks.ts`, add schema imports and remove the top-level `as` cast:

```ts
// Add at the top
import {
  addAccountArgs,
  addLocalFeedArgs,
  createFolderArgs,
  createTagArgs,
  deleteFeedArgs,
  deleteTagArgs,
  discoverFeedsArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedsArgs,
  listFoldersArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFolderReadArgs,
  openInBrowserArgs,
  renameFeedArgs,
  renameTagArgs,
  searchArticlesArgs,
  setPreferenceArgs,
  tagArticleArgs,
  toggleArticleStarArgs,
  untagArticleArgs,
  updateAccountSyncArgs,
  updateFeedDisplayModeArgs,
  updateFeedFolderArgs,
  checkBrowserEmbedSupportArgs,
  getArticleTagsArgs,
  renameAccountArgs,
  deleteAccountArgs,
  exportOpmlArgs,
} from "@/api/schemas";
```

- [ ] **Step 2: Replace each case with schema parse**

For every `case` in the `switch` statement, replace `args.xxx as Type` with destructured parse result. Examples:

```ts
// Before (line 31): const args = payload as Record<string, unknown>;
// After: remove this line, parse payload per case

case "list_folders": {
  const { accountId } = listFoldersArgs.parse(payload);
  return mockFolders.filter((f) => f.account_id === accountId);
}

case "add_account": {
  const { kind, name, serverUrl } = addAccountArgs.parse(payload);
  const account: AccountDto = {
    id: `dev-acc-${nextAccountId++}`,
    kind,
    name,
    server_url: serverUrl ?? null,
    // ...
  };
}
```

Apply the same pattern to ALL cases. For cases that don't take args (`list_accounts`, `get_preferences`, `trigger_sync`, etc.), no parse is needed.

- [ ] **Step 3: Run dev server to smoke test**

Run: `pnpm dev --host 127.0.0.1 --port 4173 --strictPort`
Verify the app loads in browser without console errors.

- [ ] **Step 4: Run tests**

Run: `rtk vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/dev-mocks.ts
rtk git commit -m "refactor: replace as casts with Zod parse in dev-mocks"
```

---

### Task 5: Test Helper Migration

### Files

- Modify: `tests/helpers/tauri-mocks.ts:1-157`

- [ ] **Step 1: Add failing test for custom handler args validation**

Add to `src/__tests__/api/tauri-commands.test.ts`:

```ts
describe("setupTauriMocks validates args for custom handler", () => {
  it("passes validated args to custom handler", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_articles") return [];
      return null;
    });

    const ok = Result.unwrap(await listArticles("feed-1"));
    expect(ok).toEqual([]);
  });

  it("rejects invalid args shape via validateArgs", async () => {
    // Verify that validateArgs catches schema mismatch.
    // listArticles requires { feedId: string }, calling with wrong shape
    // should cause a ZodError which safeInvoke catches as AppError.
    let handlerCalled = false;
    setupTauriMocks(() => {
      handlerCalled = true;
      return [];
    });

    // Call markArticleRead which requires { articleId: string }
    // Pass empty object via direct invoke to bypass TS function signature
    const { invoke } = await import("@tauri-apps/api/core");
    await expect(invoke("mark_article_read", {})).rejects.toThrow();
    expect(handlerCalled).toBe(false);
  });
});
```

- [ ] **Step 2: Add validateArgs to tauri-mocks.ts**

Modify `tests/helpers/tauri-mocks.ts`:

```ts
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, ArticleDto, FeedDto } from "@/api/tauri-commands";
import { commandArgsSchemas } from "@/api/schemas";

// ... sampleAccounts, sampleFeeds, sampleArticles unchanged ...

type MockHandler = (cmd: string, args: Record<string, unknown>) => unknown;

function validateArgs(cmd: string, payload: unknown): Record<string, unknown> {
  const schema = commandArgsSchemas[cmd];
  if (schema) {
    return schema.parse(payload) as Record<string, unknown>;
  }
  return (payload ?? {}) as Record<string, unknown>;
}

const defaultHandler: MockHandler = (cmd, args) => {
  // ... existing switch unchanged ...
};

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

Also update the `add_account` case (line 100) to remove the `as string` cast. Since `validateArgs` ensures the shape is valid but `Record<string, unknown>` still types values as `unknown`, use `String()` coercion instead of `as` for the remaining cases in `defaultHandler`:

```ts
// Before
server_url: (args.serverUrl as string) ?? null,

// After
server_url: args.serverUrl != null ? String(args.serverUrl) : null,
```

> **Design note:** `Record<string, unknown>` 型から値を取り出す際、`as` キャストは避けられない場面がある。`validateArgs` でスキーマ検証済みのため実行時の安全性は担保されているが、`String()` / `Number()` / `Boolean()` のコercion関数を使うことで `as` を完全に排除できる。test-mocks は `defaultHandler` の case が少数のため、この方法で対応する。

- [ ] **Step 3: Run all tests**

Run: `rtk vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
rtk git add tests/helpers/tauri-mocks.ts src/__tests__/api/tauri-commands.test.ts
rtk git commit -m "refactor: add args validation to test mock helper"
```

---

### Task 6: Remove Old Type Definitions + Final Cleanup

### Files

- Modify: `src/api/tauri-commands.ts` — verify no hand-written DTO types remain
- Verify: All consumers import types from `@/api/tauri-commands` (re-exported from schemas)

- [ ] **Step 1: Verify no hand-written DTO types remain in tauri-commands.ts**

Check that `src/api/tauri-commands.ts` no longer contains `type AccountDto = {`, `type FeedDto = {`, etc. These should have been removed in Task 3 and replaced with re-exports from schemas.

- [ ] **Step 2: Run full quality check**

Run: `rtk mise run check`
Expected: format, lint, and tests all pass

- [ ] **Step 3: Verify consumer imports still work**

All files that `import type { ... } from "@/api/tauri-commands"` should work without changes because `tauri-commands.ts` re-exports the types. Verify with:

Run: `rtk pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
rtk git add src/api/tauri-commands.ts
rtk git commit -m "chore: final cleanup for Zod IPC validation migration"
```

If no changes exist at this step (all cleanup was done in earlier tasks), skip the commit.

---

## Post-Implementation Checklist

- [ ] `rtk mise run check` passes (format + lint + test)
- [ ] `rtk mise run ci` passes (format + lint + test + build)
- [ ] No `as XXX` type assertions remain in `src/api/tauri-commands.ts`
- [ ] No `as string` / `as boolean` casts remain in `src/dev-mocks.ts`
- [ ] `tests/helpers/tauri-mocks.ts` validates args for both default and custom handlers
- [ ] All existing consumer imports still resolve
