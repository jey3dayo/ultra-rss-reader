# Preview Eye Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the article toolbar `S/P` preset group with a single `Eye` preview toggle so article-local preview control matches the other icon toggles without changing the underlying display-resolution behavior.

**Architecture:** Reuse the existing article preview toggle path in `ArticleToolbarView` and `ArticleView` instead of inventing a second preview control. Collapse the current double-control setup by removing `DisplayModeToggleGroup`, repurposing the in-app preview toggle as the single eye-based control, and keeping the `standard` / `preview` resolution logic inside `article-display.ts` and `ArticleView`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Storybook, i18next

---

## File Map

- Modify: `src/__tests__/components/article-toolbar-view.test.tsx`
  Responsibility: lock the toolbar contract to a single preview toggle and verify the button order / labels / pressed styling.
- Modify: `src/__tests__/components/article-view.test.tsx`
  Responsibility: verify the integrated article toolbar exposes the new eye toggle semantics, opens/closes preview, and keeps fallback behavior intact.
- Modify: `src/components/reader/article-toolbar-view.tsx`
  Responsibility: remove the injected `displayModeControl` slot and render the article-local preview toggle inline with the other icon toggles.
- Modify: `src/components/reader/article-toolbar-view.stories.tsx`
  Responsibility: update Storybook fixtures to show the new single-toggle toolbar states.
- Modify: `src/components/reader/article-view.tsx`
  Responsibility: drive the single preview toggle from the existing temporary override flow and expose stateful labels for tooltip / `aria-label`.
- Delete: `src/components/reader/display-mode-toggle-group.tsx`
  Responsibility: remove the now-unused `S/P` toolbar control implementation.
- Modify: `src/locales/en/reader.json`
  Responsibility: add stateful preview-toggle copy and preserve existing external-browser wording.
- Modify: `src/locales/ja/reader.json`
  Responsibility: add the Japanese stateful preview-toggle copy and preserve existing external-browser wording.

### Task 1: Lock The New Toolbar Contract In Tests

**Files:**

- Modify: `src/__tests__/components/article-toolbar-view.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: Write the failing toolbar unit assertions for a single preview toggle**

```tsx
it("renders a single preview toggle without the legacy display-mode group", async () => {
  render(
    <ArticleToolbarView
      // existing toolbar props
      labels={{
        previewToggleOn: "Close Web Preview",
        previewToggleOff: "Open Web Preview",
      }}
    />,
  );

  expect(screen.getByRole("button", { name: "Open Web Preview" })).toBeInTheDocument();
  expect(screen.queryByText("S")).not.toBeInTheDocument();
  expect(screen.queryByText("P")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write the failing integration assertions in `ArticleView`**

```tsx
it("uses the single preview toggle to open and close the web preview", async () => {
  render(<ArticleView />, { wrapper: createWrapper() });

  const previewButton = await screen.findByRole("button", { name: "Open Web Preview" });
  await user.click(previewButton);
  await screen.findByRole("button", { name: "Close Web Preview" });
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail for the right reason**

Run:

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: FAIL because the toolbar still renders `DisplayModeToggleGroup`, the legacy labels still assume the old slot-based API, and the integration test still sees the old control structure.

- [ ] **Step 4: Update the existing expectations instead of adding duplicate coverage**

Adjust these existing checks while keeping their original behavior focus:

```tsx
expect(toolbarButtons).toEqual([
  "Close article",
  "Toggle read",
  "Toggle star",
  "Open Web Preview",
  "Copy link",
  "Open in External Browser",
]);
```

Add assertions that the new preview toggle keeps `aria-pressed`, tooltipable labels, and no longer coexists with a second `S/P` control.

- [ ] **Step 5: Re-run the same targeted tests and confirm they still fail only on missing implementation**

Run:

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: FAIL with assertion mismatches that point to the toolbar implementation still using the old `displayModeControl` path.

- [ ] **Step 6: Commit the test-first checkpoint**

```bash
git add src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "test: define single preview toggle behavior"
```

### Task 2: Replace The Toolbar UI With A Single Eye Toggle

**Files:**

- Modify: `src/components/reader/article-toolbar-view.tsx`
- Modify: `src/components/reader/article-view.tsx`
- Delete: `src/components/reader/display-mode-toggle-group.tsx`

- [ ] **Step 1: Remove the slot-based display-mode control from the toolbar API**

Refactor `ArticleToolbarViewProps` so the toolbar receives stateful preview-toggle labels directly instead of an injected `displayModeControl`.

```tsx
export type ArticleToolbarViewLabels = {
  closeView: string;
  toggleRead: string;
  toggleStar: string;
  previewToggleOn: string;
  previewToggleOff: string;
  copyLink: string;
  openInExternalBrowser: string;
};
```

- [ ] **Step 2: Swap the legacy preview toggle icon from `Globe` to `Eye`**

In `src/components/reader/article-toolbar-view.tsx`, render the existing preview toggle inline with the other icon toggles:

```tsx
<IconToolbarToggle
  label={isBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
  pressed={isBrowserOpen}
  onPressedChange={() => onOpenInBrowser()}
  disabled={!canOpenInBrowser}
  pressedTone="accent"
  focusTargetKey="open-in-browser"
>
  <Eye className="h-4 w-4" />
</IconToolbarToggle>
```

Delete the `displayModeControl` prop and all related render branches.

- [ ] **Step 3: Update `ArticleView` to provide the stateful labels through i18n**

Replace the `DisplayModeToggleGroup` usage with label selection driven by the existing preview state:

```tsx
labels={{
  closeView: t("close_view"),
  toggleRead: t("toggle_read"),
  toggleStar: t("toggle_star"),
  previewToggleOff: t("open_in_browser"),
  previewToggleOn: t("close_browser_overlay"),
  copyLink: t("copy_link"),
  openInExternalBrowser: t("open_in_external_browser"),
}}
```

Keep `handleToggleBrowserOverlay` and the temporary override logic as the only behavior source so the UI change does not alter display precedence.

- [ ] **Step 4: Remove the dead `DisplayModeToggleGroup` module and imports**

Delete the file and clean up these import sites:

```tsx
import { DisplayModeToggleGroup } from "./display-mode-toggle-group";
```

Targets:

- `src/components/reader/article-view.tsx`
- `src/components/reader/article-toolbar-view.stories.tsx`
- `src/__tests__/components/article-toolbar-view.test.tsx`

- [ ] **Step 5: Run the targeted tests and verify the new toolbar passes**

Run:

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS. The toolbar should expose a single eye-based preview toggle, and the article integration tests should still open/close the overlay correctly.

- [ ] **Step 6: Commit the toolbar implementation**

```bash
git add src/components/reader/article-toolbar-view.tsx src/components/reader/article-view.tsx src/components/reader/display-mode-toggle-group.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "feat: replace display preset group with preview toggle"
```

### Task 3: Update Copy, Stories, And Final Verification

**Files:**

- Modify: `src/components/reader/article-toolbar-view.stories.tsx`
- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`

- [ ] **Step 1: Add any missing locale strings needed by the single preview toggle**

Keep external-browser wording separate from preview wording. If `open_in_browser` and `close_browser_overlay` already match the desired copy, only normalize the story labels; otherwise add explicit preview-toggle keys and wire them in.

```json
{
  "open_in_browser": "Open Web Preview",
  "close_browser_overlay": "Close Web Preview"
}
```

```json
{
  "open_in_browser": "Webプレビューを開く",
  "close_browser_overlay": "Webプレビューを閉じる"
}
```

- [ ] **Step 2: Refresh Storybook stories to show the single preview toggle states**

Replace the legacy control fixture with direct toolbar args:

```tsx
export const Default: Story = {
  args: {
    isBrowserOpen: false,
  },
};

export const PreviewOpen: Story = {
  args: {
    isBrowserOpen: true,
  },
};
```

No story should import or render `DisplayModeToggleGroup`.

- [ ] **Step 3: Run story-adjacent and integration verification**

Run:

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
mise run check
```

Expected:

- Vitest: PASS for the touched toolbar/article suites
- `mise run check`: PASS for format, lint, and test across the repo

- [ ] **Step 4: Manually sanity-check the article toolbar in dev mode**

Run:

```bash
mise run app:dev
```

Verify:

- The toolbar shows one eye icon, not `S/P`
- Tooltip changes between open/close preview states
- Preview fallback warning still appears when the article cannot be embedded

- [ ] **Step 5: Commit the copy + story cleanup**

```bash
git add src/components/reader/article-toolbar-view.stories.tsx src/locales/en/reader.json src/locales/ja/reader.json
git commit -m "chore: align preview toggle copy and stories"
```
