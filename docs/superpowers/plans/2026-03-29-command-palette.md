# Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ⌘K でアクション・フィード・記事を統合検索できるコマンドパレットを追加する。

**Architecture:** cmdk ライブラリを Base UI Dialog でラップした Command コンポーネントを新設。プレフィックス（`>` `@` `#`）によるフィルタ切替と、最近のアクション履歴（localStorage）を持つ。記事検索は既存の FTS5+LIKE ハイブリッドをそのまま利用。

**Tech Stack:** cmdk, @base-ui/react, Zustand, React Query, react-i18next, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-29-command-palette-design.md`

---

## File Map

### New Files

| File                                                | Responsibility                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/components/ui/command.tsx`                     | cmdk の headless primitives を Tailwind でラップした UI コンポーネント群 |
| `src/hooks/use-command-history.ts`                  | localStorage で最近のアクション履歴を管理                                |
| `src/hooks/use-command-search.ts`                   | プレフィックス解析 + 各ソースへの検索ディスパッチ                        |
| `src/components/reader/command-palette.tsx`         | パレット本体。グループ別結果表示 + 選択実行                              |
| `src/__tests__/hooks/use-command-history.test.ts`   | 履歴フックのテスト                                                       |
| `src/__tests__/hooks/use-command-search.test.ts`    | 検索フックのテスト                                                       |
| `src/__tests__/components/command-palette.test.tsx` | パレットコンポーネントのテスト                                           |

### Modified Files

| File                            | Change                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `package.json`                  | `cmdk` 依存追加                                                                         |
| `src/stores/ui-store.ts`        | `commandPaletteOpen` 状態 + `openCommandPalette` / `closeCommandPalette` アクション追加 |
| `src/lib/actions.ts`            | `open-command-palette` を `AppAction` union に追加 + `executeAction` に case 追加       |
| `src/lib/keyboard-shortcuts.ts` | `open_command_palette` ショートカット定義追加                                           |
| `src/hooks/use-keyboard.ts`     | `open-command-palette` case 追加                                                        |
| `src/components/app-shell.tsx`  | `<CommandPalette />` を配置                                                             |
| `src/locales/ja/reader.json`    | コマンドパレット用 i18n 文字列追加                                                      |
| `src/locales/en/reader.json`    | コマンドパレット用 i18n 文字列追加                                                      |

---

## Task 1: cmdk 依存のインストール

**Files:**

- Modify: `package.json`

- [ ] **Step 1: cmdk をインストール**

```bash
pnpm add cmdk
```

- [ ] **Step 2: インストール確認**

```bash
pnpm list cmdk
```

Expected: `cmdk` のバージョンが表示される

- [ ] **Step 3: コミット**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add cmdk dependency for command palette"
```

---

## Task 2: UI Store に commandPaletteOpen 状態を追加

**Files:**

- Modify: `src/stores/ui-store.ts`
- Test: `src/__tests__/stores/ui-store.test.ts`

- [ ] **Step 1: テストを書く**

`src/__tests__/stores/ui-store.test.ts` の末尾（最後の `});` の前）に追加:

```typescript
it("commandPaletteOpen defaults to false", () => {
  expect(useUiStore.getState().commandPaletteOpen).toBe(false);
});

it("openCommandPalette sets open to true", () => {
  useUiStore.getState().openCommandPalette();
  expect(useUiStore.getState().commandPaletteOpen).toBe(true);
});

it("closeCommandPalette sets open to false", () => {
  useUiStore.getState().openCommandPalette();
  useUiStore.getState().closeCommandPalette();
  expect(useUiStore.getState().commandPaletteOpen).toBe(false);
});

it("toggleCommandPalette toggles state", () => {
  useUiStore.getState().toggleCommandPalette();
  expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  useUiStore.getState().toggleCommandPalette();
  expect(useUiStore.getState().commandPaletteOpen).toBe(false);
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm vitest run src/__tests__/stores/ui-store.test.ts
```

Expected: FAIL — `commandPaletteOpen` が存在しない

- [ ] **Step 3: ui-store に状態とアクションを追加**

`src/stores/ui-store.ts` の `UiState` interface に追加:

```typescript
commandPaletteOpen: boolean;
```

`UiActions` interface に追加:

```typescript
openCommandPalette: () => void;
closeCommandPalette: () => void;
toggleCommandPalette: () => void;
```

`initialState` に追加:

```typescript
commandPaletteOpen: false,
```

`create<UiState & UiActions>()` の中に追加:

```typescript
openCommandPalette: () => set({ commandPaletteOpen: true }),
closeCommandPalette: () => set({ commandPaletteOpen: false }),
toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
```

- [ ] **Step 4: テスト成功を確認**

```bash
pnpm vitest run src/__tests__/stores/ui-store.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/stores/ui-store.ts src/__tests__/stores/ui-store.test.ts
git commit -m "feat: add commandPaletteOpen state to ui-store"
```

---

## Task 3: AppAction に open-command-palette を追加

**Files:**

- Modify: `src/lib/actions.ts`
- Test: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: テストを書く**

`src/__tests__/lib/actions.test.ts` に追加:

```typescript
it("open-command-palette toggles commandPaletteOpen", () => {
  expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  executeAction("open-command-palette");
  expect(useUiStore.getState().commandPaletteOpen).toBe(true);
});

it("isAppAction recognizes open-command-palette", () => {
  expect(isAppAction("open-command-palette")).toBe(true);
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm vitest run src/__tests__/lib/actions.test.ts
```

Expected: FAIL — 型エラーまたはアサーション失敗

- [ ] **Step 3: actions.ts に追加**

`AppAction` 型に追加:

```typescript
| "open-command-palette"
```

`appActions` Set に追加:

```typescript
"open-command-palette",
```

`executeAction` の switch に追加（`default` case の前）:

```typescript
case "open-command-palette":
  store.toggleCommandPalette();
  break;
```

- [ ] **Step 4: テスト成功を確認**

```bash
pnpm vitest run src/__tests__/lib/actions.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/actions.ts src/__tests__/lib/actions.test.ts
git commit -m "feat: add open-command-palette action"
```

---

## Task 4: ⌘K キーボードショートカットを追加

**Files:**

- Modify: `src/lib/keyboard-shortcuts.ts`
- Modify: `src/hooks/use-keyboard.ts`
- Test: `src/__tests__/hooks/use-keyboard.test.tsx`

- [ ] **Step 1: keyboard-shortcuts.ts にショートカット定義を追加**

`ShortcutActionId` 型に追加:

```typescript
| "open_command_palette"
```

`ShortcutLabelKey` 型に追加:

```typescript
| "shortcuts.open_command_palette"
```

`shortcutDefinitions` 配列に追加:

```typescript
{
  id: "open_command_palette",
  labelKey: "shortcuts.open_command_palette",
  categoryKey: "shortcuts.category_global",
  defaultKey: "\u2318+k",
},
```

`KeyboardAction` 型に追加:

```typescript
| { type: "open-command-palette" }
```

`resolveActionForId` の switch に追加:

```typescript
case "open_command_palette":
  return Result.succeed({ type: "open-command-palette" });
```

- [ ] **Step 2: use-keyboard.ts に case を追加**

`useKeyboard` の switch に追加（`case "open-settings":` の後）:

```typescript
case "open-command-palette":
  executeAction("open-command-palette");
  break;
```

- [ ] **Step 3: テストを書く**

`src/__tests__/hooks/use-keyboard.test.tsx` に追加（既存のテストパターンに従う）:

```typescript
it("resolves ⌘K to open-command-palette", () => {
  const result = resolveKeyboardAction({
    key: "k",
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    targetTag: "DIV",
    selectedArticleId: null,
    contentMode: "empty",
    viewMode: "all",
  });
  expect(Result.isSuccess(result)).toBe(true);
  expect(Result.unwrap(result)).toEqual({ type: "open-command-palette" });
});
```

- [ ] **Step 4: テスト成功を確認**

```bash
pnpm vitest run src/__tests__/hooks/use-keyboard.test.tsx
```

Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/keyboard-shortcuts.ts src/hooks/use-keyboard.ts src/__tests__/hooks/use-keyboard.test.tsx
git commit -m "feat: add Cmd+K shortcut for command palette"
```

---

## Task 5: Command UI コンポーネントを作成

**Files:**

- Create: `src/components/ui/command.tsx`
- Reference: `mock/components/ui/command.tsx` (移植元), `src/components/ui/dialog.tsx` (Base UI パターン)

- [ ] **Step 1: mock/components/ui/command.tsx を src/components/ui/command.tsx にコピー**

```bash
cp mock/components/ui/command.tsx src/components/ui/command.tsx
```

- [ ] **Step 2: Radix Dialog → Base UI Dialog に書き換え**

`src/components/ui/command.tsx` を編集。主な変更点:

1. `'use client'` を削除
2. Dialog import を Base UI 版に差し替え:

   ```typescript
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogHeader,
     DialogTitle,
   } from "@/components/ui/dialog";
   ```

3. `CommandDialog` のプロップ型を Base UI Dialog のプロップ型に合わせる:
   - `React.ComponentProps<typeof Dialog>` を使用
   - `open` と `onOpenChange` は `Dialog` コンポーネントの props で制御
4. `DialogContent` に `showCloseButton={false}` を渡す
5. シングルクォートをダブルクォートに統一（Biome 準拠）
6. `CommandDialog` で `DialogHeader` を `sr-only` で残す（アクセシビリティ）

- [ ] **Step 3: 型チェック**

```bash
pnpm tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/ui/command.tsx
git commit -m "feat: add Command UI component (cmdk + Base UI Dialog)"
```

---

## Task 6: useCommandHistory フックを作成

**Files:**

- Create: `src/hooks/use-command-history.ts`
- Create: `src/__tests__/hooks/use-command-history.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/__tests__/hooks/use-command-history.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addToHistory,
  clearHistory,
  getHistory,
  HISTORY_KEY,
  MAX_HISTORY,
} from "@/hooks/use-command-history";

describe("useCommandHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no history", () => {
    expect(getHistory()).toEqual([]);
  });

  it("adds an item to history", () => {
    addToHistory("sync-all");
    expect(getHistory()).toEqual(["sync-all"]);
  });

  it("moves duplicate to front", () => {
    addToHistory("sync-all");
    addToHistory("open-settings");
    addToHistory("sync-all");
    expect(getHistory()[0]).toBe("sync-all");
    expect(getHistory()).toHaveLength(2);
  });

  it("limits to MAX_HISTORY items", () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      addToHistory(`action-${i}`);
    }
    expect(getHistory()).toHaveLength(MAX_HISTORY);
  });

  it("clearHistory empties the list", () => {
    addToHistory("sync-all");
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm vitest run src/__tests__/hooks/use-command-history.test.ts
```

Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: use-command-history.ts を実装**

```typescript
// src/hooks/use-command-history.ts
export const HISTORY_KEY = "ultra-rss:command-history";
export const MAX_HISTORY = 10;

export function getHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(id: string): void {
  const history = getHistory().filter((item) => item !== id);
  history.unshift(id);
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY)),
  );
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
```

- [ ] **Step 4: テスト成功を確認**

```bash
pnpm vitest run src/__tests__/hooks/use-command-history.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/use-command-history.ts src/__tests__/hooks/use-command-history.test.ts
git commit -m "feat: add useCommandHistory hook for recent actions"
```

---

## Task 7: useCommandSearch フックを作成

**Files:**

- Create: `src/hooks/use-command-search.ts`
- Create: `src/__tests__/hooks/use-command-search.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/__tests__/hooks/use-command-search.test.ts
import { describe, expect, it } from "vitest";
import { parsePrefix, type SearchPrefix } from "@/hooks/use-command-search";

describe("parsePrefix", () => {
  it("returns null prefix for plain text", () => {
    expect(parsePrefix("hello")).toEqual({ prefix: null, query: "hello" });
  });

  it("detects > prefix for actions", () => {
    expect(parsePrefix("> sync")).toEqual({ prefix: ">", query: "sync" });
  });

  it("detects @ prefix for feeds", () => {
    expect(parsePrefix("@tech")).toEqual({ prefix: "@", query: "tech" });
  });

  it("detects # prefix for tags", () => {
    expect(parsePrefix("#news")).toEqual({ prefix: "#", query: "news" });
  });

  it("trims whitespace after prefix", () => {
    expect(parsePrefix(">  sync")).toEqual({ prefix: ">", query: "sync" });
  });

  it("handles prefix with no query", () => {
    expect(parsePrefix(">")).toEqual({ prefix: ">", query: "" });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm vitest run src/__tests__/hooks/use-command-search.test.ts
```

Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: use-command-search.ts を実装**

```typescript
// src/hooks/use-command-search.ts
import { useDeferredValue, useMemo } from "react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";

export type SearchPrefix = ">" | "@" | "#" | null;

export type ParsedInput = {
  prefix: SearchPrefix;
  query: string;
};

export function parsePrefix(input: string): ParsedInput {
  const trimmed = input.trimStart();
  if (trimmed.startsWith(">"))
    return { prefix: ">", query: trimmed.slice(1).trimStart() };
  if (trimmed.startsWith("@"))
    return { prefix: "@", query: trimmed.slice(1).trimStart() };
  if (trimmed.startsWith("#"))
    return { prefix: "#", query: trimmed.slice(1).trimStart() };
  return { prefix: null, query: trimmed };
}

export type ActionItem = {
  type: "action";
  id: AppAction;
  label: string;
  shortcut?: string;
};

export type FeedItem = {
  type: "feed";
  feed: FeedDto;
};

export type ArticleItem = {
  type: "article";
  article: ArticleDto;
};

export type TagItem = {
  type: "tag";
  tag: TagDto;
};

export type CommandItem = ActionItem | FeedItem | ArticleItem | TagItem;

export type SearchResults = {
  prefix: SearchPrefix;
  actions: ActionItem[];
  feeds: FeedItem[];
  articles: ArticleItem[];
  tags: TagItem[];
};

export function useCommandSearch(
  input: string,
  actionItems: ActionItem[],
  feeds: FeedDto[],
  tags: TagDto[],
): { prefix: SearchPrefix; deferredQuery: string } {
  const { prefix, query } = parsePrefix(input);
  const deferredQuery = useDeferredValue(query);
  return { prefix, deferredQuery };
}

/** Filter actions by query (case-insensitive label match). cmdk handles this natively, so this is for external use. */
export function filterActions(
  actions: ActionItem[],
  query: string,
): ActionItem[] {
  if (!query) return actions;
  const lower = query.toLowerCase();
  return actions.filter((a) => a.label.toLowerCase().includes(lower));
}
```

- [ ] **Step 4: テスト成功を確認**

```bash
pnpm vitest run src/__tests__/hooks/use-command-search.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/use-command-search.ts src/__tests__/hooks/use-command-search.test.ts
git commit -m "feat: add useCommandSearch hook with prefix parsing"
```

---

## Task 8: i18n 文字列を追加

**Files:**

- Modify: `src/locales/ja/reader.json`
- Modify: `src/locales/en/reader.json`

- [ ] **Step 1: ja/reader.json に追加**

`shortcuts` オブジェクトに追加:

```json
"open_command_palette": "コマンドパレットを開く"
```

トップレベルに追加:

```json
"command_palette": {
  "placeholder": "コマンドを検索...",
  "no_results": "結果が見つかりません",
  "recent_actions": "最近のアクション",
  "actions": "アクション",
  "feeds": "フィード",
  "articles": "記事",
  "tags": "タグ",
  "online_results": "オンライン結果",
  "prefix_hint_actions": "アクション",
  "prefix_hint_feeds": "フィード",
  "prefix_hint_tags": "タグ"
}
```

- [ ] **Step 2: en/reader.json に追加**

`shortcuts` オブジェクトに追加:

```json
"open_command_palette": "Open command palette"
```

トップレベルに追加:

```json
"command_palette": {
  "placeholder": "Search commands...",
  "no_results": "No results found",
  "recent_actions": "Recent Actions",
  "actions": "Actions",
  "feeds": "Feeds",
  "articles": "Articles",
  "tags": "Tags",
  "online_results": "Online Results",
  "prefix_hint_actions": "Actions",
  "prefix_hint_feeds": "Feeds",
  "prefix_hint_tags": "Tags"
}
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja/reader.json src/locales/en/reader.json
git commit -m "feat: add command palette i18n strings"
```

---

## Task 9: CommandPalette コンポーネントを作成

**Files:**

- Create: `src/components/reader/command-palette.tsx`
- Reference: `src/components/ui/command.tsx` (UI primitives), `src/lib/actions.ts` (action list), `src/hooks/use-command-search.ts`, `src/hooks/use-command-history.ts`

- [ ] **Step 1: command-palette.tsx を実装**

```typescript
// src/components/reader/command-palette.tsx
import { useDeferredValue, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useSearchArticles } from "@/hooks/use-articles";
import { addToHistory, getHistory } from "@/hooks/use-command-history";
import { type ActionItem, type SearchPrefix, parsePrefix } from "@/hooks/use-command-search";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import { type AppAction, executeAction, isAppAction } from "@/lib/actions";
import { formatKeyForDisplay, shortcutDefinitions, shortcutPrefKey } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

/** Build the static list of action items with i18n labels and shortcut display strings. */
function useActionItems(): ActionItem[] {
  const { t } = useTranslation("reader");
  const prefs = usePreferencesStore((s) => s.prefs);

  return useMemo(() => {
    // Map action IDs to their shortcut display strings
    const shortcutMap = new Map<string, string>();
    for (const def of shortcutDefinitions) {
      const key = prefs[shortcutPrefKey(def.id)] ?? def.defaultKey;
      // Map shortcut action IDs to AppAction IDs
      const actionId = shortcutActionToAppAction(def.id);
      if (actionId) shortcutMap.set(actionId, formatKeyForDisplay(key));
    }

    const actionDefs: { id: AppAction; labelKey: string }[] = [
      { id: "sync-all", labelKey: "shortcuts.toggle_read" },
      { id: "set-filter-all", labelKey: "filter_all" },
      { id: "set-filter-unread", labelKey: "filter_unread" },
      { id: "set-filter-starred", labelKey: "filter_starred" },
      { id: "toggle-star", labelKey: "toggle_star" },
      { id: "toggle-read", labelKey: "toggle_read" },
      { id: "mark-all-read", labelKey: "mark_all_as_read" },
      { id: "open-settings", labelKey: "shortcuts.open_settings" },
      { id: "open-add-feed", labelKey: "add_feed" },
      { id: "open-in-browser", labelKey: "view_in_browser" },
      { id: "open-in-default-browser", labelKey: "open_in_external_browser" },
      { id: "copy-link", labelKey: "copy_link" },
      { id: "toggle-fullscreen", labelKey: "shortcuts.reload_webview" },
      { id: "check-for-updates", labelKey: "shortcuts.open_settings" },
    ];

    return actionDefs.map((def) => ({
      type: "action" as const,
      id: def.id,
      label: t(def.labelKey),
      shortcut: shortcutMap.get(def.id),
    }));
  }, [t, prefs]);
}

function shortcutActionToAppAction(id: string): AppAction | null {
  const map: Record<string, AppAction> = {
    toggle_read: "toggle-read",
    toggle_star: "toggle-star",
    open_in_app_browser: "open-in-reader",
    open_external_browser: "open-in-browser",
    mark_all_read: "mark-all-read",
    open_settings: "open-settings",
    reload_webview: "reload-webview",
  };
  return map[id] ?? null;
}

export function CommandPalette() {
  const { t } = useTranslation("reader");
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const selectTag = useUiStore((s) => s.selectTag);

  const actionItems = useActionItems();
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: tags } = useTags();

  // Track input for prefix detection
  const [inputValue, setInputValue] = useState("");
  const { prefix, query } = parsePrefix(inputValue);
  const deferredQuery = useDeferredValue(query);

  // Article search (only when no prefix or prefix allows articles)
  const searchEnabled = prefix === null && deferredQuery.length >= 2;
  const { data: searchResults } = useSearchArticles(
    searchEnabled ? selectedAccountId : null,
    searchEnabled ? deferredQuery : "",
  );

  // Recent history for initial display
  const recentIds = useMemo(() => getHistory(), [open]);
  const recentActions = useMemo(
    () => recentIds.filter(isAppAction).map((id) => actionItems.find((a) => a.id === id)).filter(Boolean),
    [recentIds, actionItems],
  );

  const handleSelect = useCallback(
    (value: string) => {
      close();

      // Action
      if (isAppAction(value)) {
        addToHistory(value);
        executeAction(value);
        return;
      }

      // Feed (prefixed with "feed:")
      if (value.startsWith("feed:")) {
        const feedId = value.slice(5);
        addToHistory(value);
        selectFeed(feedId);
        return;
      }

      // Article (prefixed with "article:")
      if (value.startsWith("article:")) {
        const articleId = value.slice(8);
        addToHistory(value);
        selectArticle(articleId);
        return;
      }

      // Tag (prefixed with "tag:")
      if (value.startsWith("tag:")) {
        const tagId = value.slice(4);
        addToHistory(value);
        selectTag(tagId);
        return;
      }
    },
    [close, selectFeed, selectArticle, selectTag],
  );

  const showActions = prefix === null || prefix === ">";
  const showFeeds = prefix === null || prefix === "@";
  const showTags = prefix === null || prefix === "#";
  const showArticles = prefix === null;
  const showRecent = !inputValue && prefix === null;

  return (
    <CommandDialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <CommandInput
        placeholder={t("command_palette.placeholder")}
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>{t("command_palette.no_results")}</CommandEmpty>

        {/* Recent actions (initial state) */}
        {showRecent && recentActions.length > 0 && (
          <CommandGroup heading={t("command_palette.recent_actions")}>
            {recentActions.map((item) =>
              item ? (
                <CommandItem key={`recent-${item.id}`} value={item.id} onSelect={handleSelect}>
                  <span>{item.label}</span>
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ) : null,
            )}
          </CommandGroup>
        )}

        {/* Actions */}
        {showActions && (
          <CommandGroup heading={t("command_palette.actions")}>
            {actionItems.map((item) => (
              <CommandItem key={item.id} value={item.id} onSelect={handleSelect}>
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Feeds */}
        {showFeeds && feeds && feeds.length > 0 && (
          <CommandGroup heading={t("command_palette.feeds")}>
            {feeds.map((feed) => (
              <CommandItem key={feed.id} value={`feed:${feed.id}`} keywords={[feed.title, feed.url]} onSelect={handleSelect}>
                <span>{feed.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Tags */}
        {showTags && tags && tags.length > 0 && (
          <CommandGroup heading={t("command_palette.tags")}>
            {tags.map((tag) => (
              <CommandItem key={tag.id} value={`tag:${tag.id}`} keywords={[tag.name]} onSelect={handleSelect}>
                <span>{tag.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Articles (local search results) */}
        {showArticles && searchResults && searchResults.length > 0 && (
          <CommandGroup heading={t("command_palette.articles")}>
            {searchResults.slice(0, 10).map((article) => (
              <CommandItem key={article.id} value={`article:${article.id}`} keywords={[article.title]} onSelect={handleSelect}>
                <span className="truncate">{article.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer hints */}
      <div className="flex gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          <kbd className="rounded bg-muted px-1">&gt;</kbd> {t("command_palette.prefix_hint_actions")}
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">@</kbd> {t("command_palette.prefix_hint_feeds")}
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">#</kbd> {t("command_palette.prefix_hint_tags")}
        </span>
      </div>
    </CommandDialog>
  );
}
```

**注意:** `useState` を React からインポートすること。import 行の冒頭を確認:

```typescript
import { useCallback, useDeferredValue, useMemo, useState } from "react";
```

- [ ] **Step 2: 型チェック**

```bash
pnpm tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/reader/command-palette.tsx
git commit -m "feat: add CommandPalette component with grouped search"
```

---

## Task 10: AppShell にパレットを配置

**Files:**

- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: app-shell.tsx にインポートと配置を追加**

import 追加:

```typescript
import { CommandPalette } from "./reader/command-palette";
```

`AppShell` の return JSX、`<Toast />` の後に追加:

```tsx
<CommandPalette />
```

- [ ] **Step 2: 型チェック**

```bash
pnpm tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/app-shell.tsx
git commit -m "feat: mount CommandPalette in AppShell"
```

---

## Task 11: 品質チェック + 動作確認

**Files:** すべて

- [ ] **Step 1: フォーマット**

```bash
mise run format
```

- [ ] **Step 2: リント**

```bash
mise run lint
```

Expected: エラーなし

- [ ] **Step 3: テスト**

```bash
mise run test
```

Expected: 全テスト成功

- [ ] **Step 4: ビルド**

```bash
mise run ci
```

Expected: 全パス

- [ ] **Step 5: 最終コミット（必要な場合のみ）**

フォーマット/リント修正があればコミット:

```bash
git add -A
git commit -m "chore: format and lint fixes for command palette"
```
