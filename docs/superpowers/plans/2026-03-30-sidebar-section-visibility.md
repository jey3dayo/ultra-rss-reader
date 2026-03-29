# Sidebar Section Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings > General から `Unread` / `Starred` / `Tags` のサイドバー表示を個別に切り替えられるようにし、非表示化で現在選択中の項目が無効になった場合は安全に fallback させる

**Architecture:** preference 追加と Settings UI は既存の `preferences-store` + `GeneralSettings` パターンに沿って実装する。永続化のため `src-tauri` 側の preference allowlist も同時更新する。実際の表示制御と fallback は `sidebar.tsx` に閉じ込めるが、active state 判定は `selection` だけでなく `viewMode` も見る。`ui-store` の selection 型は増やさず既存 action と `setViewMode("all")` を使って遷移する。テストは store / settings component / sidebar component の既存層に分けて追加する。

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, react-i18next, Vitest, Testing Library

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `src/stores/preferences-store.ts` | `show_sidebar_unread` / `show_sidebar_starred` / `show_sidebar_tags` の schema・default・normalize を追加 |
| Modify | `src-tauri/src/commands/preference_commands.rs` | 新 preference key を `ALLOWED_KEYS` に追加して永続化を通す |
| Modify | `src/__tests__/stores/preferences-store.test.ts` | 新 preference の既定値と不正値 fallback を検証 |
| Modify | `src/components/settings/general-settings.tsx` | General settings に sidebar section visibility スイッチを追加 |
| Modify | `src/locales/en/settings.json` | Settings > General の英語ラベルを追加 |
| Modify | `src/locales/ja/settings.json` | Settings > General の日本語ラベルを追加 |
| Create | `src/__tests__/components/general-settings.test.tsx` | 新しい sidebar visibility スイッチの描画と store 更新を検証 |
| Modify | `src/components/reader/sidebar.tsx` | smart view / tags の表示フィルタと selection fallback を実装 |
| Modify | `src/__tests__/components/sidebar.test.tsx` | sidebar visibility と fallback behavior を検証 |

---

## Task 1: Sidebar visibility preference を store と backend allowlist に追加する

### Files

- Modify: `src/stores/preferences-store.ts`
- Modify: `src-tauri/src/commands/preference_commands.rs`
- Modify: `src/__tests__/stores/preferences-store.test.ts`

- [ ] **Step 1: preference store の失敗テストを追加する**

`src/__tests__/stores/preferences-store.test.ts` に追加:

```ts
it("defaults sidebar section visibility preferences to true", () => {
  expect(resolvePreferenceValue({}, "show_sidebar_unread")).toBe("true");
  expect(resolvePreferenceValue({}, "show_sidebar_starred")).toBe("true");
  expect(resolvePreferenceValue({}, "show_sidebar_tags")).toBe("true");
});

it("normalizes invalid sidebar visibility preferences back to true", () => {
  expect(resolvePreferenceValue({ show_sidebar_unread: "maybe" }, "show_sidebar_unread")).toBe("true");
  expect(resolvePreferenceValue({ show_sidebar_starred: "nope" }, "show_sidebar_starred")).toBe("true");
  expect(resolvePreferenceValue({ show_sidebar_tags: "unset" }, "show_sidebar_tags")).toBe("true");
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm vitest run src/__tests__/stores/preferences-store.test.ts`

Expected: FAIL with `Expected: "true"` / `Received: ""` for the new preference keys

- [ ] **Step 3: preference schema / default と backend allowlist を追加する**

`src/stores/preferences-store.ts` に追加:

```ts
const preferenceSchemas = {
  // ...
  show_sidebar_unread: booleanStringSchema,
  show_sidebar_starred: booleanStringSchema,
  show_sidebar_tags: booleanStringSchema,
} as const;

const corePreferenceDefaults = {
  // ...
  show_sidebar_unread: "true",
  show_sidebar_starred: "true",
  show_sidebar_tags: "true",
} satisfies { [K in KnownPreferenceKey]: z.input<(typeof preferenceSchemas)[K]> };
```

ポイント:

- 既存の `show_unread_count` / `show_starred_count` と同じ boolean string preference として扱う
- `normalizePreferenceValue()` と `resolvePreferenceValue()` の既存 fallback 経路に自然に乗せる
- store action は増やさず、既存の `setPref()` をそのまま使う

`src-tauri/src/commands/preference_commands.rs` の `ALLOWED_KEYS` にも追加:

```rs
"show_sidebar_unread",
"show_sidebar_starred",
"show_sidebar_tags",
```

ポイント:

- frontend store だけ更新すると `set_preference` が `Unknown preference key` を返して保存に失敗する
- 新 preference key は TypeScript 側と Rust 側で同じタイミングで追加する

- [ ] **Step 4: preference store テストを再実行する**

Run: `pnpm vitest run src/__tests__/stores/preferences-store.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/stores/preferences-store.ts src-tauri/src/commands/preference_commands.rs src/__tests__/stores/preferences-store.test.ts
git commit -m "feat: add sidebar visibility preferences"
```

---

## Task 2: Settings > General に sidebar visibility スイッチを追加する

### Files

- Modify: `src/components/settings/general-settings.tsx`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`
- Create: `src/__tests__/components/general-settings.test.tsx`

- [ ] **Step 1: General settings の失敗テストを追加する**

`src/__tests__/components/general-settings.test.tsx` を作成:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GeneralSettings } from "@/components/settings/general-settings";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("GeneralSettings", () => {
  beforeEach(() => {
    setupTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("renders sidebar section switches and updates preferences", async () => {
    const user = userEvent.setup();

    render(<GeneralSettings />, { wrapper: createWrapper() });

    const unread = screen.getByRole("switch", { name: "Show Unread" });
    const starred = screen.getByRole("switch", { name: "Show Starred" });
    const tags = screen.getByRole("switch", { name: "Show Tags" });

    expect(unread).toBeChecked();
    expect(starred).toBeChecked();
    expect(tags).toBeChecked();

    await user.click(unread);
    await user.click(tags);

    expect(usePreferencesStore.getState().prefs.show_sidebar_unread).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_tags).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_starred).toBeUndefined();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/general-settings.test.tsx`

Expected: FAIL with missing `Show Unread` / `Show Starred` / `Show Tags` switches

- [ ] **Step 3: translation key と settings controls を追加する**

`src/locales/en/settings.json` の `general` に追加:

```json
"sidebar": "Sidebar",
"show_unread": "Show Unread",
"show_starred": "Show Starred",
"show_tags": "Show Tags"
```

`src/locales/ja/settings.json` の `general` に追加:

```json
"sidebar": "サイドバー",
"show_unread": "Unread を表示",
"show_starred": "Starred を表示",
"show_tags": "Tags を表示"
```

`src/components/settings/general-settings.tsx` に section を追加:

```tsx
{
  id: "sidebar",
  heading: t("general.sidebar"),
  controls: [
    {
      id: "show-sidebar-unread",
      type: "switch",
      label: t("general.show_unread"),
      checked: resolvePreferenceValue(prefs, "show_sidebar_unread") === "true",
      onChange: (checked) => setPref("show_sidebar_unread", String(checked)),
    },
    {
      id: "show-sidebar-starred",
      type: "switch",
      label: t("general.show_starred"),
      checked: resolvePreferenceValue(prefs, "show_sidebar_starred") === "true",
      onChange: (checked) => setPref("show_sidebar_starred", String(checked)),
    },
    {
      id: "show-sidebar-tags",
      type: "switch",
      label: t("general.show_tags"),
      checked: resolvePreferenceValue(prefs, "show_sidebar_tags") === "true",
      onChange: (checked) => setPref("show_sidebar_tags", String(checked)),
    },
  ],
}
```

ポイント:

- `GeneralSettingsView` の既存 `sections` 構造をそのまま使う
- `show_unread_count` / `show_starred_count` とは別概念なので混同しない
- switch toggle は mock IPC の `set_preference` 経路まで通す

- [ ] **Step 4: General settings テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/general-settings.test.tsx`

Expected: PASS

- [ ] **Step 5: 関連 settings テストを再確認する**

Run: `pnpm vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/settings-surface-views.test.tsx`

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/settings/general-settings.tsx src/locales/en/settings.json src/locales/ja/settings.json src/__tests__/components/general-settings.test.tsx
git commit -m "feat: add sidebar visibility settings"
```

---

## Task 3: Sidebar の表示制御と fallback behavior を実装する

### Files

- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: sidebar の失敗テストを追加する**

`src/__tests__/components/sidebar.test.tsx` に追加:

```tsx
import { usePreferencesStore } from "@/stores/preferences-store";

it("hides configurable sections while keeping accounts and feeds visible", async () => {
  usePreferencesStore.setState({
    prefs: {
      show_sidebar_unread: "false",
      show_sidebar_starred: "false",
      show_sidebar_tags: "false",
    },
    loaded: true,
  });

  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      case "list_account_articles":
        return [];
      case "list_tags":
        return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
      case "get_tag_article_counts":
        return { "tag-1": 2 };
      default:
        return null;
    }
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: /Local/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Feeds" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Unread/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Starred/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
});

it("falls back away from hidden sidebar states, including viewMode-only flows", async () => {
  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      case "list_account_articles":
        return [];
      case "list_tags":
        return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
      case "get_tag_article_counts":
        return { "tag-1": 2 };
      default:
        return null;
    }
  });

  useUiStore.setState({
    ...useUiStore.getState(),
    selectedAccountId: "acc-1",
    selection: { type: "feed", feedId: "feed-1" },
    viewMode: "starred",
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  usePreferencesStore.getState().setPref("show_sidebar_starred", "false");

  await waitFor(() => {
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    expect(useUiStore.getState().viewMode).toBe("all");
  });

  useUiStore.getState().selectSmartView("unread");
  usePreferencesStore.getState().setPref("show_sidebar_unread", "false");

  await waitFor(() => {
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
  });

  usePreferencesStore.getState().setPref("show_sidebar_unread", "true");

  expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: FAIL because `Unread` / `Starred` / `Tags` are still rendered and hidden state does not fallback

- [ ] **Step 3: sidebar.tsx に visibility flag と fallback effect を実装する**

`src/components/reader/sidebar.tsx` に追加:

```tsx
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

const showSidebarUnread = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "show_sidebar_unread") === "true");
const showSidebarStarred = usePreferencesStore(
  (s) => resolvePreferenceValue(s.prefs, "show_sidebar_starred") === "true",
);
const showSidebarTags = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "show_sidebar_tags") === "true");
const selectAll = useUiStore((s) => s.selectAll);
const viewMode = useUiStore((s) => s.viewMode);
const setViewMode = useUiStore((s) => s.setViewMode);
```

smart view filter:

```tsx
const visibleSmartViews = smartViews.filter((view) => {
  if (view.kind === "unread") return showSidebarUnread;
  if (view.kind === "starred") return showSidebarStarred;
  return true;
});

const tagViews = (tags ?? []).map((tag) => ({
  id: tag.id,
  name: tag.name,
  color: tag.color,
  articleCount: tagArticleCounts?.[tag.id] ?? 0,
  isSelected: selection.type === "tag" && selection.tagId === tag.id,
}));
```

fallback effect:

```tsx
const firstFeedId = orderedFeedIds[0] ?? null;
const hasSmartUnreadSelection = selection.type === "smart" && selection.kind === "unread";
const hasSmartStarredSelection = selection.type === "smart" && selection.kind === "starred";
const hasFilterOnlyUnread = viewMode === "unread" && !hasSmartUnreadSelection;
const hasFilterOnlyStarred = viewMode === "starred" && !hasSmartStarredSelection;

useEffect(() => {
  const fallbackToFeedOrAll = () => {
    if (firstFeedId) {
      selectFeed(firstFeedId);
      return;
    }
    selectAll();
  };

  if (hasFilterOnlyStarred && !showSidebarStarred) {
    setViewMode("all");
    return;
  }

  if (hasSmartStarredSelection && !showSidebarStarred) {
    if (showSidebarUnread) selectSmartView("unread");
    else fallbackToFeedOrAll();
    return;
  }

  if (selection.type === "tag" && !showSidebarTags) {
    if (showSidebarUnread) selectSmartView("unread");
    else fallbackToFeedOrAll();
    return;
  }

  if (hasFilterOnlyUnread && !showSidebarUnread) {
    setViewMode("all");
    return;
  }

  if (hasSmartUnreadSelection && !showSidebarUnread) {
    fallbackToFeedOrAll();
  }
}, [
  firstFeedId,
  hasFilterOnlyStarred,
  hasFilterOnlyUnread,
  hasSmartStarredSelection,
  hasSmartUnreadSelection,
  selectAll,
  selectFeed,
  selectSmartView,
  selection,
  setViewMode,
  showSidebarStarred,
  showSidebarTags,
  showSidebarUnread,
]);
```

render 部分は次のように変更:

```tsx
<SmartViewsView views={visibleSmartViews} onSelectSmartView={selectSmartView} />

{showSidebarTags && (
  <TagListView
    tagsLabel={t("tags")}
    isOpen={isTagsSectionOpen}
    onToggleOpen={() => setIsTagsSectionOpen((v) => !v)}
    tags={tagViews}
    onSelectTag={selectTag}
    renderContextMenu={...}
  />
)}
```

ポイント:

- `selection` と `viewMode` を合わせて active state を判定する
- menu / keyboard / `cycle_filter` の `viewMode` のみ変更する経路も取りこぼさない
- filter だけが hidden になったケースでは `selection` を維持したまま `setViewMode("all")` へ戻す
- `selectAll()` を「feed が一つもない場合の既存 safe default」として使う
- `TagListView` 自体は変更せず、visibility policy を `sidebar.tsx` に閉じ込める

- [ ] **Step 4: sidebar テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: 影響範囲のテストをまとめて実行する**

Run: `pnpm vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/components/general-settings.test.tsx src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/reader/sidebar.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat: hide sidebar sections by preference"
```

---

## Task 4: 最終検証を行う

### Files

- Modify: なし

- [ ] **Step 1: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 2: unit test を実行する**

Run: `pnpm run test -- --reporter=dot`

Expected: PASS

- [ ] **Step 3: フルチェックを実行する**

Run: `mise run check`

Expected: PASS

注記:

- もし `mise run check` が今回の差分と無関係な既存 failure のみで落ちる場合は、失敗ファイルとエラー内容を completion report に明記する
- この task では unrelated docs や unrelated test failure を直すためにスコープを広げない

- [ ] **Step 4: 手動確認を行う**

Run: `mise run app:dev:browser`

確認項目:

- Settings > General で 3 スイッチが即時反映される
- `Unread` OFF で row が消える
- `Starred` OFF で row が消え、表示中なら `Unread` へ戻る
- `Tags` OFF で section が消え、表示中なら `Unread` へ戻る
- `Unread` も OFF の場合は feed か safe default に戻る
- 再度 ON にしても自動で元の row に戻らない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- 変更したファイル一覧
- 実行した検証コマンドと結果
- `mise run check` が失敗した場合は、その failure が今回の差分起因か既存起因か
