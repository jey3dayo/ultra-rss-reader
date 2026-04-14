# Dev Scenarios + Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `dev intent` を `DevScenario` ハーネスへ整理し、`dev build` 限定でコマンドパレットから起動できるようにして、表示再現・ナビゲーション再現・操作 smoke のテストケースを増やしやすくする。

Architecture: 単発の通常操作は既存 `AppAction` に残し、複数 state やデータ選択をまとめるものだけを `DevScenario` として分離する。起動時 env 注入と command palette 選択の両方が同じ scenario registry / runner を使う構成にし、`image-viewer-overlay` の既存挙動を後方互換で維持する。

Tech Stack: React 19, TypeScript, Vitest, Testing Library, Zustand, React Query, Vite env flags

Spec: `docs/superpowers/specs/2026-04-04-dev-scenarios-command-palette-design.md`

---

## File Map

### New Files

| File | Responsibility |
| --- | --- |
| `src/dev/scenarios/types.ts` | `DevScenarioId` / `DevScenario` / `DevScenarioContext` の型定義 |
| `src/dev/scenarios/helpers.ts` | feed / article 選定、state 適用、共通エラー処理の補助関数 |
| `src/dev/scenarios/registry.ts` | scenario 定義一覧と `getDevScenario()` 解決 |
| `src/dev/scenarios/runner.ts` | `runDevScenario()` 実行エントリ。起動時注入とパレット実行を共通化 |
| `src/dev/scenarios/index.ts` | scenario API の公開面 |
| `src/__tests__/dev/scenarios/registry.test.ts` | registry / env 解決の純粋関数テスト |
| `src/__tests__/dev/scenarios/runner.test.ts` | scenario 実行ロジックの単体テスト |
| `src/__tests__/hooks/use-dev-intent.test.tsx` | 起動時注入の 1 回実行と失敗 toast テスト |

### Modified Files

| File | Change |
| --- | --- |
| `src/lib/dev-intent.ts` | env 値読み取りと後方互換 parser を scenario id 解決へ整理 |
| `src/hooks/use-dev-intent.ts` | 直接ロジックを持たず、`runDevScenario()` を 1 回呼ぶ hook に整理 |
| `src/components/reader/command-palette.tsx` | `Dev Scenarios` グループを `dev build` 時だけ追加 |
| `src/__tests__/lib/dev-intent.test.ts` | parser / `image-viewer-overlay` の後方互換テストへ更新 |
| `src/__tests__/components/command-palette.test.tsx` | dev scenario 表示・検索・選択のテスト追加 |

### Existing Files Reused Without Structural Changes

| File | Why |
| --- | --- |
| `src/lib/actions.ts` | `open-add-feed` / `sync-all` / `reload-webview` を通常操作として再利用する |
| `src/stores/ui-store.ts` | scenario 実行時の UI state 適用先 |
| `src/api/tauri-commands.ts` | feed / article の読み出しを既存 API で行う |
| `src/hooks/use-feeds.ts` / `src/hooks/use-tags.ts` / `src/hooks/use-articles.ts` | command palette 側の既存検索データ源 |

---

## Task 1: Scenario 型と registry を追加する

### Files:

- Create: `src/dev/scenarios/types.ts`
- Create: `src/dev/scenarios/registry.ts`
- Create: `src/dev/scenarios/index.ts`
- Create: `src/__tests__/dev/scenarios/registry.test.ts`
- Modify: `src/lib/dev-intent.ts`
- Modify: `src/__tests__/lib/dev-intent.test.ts`

- [ ] **Step 1: registry テストを書く**

`src/__tests__/dev/scenarios/registry.test.ts` を作成:

```ts
import { describe, expect, it } from "vitest";
import { getDevScenario, listDevScenarios } from "@/dev/scenarios";
import { parseDevIntent } from "@/lib/dev-intent";

describe("dev scenario registry", () => {
  it("lists the built-in scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual([
      "image-viewer-overlay",
      "open-feed-first-article",
      "open-tag-view",
      "open-add-feed-dialog",
      "sync-all-smoke",
    ]);
  });

  it("returns the image-viewer scenario by id", () => {
    expect(getDevScenario("image-viewer-overlay")?.id).toBe("image-viewer-overlay");
  });

  it("returns null for unknown ids", () => {
    expect(getDevScenario("unknown" as never)).toBeNull();
  });

  it("keeps image-viewer-overlay env parsing backward compatible", () => {
    expect(parseDevIntent("image-viewer-overlay")).toBe("image-viewer-overlay");
    expect(parseDevIntent("unknown")).toBeNull();
  });
});
```

- [ ] **Step 2: テスト失敗を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/registry.test.ts src/__tests__/lib/dev-intent.test.ts
```

Expected: FAIL because `@/dev/scenarios` does not exist yet

- [ ] **Step 3: 型定義を追加する**

`src/dev/scenarios/types.ts` を作成:

```ts
import type { listAccounts, listArticles, listFeeds } from "@/api/tauri-commands";
import { queryClient } from "@/lib/query-client";
import { useUiStore } from "@/stores/ui-store";
import type { executeAction } from "@/lib/actions";

export type DevScenarioId =
  | "image-viewer-overlay"
  | "open-feed-first-article"
  | "open-tag-view"
  | "open-add-feed-dialog"
  | "sync-all-smoke";

export type DevScenarioContext = {
  ui: typeof useUiStore.getState;
  queryClient: typeof queryClient;
  actions: {
    executeAction: typeof executeAction;
    listAccounts: typeof listAccounts;
    listFeeds: typeof listFeeds;
    listArticles: typeof listArticles;
  };
};

export type DevScenario = {
  id: DevScenarioId;
  title: string;
  keywords: string[];
  run: (context: DevScenarioContext) => Promise<void> | void;
};
```

- [ ] **Step 4: registry と env parser を実装する**

`src/dev/scenarios/registry.ts` を作成して、まずは stub 実装でよいので 5 scenario を登録する:

```ts
import type { DevScenario } from "./types";

const scenarios: DevScenario[] = [
  { id: "image-viewer-overlay", title: "Image viewer overlay", keywords: ["image", "overlay"], run: () => {} },
  { id: "open-feed-first-article", title: "Open feed first article", keywords: ["feed", "article"], run: () => {} },
  { id: "open-tag-view", title: "Open tag view", keywords: ["tag", "navigation"], run: () => {} },
  { id: "open-add-feed-dialog", title: "Open add feed dialog", keywords: ["feed", "dialog"], run: () => {} },
  { id: "sync-all-smoke", title: "Sync all smoke", keywords: ["sync", "reload"], run: () => {} },
];

export function listDevScenarios(): DevScenario[] {
  return scenarios;
}

export function getDevScenario(id: string): DevScenario | null {
  return scenarios.find((scenario) => scenario.id === id) ?? null;
}
```

`src/dev/scenarios/index.ts` を作成:

```ts
export * from "./types";
export * from "./registry";
```

`src/lib/dev-intent.ts` の parser を scenario id ベースに整理:

```ts
import { getDevScenario, type DevScenarioId } from "@/dev/scenarios";

export function parseDevIntent(value: string | undefined): DevScenarioId | null {
  if (!value) {
    return null;
  }

  return getDevScenario(value)?.id ?? null;
}
```

既存の `pickDevIntentArticle` / `rankDevIntentFeeds` / `resolveDevIntentBrowserUrl` はこの段階では残す。Task 2 で scenario helper へ寄せる。

- [ ] **Step 5: テスト成功を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/registry.test.ts src/__tests__/lib/dev-intent.test.ts
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/dev/scenarios src/lib/dev-intent.ts src/__tests__/dev/scenarios/registry.test.ts src/__tests__/lib/dev-intent.test.ts
git commit -m "feat: add dev scenario registry and env parsing"
```

---

## Task 2: Scenario runner を導入して image-viewer-overlay を移植する

### Files:

- Create: `src/dev/scenarios/helpers.ts`
- Create: `src/dev/scenarios/runner.ts`
- Create: `src/__tests__/dev/scenarios/runner.test.ts`
- Create: `src/__tests__/hooks/use-dev-intent.test.tsx`
- Modify: `src/hooks/use-dev-intent.ts`
- Modify: `src/dev/scenarios/registry.ts`
- Modify: `src/lib/dev-intent.ts`

- [ ] **Step 1: runner テストを書く**

`src/__tests__/dev/scenarios/runner.test.ts` を作成:

```ts
import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDevScenario } from "@/dev/scenarios/runner";
import { useUiStore } from "@/stores/ui-store";

const listAccounts = vi.fn();
const listFeeds = vi.fn();
const listArticles = vi.fn();
const executeAction = vi.fn();

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState());
  listAccounts.mockReset();
  listFeeds.mockReset();
  listArticles.mockReset();
  executeAction.mockReset();
});

it("runs image-viewer-overlay and opens the browser preview", async () => {
  listAccounts.mockResolvedValue(Result.succeed([{ id: "acc-1", name: "Local" }]));
  listFeeds.mockResolvedValue(Result.succeed([
    {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      title: "マガポケ",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 3,
      reader_mode: "on",
      web_preview_mode: "on",
    },
  ]));
  listArticles.mockResolvedValue(Result.succeed([
    {
      id: "article-1",
      feed_id: "feed-1",
      title: "Overlay target",
      content_sanitized: "<p>body</p>",
      summary: "body",
      url: "https://example.com/article",
      author: null,
      published_at: "2026-04-04T00:00:00.000Z",
      thumbnail: null,
      is_read: false,
      is_starred: false,
    },
  ]));

  await runDevScenario("image-viewer-overlay", {
    ui: useUiStore.getState,
    queryClient,
    actions: { executeAction, listAccounts, listFeeds, listArticles },
  });

  expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
  expect(useUiStore.getState().selectedArticleId).toBe("article-1");
  expect(useUiStore.getState().contentMode).toBe("browser");
});
```

- [ ] **Step 2: 起動時 hook テストを書く**

`src/__tests__/hooks/use-dev-intent.test.tsx` を作成:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDevIntent } from "@/hooks/use-dev-intent";
import { useUiStore } from "@/stores/ui-store";

const runDevScenarioMock = vi.fn();

vi.mock("@/dev/scenarios/runner", () => ({
  runDevScenario: runDevScenarioMock,
}));

describe("useDevIntent", () => {
  beforeEach(() => {
    runDevScenarioMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
    vi.stubEnv("DEV", "1");
    vi.stubEnv("VITE_DEV_INTENT", "image-viewer-overlay");
  });

  it("runs the scenario once on mount", async () => {
    renderHook(() => useDevIntent());

    await waitFor(() => {
      expect(runDevScenarioMock).toHaveBeenCalledTimes(1);
      expect(runDevScenarioMock).toHaveBeenCalledWith("image-viewer-overlay");
    });
  });
});
```

- [ ] **Step 3: テスト失敗を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts src/__tests__/hooks/use-dev-intent.test.tsx
```

Expected: FAIL because `runDevScenario` and scenario logic are not implemented

- [ ] **Step 4: helper と runner を実装する**

`src/dev/scenarios/helpers.ts` を作成し、既存 `rankDevIntentFeeds` / `pickDevIntentArticle` / `resolveDevIntentBrowserUrl` をここへ寄せる。  
`src/lib/dev-intent.ts` には parser と軽量 env reader だけを残す。

`src/dev/scenarios/runner.ts` を作成:

```ts
import { Result } from "@praha/byethrow";
import { listAccounts, listArticles, listFeeds } from "@/api/tauri-commands";
import { executeAction } from "@/lib/actions";
import { queryClient } from "@/lib/query-client";
import { useUiStore } from "@/stores/ui-store";
import { getDevScenario } from "./registry";
import type { DevScenarioContext, DevScenarioId } from "./types";

function createDefaultContext(): DevScenarioContext {
  return {
    ui: useUiStore.getState,
    queryClient,
    actions: { executeAction, listAccounts, listFeeds, listArticles },
  };
}

export async function runDevScenario(id: DevScenarioId, context: DevScenarioContext = createDefaultContext()) {
  const scenario = getDevScenario(id);
  if (!scenario) {
    throw new Error(`Unknown dev scenario: ${id}`);
  }

  await scenario.run(context);
}
```

`src/dev/scenarios/registry.ts` の `image-viewer-overlay` を実装し、既存 `useDevIntent` のロジックを scenario に移す。  
`src/hooks/use-dev-intent.ts` は `hasRun` 管理と `runDevScenario(intent)` 呼び出しだけにする。

- [ ] **Step 5: 失敗 toast を追加する**

`useDevIntent` の `catch` では既存文言を維持する:

```ts
useUiStore.getState().showToast("Dev intent failed to open the overlay.");
```

Runner 側では toast を出さず、hook 側が起動時注入の失敗表示責務を持つ。

- [ ] **Step 6: テスト成功を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts src/__tests__/hooks/use-dev-intent.test.tsx src/__tests__/lib/dev-intent.test.ts
```

Expected: PASS

- [ ] **Step 7: コミットする**

```bash
git add src/dev/scenarios src/hooks/use-dev-intent.ts src/lib/dev-intent.ts src/__tests__/dev/scenarios/runner.test.ts src/__tests__/hooks/use-dev-intent.test.tsx src/__tests__/lib/dev-intent.test.ts
git commit -m "feat: move dev intent execution into shared scenario runner"
```

---

## Task 3: Command Palette に Dev Scenarios グループを追加する

### Files:

- Modify: `src/components/reader/command-palette.tsx`
- Modify: `src/__tests__/components/command-palette.test.tsx`

- [ ] **Step 1: コンポーネントテストを追加する**

`src/__tests__/components/command-palette.test.tsx` に追加:

```tsx
it("shows the Dev Scenarios group in dev mode", async () => {
  vi.stubEnv("DEV", "1");

  render(<CommandPalette />, { wrapper: createWrapper() });

  expect(await screen.findByText("Dev Scenarios", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Image viewer overlay/i })).toBeInTheDocument();
});

it("does not show Dev Scenarios outside dev mode", async () => {
  vi.stubEnv("DEV", "");

  render(<CommandPalette />, { wrapper: createWrapper() });

  await screen.findByText("Actions", { selector: "[cmdk-group-heading]" });
  expect(screen.queryByText("Dev Scenarios")).not.toBeInTheDocument();
});

it("runs a dev scenario and closes the palette", async () => {
  vi.stubEnv("DEV", "1");
  const runDevScenario = vi.fn();
  vi.doMock("@/dev/scenarios/runner", () => ({ runDevScenario }));

  render(<CommandPalette />, { wrapper: createWrapper() });
  await userEvent.click(await screen.findByRole("option", { name: /Image viewer overlay/i }));

  await waitFor(() => {
    expect(runDevScenario).toHaveBeenCalledWith("image-viewer-overlay");
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
```

- [ ] **Step 2: テスト失敗を確認する**

Run:

```bash
pnpm vitest run src/__tests__/components/command-palette.test.tsx
```

Expected: FAIL because the component has no `Dev Scenarios` group yet

- [ ] **Step 3: component に scenario group を実装する**

`src/components/reader/command-palette.tsx` に以下を追加する。

1. `listDevScenarios()` を import
2. `runDevScenario()` を import
3. `const devScenarios = import.meta.env.DEV ? listDevScenarios() : [];`
4. `CommandGroup heading="Dev Scenarios"` を `Actions` の後に追加
5. item 選択時に `runDevScenario(id)` を呼び、履歴を `scenario:<id>` で保存して palette を閉じる

実装イメージ:

```tsx
const devScenarios = import.meta.env.DEV ? listDevScenarios() : [];

function handleScenarioSelect(id: DevScenarioId) {
  addToHistory(`scenario:${id}`);
  void runDevScenario(id);
  closePalette();
}
```

`showRecentActions` はそのまま維持し、scenario 履歴はこの段階では初期表示に混ぜない。  
履歴表示は通常操作だけに絞っておく。

- [ ] **Step 4: scenario 検索を追加する**

既存の `matchesQuery()` を流用し、`title` と `keywords` でフィルタする:

```ts
const filteredScenarios = useMemo(
  () => devScenarios.filter((scenario) => matchesQuery(scenario.title, scenario.keywords, query)),
  [devScenarios, query],
);
```

- [ ] **Step 5: テスト成功を確認する**

Run:

```bash
pnpm vitest run src/__tests__/components/command-palette.test.tsx
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/reader/command-palette.tsx src/__tests__/components/command-palette.test.tsx
git commit -m "feat: add dev scenarios group to command palette"
```

---

## Task 4: ナビゲーション系 scenario を追加する

### Files:

- Modify: `src/dev/scenarios/registry.ts`
- Modify: `src/dev/scenarios/helpers.ts`
- Modify: `src/__tests__/dev/scenarios/runner.test.ts`

- [ ] **Step 1: failing test を追加する**

`src/__tests__/dev/scenarios/runner.test.ts` に追加:

```ts
it("opens the first article in the top-ranked feed", async () => {
  // account / feed / article mock は image-viewer-overlay と同様
  await runDevScenario("open-feed-first-article", context);

  expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
  expect(useUiStore.getState().selectedArticleId).toBe("article-1");
  expect(useUiStore.getState().contentMode).toBe("reader");
});

it("opens the tag view without selecting an article", async () => {
  useUiStore.getState().selectAccount("acc-1");

  await runDevScenario("open-tag-view", context);

  expect(useUiStore.getState().selection).toEqual({ type: "tag", tagId: "tag-dev" });
  expect(useUiStore.getState().selectedArticleId).toBeNull();
  expect(useUiStore.getState().contentMode).toBe("empty");
});
```

- [ ] **Step 2: テスト失敗を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts
```

Expected: FAIL because the new scenarios are still stubs

- [ ] **Step 3: open-feed-first-article を実装する**

`src/dev/scenarios/helpers.ts` に `loadBestFeedWithArticles()` を追加:

```ts
export async function loadBestFeedWithArticles(context: DevScenarioContext) {
  const accounts = await context.actions.listAccounts().then(Result.unwrap);

  for (const account of accounts) {
    const feeds = await context.actions.listFeeds(account.id).then(Result.unwrap);
    context.queryClient.setQueryData(["feeds", account.id], feeds);

    for (const feed of rankDevIntentFeeds(feeds)) {
      const articles = await context.actions.listArticles(feed.id).then(Result.unwrap);
      context.queryClient.setQueryData(["articles", feed.id], articles);
      if (articles.length > 0) {
        return { account, feed, articles };
      }
    }
  }

  return null;
}
```

`registry.ts` の scenario 実装:

```ts
{
  id: "open-feed-first-article",
  title: "Open feed first article",
  keywords: ["feed", "article", "reader"],
  run: async (context) => {
    const loaded = await loadBestFeedWithArticles(context);
    if (!loaded) {
      context.ui().showToast("Dev scenario could not find any articles.");
      return;
    }

    const article = pickDevIntentArticle(loaded.articles);
    context.ui().selectAccount(loaded.account.id);
    context.ui().selectFeed(loaded.feed.id);
    context.ui().setViewMode("all");
    if (article) {
      context.ui().selectArticle(article.id);
    }
  },
}
```

- [ ] **Step 4: open-tag-view を実装する**

この段階では provider から tag を取らず、検証用の固定 tag id でよい。  
`selectedAccountId` がない場合は、最初の account を選んでから tag view を開く。

```ts
{
  id: "open-tag-view",
  title: "Open tag view",
  keywords: ["tag", "navigation", "filter"],
  run: async (context) => {
    const accounts = await context.actions.listAccounts().then(Result.unwrap);
    const account = accounts[0];
    if (!account) {
      context.ui().showToast("Dev scenario could not find any accounts.");
      return;
    }

    context.ui().selectAccount(account.id);
    context.ui().selectTag("tag-dev");
    context.ui().setViewMode("all");
  },
}
```

後続で実データ tag に寄せたくなったら別 task で改善する。  
最初は「tag selection state をすぐ再現できる」ことを優先する。

- [ ] **Step 5: テスト成功を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/dev/scenarios/registry.ts src/dev/scenarios/helpers.ts src/__tests__/dev/scenarios/runner.test.ts
git commit -m "feat: add navigation dev scenarios"
```

---

## Task 5: 操作 smoke scenario を追加する

### Files:

- Modify: `src/dev/scenarios/registry.ts`
- Modify: `src/__tests__/dev/scenarios/runner.test.ts`

- [ ] **Step 1: failing test を追加する**

`src/__tests__/dev/scenarios/runner.test.ts` に追加:

```ts
it("runs the add-feed dialog scenario through AppAction", async () => {
  await runDevScenario("open-add-feed-dialog", context);
  expect(executeAction).toHaveBeenCalledWith("open-add-feed");
});

it("runs the sync smoke scenario through AppAction", async () => {
  await runDevScenario("sync-all-smoke", context);
  expect(executeAction).toHaveBeenCalledWith("sync-all");
});
```

- [ ] **Step 2: テスト失敗を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts
```

Expected: FAIL because the scenarios still use no-op stubs

- [ ] **Step 3: scenario 実装を追加する**

`src/dev/scenarios/registry.ts` を更新:

```ts
{
  id: "open-add-feed-dialog",
  title: "Open add feed dialog",
  keywords: ["feed", "add", "dialog"],
  run: ({ actions }) => {
    actions.executeAction("open-add-feed");
  },
},
{
  id: "sync-all-smoke",
  title: "Sync all smoke",
  keywords: ["sync", "reload", "smoke"],
  run: ({ actions }) => {
    actions.executeAction("sync-all");
  },
},
```

`reload-webview-smoke` は今回は追加しない。  
Spec の out-of-scope ではないが、最初の PR 群では 4 本に絞る。

- [ ] **Step 4: テスト成功を確認する**

Run:

```bash
pnpm vitest run src/__tests__/dev/scenarios/runner.test.ts
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/dev/scenarios/registry.ts src/__tests__/dev/scenarios/runner.test.ts
git commit -m "feat: add action-based dev smoke scenarios"
```

---

## Task 6: 全体確認と回帰チェックを行う

### Files:

- Verify: `src/dev/scenarios/*.ts`
- Verify: `src/lib/dev-intent.ts`
- Verify: `src/hooks/use-dev-intent.ts`
- Verify: `src/components/reader/command-palette.tsx`
- Verify: `src/__tests__/dev/scenarios/*.test.ts`
- Verify: `src/__tests__/hooks/use-dev-intent.test.tsx`
- Verify: `src/__tests__/components/command-palette.test.tsx`

- [ ] **Step 1: scenario 関連テストを通す**

```bash
pnpm vitest run src/__tests__/dev/scenarios/registry.test.ts src/__tests__/dev/scenarios/runner.test.ts src/__tests__/hooks/use-dev-intent.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/lib/dev-intent.test.ts
```

Expected: PASS

- [ ] **Step 2: 型チェックを通す**

```bash
pnpm tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: lint / test を通す**

```bash
mise run check
```

Expected: PASS

- [ ] **Step 4: browser dev で手動確認する**

```bash
mise run app:dev:browser
```

確認項目:

- `VITE_DEV_INTENT=image-viewer-overlay` で起動時 scenario が 1 回だけ走る
- `Cmd+K` / `Ctrl+K` で palette が開く
- `Dev Scenarios` が dev build でだけ表示される
- `Image viewer overlay` / `Open add feed dialog` / `Sync all smoke` を実行できる

- [ ] **Step 5: 必要なら最終コミットする**

```bash
git add -A
git commit -m "chore: polish dev scenarios command palette integration"
```

必要な差分がなければこの step はスキップする。
