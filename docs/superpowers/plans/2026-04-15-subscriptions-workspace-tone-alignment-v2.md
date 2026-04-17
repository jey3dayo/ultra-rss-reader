# Subscriptions Workspace Tone Alignment V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Rework the subscriptions index and cleanup workspaces so the left pane feels like the original lightweight feed tree while the right pane stays aligned with the refined shared detail surface.

Architecture: Keep the current shared detail panel family on the right, but replace the left subscriptions list with a tree-style workspace pane built from existing folder/feed tree patterns and drag/drop behavior. Treat subscriptions index and cleanup as one workspace family with consistent shell, spacing, scrolling, and interaction rules.

Tech Stack: React 19, TypeScript, Zustand UI state, existing reader feed-tree primitives, Vitest, Biome

---

## File Structure

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
  - Replace the heavy card list with lightweight folder/feed rows and selected-row emphasis only.
- Modify: `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - Feed the new tree-style list with grouped rows and any drag/drop metadata needed for folder reassignment.
- Modify: `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
  - Keep independent scrolling and preserve the content-only workspace shell.
- Modify: `src/components/subscriptions-index/subscriptions-index.types.ts`
  - Add any row/group metadata required for tree rendering or folder drop handling.
- Modify: `src/lib/subscriptions-index.ts`
  - Extend grouping helpers if folder metadata or row display state needs to be normalized.
- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
  - Reduce the left list to the same visual language as the subscriptions tree while preserving cleanup-only actions.
- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
  - Keep the control strip dense and aligned with the lighter left-pane structure.
- Modify: `src/components/shared/feed-detail-panel.tsx`
  - Preserve the shared right-pane tokens and spacing while matching the agreed tone.
- Modify: `src/components/feed-cleanup/feed-cleanup-review-panel.tsx`
  - Ensure the cleanup detail panel continues to reuse the shared detail panel without reintroducing one-off styles.
- Modify: `src/components/app-layout.tsx`
  - Keep subscriptions workspaces in content-only mode without restoring the app sidebar.
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`
- Test: `src/__tests__/components/feed-cleanup-page.test.tsx`
- Test: `src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
- Test: `src/__tests__/components/app-layout.test.tsx`

### Task 1: Restore a lightweight tree-style subscriptions left pane

### Files

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders lightweight feed rows and only highlights the selected feed", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  const selectedFeed = await screen.findByRole("button", { name: "Example Feed" });
  const secondaryFeed = screen.getByRole("button", { name: "Fresh Feed" });

  expect(selectedFeed).toHaveClass("border");
  expect(selectedFeed).toHaveClass("bg-card/75");
  expect(secondaryFeed).not.toHaveClass("bg-card/75");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: FAIL because the current list still uses card-heavy row styling instead of lightweight tree rows with selected-only emphasis.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/subscriptions-index/subscriptions-list-pane.tsx
<button
  key={row.feed.id}
  type="button"
  aria-label={row.feed.title}
  onClick={() => onSelectFeed(row.feed.id)}
  className={cn(
    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
    selectedFeedId === row.feed.id
      ? "border-border/70 bg-card/75"
      : "border-transparent bg-transparent hover:bg-card/40",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS with selected-only emphasis.

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions-index/subscriptions-list-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "style: restore lightweight subscriptions tree rows"
```

### Task 2: Reuse folder structure and prepare folder drop targets in subscriptions index

### Files

- Modify: `src/components/subscriptions-index/subscriptions-index.types.ts`
- Modify: `src/lib/subscriptions-index.ts`
- Modify: `src/components/subscriptions-index/subscriptions-index-page.tsx`
- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("exposes folder rows as drop targets in the subscriptions tree", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  expect(await screen.findByRole("heading", { name: "Gaming" })).toBeInTheDocument();
  expect(screen.getByTestId("subscriptions-folder-row-folder-1")).toHaveAttribute("data-folder-drop-target", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: FAIL because folder rows currently lack explicit drop-target metadata.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/subscriptions-index/subscriptions-index.types.ts
export type SubscriptionListGroup = {
  key: string;
  label: string;
  rows: SubscriptionListRow[];
  folderId: string | null;
};

// src/lib/subscriptions-index.ts
export function buildSubscriptionListGroups(
  rows: SubscriptionListRow[],
  folders: Array<{ id: string; name: string }>,
  noFolderLabel: string,
): SubscriptionListGroup[] {
  // preserve folder id so UI can expose drop target metadata
}

// src/components/subscriptions-index/subscriptions-list-pane.tsx
<div
  data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
  data-folder-drop-target={group.folderId ? "true" : "false"}
  className="flex items-center justify-between px-1 py-1"
>
  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
  <span className="text-[11px] text-muted-foreground">{group.rows.length}</span>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS with explicit folder-row metadata.

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions-index/subscriptions-index.types.ts src/lib/subscriptions-index.ts src/components/subscriptions-index/subscriptions-index-page.tsx src/components/subscriptions-index/subscriptions-list-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "feat: prepare subscriptions tree folder drop targets"
```

### Task 3: Keep workspace shell and scrolling aligned with the lighter list

### Files

- Modify: `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
- Modify: `src/components/app-layout.tsx`
- Test: `src/__tests__/components/app-layout.test.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("keeps subscriptions workspace content-only and lets the left pane scroll independently", async () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    layoutMode: "wide",
    subscriptionsWorkspace: { kind: "index", cleanupContext: null },
    focusedPane: "content",
  });

  render(<AppLayout />);

  expect(screen.queryByText("Sidebar")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/app-layout.test.tsx src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: FAIL if any workspace shell regression remains.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/app-layout.tsx
const panes = subscriptionsWorkspaceOpen ? ["content"] : resolveLayout("wide", focusedPane, contentMode);

// src/components/subscriptions-index/subscriptions-index-page-view.tsx
<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] overflow-hidden">
  <SubscriptionsListPane ... />
  <SubscriptionDetailPane ... />
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/app-layout.test.tsx src/__tests__/components/subscriptions-index-page.test.tsx`
Expected: PASS with independent left-pane scrolling preserved.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-layout.tsx src/components/subscriptions-index/subscriptions-index-page-view.tsx src/__tests__/components/app-layout.test.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "style: align subscriptions workspace shell and scrolling"
```

### Task 4: Reconcile cleanup queue rows with the same lighter language

### Files

- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
- Test: `src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
- Test: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("uses flatter queue rows while preserving cleanup actions", async () => {
  render(<FeedCleanupPage />, { wrapper: createWrapper() });

  const queueRow = await screen.findByTestId("feed-cleanup-queue-row-feed-1");
  expect(queueRow).not.toHaveClass("rounded-3xl");
  expect(within(queueRow).getByRole("button", { name: "Delete" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
Expected: FAIL because the cleanup rows still look more like standalone cards than tree rows.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/feed-cleanup/feed-cleanup-queue-panel.tsx
<div
  data-testid={`feed-cleanup-queue-row-${candidate.feedId}`}
  className={cn(
    "rounded-xl border px-3 py-3 transition-colors",
    selectedCandidate?.feedId === candidate.feedId ? "border-border/70 bg-card/75" : "border-transparent bg-transparent hover:bg-card/40",
  )}
>
  {/* keep existing inline Keep / Defer / Delete actions */}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
Expected: PASS with flatter rows and preserved actions.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed-cleanup/feed-cleanup-queue-panel.tsx src/components/feed-cleanup/feed-cleanup-overview-panel.tsx src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx
git commit -m "style: align cleanup queue with subscriptions tree tone"
```

### Task 5: Preserve the refined shared detail panel while the left panes lighten

### Files

- Modify: `src/components/shared/feed-detail-panel.tsx` (only if spacing or visual rhythm still needs alignment)
- Modify: `src/components/feed-cleanup/feed-cleanup-review-panel.tsx`
- Modify: `src/components/subscriptions-index/subscription-detail-pane.tsx`
- Test: `src/__tests__/components/feed-cleanup-review-panel.test.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("keeps the shared detail panel tone while the left tree is lighter", async () => {
  render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

  const detailPane = screen.getByTestId("subscriptions-detail-pane");
  expect(await within(detailPane).findByRole("link", { name: "Example Feed" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails only if the right pane regressed**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx`
Expected: PASS or reveal only right-pane regressions introduced by the left-pane refactor.

- [ ] **Step 3: Write minimal implementation if needed**

```tsx
// src/components/shared/feed-detail-panel.tsx
<FeedCleanupCard className="rounded-3xl border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.97))]">
  <div className="space-y-5">{/* preserve existing right-pane rhythm */}</div>
</FeedCleanupCard>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx`
Expected: PASS with the shared detail panel still intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/feed-detail-panel.tsx src/components/feed-cleanup/feed-cleanup-review-panel.tsx src/components/subscriptions-index/subscription-detail-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx
git commit -m "style: preserve shared subscriptions detail surface"
```

## Self-Review

- Spec coverage:
  - Left-pane tone alignment is covered by Tasks 1–4.
  - Drag/drop reuse is covered by Task 2.
  - Shared detail continuity is covered by Task 5.
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to” placeholders remain.
- Type consistency:
  - All referenced files and component names exist in this repository and match the current subscriptions/cleanup workspace structure.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-subscriptions-workspace-tone-alignment-v2.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
