# Web Preview Overlay Root Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `main-stage` の web preview で `overlay root` を唯一の geometry 正本にし、close/action chrome を保ったまま native child webview を左右いっぱいまで安定して配置する。

Architecture: `data-browser-overlay-root` を fullscreen viewer root として固定し、`main-stage` では `overlay root -> host rect -> native bounds` の一方向 contract に揃える。上部には最小の safe lane と極薄 top rail を置き、close/action はその lane に逃がす。`stage` と `host` は同じ surface contract を共有し、diagnostics は rect を変えない検証 overlay として扱う。

Tech Stack: React 19, TypeScript, Tailwind utilities, Zustand, Vitest, Tauri 2 child webview, PowerShell, Windows Tauri manual verification

---

## File Map

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\app-shell.tsx`
  - `data-browser-overlay-root` を fullscreen geometry root として維持し、必要な titlebar/positioning contract を固定する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\lib\browser-viewer-geometry.ts`
  - `main-stage` の safe lane, top rail, host rect contract を一元化する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
  - `stage === host` 契約、top rail、close icon、native bounds sync を実装する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\shared\icon-toolbar-control.tsx`
  - 共有側の変更が必要なら最小限だけ行う。不要なら触らない
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\app-shell.test.tsx`
  - overlay root が app shell full area の geometry root であることを固定する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\app-layout.test.tsx`
  - overlay root が `AppLayout` 内に戻っていないことを固定する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\lib\browser-viewer-geometry.test.ts`
  - safe lane と host rect の期待値を固定する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`
  - `host == native` 契約、close icon、rail、scrim 非閉鎖、full-width bounds を固定する
- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src-tauri\src\commands\browser_webview_commands.rs`
  - diagnostics/logging コメントだけ整理する。挙動変更は原則しない

## Task 1: Lock The Overlay Root Contract In Tests

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\app-shell.test.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\app-layout.test.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\app-shell.tsx`

- [ ] **Step 1: Write the failing shell-level expectation**

Assert that `data-browser-overlay-root` is a sibling overlay above `AppLayout`, not inside it, and fills the shell container.

```tsx
expect(overlayRoot).toBeInTheDocument();
expect(appLayout).not.toContainElement(overlayRoot);
expect(appLayout.parentElement).toContainElement(overlayRoot);
```

- [ ] **Step 2: Write the failing regression expectation in `app-layout.test.tsx`**

Add or adjust the test so `AppLayout` itself does not render `data-browser-overlay-root`.

```tsx
expect(container.querySelector("[data-browser-overlay-root]")).not.toBeInTheDocument();
```

- [ ] **Step 3: Run the focused shell/layout tests to confirm red if needed**

Run:

```bash
pnpm vitest run src/__tests__/components/app-shell.test.tsx src/__tests__/components/app-layout.test.tsx
```

Expected: PASS if the current dirty changes already satisfy the contract, otherwise FAIL and reveal what must still be fixed.

- [ ] **Step 4: Make the minimal `AppShell` implementation change**

Keep `data-browser-overlay-root` under the shell-level `relative min-h-0 flex-1` container and preserve titlebar helper classes there, not in `AppLayout`.

- [ ] **Step 5: Re-run the shell/layout tests**

Run:

```bash
pnpm vitest run src/__tests__/components/app-shell.test.tsx src/__tests__/components/app-layout.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the overlay-root contract**

```bash
git add src/components/app-shell.tsx src/__tests__/components/app-shell.test.tsx src/__tests__/components/app-layout.test.tsx
git commit -m "refactor(reader): anchor web preview overlay at app shell"
```

## Task 2: Encode The Main-Stage Geometry Contract In Red

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\lib\browser-viewer-geometry.ts`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\lib\browser-viewer-geometry.test.ts`

- [ ] **Step 1: Add a failing test for the safe lane**

Assert that `main-stage` keeps full-width geometry while reserving only the top safe lane.

```ts
expect(geometry.host.left).toBe(0);
expect(geometry.host.right).toBe(0);
expect(geometry.host.top).toBeGreaterThan(0);
expect(geometry.host.bottom).toBe(0);
```

- [ ] **Step 2: Add a failing test for the top rail**

Assert that the top rail is visible for `main-stage`, but only as a minimal lane and never reduces width.

```ts
expect(geometry.chromeRail.visible).toBe(true);
expect(geometry.chromeRail.left).toBe(0);
expect(geometry.chromeRail.right).toBe(0);
```

- [ ] **Step 3: Add a failing test for compact mode**

Keep compact button sizing, but assert that the host still uses full width.

```ts
expect(geometry.compact).toBe(true);
expect(geometry.host.left).toBe(0);
expect(geometry.host.right).toBe(0);
```

- [ ] **Step 4: Run the geometry tests to confirm red**

Run:

```bash
pnpm vitest run src/__tests__/lib/browser-viewer-geometry.test.ts
```

Expected: FAIL on rail visibility and/or host contract mismatches.

- [ ] **Step 5: Update `resolveMainStageGeometry()` minimally**

Make `main-stage` return:

```ts
stage: { left: 0, top: hostTopInset, right: 0, bottom: 0, radius: 0 }
host: { left: 0, top: hostTopInset, right: 0, bottom: 0 }
chromeRail: { visible: true, left: 0, right: 0, top: 0, height: hostTopInset, radius: 0 }
```

Choose the exact inset from button size + minimal outer padding. Do not let diagnostics change it.

- [ ] **Step 6: Re-run the geometry tests**

Run:

```bash
pnpm vitest run src/__tests__/lib/browser-viewer-geometry.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the geometry contract**

```bash
git add src/lib/browser-viewer-geometry.ts src/__tests__/lib/browser-viewer-geometry.test.ts
git commit -m "refactor(reader): define overlay-root browser geometry contract"
```

## Task 3: Make BrowserView Honor The Single Host Rect Contract

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`

- [ ] **Step 1: Write a failing test that `stage === host` for `main-stage`**

Using the test DOM rect resolver, assert the host surface begins at the safe lane bottom and reaches the overlay root width.

```tsx
expect(stage).toHaveStyle({ left: "0px", right: "0px" });
expect(host).toHaveStyle({ left: "0px", right: "0px" });
```

- [ ] **Step 2: Write a failing test that the create/update bounds match the host rect**

Assert that `create_or_update_browser_webview` and `set_browser_webview_bounds` receive the same full-width rect derived from the host.

```tsx
expect(commands[0]).toMatchObject({
  cmd: "create_or_update_browser_webview",
  args: { bounds: { x: 0, y: expectedTop, width: 1400, height: expectedHeight } },
});
```

- [ ] **Step 3: Write a failing test for the close icon and rail**

Assert that the top rail exists, the close button is present, and its content is no longer the literal `×` text node.

```tsx
expect(screen.getByLabelText("Close Web Preview")).toBeInTheDocument();
expect(screen.getByTestId("browser-overlay-top-rail")).toBeInTheDocument();
expect(screen.queryByText("×")).not.toBeInTheDocument();
```

- [ ] **Step 4: Write a failing test for scrim behavior**

Keep the fullscreen scrim visual-only.

```tsx
await user.click(screen.getByTestId("browser-overlay-scrim"));
expect(onCloseOverlay).not.toHaveBeenCalled();
```

- [ ] **Step 5: Run the browser-view test file to confirm red**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: FAIL on rail visibility, close icon rendering, and/or bounds expectations.

- [ ] **Step 6: Implement the minimal `BrowserView` changes**

Update `BrowserView` so that:

- `browser-overlay-top-rail` renders for `main-stage`
- `browser-overlay-stage` and `browser-webview-host` share the same rect contract
- `captureLayoutDiagnostics()` still measures overlay/stage/host, but diagnostics do not mutate geometry
- close remains a shared `IconToolbarButton`, but uses an SVG icon with fixed box metrics
- `scope === "main-stage"` keeps the scrim visual-only

- [ ] **Step 7: Re-run the browser-view tests**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit the BrowserView surface update**

```bash
git add src/components/reader/browser-view.tsx src/__tests__/components/browser-view.test.tsx
git commit -m "feat(reader): align web preview host and native geometry"
```

## Task 4: Verify The Native Tauri Boundary Without Changing Rust Semantics

### Files:

- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src-tauri\src\commands\browser_webview_commands.rs`

- [ ] **Step 1: Read the current Rust command comments and diagnostics wording**

Confirm that `child_webview_rect_from_viewport_bounds()` still matches the frontend contract and does not add titlebar/menu offsets.

- [ ] **Step 2: Add comment-only cleanup if needed**

If the wording still implies older inset-stage behavior, update only the explanatory comments.

```rust
// Child webviews use the same logical coordinate space as the overlay-root-derived host rect.
// Do not add native title bar or menu insets here.
```

- [ ] **Step 3: Run the focused regression suite**

Run:

```bash
pnpm vitest run src/__tests__/components/app-shell.test.tsx src/__tests__/components/app-layout.test.tsx src/__tests__/lib/browser-viewer-geometry.test.ts src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit only if Rust or related files changed**

```bash
git add src-tauri/src/commands/browser_webview_commands.rs
git commit -m "chore(reader): clarify browser webview geometry comments"
```

Skip this commit if there were no code changes.

## Task 5: Run The Checklist Loop In The Real App

### Files:

- No required source edits

- [ ] **Step 1: Start the desktop app**

Run:

```powershell
mise run app:dev
```

Expected: the Tauri shell opens successfully.

- [ ] **Step 2: Capture the first manual verification screenshot**

Open an article, enter browser mode, and save a screenshot under:

```text
C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\tmp\screenshots\
```

- [ ] **Step 3: Check the required checklist items**

Verify:

- `×ボタンがある`
- `左端から右端まで、webviewが設定されている`

If either item fails, stop and inspect `overlay / stage / host / native` before changing code.

- [ ] **Step 4: Run `codex-code-review` on the remaining diff**

Use the same local Codex review flow as previous turns and fix any material findings before claiming done.

- [ ] **Step 5: Run the `ui-ux-pro-max` review pass**

Check that:

- top rail is visible enough to establish ownership, but not loud
- close/action buttons are visually centered and balanced
- the surface reads as one immersive canvas

- [ ] **Step 6: If the checklist still fails, loop**

Repeat:

1. adjust geometry or chrome
2. run focused tests
3. relaunch or refresh Tauri
4. capture a new screenshot
5. re-check the checklist

Continue until all four checklist items pass.

- [ ] **Step 7: Commit only if the checklist loop required a final polish change**

```bash
git add <touched-files>
git commit -m "fix(reader): polish overlay-root web preview geometry"
```

## Notes For Execution

- Keep `main-stage` and `content-pane` behavior separate. Do not “simplify” by forcing the same geometry for both scopes.
- If manual verification shows `host` is full-width but the native child webview is still narrow, treat that as a `host -> native` sync bug, not a CSS bug.
- Prefer adding temporary diagnostics or logging before guessing at offsets.
- If Tauri behavior becomes unclear, use `tauri-webview-geometry` guidance first. If an API behavior is still uncertain, then consult Context7 or web search using primary sources only.
- Before each commit, prefer `mise run check` when the diff is stable. During the loop, focused `vitest` + `tsc` runs are enough to keep iteration fast.
