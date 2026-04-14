# Sidebar Density Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定画面 `外観 > 一般` に `リスト密度` を追加し、sidebar の行高・縦 gap・トグルサイズを `狭く / 標準 / 広く` で即時切替できるようにする。

**Architecture:** preference は内部 key `sidebar_density` として `preferences-store` に追加し、sidebar 専用の density helper で token 化する。sidebar root / controller で preference を 1 回だけ解決し、`SidebarNavButton` と `feed-tree*` / `tag-list` に props で流す。

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Vitest, i18next, Tailwind utility classes

---

## File Structure

- Create: `src/components/reader/sidebar-density.ts`
  - sidebar 専用の密度 token helper
- Test: `src/__tests__/components/sidebar-density.test.ts`
  - density helper の unit test
- Modify: `src/stores/preferences-store.ts`
  - `sidebar_density` schema / default / fallback を追加
- Modify: `src/__tests__/stores/preferences-store.test.ts`
  - `sidebar_density` の default / invalid fallback を追加
- Modify: `src/components/settings/use-appearance-settings-view-props.ts`
  - Appearance settings に `リスト密度` select を追加
- Modify: `src/locales/ja/settings.json`
  - `リスト密度`, `狭く`, `標準`, `広く` 文言を追加
- Modify: `src/locales/en/settings.json`
  - `List density`, `Compact`, `Standard`, `Spacious` 文言を追加
- Modify: `src/__tests__/components/settings-surface-views.test.tsx`
  - Appearance settings の新 select を検証
- Modify: `src/components/reader/sidebar.types.ts`
  - density 型と props を追加
- Modify: `src/components/reader/use-sidebar-runtime.ts`
  - preference source から `sidebarDensity` を引き出す
- Modify: `src/components/reader/use-sidebar-controller.ts`
  - density を section props へ渡す
- Modify: `src/components/reader/use-sidebar-controller-sections.ts`
  - density を feed/tag section props に渡す
- Modify: `src/components/reader/use-sidebar-section-props.ts`
  - density を content props に含める
- Modify: `src/components/reader/use-sidebar-content-sections-props.ts`
  - density を feed tree / tag list 側へ伝播する
- Modify: `src/components/reader/sidebar-content-sections.tsx`
  - density props を各 section に渡す
- Modify: `src/components/reader/sidebar-nav-button.tsx`
  - density-aware にする
- Modify: `src/components/reader/feed-tree-row.tsx`
  - drag handle と drag padding を density-aware にする
- Modify: `src/components/reader/feed-tree-folder-section.tsx`
  - folder toggle と child gap を density-aware にする
- Modify: `src/components/reader/feed-tree-view.tsx`
  - tree root gap を density-aware にする
- Modify: `src/components/reader/feed-tree-unfoldered-section.tsx`
  - unfoldered gap を density-aware にする
- Modify: `src/components/reader/tag-list-view.tsx`
  - tag list gap を density-aware にする
- Test: `src/__tests__/components/feed-tree-view.test.tsx`
  - density 適用時の size / padding / gap を検証
- Test: `src/__tests__/components/sidebar.test.tsx`
  - store preference 経由で sidebar へ反映されることを検証

## Task 1: preference と設定画面に `リスト密度` を追加する

**Files:**

- Modify: `src/stores/preferences-store.ts`
- Modify: `src/components/settings/use-appearance-settings-view-props.ts`
- Modify: `src/locales/ja/settings.json`
- Modify: `src/locales/en/settings.json`
- Test: `src/__tests__/stores/preferences-store.test.ts`
- Test: `src/__tests__/components/settings-surface-views.test.tsx`

- [ ] **Step 1: failing test を追加する**

```ts
// src/__tests__/stores/preferences-store.test.ts
it("defaults sidebar density to normal and normalizes invalid values", () => {
  expect(resolvePreferenceValue({}, "sidebar_density")).toBe("normal");
  expect(resolvePreferenceValue({ sidebar_density: "dense" }, "sidebar_density")).toBe("normal");
});
```

```tsx
// src/__tests__/components/settings-surface-views.test.tsx
it("renders the list density control in appearance settings", async () => {
  const user = userEvent.setup();
  const onDensityChange = vi.fn();

  render(
    <AppearanceSettingsView
      title="Appearance"
      sections={[
        {
          id: "appearance-general",
          heading: "General",
          controls: [
            {
              id: "list-density",
              type: "select",
              name: "sidebar_density",
              label: "List density",
              value: "normal",
              options: [
                { value: "compact", label: "Compact" },
                { value: "normal", label: "Standard" },
                { value: "spacious", label: "Spacious" },
              ],
              onChange: onDensityChange,
            },
          ],
        },
      ]}
    />,
  );

  await user.click(screen.getByRole("combobox", { name: "List density" }));
  await user.click(await screen.findByRole("option", { name: "Spacious" }));

  expect(onDensityChange).toHaveBeenCalledWith("spacious");
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/components/settings-surface-views.test.tsx`
Expected: FAIL because `sidebar_density` is not yet a known preference / settings control

- [ ] **Step 3: 最小実装を書く**

```ts
// src/stores/preferences-store.ts
const sidebarDensitySchema = z.enum(["compact", "normal", "spacious"]);

const preferenceSchemas = {
  // ...
  sidebar_density: sidebarDensitySchema,
} as const;

const corePreferenceDefaults = {
  // ...
  sidebar_density: "normal",
} satisfies { [K in KnownPreferenceKey]: z.input<(typeof preferenceSchemas)[K]> };
```

```ts
// src/components/settings/use-appearance-settings-view-props.ts
{
  id: "list-density",
  type: "select",
  name: "sidebar_density",
  label: t("appearance.list_density"),
  value: resolvePreferenceValue(prefs, "sidebar_density"),
  options: [
    { value: "compact", label: t("appearance.compact_density") },
    { value: "normal", label: t("appearance.normal_density") },
    { value: "spacious", label: t("appearance.spacious_density") },
  ],
  onChange: (value) => setPref("sidebar_density", value),
},
```

```json
// src/locales/ja/settings.json
{
  "list_density": "リスト密度",
  "compact_density": "狭く",
  "normal_density": "標準",
  "spacious_density": "広く"
}
```

```json
// src/locales/en/settings.json
{
  "list_density": "List density",
  "compact_density": "Compact",
  "normal_density": "Standard",
  "spacious_density": "Spacious"
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/stores/preferences-store.test.ts src/__tests__/components/settings-surface-views.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/stores/preferences-store.ts src/components/settings/use-appearance-settings-view-props.ts src/locales/ja/settings.json src/locales/en/settings.json src/__tests__/stores/preferences-store.test.ts src/__tests__/components/settings-surface-views.test.tsx
git commit -m "feat(settings): add sidebar density preference"
```

## Task 2: sidebar 専用 density helper を追加する

**Files:**

- Create: `src/components/reader/sidebar-density.ts`
- Test: `src/__tests__/components/sidebar-density.test.ts`

- [ ] **Step 1: failing test を書く**

```ts
import { describe, expect, it } from "vitest";
import { getSidebarDensityTokens } from "@/components/reader/sidebar-density";

describe("getSidebarDensityTokens", () => {
  it("returns progressively larger tokens from compact to spacious", () => {
    const compact = getSidebarDensityTokens("compact");
    const normal = getSidebarDensityTokens("normal");
    const spacious = getSidebarDensityTokens("spacious");

    expect(compact.navButton).toContain("min-h-8");
    expect(normal.navButton).toContain("min-h-9");
    expect(spacious.navButton).toContain("min-h-10");

    expect(compact.treeGap).toContain("space-y-0");
    expect(normal.treeGap).toContain("space-y-0.5");
    expect(spacious.treeGap).toContain("space-y-1");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar-density.test.ts`
Expected: FAIL with `Cannot find module '@/components/reader/sidebar-density'`

- [ ] **Step 3: 最小実装を書く**

```ts
// src/components/reader/sidebar-density.ts
export type SidebarDensity = "compact" | "normal" | "spacious";

export type SidebarDensityTokens = {
  navButton: string;
  dragHandle: string;
  folderToggle: string;
  dragPadding: string;
  treeGap: string;
  childGap: string;
  unfolderedGap: string;
  tagListGap: string;
};

const densityMap: Record<SidebarDensity, SidebarDensityTokens> = {
  compact: {
    navButton: "min-h-8 py-0.5",
    dragHandle: "h-8 w-8",
    folderToggle: "h-8 w-8",
    dragPadding: "pl-8",
    treeGap: "space-y-0",
    childGap: "space-y-0",
    unfolderedGap: "space-y-1",
    tagListGap: "space-y-0",
  },
  normal: {
    navButton: "min-h-9 py-1",
    dragHandle: "h-9 w-9",
    folderToggle: "h-9 w-9",
    dragPadding: "pl-9",
    treeGap: "space-y-0.5",
    childGap: "space-y-0.5",
    unfolderedGap: "space-y-1.5",
    tagListGap: "space-y-0.5",
  },
  spacious: {
    navButton: "min-h-10 py-1.5",
    dragHandle: "h-10 w-10",
    folderToggle: "h-10 w-10",
    dragPadding: "pl-10",
    treeGap: "space-y-1",
    childGap: "space-y-1",
    unfolderedGap: "space-y-2",
    tagListGap: "space-y-1",
  },
};

export function getSidebarDensityTokens(density: SidebarDensity): SidebarDensityTokens {
  return densityMap[density];
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar-density.test.ts`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar-density.ts src/__tests__/components/sidebar-density.test.ts
git commit -m "feat(sidebar): add density tokens"
```

## Task 3: density を sidebar controller から UI へ配線する

**Files:**

- Modify: `src/components/reader/sidebar.types.ts`
- Modify: `src/components/reader/use-sidebar-runtime.ts`
- Modify: `src/components/reader/use-sidebar-controller.ts`
- Modify: `src/components/reader/use-sidebar-controller-sections.ts`
- Modify: `src/components/reader/use-sidebar-section-props.ts`
- Modify: `src/components/reader/use-sidebar-content-sections-props.ts`
- Modify: `src/components/reader/sidebar-content-sections.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: failing test を追加する**

```tsx
it("passes the compact sidebar density preference through to sidebar sections", async () => {
  usePreferencesStore.setState({
    prefs: { sidebar_density: "compact" },
    loaded: true,
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  const folderToggle = await screen.findByRole("button", { name: /Toggle folder|フォルダ/ });
  expect(folderToggle).toHaveClass("h-8");
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar.test.tsx -t "passes the compact sidebar density preference through to sidebar sections"`
Expected: FAIL because sidebar currently ignores `sidebar_density`

- [ ] **Step 3: 最小実装を書く**

```ts
// src/components/reader/sidebar.types.ts
import type { SidebarDensity } from "./sidebar-density";

export type SidebarNavButtonProps = ComponentPropsWithoutRef<"button"> & {
  // ...
  density?: SidebarDensity;
};

export type SidebarContentSectionsProps = {
  // ...
  sidebarDensity: SidebarDensity;
};
```

```ts
// src/components/reader/use-sidebar-runtime.ts
import { resolvePreferenceValue } from "@/stores/preferences-store";

const sidebarDensity = resolvePreferenceValue(uiState.prefs, "sidebar_density");

return {
  // ...
  sidebarDensity,
};
```

```ts
// src/components/reader/use-sidebar-controller.ts
const {
  // ...
  sidebarDensity,
} = useSidebarRuntime();

return useSidebarViewProps({
  opaqueSidebars,
  headerProps,
  accountSectionProps,
  smartViewsProps,
  contentSectionsProps,
  sidebarDensity,
});
```

```ts
// src/components/reader/use-sidebar-section-props.ts
const contentSectionsProps = useSidebarContentSectionsProps({
  // ...
  sidebarDensity,
});
```

```tsx
// src/components/reader/sidebar-content-sections.tsx
<FeedTreeView {...feedTreeProps} sidebarDensity={sidebarDensity} />
<TagListView {...tagListProps} sidebarDensity={sidebarDensity} />
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar.types.ts src/components/reader/use-sidebar-runtime.ts src/components/reader/use-sidebar-controller.ts src/components/reader/use-sidebar-controller-sections.ts src/components/reader/use-sidebar-section-props.ts src/components/reader/use-sidebar-content-sections-props.ts src/components/reader/sidebar-content-sections.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat(sidebar): wire density preference through controller"
```

## Task 4: sidebar row / tree / tag list を density-aware にする

**Files:**

- Modify: `src/components/reader/sidebar-nav-button.tsx`
- Modify: `src/components/reader/feed-tree-row.tsx`
- Modify: `src/components/reader/feed-tree-folder-section.tsx`
- Modify: `src/components/reader/feed-tree-view.tsx`
- Modify: `src/components/reader/feed-tree-unfoldered-section.tsx`
- Modify: `src/components/reader/tag-list-view.tsx`
- Test: `src/__tests__/components/feed-tree-view.test.tsx`

- [ ] **Step 1: failing test を追加する**

```tsx
it("applies compact density tokens to feed rows and drag handles", () => {
  render(
    <FeedTreeView
      isOpen={true}
      sidebarDensity="compact"
      canDragFeeds={true}
      draggedFeedId="feed-2"
      activeDropTarget={null}
      folders={[
        {
          id: "folder-empty",
          name: "Empty",
          accountId: "acc-1",
          sortOrder: 1,
          unreadCount: 0,
          isExpanded: false,
          isSelected: false,
          feeds: [],
        },
      ]}
      unfolderedFeeds={[
        {
          id: "feed-2",
          accountId: "acc-1",
          folderId: null,
          title: "Beta",
          url: "https://example.com/beta.xml",
          siteUrl: "https://example.com/beta",
          unreadCount: 1,
          readerMode: "on",
          webPreviewMode: "off",
          isSelected: false,
          grayscaleFavicon: false,
        },
      ]}
      onToggleFolder={vi.fn()}
      onSelectFeed={vi.fn()}
      onDragStartFeed={vi.fn()}
      onDragEnterFolder={vi.fn()}
      onDragEnterUnfoldered={vi.fn()}
      onDropToFolder={vi.fn()}
      onDropToUnfoldered={vi.fn()}
      onDragEnd={vi.fn()}
      displayFavicons={false}
      emptyState={{ kind: "message", message: "No feeds yet" }}
    />,
  );

  expect(screen.getByRole("button", { name: "Drag Beta" })).toHaveClass("h-8");
  expect(document.querySelector('[data-feed-id="feed-2"]')).toHaveClass("pl-8");
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/feed-tree-view.test.tsx`
Expected: FAIL because `FeedTreeView` and child rows do not yet accept `sidebarDensity`

- [ ] **Step 3: 最小実装を書く**

```tsx
// src/components/reader/sidebar-nav-button.tsx
import { getSidebarDensityTokens } from "./sidebar-density";

const tokens = getSidebarDensityTokens(density ?? "normal");

className={cn(
  "relative flex w-full items-center justify-between overflow-hidden rounded-md px-2 text-sm transition-[background-color,color,box-shadow] duration-150 ...",
  size === "default" ? "min-h-10 py-2" : tokens.navButton,
  selected ? "bg-sidebar-accent/85 ..." : "text-sidebar-foreground hover:bg-sidebar-accent/55",
  className,
)}
```

```tsx
// src/components/reader/feed-tree-row.tsx
const tokens = getSidebarDensityTokens(sidebarDensity);

className={cn(tokens.dragHandle, "shrink-0 cursor-grab items-center justify-center rounded-md ...")}

<SidebarNavButton
  density={sidebarDensity}
  className={cn(canDragFeeds && tokens.dragPadding)}
/>
```

```tsx
// src/components/reader/feed-tree-folder-section.tsx
const tokens = getSidebarDensityTokens(sidebarDensity);

className={cn(tokens.folderToggle, "shrink-0 items-center justify-center rounded-md ...")}

<div className={cn("mt-0.5 ml-2 border-l border-sidebar-border/30 pl-3", tokens.childGap)}>
```

```tsx
// src/components/reader/feed-tree-view.tsx
const tokens = getSidebarDensityTokens(sidebarDensity);
<div className={cn("px-2", tokens.treeGap)}>
```

```tsx
// src/components/reader/feed-tree-unfoldered-section.tsx
const tokens = getSidebarDensityTokens(sidebarDensity);
<div className={tokens.unfolderedGap}>
```

```tsx
// src/components/reader/tag-list-view.tsx
const tokens = getSidebarDensityTokens(sidebarDensity);
<div className={cn("px-2", tokens.tagListGap)}>
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/sidebar-density.test.ts`
Expected: PASS

- [ ] **Step 5: フルチェックを実行する**

Run: `mise run check`
Expected: PASS with format, lint, test all green

- [ ] **Step 6: コミットする**

```bash
git add src/components/reader/sidebar-nav-button.tsx src/components/reader/feed-tree-row.tsx src/components/reader/feed-tree-folder-section.tsx src/components/reader/feed-tree-view.tsx src/components/reader/feed-tree-unfoldered-section.tsx src/components/reader/tag-list-view.tsx src/__tests__/components/feed-tree-view.test.tsx
git commit -m "feat(sidebar): add configurable list density"
```
