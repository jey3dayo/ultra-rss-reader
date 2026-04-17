# Subscriptions Workspace Tone Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Align the subscriptions index and cleanup workspaces with the article-reading and settings surfaces by restoring a lighter tree-driven left pane, preserving the richer right detail panel, and reusing the existing drag-and-drop behavior for folder assignment.

Architecture: Keep the right-side detail surfaces card-based and shared, but replace the left-side subscriptions list with a tree-style pane that reuses the existing folder/feed drag logic and only applies a stronger surface to the currently selected feed. Scope the implementation to the subscriptions index and cleanup workspaces without changing unrelated reader or settings flows.

Tech Stack: React 19, TypeScript, Zustand UI state, existing reader feed-tree components, Vitest, Biome

---

## File Structure

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
  - Replace the current all-card list with a tree-style list that uses folder rows, flatter feed rows, and a selected-row variant.
- Modify: `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
  - Ensure the left pane can scroll independently and retains the current two-column workspace layout.
- Modify: `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - Adapt data passed to the updated left pane and preserve the existing right-detail synchronization.
- Modify: `src/components/subscriptions-index/subscriptions-index.types.ts`
  - Add row display helpers only if the tree-style pane needs an explicit view model.
- Modify: `src/components/app-layout.tsx`
  - Keep the workspace content-only wide layout without reviving the hidden sidebar.
- Modify: `src/components/shared/feed-detail-panel.tsx`
  - Preserve the existing refined detail panel tokens so the left/right contrast stays intentional after the left pane is flattened.
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`
- Test: `src/__tests__/components/app-layout.test.tsx`

### Task 1: Replace the subscriptions left pane with a tree-style list

### Files

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders folder-first tree rows instead of heavy card rows", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  expect(await screen.findByRole("heading", { name: "Gaming" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Example Feed" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Example Feed" })).not.toHaveClass("rounded-3xl");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: FAIL because the current left pane still renders card-styled rows with `rounded-3xl`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/subscriptions-index/subscriptions-list-pane.tsx
<section className="flex min-h-0 flex-col border-r border-border/70 bg-background/55 px-4 py-4 sm:px-6">
  <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-sm font-semibold">{heading}</h2>
    <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
      {groups.reduce((count, group) => count + group.rows.length, 0)}
    </span>
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
    {groups.map((group) => (
      <div key={group.key} className="space-y-1.5">
        <div className="flex items-center justify-between px-1 py-1">
          <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
          <span className="text-[11px] text-muted-foreground">{group.rows.length}</span>
        </div>
        {group.rows.map((row) => (
          <button
            key={row.feed.id}
            type="button"
            aria-label={row.feed.title}
            onClick={() => onSelectFeed(row.feed.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              selectedFeedId === row.feed.id
                ? "border border-border/70 bg-card/75"
                : "border border-transparent bg-transparent hover:bg-card/45",
            )}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/90 text-sm font-medium text-foreground">
              {buildFeedAvatar(row.feed.title)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block line-clamp-1 text-sm font-medium text-foreground">{row.feed.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{statusLabels[row.status.labelKey]}</span>
            </span>
          </button>
        ))}
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS for the new tree-style expectations.

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions-index/subscriptions-list-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "refactor: restore tree-style subscriptions list"
```

### Task 2: Reuse folder drag/drop behavior for subscriptions index rows

### Files

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Modify: `src/components/subscriptions-index/subscriptions-index-page.tsx`
- Modify: `src/components/subscriptions-index/subscriptions-index.types.ts`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows a droppable folder target for subscriptions rows", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: "Gaming" })).toHaveAttribute("data-folder-drop-target", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: FAIL because folder rows do not yet expose drop-target state.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/subscriptions-index/subscriptions-index.types.ts
export type SubscriptionListGroup = {
  key: string;
  label: string;
  rows: SubscriptionListRow[];
  folderId: string | null;
};

// src/components/subscriptions-index/subscriptions-index-page.tsx
const groupedRows = useMemo(
  () =>
    buildSubscriptionListGroups(
      state.visibleRows,
      folders.map((folder) => ({ id: folder.id, name: folder.name })),
      t("meta_folder_none"),
    ),
  [folders, state.visibleRows, t],
);

// src/components/subscriptions-index/subscriptions-list-pane.tsx
<button
  type="button"
  aria-label={group.label}
  data-folder-drop-target={group.folderId ? "true" : "false"}
  className="flex w-full items-center justify-between px-1 py-1"
>
  <span className="text-sm font-semibold text-foreground">{group.label}</span>
  <span className="text-[11px] text-muted-foreground">{group.rows.length}</span>
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS with the folder drop-target marker present.

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions-index/subscriptions-index.types.ts src/components/subscriptions-index/subscriptions-index-page.tsx src/components/subscriptions-index/subscriptions-list-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "feat: prepare subscriptions tree for folder drop targets"
```

### Task 3: Keep the workspace layout aligned with the lighter left pane

### Files

- Modify: `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
- Modify: `src/components/app-layout.tsx`
- Test: `src/__tests__/components/app-layout.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("keeps subscriptions workspace content-only without reviving the app sidebar", () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    layoutMode: "wide",
    subscriptionsWorkspace: { kind: "index", cleanupContext: null },
    focusedPane: "content",
  });

  render(<AppLayout />);

  expect(screen.queryByText("Sidebar")).not.toBeInTheDocument();
  expect(screen.getByText("Article View")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/app-layout.test.tsx`
Expected: FAIL if any workspace layout regression reintroduces the sidebar shell.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/app-layout.tsx
const panes = subscriptionsWorkspaceOpen ? ["content"] : resolveLayout("wide", focusedPane, contentMode);
const shouldShowSidebar = subscriptionsWorkspaceOpen ? false : sidebarOpen;

// src/components/subscriptions-index/subscriptions-index-page-view.tsx
<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] overflow-hidden">
  <SubscriptionsListPane ... />
  <SubscriptionDetailPane ... />
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/app-layout.test.tsx`
Expected: PASS with content-only workspace layout intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-layout.tsx src/components/subscriptions-index/subscriptions-index-page-view.tsx src/__tests__/components/app-layout.test.tsx
git commit -m "style: align subscriptions workspace shell"
```

### Task 4: Verify the subscriptions workspace still matches the shared detail tone

### Files

- Modify: `src/components/shared/feed-detail-panel.tsx` (only if a spacing/token mismatch appears)
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("keeps the shared detail panel visible while the left tree scrolls independently", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  const detailPane = screen.getByTestId("subscriptions-detail-pane");
  expect(detailPane).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Example Feed" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails only if the detail pane regressed**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS or pinpoint any accidental regression introduced by the left-pane refactor.

- [ ] **Step 3: Write minimal implementation if needed**

```tsx
// src/components/shared/feed-detail-panel.tsx
<FeedCleanupCard className="rounded-3xl border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.97))]">
  <div className="space-y-5">{/* preserve current shared detail layout */}</div>
</FeedCleanupCard>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS with the shared detail panel unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/feed-detail-panel.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "test: guard shared subscriptions detail layout"
```

## Self-Review

- Spec coverage:
  - Left-pane tone alignment is covered by Tasks 1 and 3.
  - Drag/drop reuse is covered by Task 2.
  - Shared detail continuity is covered by Task 4.
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to” references remain.
- Type consistency:
  - All task snippets use the current file paths and names in this repository (`subscriptions-list-pane`, `subscriptions-index-page`, `feed-detail-panel`, `app-layout`).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-subscriptions-workspace-tone-alignment.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
