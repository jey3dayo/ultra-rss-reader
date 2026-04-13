# Feed Cleanup Copy And Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed Cleanup を「購読の整理 / Review Subscriptions」という位置づけに寄せ、一覧と詳細の copy / metadata 表示を理由つきで理解しやすい形へ更新する。

**Architecture:** i18n locale を source of truth として、sidebar・command palette・cleanup page・delete dialog の terminology を一括で揃える。UI 実装は `FeedCleanupPageView` の metadata row と review panel の順序・ラベルだけを最小変更し、candidate selection や action logic には触れない。

**Tech Stack:** React 19, TypeScript, react-i18next, Vitest, Testing Library

---

## Task 1: Red tests for renamed navigation and page positioning

**Files:**

- Modify: `src/__tests__/lib/ja-locales.test.ts`
- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/components/command-palette.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: Rewrite the failing expectations for the new terminology**
  - Change the locale test to expect `購読の整理` instead of `フィード管理`
  - Update sidebar / command palette / article-view expectations from `Feed Cleanup` to `Review Subscriptions`
  - Keep assertions narrow: only names that should change as part of this copy pass

- [ ] **Step 2: Run the targeted tests and confirm they fail on old strings**

```bash
pnpm vitest run src/__tests__/lib/ja-locales.test.ts src/__tests__/components/sidebar.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: FAIL with assertions still finding `フィード管理` / `Feed Cleanup`

- [ ] **Step 3: Commit the red-test checkpoint if working task-by-task**

```bash
git add src/__tests__/lib/ja-locales.test.ts src/__tests__/components/sidebar.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "test(feed-cleanup): cover renamed navigation copy"
```

## Task 2: Red tests for cleanup-page copy and labeled metadata

**Files:**

- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Update the page-level expectations to the approved copy**
  - Expect `Review Subscriptions`, `Decision Details`, `Review List`, `Keep Subscribed`, `Snooze`, `Unsubscribe`
  - Replace `Why this feed is here` with the new reasons section wording
  - Replace recommendation text like `Strong cleanup candidate` with the new reason-first phrasing

- [ ] **Step 2: Add assertions for labeled metadata in the selected-candidate panel**
  - Assert the detail panel still shows `Folder`, `Latest article`, `Unread`, `Starred`
  - Add assertions that the queue row no longer relies on the old condensed text-only phrasing
  - Keep this focused on observable text, not implementation details or exact DOM nesting

- [ ] **Step 3: Run the cleanup-page test and confirm it fails**

```bash
pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx
```

Expected: FAIL because the existing copy still reflects the old terminology and summary text

- [ ] **Step 4: Commit the red-test checkpoint if working task-by-task**

```bash
git add src/__tests__/components/feed-cleanup-page.test.tsx
git commit -m "test(feed-cleanup): cover revised cleanup copy"
```

## Task 3: Implement the i18n copy updates

**Files:**

- Modify: `src/locales/ja/sidebar.json`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/ja/cleanup.json`
- Modify: `src/locales/en/cleanup.json`

- [ ] **Step 1: Update sidebar and page positioning copy**
  - `feed_cleanup` should become `購読の整理` / `Review Subscriptions`
  - `title`, `subtitle`, `queue`, `review`, action labels, filter labels, and recommendation labels should match the approved spec

- [ ] **Step 2: Update the cleanup recommendation strings consistently**
  - Keep `review_now`, `consider`, and `keep` semantically distinct
  - Make `summary_headline_*` and `candidate_summary_*` reason-first and natural in both languages
  - Update delete-dialog-adjacent labels like `delete_title`, `reasons`, and `delete`

- [ ] **Step 3: Re-run the navigation/locale tests**

```bash
pnpm vitest run src/__tests__/lib/ja-locales.test.ts src/__tests__/components/sidebar.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS for renamed entry-point copy, with cleanup-page tests still failing until the view is updated

- [ ] **Step 4: Commit the locale-only implementation**

```bash
git add src/locales/ja/sidebar.json src/locales/en/sidebar.json src/locales/ja/cleanup.json src/locales/en/cleanup.json
git commit -m "feat(feed-cleanup): refresh cleanup terminology"
```

## Task 4: Implement the feed-cleanup view copy and metadata presentation

**Files:**

- Modify: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`

- [ ] **Step 1: Update queue-row metadata to read as labeled facts**
  - Replace the condensed inline row (`folder · 0d · unread · starred`) with labeled values such as `Folder`, `Updated`, `Unread`, `Saved`
  - Keep the row compact and avoid introducing extra layout churn beyond what the spec requires
  - Hide repeated zero-signal fallback copy when it adds no value

- [ ] **Step 2: Update the review panel to match the approved information order**
  - Keep the order as recommendation -> reason -> facts -> reasons list -> actions
  - Ensure the recommendation headline and badge use the new i18n strings
  - Keep integrity-mode UI intact unless terminology changes are shared

- [ ] **Step 3: Update the destructive flow wording without changing behavior**
  - Delete dialog title/button text should reflect `購読解除` / `Unsubscribe`
  - Preserve the same open/confirm/cancel behavior and mutation wiring

- [ ] **Step 4: Run the cleanup-page test and make it pass**

```bash
pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx
```

Expected: PASS with updated labels, recommendation copy, and metadata presentation

- [ ] **Step 5: Commit the view implementation**

```bash
git add src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx src/components/feed-cleanup/feed-cleanup-page.tsx
git commit -m "feat(feed-cleanup): clarify review copy and metadata"
```

## Task 5: Final verification sweep

**Files:**

- Verify: `src/__tests__/lib/ja-locales.test.ts`
- Verify: `src/__tests__/components/sidebar.test.tsx`
- Verify: `src/__tests__/components/command-palette.test.tsx`
- Verify: `src/__tests__/components/article-view.test.tsx`
- Verify: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Run the targeted verification suite**

```bash
pnpm vitest run src/__tests__/lib/ja-locales.test.ts src/__tests__/components/sidebar.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the broader local quality gate if the targeted suite is green**

```bash
mise run check
```

Expected: PASS, or a failure unrelated to this task that should be called out explicitly before continuing

- [ ] **Step 3: Inspect the final diff for terminology consistency**
  - Confirm there is no leftover `Feed Cleanup` / `フィード管理` on the primary cleanup flow unless intentionally outside scope
  - Confirm `ja` / `en` remain aligned by intent, not necessarily literal phrasing

- [ ] **Step 4: Commit the final verification checkpoint if needed**

```bash
git add src/__tests__/lib/ja-locales.test.ts src/__tests__/components/sidebar.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx src/components/feed-cleanup/feed-cleanup-page.tsx src/locales/ja/sidebar.json src/locales/en/sidebar.json src/locales/ja/cleanup.json src/locales/en/cleanup.json
git commit -m "feat(feed-cleanup): refine cleanup copy and information design"
```

## Notes For Execution

- Keep this implementation scoped to copy and information presentation only; do not add bulk actions or priority-score UI in this pass
- `TODO.md` already tracks future work for bulk actions and priority display, so no additional TODO work is required during implementation
- If a queue-row markup change makes current assertions too brittle, prefer role/text-based test updates over `data-testid` additions unless there is no stable user-facing hook
