# Web Preview Fullscreen Webview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `main-stage` の `Web Preview` を true fullscreen 化し、native child webview が app window の client area 全面に追従するようにする。

Architecture: fullscreen browser mode の source of truth は app-shell overlay 配下の fullscreen host rect とし、`BrowserView` がそこから native bounds を計測する。`resolveBrowserViewerGeometry()` は `main-stage` だけ full-bleed geometry を返し、diagnostics や floating chrome は surface を縮めない absolute overlay として分離する。Rust/Tauri 側は既存どおり受け取った rect をそのまま child webview に適用する。

Tech Stack: React 19, TypeScript, Zustand, Vitest, Tauri 2 child webview, PowerShell/manual app verification

---

## File Map

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\lib\browser-viewer-geometry.ts`
  - `main-stage` 用 geometry を full-bleed に変更し、chrome compact 化だけを残す
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\lib\browser-viewer-geometry.test.ts`
  - fullscreen geometry contract を固定する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
  - fullscreen host、rail 廃止、scrim click close 廃止、diagnostics overlay 分離を実装する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`
  - fullscreen shell / no-rail / no-scrim-close / diagnostics non-resize を検証する
- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src-tauri\src\commands\browser_webview_commands.rs`
  - comment や diagnostics wording を fullscreen host 前提に整える。挙動変更は不要

## Task 1: Lock In The Fullscreen Geometry Contract

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\lib\browser-viewer-geometry.test.ts`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\lib\browser-viewer-geometry.ts`

- [ ] **Step 1: Write the failing geometry expectations for wide screens**

Replace the existing inset-stage expectations with full-bleed assertions:

```ts
expect(geometry.stage.left).toBe(0);
expect(geometry.stage.top).toBe(0);
expect(geometry.stage.right).toBe(0);
expect(geometry.stage.bottom).toBe(0);
expect(geometry.stage.radius).toBe(0);
expect(geometry.chromeRail.visible).toBe(false);
```

- [ ] **Step 2: Write the failing geometry expectations for compact screens**

Keep compact chrome sizing, but assert that the surface still stays full-bleed:

```ts
expect(geometry.compact).toBe(true);
expect(geometry.stage.left).toBe(0);
expect(geometry.stage.top).toBe(0);
expect(geometry.chrome.close.left).toBe(12);
expect(geometry.chrome.action.right).toBe(12);
```

- [ ] **Step 3: Run the geometry test file to confirm red**

Run:

```bash
pnpm vitest run src/__tests__/lib/browser-viewer-geometry.test.ts
```

Expected: FAIL because the resolver still returns `16px/12px` inset stage values.

- [ ] **Step 4: Update `resolveMainStageGeometry()` with minimal implementation**

Refactor the function so `stage` is always full-bleed and diagnostics no longer reserve space:

```ts
stage: {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  radius: 0,
},
chromeRail: {
  visible: false,
  left: 0,
  right: 0,
  top: 0,
  height: 0,
  radius: 0,
},
```

- [ ] **Step 5: Re-run the geometry tests until green**

Run:

```bash
pnpm vitest run src/__tests__/lib/browser-viewer-geometry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the geometry contract**

```bash
git add src/lib/browser-viewer-geometry.ts src/__tests__/lib/browser-viewer-geometry.test.ts
git commit -m "refactor(reader): make browser viewer geometry full bleed"
```

## Task 2: Encode The New BrowserView Behavior In Red Tests

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`

- [ ] **Step 1: Replace the inset-stage expectation with fullscreen stage assertions**

Update the `main-stage geometry` test to assert:

```tsx
expect(stage).toHaveStyle({
  left: "0px",
  right: "0px",
  top: "0px",
  bottom: "0px",
  borderRadius: "0px",
});
```

- [ ] **Step 2: Add a failing test that diagnostics do not push the surface down**

Write a test with `debug_browser_hud: "true"` that asserts:

```tsx
expect(diagnostics).toHaveStyle({ top: "16px" });
expect(stage).toHaveStyle({ top: "0px" });
expect(screen.queryByTestId("browser-overlay-top-rail")).not.toBeInTheDocument();
```

- [ ] **Step 3: Add a failing test that scrim clicks no longer close in `main-stage`**

Convert the current scrim-close test into a `main-stage` no-close assertion:

```tsx
await userEvent.setup().click(screen.getByTestId("browser-overlay-scrim"));
expect(onCloseOverlay).toHaveBeenCalledTimes(0);
```

Keep the close button test separate so the close path is still covered.

- [ ] **Step 4: Add a failing test that fullscreen bounds are sent on first create**

Mock the host rect to cover the overlay root and assert:

```tsx
expect(commands).toContainEqual({
  cmd: "create_or_update_browser_webview",
  args: { url: "https://example.com/article", bounds: { x: 0, y: 0, width: 1400, height: 900 } },
});
```

- [ ] **Step 5: Run the browser-view tests and confirm red**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: FAIL on stage inset, rail visibility, scrim-close behavior, and fullscreen bounds expectations.

## Task 3: Implement The Fullscreen Browser Surface

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`

- [ ] **Step 1: Remove the stage styling that makes `main-stage` look like a floating panel**

For `scope === "main-stage"`, remove:

- border
- drop shadow
- rounded corners
- inset positioning assumptions

Target direction:

```tsx
const stageClass =
  scope === "main-stage"
    ? "absolute z-10 overflow-hidden bg-background"
    : "absolute z-10 overflow-hidden border border-white/6 bg-background shadow-[...]";
```

- [ ] **Step 2: Stop rendering the top rail for fullscreen mode**

Gate `geometry.chromeRail.visible` off for `main-stage` and remove the old rail expectation entirely.

- [ ] **Step 3: Make the scrim visual-only in fullscreen mode**

Keep the element for layering, but do not attach `onClick={handleCloseOverlay}` when `scope === "main-stage"`:

```tsx
onClick={scope === "main-stage" ? undefined : handleCloseOverlay}
```

- [ ] **Step 4: Keep diagnostics floating independently from the surface**

Ensure diagnostics are still rendered, but never affect `stage` or `host` geometry. `captureLayoutDiagnostics()` should continue to report `overlay`, `stage`, and `host`, but `stage.top` should stay `0`.

- [ ] **Step 5: Re-run the browser-view tests until green**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the fullscreen shell implementation**

```bash
git add src/components/reader/browser-view.tsx src/__tests__/components/browser-view.test.tsx
git commit -m "feat(reader): make web preview fullscreen in main stage"
```

## Task 4: Verify Native Bounds Sync And Preserve Existing Entry Flow

### Files:

- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src-tauri\src\commands\browser_webview_commands.rs`
- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\article-view.tsx`

- [ ] **Step 1: Review whether `ArticleView` needs code changes**

Confirm that fullscreen behavior is already inherited through `BrowserView` and that `Esc` / close-button focus restoration still passes existing tests. If no code change is needed, leave `article-view.tsx` untouched.

- [ ] **Step 2: Review whether Rust needs comment-only cleanup**

If the frontend refactor is sufficient, keep Rust unchanged. Only update comments if they still imply inset-stage behavior:

```rust
// Child webviews use the same logical coordinate space as the fullscreen host rect.
// Do not add native title bar or menu insets here.
```

- [ ] **Step 3: Run the focused regression suite**

Run:

```bash
pnpm vitest run src/__tests__/lib/browser-viewer-geometry.test.ts src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit any optional cleanup**

If files changed:

```bash
git add src/components/reader/article-view.tsx src-tauri/src/commands/browser_webview_commands.rs
git commit -m "chore(reader): align fullscreen browser view comments and flow"
```

If nothing changed, skip this commit.

## Task 5: Manual App Verification

### Files:

- No required source edits

- [ ] **Step 1: Launch the desktop app**

Run:

```powershell
mise run app:dev
```

Expected: app starts with the Tauri shell and the normal reader UI.

- [ ] **Step 2: Verify fullscreen browser mode in wide layout**

Manual checks:

- open an article and enter browser mode
- confirm the page fills the whole app window client area
- confirm there is no floating stage border/radius/shadow
- confirm left close and right external-browser buttons remain visible

- [ ] **Step 3: Verify diagnostics do not resize the surface**

Turn on `debug_browser_hud` and confirm:

- HUD appears
- webview surface remains full-bleed
- no top rail appears
- opening and resizing the window keeps host/native alignment

- [ ] **Step 4: Verify close semantics**

Manual checks:

- `Esc` closes fullscreen browser mode
- clicking the left close button closes fullscreen browser mode
- clicking the page background does **not** close the mode accidentally

- [ ] **Step 5: Commit only if a verification-driven code tweak was required**

If manual verification required an additional code fix, make that fix and commit it separately:

```bash
git add <touched-files>
git commit -m "fix(reader): polish fullscreen web preview interactions"
```

## Notes For Execution

- Do not reintroduce inset stage math to make the HUD or chrome “look nicer.” If a chrome element needs space, float it over the surface instead.
- Prefer preserving `content-pane` behavior. This plan only turns `main-stage` into true fullscreen.
- If a test currently relies on scrim close in `main-stage`, replace that expectation instead of trying to keep both behaviors alive.
- Rust changes are optional. A frontend-only implementation is acceptable if bounds diagnostics still show `host == native`.
