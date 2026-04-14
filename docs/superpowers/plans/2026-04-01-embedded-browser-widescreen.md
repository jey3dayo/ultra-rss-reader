# Embedded Browser Widescreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `wide + widescreen` で購読 sidebar を外した 2 ペインを復元し、右ペインを `reader` と埋め込み `webview` で切り替えられるようにする

Architecture: React 側は `displayMode` を layout の source of truth にし、右ペインの中身だけを `contentMode` で `reader/browser` 切り替えする。Tauri 側は `WebviewWindow` をやめて main window の child `Webview` を管理し、pane の DOM rect を受け取って生成・再配置する。

Tech Stack: React, Zustand, TanStack Query hooks, Zod, Vitest, Tauri 2 (`unstable` multiwebview), Rust commands

Spec: `docs/superpowers/specs/2026-04-01-embedded-browser-widescreen-design.md`

---

## File Map

- `src/hooks/use-layout.ts`
  - `wide` 時の pane 配列を `displayMode` ベースで返す
- `src/components/app-layout.tsx`
  - selected feed / default preference から実効 `displayMode` を計算して layout に渡す
- `src/components/reader/article-view.tsx`
  - 右ペインの共通 toolbar と `reader/browser` の分岐を持つ
- `src/components/reader/article-toolbar-view.tsx`
  - 既読 / スターと並ぶ browser toggle を描画する
- `src/components/reader/browser-view.tsx`
  - 埋め込み browser の URL 同期、bounds 同期、fallback を担当する
- `src/lib/browser-webview.ts`
  - DOM rect を Tauri command 用 bounds に変換する小さな helper
- `src/api/schemas/commands.ts`
  - browser webview bounds 付き command schema を定義する
- `src/api/tauri-commands.ts`
  - `create_or_update_browser_webview(url, bounds)` と `set_browser_webview_bounds(bounds)` を expose する
- `src/dev-mocks.ts`
  - embedded browser mock state と bounds command の応答を持つ
- `src/locales/en/reader.json`
  - embedded browser fallback / loading 文言を英語で持つ
- `src/locales/ja/reader.json`
  - embedded browser fallback / loading 文言を日本語で持つ
- `src-tauri/src/browser_webview.rs`
  - child webview lookup、tracker、event emission、navigation helper を持つ
- `src-tauri/src/commands/browser_webview_commands.rs`
  - child webview の create / update / resize / close / navigation command を持つ
- `src-tauri/src/lib.rs`
  - 新しい browser bounds command を `invoke_handler` に登録する
- `src-tauri/capabilities/default.json`
  - capability を main app webview のみに絞る
- `src/__tests__/hooks/use-layout.test.ts`
  - widescreen 2 ペイン判定を検証する
- `src/__tests__/components/article-toolbar-view.test.tsx`
  - browser toggle の pressed / disabled 表示を検証する
- `src/__tests__/components/article-view.test.tsx`
  - browser toggle が `contentMode` と `browserUrl` を切り替えることを検証する
- `src/__tests__/components/browser-view.test.tsx`
  - embedded browser command、bounds update、fallback を検証する
- `src/__tests__/lib/browser-webview.test.ts`
  - bounds helper の丸め・ゼロサイズ防止を検証する

### Task 1: widescreen の 2 ペイン layout を復元する

### Task 1 Files

- Modify: `src/hooks/use-layout.ts`
- Modify: `src/components/app-layout.tsx`
- Test: `src/__tests__/hooks/use-layout.test.ts`

- [ ] **Step 1: `resolveLayout` の failing test を追加**

`src/__tests__/hooks/use-layout.test.ts` の `resolveLayout` セクションへ以下を追加:

```ts
it("wide+normal: keeps the 3-pane reader layout", () => {
  expect(resolveLayout("wide", "sidebar", "normal")).toEqual(["sidebar", "list", "content"]);
});

it("wide+widescreen: hides the subscription sidebar", () => {
  expect(resolveLayout("wide", "sidebar", "widescreen")).toEqual(["list", "content"]);
});
```

既存の `wide+browser` テストは削除し、`contentMode` ではなく `displayMode` が layout を決める前提へ差し替える。

- [ ] **Step 2: 追加した test を実行して失敗を確認**

Run: `rtk vitest run src/__tests__/hooks/use-layout.test.ts`

Expected: `wide+widescreen` が FAIL し、`resolveLayout()` がまだ常に `["sidebar", "list", "content"]` を返していると分かる

- [ ] **Step 3: `displayMode` を layout の入力に切り替える**

`src/hooks/use-layout.ts` の `resolveLayout()` を以下の形へ更新:

```ts
export function resolveLayout(
  layoutMode: ResponsiveLayoutMode,
  focusedPane: FocusedPane,
  displayMode: "normal" | "widescreen",
): Pane[] {
  if (layoutMode === "wide") {
    return displayMode === "widescreen" ? ["list", "content"] : ["sidebar", "list", "content"];
  }
  if (layoutMode === "compact") {
    return focusedPane === "content" ? ["list", "content"] : ["sidebar", "list"];
  }
  return [focusedPane];
}
```

`src/components/app-layout.tsx` では、selected feed があるときだけ feed 単位 `display_mode` を使い、それ以外は settings の `reader_view` を使う:

```tsx
const selection = useUiStore((s) => s.selection);
const selectedAccountId = useUiStore((s) => s.selectedAccountId);
const readerViewPref = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "reader_view"));
const { data: feeds } = useFeeds(selectedAccountId);

const selectedFeedDisplayMode =
  selection.type === "feed" ? feeds?.find((feed) => feed.id === selection.feedId)?.display_mode : undefined;

const effectiveDisplayMode = resolveEffectiveDisplayMode(selectedFeedDisplayMode, readerViewPref);
const panes = resolveLayout(layoutMode, focusedPane, effectiveDisplayMode);
```

これで「設定画面の default display mode」「sidebar の feed selection」「header の display mode update」が同じ `effectiveDisplayMode` に集約される。

- [ ] **Step 4: targeted test を再実行して通す**

Run: `rtk vitest run src/__tests__/hooks/use-layout.test.ts`

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/use-layout.ts src/components/app-layout.tsx src/__tests__/hooks/use-layout.test.ts
git commit -m "feat: restore widescreen two-pane layout"
```

---

### Task 2: article pane を shared toolbar + reader/browser 分岐へ整理する

### Task 2 Files

- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/components/reader/article-toolbar-view.tsx`
- Test: `src/__tests__/components/article-toolbar-view.test.tsx`
- Test: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: browser toggle の failing test を追加**

`src/__tests__/components/article-toolbar-view.test.tsx` に pressed state の test を追加:

```tsx
it("renders the browser button as a pressed toggle when browser mode is active", () => {
  render(
    <ArticleToolbarView
      showCloseButton={false}
      canToggleRead
      canToggleStar
      isRead={false}
      isStarred={false}
      isBrowserOpen
      showCopyLinkButton={false}
      canCopyLink={false}
      showOpenInBrowserButton
      canOpenInBrowser
      showOpenInExternalBrowserButton={false}
      canOpenInExternalBrowser={false}
      labels={labels}
      onCloseView={() => {}}
      onToggleRead={() => {}}
      onToggleStar={() => {}}
      onCopyLink={() => {}}
      onOpenInBrowser={() => {}}
      onOpenInExternalBrowser={() => {}}
    />,
  );

  expect(screen.getByRole("button", { name: "View in browser" })).toHaveAttribute("aria-pressed", "true");
});
```

`src/__tests__/components/article-view.test.tsx` では既存の「browser button opens the external browser」系 test を差し替え、以下を追加:

```tsx
it("toggles embedded browser mode from the article toolbar", async () => {
  const user = userEvent.setup();
  render(<ArticleView />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: "View in browser" }));

  expect(useUiStore.getState().contentMode).toBe("browser");
  expect(useUiStore.getState().browserUrl).toBe("https://example.com/article");
});
```

- [ ] **Step 2: test を実行して失敗を確認**

Run: `rtk vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx`

Expected: FAIL。現状は browser button が external browser を開き、`contentMode` が `browser` へ遷移しない

- [ ] **Step 3: `ArticleView` を共通 toolbar + mode switch に組み替える**

`src/components/reader/article-view.tsx` を以下の責務分担にする:

```tsx
function ArticlePane({ article, feedName }: { article: ArticleDto; feedName?: string }) {
  const contentMode = useUiStore((s) => s.contentMode);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const isBrowserOpen = contentMode === "browser";

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar
        article={article}
        isBrowserOpen={isBrowserOpen}
        onToggleBrowser={() => {
          if (!article.url) return;
          if (isBrowserOpen) {
            closeBrowser();
            return;
          }
          openBrowser(article.url);
        }}
      />
      {isBrowserOpen ? <BrowserView article={article} /> : <ArticleReader article={article} feedName={feedName} />}
    </div>
  );
}
```

`src/components/reader/article-toolbar-view.tsx` では既存の `IconToolbarToggle` をそのまま活かし、browser toggle は unread / star と同列に残す。icon は今は `Globe` のままにし、後で差し替えやすいよう button API は変えない。

`ArticleToolbar` の label は `view_in_browser` を使い、`onOpenInBrowser()` は external browser ではなく `openBrowser()/closeBrowser()` を呼ぶ。`onOpenInExternalBrowser()` だけが `openInBrowser(url, bg)` を持つよう整理する。

- [ ] **Step 4: component test を再実行して通す**

Run: `rtk vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx`

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/reader/article-view.tsx src/components/reader/article-toolbar-view.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "feat: toggle embedded browser from article toolbar"
```

---

### Task 3: embedded browser の bounds 同期と frontend command を実装する

### Task 3 Files

- Create: `src/lib/browser-webview.ts`
- Modify: `src/components/reader/browser-view.tsx`
- Modify: `src/api/schemas/commands.ts`
- Modify: `src/api/tauri-commands.ts`
- Modify: `src/dev-mocks.ts`
- Test: `src/__tests__/components/browser-view.test.tsx`
- Test: `src/__tests__/lib/browser-webview.test.ts`

- [ ] **Step 1: bounds helper と browser command の failing test を追加**

`src/__tests__/lib/browser-webview.test.ts` を新規作成し、最小限の helper test を入れる:

```ts
import { describe, expect, it } from "vitest";
import { toBrowserWebviewBounds } from "@/lib/browser-webview";

describe("toBrowserWebviewBounds", () => {
  it("rounds DOMRect values into integer bounds", () => {
    expect(
      toBrowserWebviewBounds({
        left: 12.4,
        top: 48.6,
        width: 799.7,
        height: 640.2,
      } as DOMRect),
    ).toEqual({ x: 12, y: 49, width: 800, height: 640 });
  });

  it("returns null for zero-sized hosts", () => {
    expect(
      toBrowserWebviewBounds({ left: 0, top: 0, width: 0, height: 480 } as DOMRect),
    ).toBeNull();
  });
});
```

`src/__tests__/components/browser-view.test.tsx` の dedicated window 前提 test を埋め込み前提へ更新し、少なくとも以下を追加:

```tsx
it("creates the embedded browser webview with host bounds", async () => {
  mockHostRect({ left: 380, top: 48, width: 900, height: 720 });

  render(<BrowserViewHarness />, { wrapper: createWrapper() });

  await waitFor(() => {
    expect(commands).toContainEqual({
      cmd: "create_or_update_browser_webview",
      args: {
        url: "https://example.com/article",
        bounds: { x: 380, y: 48, width: 900, height: 720 },
      },
    });
  });
});
```

- [ ] **Step 2: failing test を実行**

Run: `rtk vitest run src/__tests__/lib/browser-webview.test.ts src/__tests__/components/browser-view.test.tsx`

Expected: FAIL。現状は bounds helper がなく、`create_or_update_browser_webview` も `url` しか受け取らない

- [ ] **Step 3: browser bounds DTO と `BrowserView` の host sync を実装**

`src/api/schemas/commands.ts` に以下を追加:

```ts
export const browserWebviewBoundsArgs = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const createOrUpdateBrowserWebviewArgs = z.object({
  url: z.string(),
  bounds: browserWebviewBoundsArgs,
});

export const setBrowserWebviewBoundsArgs = z.object({
  bounds: browserWebviewBoundsArgs,
});
```

`src/api/tauri-commands.ts` では:

```ts
export const createOrUpdateBrowserWebview = (url: string, bounds: BrowserWebviewBounds) =>
  safeInvoke("create_or_update_browser_webview", { response: BrowserWebviewStateSchema, args: createOrUpdateBrowserWebviewArgs }, { url, bounds });

export const setBrowserWebviewBounds = (bounds: BrowserWebviewBounds) =>
  safeInvoke("set_browser_webview_bounds", { response: z.null(), args: setBrowserWebviewBoundsArgs }, { bounds });
```

`src/lib/browser-webview.ts` は小さく保つ:

```ts
export type BrowserWebviewBounds = { x: number; y: number; width: number; height: number };

export function toBrowserWebviewBounds(rect: DOMRect): BrowserWebviewBounds | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
```

`src/components/reader/browser-view.tsx` は browser host `<div>` を描画し、`ResizeObserver` で bounds を同期する:

```tsx
const hostRef = useRef<HTMLDivElement | null>(null);

useLayoutEffect(() => {
  if (!browserUrl || !hostRef.current) return;

  const syncBounds = (mode: "create" | "resize") => {
    const rect = hostRef.current?.getBoundingClientRect();
    const bounds = rect ? toBrowserWebviewBounds(rect) : null;
    if (!bounds) return;

    if (mode === "create") {
      void createOrUpdateBrowserWebview(browserUrl, bounds);
      return;
    }

    void setBrowserWebviewBounds(bounds);
  };

  syncBounds("create");
  const observer = new ResizeObserver(() => syncBounds("resize"));
  const handleResize = () => syncBounds("resize");
  observer.observe(hostRef.current);
  window.addEventListener("resize", handleResize);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", handleResize);
  };
}, [browserUrl]);
```

`src/dev-mocks.ts` では `create_or_update_browser_webview` が `{ url, can_go_back, can_go_forward, is_loading }` を返し、`set_browser_webview_bounds` は `null` を返す mock を追加する。

- [ ] **Step 4: updated test を再実行して通す**

Run: `rtk vitest run src/__tests__/lib/browser-webview.test.ts src/__tests__/components/browser-view.test.tsx`

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/browser-webview.ts src/components/reader/browser-view.tsx src/api/schemas/commands.ts src/api/tauri-commands.ts src/dev-mocks.ts src/__tests__/components/browser-view.test.tsx src/__tests__/lib/browser-webview.test.ts
git commit -m "feat: sync embedded browser bounds from the content pane"
```

---

### Task 4: Tauri backend を child webview ベースへ置き換える

### Task 4 Files

- Modify: `src-tauri/src/browser_webview.rs`
- Modify: `src-tauri/src/commands/browser_webview_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Rust の failing test を追加**

`src-tauri/src/commands/browser_webview_commands.rs` の `#[cfg(test)]` へ、少なくとも以下 2 系統を追加:

```rust
#[test]
fn external_url_rejects_file_scheme() {
    let result = external_url("file:///tmp/article.html");
    assert!(result.is_err());
}

#[test]
fn logical_bounds_reject_zero_size() {
    let result = BrowserWebviewBounds {
        x: 0.0,
        y: 0.0,
        width: 0.0,
        height: 400.0,
    }
    .validate();
    assert!(result.is_err());
}
```

browser state tracker の既存 test は残し、`WebviewWindow` 前提の helper test は child webview 前提に更新する。

- [ ] **Step 2: Rust test を実行して失敗を確認**

Run: `cargo test --lib browser_webview_commands`

Expected: FAIL。`BrowserWebviewBounds` や `set_browser_webview_bounds` がまだ存在しない

- [ ] **Step 3: `WebviewWindowBuilder` を child `Webview` に置き換える**

`src-tauri/src/browser_webview.rs` では dedicated window helper を child webview helper に切り替える:

```rust
pub const BROWSER_WEBVIEW_LABEL: &str = "embedded-browser";

pub fn browser_webview(app_handle: &tauri::AppHandle) -> Option<tauri::Webview> {
    app_handle.get_webview(BROWSER_WEBVIEW_LABEL)
}
```

`src-tauri/src/commands/browser_webview_commands.rs` では `create_browser_window()` / `show_browser_window()` / `focus_browser_window()` を削除し、`Window::add_child()` ベースに置き換える:

```rust
#[tauri::command]
pub fn create_or_update_browser_webview(
    window: Window,
    state: State<'_, AppState>,
    url: String,
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewState, AppError> {
    let url = external_url(&url)?;
    let webview = if let Some(existing) = browser_webview(window.app_handle()) {
        existing.set_bounds(bounds.to_logical_rect())?;
        existing.navigate(url.clone())?;
        existing
    } else {
        window.add_child(
            tauri::webview::WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(url.clone())),
            bounds.to_logical_position(),
            bounds.to_logical_size(),
        )?
    };

    tracker_start(state.inner(), window.app_handle(), url.to_string())?;
    Ok(current_or_loading_state(state.inner(), window.app_handle(), url.to_string())?)
}

#[tauri::command]
pub fn set_browser_webview_bounds(window: Window, bounds: BrowserWebviewBounds) -> Result<(), AppError> {
    let webview = browser_webview(window.app_handle())
        .ok_or_else(|| browser_webview_error("Browser webview is not open"))?;
    webview.set_bounds(bounds.to_logical_rect())?;
    Ok(())
}
```

`go_back_browser_webview`, `go_forward_browser_webview`, `reload_browser_webview`, `close_browser_webview` も `browser_window()` ではなく child `Webview` を使うように直す。timeout fallback は残すが、ログ・toast 用の wording は `browser window` から `embedded browser` へ更新する。

`src-tauri/src/lib.rs` に新 command を登録:

```rust
commands::browser_webview_commands::set_browser_webview_bounds,
```

- [ ] **Step 4: capability を main app webview 専用へ絞る**

`src-tauri/capabilities/default.json` を以下へ変更:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main app webview",
  "webviews": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "clipboard-manager:allow-write-text",
    "updater:default",
    "core:window:allow-set-badge-count",
    "core:window:allow-start-dragging"
  ]
}
```

embedded browser label には capability を与えない。これで child browser webview が app の IPC を引き継がない。

- [ ] **Step 5: Rust test を再実行して通す**

Run: `cargo test --lib browser_webview_commands`

Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src-tauri/src/browser_webview.rs src-tauri/src/commands/browser_webview_commands.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: embed browser webview inside the main window"
```

---

### Task 5: fallback copy・browser regressions・display mode 連携を仕上げる

### Task 5 Files

- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`
- Modify: `src/__tests__/components/browser-view.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: regression test を追加**

`src/__tests__/components/browser-view.test.tsx` に fallback copy の test を追加:

```tsx
it("falls back to the external browser and shows embedded-browser copy when creation fails", async () => {
  setupTauriMocks((cmd) => {
    if (cmd === "create_or_update_browser_webview") {
      throw { type: "UserVisible", message: "embedded browser unavailable" };
    }
    return null;
  });

  render(<BrowserViewHarness />, { wrapper: createWrapper() });

  await waitFor(() => {
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Opened in your external browser",
    });
  });
});
```

`src/__tests__/components/article-list.test.tsx` には、header の display mode control を `normal` に戻したとき browser mode が閉じる test を追加:

```tsx
it("closes embedded browser mode when the feed display mode is switched back to normal", async () => {
  useUiStore.setState({
    selectedArticleId: "art-1",
    contentMode: "browser",
    browserUrl: "https://example.com/article",
  });

  render(<ArticleList />, { wrapper: createWrapper() });
  await user.click(await screen.findByRole("button", { name: "3-Pane" }));

  expect(useUiStore.getState().contentMode).toBe("reader");
  expect(useUiStore.getState().browserUrl).toBeNull();
});
```

- [ ] **Step 2: regression test を実行して失敗を確認**

Run: `rtk vitest run src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: FAIL。文言がまだ dedicated window 前提、または display mode 切替後も browser state が残る

- [ ] **Step 3: locale と軽い UI glue を更新**

`src/locales/en/reader.json` の dedicated window 前提文言を embedded browser 前提へ変える:

```json
"browser_loading": "Loading",
"browser_embed_fallback": "Opened in your external browser",
"browser_embed_unavailable": "Embedded browser unavailable"
```

`src/locales/ja/reader.json` も対応させる:

```json
"browser_loading": "読込中",
"browser_embed_fallback": "外部ブラウザで開きました",
"browser_embed_unavailable": "アプリ内ブラウザを表示できませんでした"
```

`src/components/reader/browser-view.tsx` では `browser_window_fallback` を新キーへ差し替え、error log も `dedicated browser window` ではなく `embedded browser` に寄せる。

`src/components/reader/article-list.tsx` は既存の `normal` で `closeBrowser()` する分岐を残し、test が落ちる場合だけ condition を `nextDisplayMode === "normal"` 起点で明示的に直す。

- [ ] **Step 4: regression test を再実行して通す**

Run: `rtk vitest run src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/locales/en/reader.json src/locales/ja/reader.json src/__tests__/components/browser-view.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/article-list.test.tsx
git commit -m "test: cover embedded browser regressions"
```

---

### Task 6: format / lint / typecheck / app-level verification を通す

### Task 6 Files

- Modify: touched files only if verification reveals issues

- [ ] **Step 1: formatter を実行**

Run: `mise run format`

Expected: code style only changes, no errors

- [ ] **Step 2: lint / typecheck / test をまとめて実行**

Run: `mise run check`

Expected: PASS

- [ ] **Step 3: Rust command が main window child webview 前提で壊れていないか確認**

Run: `cargo test --lib browser_webview_commands`

Expected: PASS

- [ ] **Step 4: browser-mode mock で手動確認**

Run: `mise run dev`

Manual verification:

1. `wide` 幅で widescreen feed を選ぶ
2. 左端の購読 sidebar が消え、`articles + content` の 2 ペインになる
3. 右上の browser toggle を押す
4. 右ペイン内で browser toolbar と webview が出る
5. browser toggle をもう一度押す
6. 同じ記事の reader 表示へ戻る
7. display mode を `normal` に戻す
8. 購読 sidebar が戻り、browser mode が閉じる

- [ ] **Step 5: verification で出た修正をコミット**

```bash
git add -u
git commit -m "fix: polish embedded browser widescreen integration"
```
