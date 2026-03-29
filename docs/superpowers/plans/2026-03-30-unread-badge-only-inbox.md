# Unread Badge Only Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings > General > 未読バッジの `only_inbox` を、feed 合算ではなく Rust 側のアカウント単位未読件数 query で動作させる

**Architecture:** Rust の article repository にアカウント未読件数 read query を追加し、Tauri command と TypeScript wrapper 経由で `useBadge` から参照する。`all_unread` は既存の `feeds.unread_count` 合算を維持し、`only_inbox` のときだけ専用 query を使う。件数が変わる mutation / add-feed / delete-feed の invalidate 経路に新しい query key を追加して整合性を保つ。

**Tech Stack:** Rust, rusqlite, Tauri 2 commands, React 19, TanStack Query, Vitest

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `src-tauri/src/repository/article.rs` | アカウント未読件数 read API を trait に追加 |
| Modify | `src-tauri/src/infra/db/sqlite_article.rs` | SQLite で account 単位未読件数を数える実装と repository テスト |
| Modify | `src-tauri/src/commands/article_commands.rs` | `count_account_unread_articles` Tauri command を追加 |
| Modify | `src-tauri/src/lib.rs` | 新 command を invoke handler に登録 |
| Modify | `src/api/schemas/commands.ts` | 新 command の args schema と registry 追加 |
| Modify | `src/api/schemas/index.ts` | 新 args schema の export 追加 |
| Modify | `src/api/tauri-commands.ts` | `countAccountUnreadArticles()` wrapper を追加 |
| Modify | `src/dev-mocks.ts` | browser dev mode の mock IPC に新 command を追加 |
| Modify | `tests/helpers/tauri-mocks.ts` | Vitest 用 mock IPC に新 command を追加 |
| Modify | `src/__tests__/api/tauri-commands.test.ts` | wrapper が整数件数を返すことを検証 |
| Create | `src/hooks/use-account-unread-count.ts` | `enabled` 制御付き account unread count query hook |
| Modify | `src/hooks/use-badge.ts` | `unread_badge` 設定ごとに件数 source を分岐 |
| Modify | `src/hooks/use-articles.ts` | article read mutations で unread count query も invalidate |
| Modify | `src/components/reader/add-feed-dialog.tsx` | feed 追加後に unread count query を invalidate |
| Modify | `src/components/reader/feed-context-menu.tsx` | feed 削除後に unread count query を invalidate |
| Create | `src/__tests__/hooks/use-badge.test.tsx` | `dont_display` / `all_unread` / `only_inbox` のバッジ分岐を検証 |
| Modify | `TODO.md` | 実装完了後に該当項目を完了へ更新 |

---

## Task 1: Rust Repository に account unread count query を追加

### Files

- Modify: `src-tauri/src/repository/article.rs`
- Modify: `src-tauri/src/infra/db/sqlite_article.rs`

- [ ] **Step 1: repository テストを先に追加する**

`src-tauri/src/infra/db/sqlite_article.rs` の `tests` に追加:

```rust
#[test]
fn count_unread_by_account_counts_only_unread_in_selected_account() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a1 = insert_test_feed(&db, &account_a);
    let feed_a2 = insert_test_feed(&db, &account_a);
    let feed_b1 = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());

    let a1 = make_article(&feed_a1, "a1 unread");
    let a2 = make_article(&feed_a2, "a2 unread");
    let mut a3 = make_article(&feed_a2, "a2 read");
    let b1 = make_article(&feed_b1, "b1 unread");
    a3.is_read = true;

    repo.upsert(&[a1, a2, a3, b1]).unwrap();

    assert_eq!(repo.count_unread_by_account(&account_a).unwrap(), 2);
}
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd src-tauri && cargo test count_unread_by_account_counts_only_unread_in_selected_account -- --nocapture`

Expected: FAIL with `no method named 'count_unread_by_account'` or trait implementation error

- [ ] **Step 3: trait と SQLite 実装を追加する**

`src-tauri/src/repository/article.rs` に追加:

```rust
fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32>;
```

`src-tauri/src/infra/db/sqlite_article.rs` に追加:

```rust
fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32> {
    let count = self.conn.query_row(
        "SELECT COUNT(*)
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE f.account_id = ?1
           AND a.is_read = 0",
        params![account_id.0],
        |row| row.get(0),
    )?;
    Ok(count)
}
```

- [ ] **Step 4: repository テストを再実行する**

Run: `cd src-tauri && cargo test count_unread_by_account_counts_only_unread_in_selected_account -- --nocapture`

Expected: PASS

- [ ] **Step 5: SQLite article repository 一式を再確認する**

Run: `cd src-tauri && cargo test sqlite_article -- --nocapture`

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src-tauri/src/repository/article.rs src-tauri/src/infra/db/sqlite_article.rs
git commit -m "feat: add account unread count query"
```

---

## Task 2: Tauri command と TypeScript API plumbing を追加

### Files

- Modify: `src-tauri/src/commands/article_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/api/schemas/commands.ts`
- Modify: `src/api/schemas/index.ts`
- Modify: `src/api/tauri-commands.ts`
- Modify: `src/dev-mocks.ts`
- Modify: `tests/helpers/tauri-mocks.ts`
- Modify: `src/__tests__/api/tauri-commands.test.ts`

- [ ] **Step 1: API wrapper の失敗テストを追加する**

`src/__tests__/api/tauri-commands.test.ts` に追加:

```ts
import { countAccountUnreadArticles } from "@/api/tauri-commands";

describe("countAccountUnreadArticles", () => {
  it("returns unread count for a given account", async () => {
    const value = Result.unwrap(await countAccountUnreadArticles("acc-1"));
    expect(value).toBe(1);
  });
});
```

`tests/helpers/tauri-mocks.ts` の default handler は後で `sampleArticles` を元に `1` を返すようにする。ここではまだ未実装でよい。

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm vitest run src/__tests__/api/tauri-commands.test.ts`

Expected: FAIL with missing export, unknown command, or validation error

- [ ] **Step 3: Rust command を追加して登録する**

`src-tauri/src/commands/article_commands.rs` に追加:

```rust
#[tauri::command]
pub fn count_account_unread_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    repo.count_unread_by_account(&AccountId(account_id))
        .map_err(AppError::from)
}
```

`src-tauri/src/lib.rs` の `invoke_handler` に `commands::article_commands::count_account_unread_articles` を追加する。

- [ ] **Step 4: TypeScript wrapper, schema, mock を追加する**

`src/api/schemas/commands.ts` に追加:

```ts
export const countAccountUnreadArticlesArgs = z.object({ accountId: z.string() });
```

registry に追加:

```ts
count_account_unread_articles: countAccountUnreadArticlesArgs,
```

`src/api/schemas/index.ts` に export を追加する。

`src/api/tauri-commands.ts` に追加:

```ts
export const countAccountUnreadArticles = (accountId: string) =>
  safeInvoke(
    "count_account_unread_articles",
    { response: z.number().int(), args: countAccountUnreadArticlesArgs },
    { accountId },
  );
```

`src/dev-mocks.ts` に追加:

```ts
case "count_account_unread_articles": {
  const { accountId } = countAccountUnreadArticlesArgs.parse(payload);
  const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
  return mockArticles.filter((a) => feedIds.includes(a.feed_id) && !a.is_read).length;
}
```

`tests/helpers/tauri-mocks.ts` の default handler に追加:

```ts
case "count_account_unread_articles":
  return sampleArticles.filter(
    (a) => !a.is_read && sampleFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId),
  ).length;
```

- [ ] **Step 5: API テストを再実行する**

Run: `pnpm vitest run src/__tests__/api/tauri-commands.test.ts`

Expected: PASS

- [ ] **Step 6: Rust 側の command 登録も含めてコンパイル確認する**

Run: `cd src-tauri && cargo check`

Expected: PASS

- [ ] **Step 7: コミットする**

```bash
git add src-tauri/src/commands/article_commands.rs src-tauri/src/lib.rs src/api/schemas/commands.ts src/api/schemas/index.ts src/api/tauri-commands.ts src/dev-mocks.ts tests/helpers/tauri-mocks.ts src/__tests__/api/tauri-commands.test.ts
git commit -m "feat: expose account unread count command"
```

---

## Task 3: `only_inbox` 用 query hook と badge 分岐を実装

### Files

- Create: `src/hooks/use-account-unread-count.ts`
- Modify: `src/hooks/use-badge.ts`
- Modify: `src/hooks/use-articles.ts`
- Modify: `src/components/reader/add-feed-dialog.tsx`
- Modify: `src/components/reader/feed-context-menu.tsx`
- Create: `src/__tests__/hooks/use-badge.test.tsx`

- [ ] **Step 1: `useBadge` の失敗テストを追加する**

`src/__tests__/hooks/use-badge.test.tsx` を作成:

```tsx
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBadge } from "@/hooks/use-badge";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const { setBadgeCountMock } = vi.hoisted(() => ({
  setBadgeCountMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setBadgeCount: setBadgeCountMock,
  }),
}));

function HookHarness() {
  useBadge();
  return null;
}

describe("useBadge", () => {
  beforeEach(() => {
    setBadgeCountMock.mockReset();
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    });
    usePreferencesStore.setState({ prefs: { unread_badge: "only_inbox" }, loaded: true });
  });

  it("uses count_account_unread_articles for only_inbox", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "count_account_unread_articles") return 1;
      if (cmd === "list_feeds") return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      return null;
    });

    render(<HookHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(setBadgeCountMock).toHaveBeenCalledWith(1);
    });
  });
});
```

テスト内の store 初期化は、実際の `useUiStore` API に合わせて調整すること。最低でも `selectedAccountId` を `"acc-1"` にし、`all_unread` 用テストでは `sampleFeeds` 合算の `5`、`dont_display` では `undefined` を確認する。

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm vitest run src/__tests__/hooks/use-badge.test.tsx`

Expected: FAIL because `useBadge` still always uses feed sum and new hook/query does not exist

- [ ] **Step 3: `enabled` 制御付き query hook を追加する**

`src/hooks/use-account-unread-count.ts` を作成:

```ts
import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { countAccountUnreadArticles } from "@/api/tauri-commands";

export function useAccountUnreadCount(accountId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["accountUnreadCount", accountId],
    queryFn: () => countAccountUnreadArticles(accountId as string).then(Result.unwrap),
    enabled: enabled && !!accountId,
    retry: false,
  });
}
```

`createQuery()` は `enabled` を `!!id` で固定しているため、今回だけは専用 hook にする。

- [ ] **Step 4: `useBadge` を設定値で分岐する**

`src/hooks/use-badge.ts` を次の方針で更新する:

```ts
const { data: feeds } = useFeeds(selectedAccountId);
const { data: inboxUnread, isError: inboxUnreadError } = useAccountUnreadCount(
  selectedAccountId,
  badgePref === "only_inbox",
);

useEffect(() => {
  if (!selectedAccountId || badgePref === "dont_display") {
    void setBadgeCount(undefined);
    return;
  }

  if (badgePref === "only_inbox" && inboxUnreadError) {
    void setBadgeCount(undefined);
    return;
  }

  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;
  const count = badgePref === "only_inbox" ? inboxUnread ?? 0 : totalUnread;

  void setBadgeCount(count > 0 ? count : undefined);
}, [selectedAccountId, badgePref, feeds, inboxUnread, inboxUnreadError]);
```

`only_inbox` の query は error 時に前回成功値を保持する可能性があるため、「更新しない」ではなく `undefined` へ明示的にクリアする。

- [ ] **Step 5: 件数変更系の invalidate に新 query key を追加する**

`src/hooks/use-articles.ts` の共通 invalidation に追加:

```ts
qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
```

`src/components/reader/add-feed-dialog.tsx` の feed 追加成功後に追加:

```ts
qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
```

`src/components/reader/feed-context-menu.tsx` の delete success 後に追加:

```ts
qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
```

この 3 箇所以外の `["feeds"]` invalidation は、件数に影響しない UI-only 更新なら触らない。

- [ ] **Step 6: hook テストを拡張して 3 分岐を揃える**

`src/__tests__/hooks/use-badge.test.tsx` に追加:

- `dont_display` なら `setBadgeCount(undefined)` を呼ぶ
- `all_unread` なら `sampleFeeds` 合算の `5` を使う
- `only_inbox` なら count command の `1` を使う
- count command が throw した場合は `setBadgeCount(undefined)` を呼び、hook もクラッシュしない

- [ ] **Step 7: hook テストを再実行する**

Run: `pnpm vitest run src/__tests__/hooks/use-badge.test.tsx`

Expected: PASS

- [ ] **Step 8: API と hook をまとめて再実行する**

Run: `pnpm vitest run src/__tests__/api/tauri-commands.test.ts src/__tests__/hooks/use-badge.test.tsx`

Expected: PASS

- [ ] **Step 9: コミットする**

```bash
git add src/hooks/use-account-unread-count.ts src/hooks/use-badge.ts src/hooks/use-articles.ts src/components/reader/add-feed-dialog.tsx src/components/reader/feed-context-menu.tsx src/__tests__/hooks/use-badge.test.tsx
git commit -m "feat: support only inbox unread badge"
```

---

## Task 4: 完了確認と TODO 更新

### Files

- Modify: `TODO.md`

- [ ] **Step 1: TODO を完了状態に更新する**

`TODO.md` の該当行を次に更新:

```md
- [x] Settings > General > 未読バッジ「受信トレイのみ」を実装する（現状は `すべての未読` と同じ集計）
```

- [ ] **Step 2: Rust / Vitest の要点だけ先に再確認する**

Run: `cd src-tauri && cargo test count_unread_by_account_counts_only_unread_in_selected_account -- --nocapture`

Expected: PASS

Run: `pnpm vitest run src/__tests__/api/tauri-commands.test.ts src/__tests__/hooks/use-badge.test.tsx`

Expected: PASS

- [ ] **Step 3: プロジェクト全体の品質ゲートを通す**

Run: `mise run check`

Expected: PASS (`format + lint + test` がすべて成功)

- [ ] **Step 4: 最終コミットを作る**

```bash
git add TODO.md
git commit -m "chore: mark unread badge task done"
```

- [ ] **Step 5: 完了報告に含める内容を整理する**

報告に含める:

- Rust 側で追加した query / command 名
- `only_inbox` が参照する query key
- 追加したテストファイル
- `mise run check` の結果

---

## Notes for Implementer

- `only_inbox` は現時点では「アカウント単位未読件数専用 query」であり、`all_unread` と数値が一致する場合がある。それでも責務分離のために query を分ける
- `useAccountUnreadCount` は `enabled` を持たせる。`createQuery()` をそのまま使うと `all_unread` でも不要な IPC が走る
- 新 command を追加したら dev mock と test mock の両方を更新する。どちらかだけだと browser dev mode か Vitest のどちらかが壊れる
- `src/App.tsx` は `sync-completed` で全 query を invalidate 済みなので、この変更のために sync event 周りへ追加対応はしない
- 既存の未保存変更は触らない。この plan に含まれない差分は混ぜない
