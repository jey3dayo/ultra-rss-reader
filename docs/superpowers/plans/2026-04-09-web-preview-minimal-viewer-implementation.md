# Web Preview Minimal Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `Web Preview` を `Minimal Viewer` に置き換え、通常起動と `intent=open-web-preview-url` の両方で同じ immersive UI・同じ close 動作・同じ bounds 計算を使えるようにする。

Architecture: viewer shell の source of truth は React 側の full-app overlay とし、`BrowserView` が close chrome / scrim / host rect を管理する。`ArticleView` は記事起動と intent 起動を同じ shell へ流し、`AppLayout` は overlay portal の配置を `main-stage` 依存からアプリ全体に引き上げる。Rust/Tauri は既存の native webview create/update フローを維持し、受け取った host rect に一致させるだけに留める。

Tech Stack: React 19, TypeScript, Zustand, Vitest, Tauri 2 child webview, HWND screenshot verification

---

## File Map

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\app-layout.tsx`
  - browser overlay portal root を `main-stage` 内限定から app 全体へ持ち上げる
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
  - Minimal Viewer shell、scrim click close、minimal chrome、intent 共通 shell を実装する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\article-view.tsx`
  - 記事起動と intent 起動の viewer entry を共通化し、旧 context/title chrome を外す
- Optional Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\hooks\use-layout.ts`
  - 実装途中で wide layout 判定の責務整理が必要になった場合だけ最小変更する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`
  - viewer shell / minimal chrome / scrim close / HUD 条件を追加する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\article-view.test.tsx`
  - intent 起動と通常起動の shell 共通化を追加する
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\TODO.md`
  - 完了した right-gutter / viewer shell TODO を整理する

## Task 1: Lock In Viewer Behavior With Failing Tests

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\article-view.test.tsx`

- [ ] **Step 1: Add a browser-view test for minimal chrome**

Add a test that renders `BrowserView` and asserts:

```tsx
expect(screen.queryByText(/webプレビュー|web preview/i)).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /open in external browser/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the new browser-view test and confirm it fails**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: FAIL because the current viewer still renders legacy chrome / layout expectations.

- [ ] **Step 3: Add a browser-view test for scrim click close**

Add a test that clicks the black overlay outside the webview host and expects `onCloseOverlay` to be called once, while clicking inside `browser-webview-host` does not close:

```tsx
fireEvent.pointerDown(screen.getByTestId("browser-overlay-scrim"));
expect(onCloseOverlay).toHaveBeenCalledTimes(1);

fireEvent.pointerDown(screen.getByTestId("browser-webview-host"));
expect(onCloseOverlay).not.toHaveBeenCalled();
```

- [ ] **Step 4: Run the focused browser-view test again**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx -t "scrim"
```

Expected: FAIL because scrim hit testing is not implemented yet.

- [ ] **Step 5: Add an article-view test for intent parity**

Add a test that simulates `contentMode === "browser"` with `browserUrl` and no `selectedArticleId`, then asserts the same viewer shell appears as when toggling browser from an article:

```tsx
expect(screen.getByTestId("browser-overlay-shell")).toBeInTheDocument();
expect(screen.queryByText(/webプレビュー|web preview/i)).not.toBeInTheDocument();
```

- [ ] **Step 6: Run the article-view test and confirm it fails**

Run:

```bash
pnpm vitest run src/__tests__/components/article-view.test.tsx -t "intent"
```

Expected: FAIL because browser-only entry and article entry still diverge.

- [ ] **Step 7: Commit the red tests after implementation is complete, not now**

Do not commit in a red state. Keep this task uncommitted until implementation passes.

## Task 2: Move The Overlay Root To The Full App Surface

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\app-layout.tsx`

- [ ] **Step 1: Add a single full-app overlay portal root**

Refactor `AppLayout` so the browser overlay root is attached above the entire app shell instead of only inside `main-stage`.

Target structure:

```tsx
<div className="relative flex h-full overflow-hidden">
  <div data-browser-overlay-root className="pointer-events-none absolute inset-0 z-40" />
  <Sidebar />
  <ArticleList />
  <ArticleView />
</div>
```

- [ ] **Step 2: Keep normal layout behavior unchanged when browser is closed**

Preserve:

- wide layout pane widths
- compact/mobile sliding layout
- feed cleanup view

Only the overlay root location should move in this task.

- [ ] **Step 3: Run the app-layout related tests**

Run:

```bash
pnpm vitest run src/__tests__/components/app-layout.test.tsx src/__tests__/app.test.tsx
```

Expected: PASS, or update assertions if the portal root position changed.

- [ ] **Step 4: Commit this isolated overlay-root refactor**

```bash
git add src/components/app-layout.tsx src/__tests__/components/app-layout.test.tsx src/__tests__/app.test.tsx
git commit -m "refactor(layout): lift browser overlay root to app shell"
```

## Task 3: Implement The Minimal Viewer Shell

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\browser-view.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\browser-view.test.tsx`

- [ ] **Step 1: Replace legacy context/title chrome with minimal chrome**

Remove:

- `BrowserPreviewContext`
- `WEBプレビュー` title label
- old top rail spacing assumptions tied to that context

Keep only:

- left `×`
- right `↗`
- optional HUD rail when debug setting is on

- [ ] **Step 2: Introduce a dedicated scrim hit area**

Add a dedicated element:

```tsx
<button
  type="button"
  data-testid="browser-overlay-scrim"
  className="absolute inset-0"
  onClick={handleCloseOverlay}
/>
```

Then place the interactive stage above it so clicks inside the host do not bubble into close.

- [ ] **Step 3: Expand the stage to a viewport-based inset**

Replace the old `main-stage`-anchored geometry with a simple viewer shell inset.

Target direction:

```tsx
const stageClass =
  "absolute left-5 right-5 top-4 bottom-3 rounded-[20px] overflow-hidden";
```

Use one shared shell for both `scope` values unless a compact/mobile exception is truly necessary.

- [ ] **Step 4: Keep HUD in the top rail only when debug is enabled**

Preserve diagnostics behavior, but ensure it does not reintroduce the removed title chrome.

- [ ] **Step 5: Run browser-view tests until green**

Run:

```bash
pnpm vitest run src/__tests__/components/browser-view.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit the minimal viewer shell**

```bash
git add src/components/reader/browser-view.tsx src/__tests__/components/browser-view.test.tsx
git commit -m "feat(reader): adopt minimal web preview viewer"
```

## Task 4: Unify Article Entry And Intent Entry

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\components\reader\article-view.tsx`
- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\src\__tests__\components\article-view.test.tsx`

- [ ] **Step 1: Simplify browser-only and article-driven rendering**

Ensure both of these render the same `BrowserView` shell:

- article toggle path
- `contentMode === "browser" && browserUrl && !selectedArticleId`

Minimize duplicate wrapper markup between `BrowserOnlyState` and `ArticlePane`.

- [ ] **Step 2: Keep close behavior consistent**

Closing from:

- `×`
- `Esc`
- scrim click

must return to the same previous UI state regardless of entry path.

- [ ] **Step 3: Verify focus return still works for article-driven open**

Keep the existing focus restoration behavior for the article-toolbar trigger when closing from an article context.

- [ ] **Step 4: Run article-view tests until green**

Run:

```bash
pnpm vitest run src/__tests__/components/article-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the unified entry flow**

```bash
git add src/components/reader/article-view.tsx src/__tests__/components/article-view.test.tsx
git commit -m "refactor(reader): unify web preview entry paths"
```

## Task 5: Regression Checks, Tauri Verification, And TODO Cleanup

### Files:

- Modify: `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\TODO.md`

- [ ] **Step 1: Run the local TypeScript and targeted UI test suite**

Run:

```bash
pnpm exec tsc --noEmit
pnpm vitest run src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/app-layout.test.tsx src/__tests__/app.test.tsx
```

Expected: PASS

- [ ] **Step 2: Relaunch Tauri dev with direct web preview intent**

Run:

```bash
$env:DEV_CREDENTIALS='1'
$env:VITE_DEV_INTENT='open-web-preview-url'
$env:VITE_DEV_WEB_URL='https://example.com'
pnpm tauri dev -c src-tauri/tauri.dev.conf.json
```

Expected: app boots directly into the same Minimal Viewer shell.

- [ ] **Step 3: Capture verification screenshots**

Use the HWND screenshot workflow and save under:

- `C:\Users\j138c\src\github.com\jey3dayo\ultra-rss-reader\tmp\screenshots\`

Capture:

- full window
- client area
- one screenshot proving right-side gutter is effectively gone

- [ ] **Step 4: Update TODO.md**

Mark complete or rewrite the pending right-gutter / close-balance items based on actual post-fix screenshots.

- [ ] **Step 5: Commit the verification and TODO cleanup**

```bash
git add TODO.md
git commit -m "docs(todo): refresh web preview follow-ups"
```

## Manual Review Checklist

- Viewer shows no `WEBプレビュー` title text
- Left `×` and right `↗` are the only default chrome
- Sidebar and article list are visually irrelevant during viewer mode
- Clicking outside the native webview closes immediately
- `intent=open-web-preview-url` and normal article open look identical
- HUD only appears when `設定 > デバッグ > レイアウト HUD を表示` is ON
- Right edge black gutter is no longer the dominant visual issue

## Notes For Execution

- Prefer minimal changes to Rust unless screenshots prove a real bounds mismatch remains after the full-app overlay migration.
- If `scope="content-pane"` and `scope="main-stage"` still diverge after refactor, collapse them into a shared immersive path first and add exceptions only when a test proves they are needed.
- Keep commits small and aligned to the task boundaries above.
- After the plan is executed, run one final screenshot comparison before claiming the gutter issue is fixed.
