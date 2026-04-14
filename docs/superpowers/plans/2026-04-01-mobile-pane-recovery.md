# Mobile Pane Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 幅 `375px` 前後の mobile レイアウトで、初期表示・browser close・reader close のどの経路でも sidebar / list / content を行き来できるようにし、設定・同期・追加導線が画面外へ退避したまま戻れない状態をなくす

Architecture: mobile の「実際に前面表示する pane」は `use-layout` に閉じた純粋関数で解決し、`AppLayout` はその解決済み pane を使って描画する。`ui-store` は viewport 条件を持たず「ユーザー操作の結果どこへ戻るか」だけを担当し、browser close の戻り先を store 内で保証する。記事一覧側には既存の mobile sidebar 導線があるため、今回の UI 追加は content 側に揃えることを中心にし、layout / store / reader toolbar の 3 層で再発防止する。

Tech Stack: React 19, TypeScript, Zustand, Vitest, Testing Library, Playwright, Tailwind CSS

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `src/hooks/use-layout.ts` | mobile 時の実表示 pane 解決関数を追加し、既存の `computeTranslateX` / `isPaneVisible` と組み合わせられる形にする |
| Modify | `src/__tests__/hooks/use-layout.test.ts` | mobile 初期 pane 解決ロジックと既存 layout helper の回帰を検証する |
| Modify | `src/components/app-layout.tsx` | mobile 時に store の `focusedPane` ではなく解決済み `activePane` で tray を描画する |
| Modify | `src/__tests__/app.test.tsx` | mobile で `selectedAccountId` と `focusedPane` に応じた前面 pane を検証する |
| Modify | `src/stores/ui-store.ts` | `closeBrowser()` の戻り先として `focusedPane = "list"` を保証する |
| Modify | `src/__tests__/stores/ui-store.test.ts` | `closeBrowser()` が article 有無に関係なく list pane に戻ることを検証する |
| Modify | `src/components/reader/article-view.tsx` | mobile content から sidebar へ戻る導線を store に接続する |
| Modify | `src/components/reader/article-toolbar-view.tsx` | content toolbar に mobile sidebar ボタンを受け取る props を追加する |
| Modify | `src/components/reader/article-toolbar-view.stories.tsx` | 新 props を story に反映し、見た目の回帰確認をしやすくする |
| Modify | `src/__tests__/components/article-toolbar-view.test.tsx` | mobile sidebar ボタンの表示条件と押下ハンドラを検証する |
| Modify | `src/__tests__/components/article-view.test.tsx` | reader / browser から list / sidebar に戻れることを検証する |

### Notes Before Editing

- `src/components/reader/article-toolbar-view.tsx`
- `src/__tests__/components/article-toolbar-view.test.tsx`
- `src/components/reader/article-view.tsx`

上記ファイルには未コミット変更が入っている可能性がある。実装時は既存差分を読んで統合し、勝手に巻き戻さないこと。

---

## Task 1: mobile の前面 pane 解決ロジックを追加する

### Files

- Modify: `src/hooks/use-layout.ts`
- Modify: `src/__tests__/hooks/use-layout.test.ts`

- [ ] **Step 1: `use-layout` の失敗テストを追加する**

`src/__tests__/hooks/use-layout.test.ts` に追加:

```ts
import {
  computeTranslateX,
  isPaneVisible,
  resolveLayout,
  resolveResponsiveLayoutMode,
  resolveVisiblePane,
} from "../../hooks/use-layout";

describe("resolveVisiblePane", () => {
  it("returns sidebar on mobile when no account is selected", () => {
    expect(resolveVisiblePane("mobile", "list", null)).toBe("sidebar");
  });

  it("keeps content visible on mobile when content is focused", () => {
    expect(resolveVisiblePane("mobile", "content", "acc-1")).toBe("content");
  });

  it("defaults to list on mobile during normal usage", () => {
    expect(resolveVisiblePane("mobile", "sidebar", "acc-1")).toBe("list");
    expect(resolveVisiblePane("mobile", "list", "acc-1")).toBe("list");
  });

  it("passes through non-mobile layout modes", () => {
    expect(resolveVisiblePane("compact", "sidebar", "acc-1")).toBe("sidebar");
    expect(resolveVisiblePane("wide", "content", "acc-1")).toBe("content");
  });
});
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `pnpm vitest run src/__tests__/hooks/use-layout.test.ts`

Expected: FAIL with `resolveVisiblePane is not exported` or `is not a function`

- [ ] **Step 3: `use-layout.ts` に最小実装を追加する**

`src/hooks/use-layout.ts` に追加:

```ts
type FocusedPane = "sidebar" | "list" | "content";

export function resolveVisiblePane(
  layoutMode: ResponsiveLayoutMode,
  focusedPane: FocusedPane,
  selectedAccountId: string | null,
): FocusedPane {
  if (layoutMode !== "mobile") return focusedPane;
  if (focusedPane === "content") return "content";
  if (!selectedAccountId) return "sidebar";
  return "list";
}
```

ポイント:

- `focusedPane === "content"` を最優先にして、記事表示中の mobile リサイズで content を潰さない
- 初期表示の救済は layout 解決責務に閉じ、store に viewport 条件を持ち込まない
- `computeTranslateX` / `isPaneVisible` のシグネチャはそのままにして、既存テストを壊さない

- [ ] **Step 4: `use-layout` テストを再実行する**

Run: `pnpm vitest run src/__tests__/hooks/use-layout.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/hooks/use-layout.ts src/__tests__/hooks/use-layout.test.ts
git commit -m "feat: resolve visible pane for mobile layout"
```

---

## Task 2: AppLayout が解決済み pane を使って描画するようにする

### Files

- Modify: `src/components/app-layout.tsx`
- Modify: `src/__tests__/app.test.tsx`

- [ ] **Step 1: `AppLayout` の失敗テストを追加する**

`src/__tests__/app.test.tsx` に追加:

```tsx
it("mobile: falls back to sidebar when no account is selected", () => {
  useUiStore.setState({
    layoutMode: "mobile",
    focusedPane: "list",
    selectedAccountId: null,
  });

  const { container } = render(<AppLayout />, { wrapper: createWrapper() });
  const tray = container.firstElementChild?.firstElementChild;
  const panes = tray?.children;

  expect(tray).toHaveStyle({ transform: "translateX(0%)" });
  expect(panes?.[0]).not.toHaveAttribute("inert");
  expect(panes?.[1]).toHaveAttribute("inert");
  expect(panes?.[2]).toHaveAttribute("inert");
});

it("mobile: keeps content visible when an article is open", () => {
  useUiStore.setState({
    layoutMode: "mobile",
    focusedPane: "content",
    selectedAccountId: "acc-1",
  });

  const { container } = render(<AppLayout />, { wrapper: createWrapper() });
  const tray = container.firstElementChild?.firstElementChild;

  expect(tray).toHaveStyle({ transform: "translateX(calc(-200% / 3))" });
});
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `pnpm vitest run src/__tests__/app.test.tsx`

Expected: FAIL because the current implementation still trusts raw `focusedPane`

- [ ] **Step 3: `AppLayout` で `activePane` を解決して使う**

`src/components/app-layout.tsx` を更新:

```tsx
import { computeTranslateX, isPaneVisible, resolveLayout, resolveVisiblePane } from "../hooks/use-layout";

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
  selectedAccountId,
  overlayTitlebar,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  selectedAccountId: string | null;
  overlayTitlebar: boolean;
}) {
  const activePane = resolveVisiblePane(layoutMode, focusedPane, selectedAccountId);
  const translateX = computeTranslateX(layoutMode, activePane);

  // ... isPaneVisible(layoutMode, activePane, "sidebar") を使う
}

export function AppLayout() {
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);

  return (
    <SlidingPaneLayout
      layoutMode={layoutMode}
      focusedPane={focusedPane}
      selectedAccountId={selectedAccountId}
      overlayTitlebar={overlayTitlebar}
    />
  );
}
```

ポイント:

- wide の挙動は変えない
- `resolveVisiblePane()` は mobile 以外では passthrough なので compact に新条件を足さない
- `aria-hidden` / `inert` 判定と `translateX` 計算の入力を揃える

- [ ] **Step 4: `AppLayout` テストを再実行する**

Run: `pnpm vitest run src/__tests__/app.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/app-layout.tsx src/__tests__/app.test.tsx
git commit -m "feat: use resolved mobile pane in app layout"
```

---

## Task 3: browser close の戻り先を store で保証する

### Files

- Modify: `src/stores/ui-store.ts`
- Modify: `src/__tests__/stores/ui-store.test.ts`

- [ ] **Step 1: `ui-store` の失敗テストを追加する**

`src/__tests__/stores/ui-store.test.ts` に追加:

```ts
it("closeBrowser returns to the list pane when an article is selected", () => {
  useUiStore.setState({ layoutMode: "mobile", focusedPane: "content" });
  useUiStore.getState().selectArticle("a1");
  useUiStore.getState().openBrowser("https://ex.com");

  useUiStore.getState().closeBrowser();

  expect(useUiStore.getState().contentMode).toBe("reader");
  expect(useUiStore.getState().focusedPane).toBe("list");
});

it("closeBrowser returns to the list pane even without a selected article", () => {
  useUiStore.setState({ layoutMode: "mobile", focusedPane: "content" });
  useUiStore.getState().openBrowser("https://ex.com");

  useUiStore.getState().closeBrowser();

  expect(useUiStore.getState().contentMode).toBe("empty");
  expect(useUiStore.getState().focusedPane).toBe("list");
});
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `pnpm vitest run src/__tests__/stores/ui-store.test.ts`

Expected: FAIL because `closeBrowser()` currently does not update `focusedPane`

- [ ] **Step 3: `closeBrowser()` を最小修正する**

`src/stores/ui-store.ts` の `closeBrowser` を更新:

```ts
closeBrowser: () =>
  set((s) => ({
    contentMode: s.selectedArticleId ? "reader" : "empty",
    browserUrl: null,
    focusedPane: s.layoutMode === "wide" ? s.focusedPane : "list",
  })),
```

ポイント:

- wide では pane を動かさない
- compact/mobile はどちらも `list` へ戻す
- `clearArticle()` の責務までは広げない

- [ ] **Step 4: `ui-store` テストを再実行する**

Run: `pnpm vitest run src/__tests__/stores/ui-store.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/stores/ui-store.ts src/__tests__/stores/ui-store.test.ts
git commit -m "fix: return to list when closing browser"
```

---

## Task 4: content 側にも mobile sidebar 導線を揃える

### Files

- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/components/reader/article-toolbar-view.tsx`
- Modify: `src/components/reader/article-toolbar-view.stories.tsx`
- Modify: `src/__tests__/components/article-toolbar-view.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: toolbar / article view の失敗テストを追加する**

`src/__tests__/components/article-toolbar-view.test.tsx` に追加:

```tsx
it("shows a mobile sidebar button when requested", async () => {
  const user = userEvent.setup();
  const onShowSidebar = vi.fn();

  render(
    <ArticleToolbarView
      showCloseButton
      showSidebarButton
      canToggleRead
      canToggleStar
      isRead={false}
      isStarred={false}
      isBrowserOpen={false}
      showCopyLinkButton
      canCopyLink
      showOpenInBrowserButton
      canOpenInBrowser
      showOpenInExternalBrowserButton
      canOpenInExternalBrowser
      labels={{
        closeView: "Close view",
        showSidebar: "Show sidebar",
        toggleRead: "Toggle read",
        toggleStar: "Toggle star",
        copyLink: "Copy link",
        viewInBrowser: "View in browser",
        openInExternalBrowser: "Open in external browser",
      }}
      onCloseView={vi.fn()}
      onShowSidebar={onShowSidebar}
      onToggleRead={vi.fn()}
      onToggleStar={vi.fn()}
      onCopyLink={vi.fn()}
      onOpenInBrowser={vi.fn()}
      onOpenInExternalBrowser={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Show sidebar" }));
  expect(onShowSidebar).toHaveBeenCalledTimes(1);
});
```

`src/__tests__/components/article-view.test.tsx` に追加:

```tsx
it("returns to the sidebar from the article toolbar on mobile", async () => {
  const user = userEvent.setup();
  useUiStore.setState({
    ...useUiStore.getState(),
    layoutMode: "mobile",
    selectedArticleId: "art-1",
    contentMode: "reader",
    focusedPane: "content",
  });

  render(<ArticleView />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: /show sidebar/i }));

  expect(useUiStore.getState().focusedPane).toBe("sidebar");
});
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx`

Expected: FAIL because `ArticleToolbarView` has no sidebar button props yet

- [ ] **Step 3: toolbar props と article view の接続を実装する**

`src/components/reader/article-toolbar-view.tsx` を更新:

```tsx
import { Copy, ExternalLink, Globe, PanelLeft, X } from "lucide-react";

export type ArticleToolbarViewLabels = {
  closeView: string;
  showSidebar: string;
  toggleRead: string;
  toggleStar: string;
  copyLink: string;
  viewInBrowser: string;
  openInExternalBrowser: string;
};

export type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  showSidebarButton?: boolean;
  // ...
  onCloseView: () => void;
  onShowSidebar?: () => void;
  // ...
};
```

button 実装:

```tsx
<div className="flex items-center gap-1">
  {showSidebarButton && onShowSidebar ? (
    <IconToolbarButton label={labels.showSidebar} onClick={onShowSidebar}>
      <PanelLeft className="h-4 w-4" />
    </IconToolbarButton>
  ) : null}
  {showCloseButton && (
    <IconToolbarButton label={labels.closeView} onClick={onCloseView}>
      <X className="h-4 w-4" />
    </IconToolbarButton>
  )}
</div>
```

`src/components/reader/article-view.tsx` の `ArticleToolbar` で追加:

```tsx
const setFocusedPane = useUiStore((s) => s.setFocusedPane);

<ArticleToolbarView
  showSidebarButton={layoutMode === "mobile"}
  labels={{
    closeView: t("close_view"),
    showSidebar: t("show_sidebar"),
    // ...
  }}
  onShowSidebar={() => setFocusedPane("sidebar")}
  // ...
/>
```

ポイント:

- 記事一覧側の `ArticleListHeader` と同じ意味の操作名に揃える
- mobile 条件は container 側で判定し、presentational component は boolean prop だけ受ける
- この task では browser close と close view の意味を変更しない

- [ ] **Step 4: story とテストを更新する**

`src/components/reader/article-toolbar-view.stories.tsx` に `showSidebarButton` と `showSidebar` label、`onShowSidebar` を追加。

`src/__tests__/components/article-toolbar-view.test.tsx` では既存ケースにも新 prop を必要最小限で追加:

```tsx
labels={{
  closeView: "Close view",
  showSidebar: "Show sidebar",
  // ...
}}
onShowSidebar={vi.fn()}
```

- [ ] **Step 5: toolbar / article view テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx`

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/reader/article-view.tsx src/components/reader/article-toolbar-view.tsx src/components/reader/article-toolbar-view.stories.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "feat: add mobile sidebar access from reader"
```

---

## Task 5: 回帰検証と 375px の手動確認を行う

### Files

- Modify: なし

- [ ] **Step 1: 変更ユニットのテストをまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/hooks/use-layout.test.ts src/__tests__/app.test.tsx src/__tests__/stores/ui-store.test.ts src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 3: プロジェクト標準のチェックを実行する**

Run: `mise run check`

Expected: PASS

注記:

- unrelated failure がある場合は、今回の差分起因か既存起因かを切り分けて報告する
- スコープ外の修正で `mise run check` を通しにいかない

- [ ] **Step 4: browser 手動確認を行う**

Run: `mise run app:dev:browser`

確認項目:

- viewport を `375x900` に設定して `http://127.0.0.1:4173/` または `http://127.0.0.1:4174/` を開く
- account 未選択時は sidebar が前面表示され、`FreshRSS` / `設定` / 同期 / 追加導線が画面内にある
- 通常利用時は list が前面表示される
- list header の sidebar ボタンで sidebar に戻れる
- article open → `表示を閉じる` で list に戻れる
- article open → toolbar の sidebar ボタンで sidebar に戻れる
- browser open → close で list に戻れる
- wide / compact では余計な sidebar ボタンが出ない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- 変更したファイル一覧
- 実行した検証コマンドと結果
- 375px 手動確認の結果
- 未解決事項があれば、その条件と再現手順
