# macOS Native Menu Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: macOSネイティブメニューバーに5つのメニュー（View / Accounts / Subscriptions / Item / Share）を追加し、既存キーボードショートカットと統合する。

Architecture: Rust側で`menu.rs`モジュールにメニュー構築を分離。メニューイベントは単一の`"menu-action"` Tauriイベントでフロントに転送。フロント側では`actions.ts`に共通アクションロジックを抽出し、キーボードショートカットとメニューの両方から呼び出す。

Tech Stack: Tauri 2 Menu API (Rust), Zustand, React Query, tauri-plugin-clipboard-manager

Spec: `docs/superpowers/specs/2026-03-28-macos-native-menubar-design.md`

---

## Task 1: Rust — menu.rsモジュール作成（メニュー構築）

### Files

- Create: `src-tauri/src/menu.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: menu.rsを作成 — build()関数**

`src-tauri/src/menu.rs` を作成。7つのサブメニュー（App / Edit / View / Accounts / Subscriptions / Item / Share）を構築する`build()`関数を実装。

```rust
use tauri::{
    menu::{
        CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    },
    AppHandle, Wry,
};

pub fn build(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<Wry>> {
    // App submenu
    let app_submenu = SubmenuBuilder::new(app, "Ultra RSS Reader")
        .item(&PredefinedMenuItem::about(app, Some("About Ultra RSS Reader"), None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "Settings...").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit"))?)
        .build()?;

    // Edit submenu (standard)
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // View submenu
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("view-unread", "Unread").accelerator("CmdOrCtrl+1").build(app)?)
        .item(&MenuItemBuilder::with_id("view-all", "All").accelerator("CmdOrCtrl+2").build(app)?)
        .item(&MenuItemBuilder::with_id("view-starred", "Starred").accelerator("CmdOrCtrl+3").build(app)?)
        .separator()
        .item(&CheckMenuItemBuilder::with_id("view-sort-unread", "Sort Unread to Top").build(app)?)
        .item(&CheckMenuItemBuilder::with_id("view-group-by-feed", "Group by Feed").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-fullscreen", "Full Screen").accelerator("Ctrl+CmdOrCtrl+F").build(app)?)
        .build()?;

    // Accounts submenu
    let accounts_submenu = SubmenuBuilder::new(app, "Accounts")
        .item(&MenuItemBuilder::with_id("accounts-sync", "Sync All").accelerator("CmdOrCtrl+R").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("accounts-show", "Show Accounts").build(app)?)
        .item(&MenuItemBuilder::with_id("accounts-add", "Add Account...").build(app)?)
        .build()?;

    // Subscriptions submenu
    let subs_submenu = SubmenuBuilder::new(app, "Subscriptions")
        .item(&MenuItemBuilder::with_id("subs-add", "Add Subscription...").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("subs-prev", "Previous Feed").build(app)?)
        .item(&MenuItemBuilder::with_id("subs-next", "Next Feed").build(app)?)
        .build()?;

    // Item submenu
    let item_submenu = SubmenuBuilder::new(app, "Item")
        .item(&MenuItemBuilder::with_id("item-prev", "Previous\tK").build(app)?)
        .item(&MenuItemBuilder::with_id("item-next", "Next\tJ").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("item-reader", "Open in Reader\tV").build(app)?)
        .item(&MenuItemBuilder::with_id("item-browser", "Open in Browser\tB").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("item-toggle-star", "Toggle Star\tS").build(app)?)
        .item(&MenuItemBuilder::with_id("item-toggle-read", "Mark as Read/Unread\tM").build(app)?)
        .item(&MenuItemBuilder::with_id("item-mark-all-read", "Mark All as Read\tA").build(app)?)
        .build()?;

    // Share submenu
    let mut share_builder = SubmenuBuilder::new(app, "Share")
        .item(&MenuItemBuilder::with_id("share-copy-link", "Copy Link").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("share-open-browser", "Open in Browser").build(app)?);

    if cfg!(target_os = "macos") {
        share_builder = share_builder
            .item(&MenuItemBuilder::with_id("share-reading-list", "Add to Reading List").build(app)?);
    }
    let share_submenu = share_builder.build()?;

    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&accounts_submenu)
        .item(&subs_submenu)
        .item(&item_submenu)
        .item(&share_submenu)
        .build()
}
```

- [ ] **Step 2: menu.rsにhandle_event()関数を追加**

```rust
use tauri::Emitter;

pub fn handle_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let action = match event.id().as_ref() {
        "view-unread" => "set-filter-unread",
        "view-all" => "set-filter-all",
        "view-starred" => "set-filter-starred",
        "view-sort-unread" => "toggle-sort-unread",
        "view-group-by-feed" => "toggle-group-by-feed",
        "view-fullscreen" => "toggle-fullscreen",
        "accounts-sync" => "sync-all",
        "accounts-show" => "open-settings-accounts",
        "accounts-add" => "open-settings-accounts",
        "subs-add" => "open-add-feed",
        "subs-prev" => "prev-feed",
        "subs-next" => "next-feed",
        "item-prev" => "prev-article",
        "item-next" => "next-article",
        "item-reader" => "open-in-reader",
        "item-browser" => "open-in-browser",
        "item-toggle-star" => "toggle-star",
        "item-toggle-read" => "toggle-read",
        "item-mark-all-read" => "mark-all-read",
        "share-copy-link" => "copy-link",
        "share-open-browser" => "open-in-default-browser",
        "share-reading-list" => "add-to-reading-list",
        "settings" => "open-settings",
        _ => return,
    };

    if let Err(e) = app.emit("menu-action", action) {
        tracing::error!("Failed to emit menu-action '{}': {}", action, e);
    }
}
```

- [ ] **Step 3: lib.rsを更新 — 既存メニューコードをmenu.rsに置換**

`src-tauri/src/lib.rs` を編集:

1. `mod menu;` を追加
2. 既存の`MenuItemBuilder`/`SubmenuBuilder`によるメニュー構築コード（app submenu + edit submenu）を削除
3. 既存の`.on_menu_event()`クロージャ（"settings" ID判定 + emit "open-settings"）を削除
4. `setup`フック内に以下を追加:

```rust
app.set_menu(menu::build(&app.handle().clone())?)?;
app.on_menu_event(move |app_handle, event| menu::handle_event(app_handle, event));
```

1. 不要になった`use`文を削除

- [ ] **Step 4: cargo checkでコンパイル確認**

Run: `rtk cargo check -p ultra-rss-reader-lib`
Expected: コンパイル成功（warning 0）

- [ ] **Step 5: コミット**

```bash
rtk git add src-tauri/src/menu.rs src-tauri/src/lib.rs
rtk git commit -m "feat: add menu.rs module with full macOS native menu bar"
```

---

## Task 2: Rust — 新規Tauriコマンド（clipboard + reading list）

### Files

- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs` (plugin登録 + command登録)
- Modify: `src-tauri/src/commands/` (新規コマンド追加先を既存パターンに合わせる)

- [ ] **Step 1: Cargo.tomlにclipboard plugin依存を追加**

`src-tauri/Cargo.toml` の `[dependencies]` セクションに追加:

```toml
tauri-plugin-clipboard-manager = "2"
```

- [ ] **Step 2: tauri.conf.jsonにclipboardプラグイン設定を追加**

`src-tauri/tauri.conf.json` の `"plugins": {}` を更新:

```json
"plugins": {
  "clipboard-manager": {}
}
```

- [ ] **Step 3: lib.rsにplugin登録を追加**

`src-tauri/src/lib.rs` の `tauri::Builder` チェーンに `.plugin(tauri_plugin_clipboard_manager::init())` を追加（`.plugin(tauri_plugin_opener::init())` の隣）。

- [ ] **Step 4: コマンド実装 — copy_to_clipboard**

既存のcommands/構造に合わせて、適切なファイルに追加。`feed_commands.rs`の`open_in_browser`の近くに配置するか、新ファイル`share_commands.rs`を作成:

```rust
#[tauri::command]
pub async fn copy_to_clipboard(
    app: tauri::AppHandle,
    text: String,
) -> Result<(), crate::commands::AppError> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(&text)
        .map_err(|e| crate::commands::AppError::UserVisible(format!("Clipboard error: {}", e)))?;
    Ok(())
}
```

- [ ] **Step 5: コマンド実装 — add_to_reading_list（macOSのみ）**

```rust
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn add_to_reading_list(url: String) -> Result<(), crate::commands::AppError> {
    let escaped_url = url.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"tell application "Safari" to add reading list item "{}""#,
        escaped_url
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| {
            crate::commands::AppError::UserVisible(format!("Failed to run osascript: {}", e))
        })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(crate::commands::AppError::UserVisible(format!(
            "Failed to add to Reading List: {}",
            stderr
        )));
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn add_to_reading_list(_url: String) -> Result<(), crate::commands::AppError> {
    Err(crate::commands::AppError::UserVisible(
        "Reading List is only available on macOS".into(),
    ))
}
```

- [ ] **Step 6: lib.rsのinvoke_handler!に新コマンドを登録**

`commands::copy_to_clipboard` と `commands::add_to_reading_list` を `invoke_handler!` マクロに追加。

- [ ] **Step 7: cargo checkでコンパイル確認**

Run: `rtk cargo check -p ultra-rss-reader-lib`
Expected: コンパイル成功

- [ ] **Step 8: コミット**

```bash
rtk git add src-tauri/
rtk git commit -m "feat: add copy_to_clipboard and add_to_reading_list commands"
```

---

## Task 3: フロント — UI状態の引き上げ（openSettings拡張 + AddFeedDialog）

### Files

- Modify: `src/stores/ui-store.ts`
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/reader/sidebar.tsx`

- [ ] **Step 1: ui-storeにsettingsInitialTab対応を追加**

`src/stores/ui-store.ts` を編集:

1. `openSettings` のシグネチャを `openSettings: (tab?: SettingsCategory) => void` に変更
2. 実装を更新:

```typescript
openSettings: (tab?: SettingsCategory) =>
  set({ settingsOpen: true, settingsCategory: tab ?? "general" }),
```

これで`openSettings("accounts")`のように呼べば、直接Accountsタブが開く。既存の`openSettings()`呼び出し（引数なし）は`"general"`にフォールバック。

- [ ] **Step 2: ui-storeにAddFeedDialog状態を追加**

`src/stores/ui-store.ts` を編集:

1. `UiState` interfaceに追加:

```typescript
isAddFeedDialogOpen: boolean;
```

1. `UiActions` interfaceに追加:

```typescript
openAddFeedDialog: () => void;
closeAddFeedDialog: () => void;
```

1. `initialState` に追加:

```typescript
isAddFeedDialogOpen: false,
```

1. 実装を追加:

```typescript
openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
```

- [ ] **Step 3: sidebar.tsxのAddFeedDialog状態をui-storeに移行**

`src/components/reader/sidebar.tsx` を編集:

1. `useState`の`showAddFeed`を削除
2. ui-storeから`isAddFeedDialogOpen`, `openAddFeedDialog`, `closeAddFeedDialog`を取得
3. `setShowAddFeed(true)` → `openAddFeedDialog()` に置換
4. `AddFeedDialog`の`open`/`onOpenChange`を更新:

```typescript
<AddFeedDialog
  open={isAddFeedDialogOpen}
  onOpenChange={(open) => open ? openAddFeedDialog() : closeAddFeedDialog()}
  accountId={selectedAccountId}
/>
```

- [ ] **Step 4: settings-modal.tsxのTauriイベントリスナーを更新**

`src/components/settings/settings-modal.tsx` を編集:

既存の `listen("open-settings", ...)` を `listen("menu-action", ...)` に変更:

```typescript
useEffect(() => {
  let cancelled = false;
  let unlisten: (() => void) | undefined;
  listen<string>("menu-action", (event) => {
    const action = event.payload;
    if (action === "open-settings") {
      openSettings();
    } else if (action === "open-settings-accounts") {
      openSettings("accounts");
    }
  })
    .then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    unlisten?.();
  };
}, [openSettings]);
```

- [ ] **Step 5: テスト実行**

Run: `rtk vitest run`
Expected: 全テスト成功

- [ ] **Step 6: コミット**

```bash
rtk git add src/stores/ui-store.ts src/components/settings/settings-modal.tsx src/components/reader/sidebar.tsx
rtk git commit -m "feat: lift AddFeedDialog state to ui-store, extend openSettings with tab param"
```

---

## Task 4: フロント — actions.ts共通アクションモジュール

### Files

- Create: `src/lib/actions.ts`
- Modify: `src/hooks/use-keyboard.ts`
- Create: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/__tests__/lib/actions.test.ts` を作成。`executeAction`が正しいstore操作を呼ぶかテスト:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ui-storeとpreferences-storeのモック
const mockSetViewMode = vi.fn();
const mockOpenSettings = vi.fn();
const mockOpenAddFeedDialog = vi.fn();

vi.mock("@/stores/ui-store", () => ({
  useUiStore: {
    getState: () => ({
      setViewMode: mockSetViewMode,
      openSettings: mockOpenSettings,
      openAddFeedDialog: mockOpenAddFeedDialog,
      selectedArticleId: "art-1",
    }),
  },
}));

vi.mock("@/api/tauri-commands", () => ({
  triggerSync: vi.fn(() => ({ pipe: vi.fn() })),
}));

describe("executeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("set-filter-unread calls setViewMode", async () => {
    const { executeAction } = await import("@/lib/actions");
    executeAction("set-filter-unread");
    expect(mockSetViewMode).toHaveBeenCalledWith("unread");
  });

  it("open-settings calls openSettings without tab", async () => {
    const { executeAction } = await import("@/lib/actions");
    executeAction("open-settings");
    expect(mockOpenSettings).toHaveBeenCalledWith();
  });

  it("open-settings-accounts calls openSettings with accounts", async () => {
    const { executeAction } = await import("@/lib/actions");
    executeAction("open-settings-accounts");
    expect(mockOpenSettings).toHaveBeenCalledWith("accounts");
  });

  it("open-add-feed calls openAddFeedDialog", async () => {
    const { executeAction } = await import("@/lib/actions");
    executeAction("open-add-feed");
    expect(mockOpenAddFeedDialog).toHaveBeenCalled();
  });

  it("unknown action is no-op", async () => {
    const { executeAction } = await import("@/lib/actions");
    expect(() => executeAction("unknown-action")).not.toThrow();
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `rtk vitest run src/__tests__/lib/actions.test.ts`
Expected: FAIL（`@/lib/actions` が存在しない）

- [ ] **Step 3: actions.tsを実装**

`src/lib/actions.ts` を作成:

```typescript
import { useUiStore } from "@/stores/ui-store";
import { triggerSync } from "@/api/tauri-commands";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function executeAction(action: string): void {
  const store = useUiStore.getState();

  switch (action) {
    case "set-filter-unread":
      store.setViewMode("unread");
      break;
    case "set-filter-all":
      store.setViewMode("all");
      break;
    case "set-filter-starred":
      store.setViewMode("starred");
      break;
    case "toggle-sort-unread":
    case "toggle-group-by-feed":
      // Preference toggle — handled via existing preference store
      break;
    case "toggle-fullscreen":
      void getCurrentWindow()
        .isFullscreen()
        .then((isFs) => {
          void getCurrentWindow().setFullscreen(!isFs);
        });
      break;
    case "sync-all":
      void triggerSync();
      break;
    case "open-settings":
      store.openSettings();
      break;
    case "open-settings-accounts":
      store.openSettings("accounts");
      break;
    case "open-add-feed":
      store.openAddFeedDialog();
      break;
    case "prev-article":
      store.navigateArticle?.(-1);
      break;
    case "next-article":
      store.navigateArticle?.(1);
      break;
    case "prev-feed":
      store.navigateFeed?.(-1);
      break;
    case "next-feed":
      store.navigateFeed?.(1);
      break;
    case "open-in-reader":
    case "open-in-browser":
    case "toggle-star":
    case "toggle-read":
    case "mark-all-read":
      // これらはキーボードショートカット経由の既存フローを使用
      // use-keyboard.tsのemitKeyboardEvent()で処理する
      emitMenuKeyboardAction(action);
      break;
    case "copy-link":
    case "open-in-default-browser":
    case "add-to-reading-list":
      // Share actions — 記事URLが必要
      handleShareAction(action, store);
      break;
  }
}

function emitMenuKeyboardAction(action: string): void {
  // menu-actionからキーボードイベントと同じパスに変換
  const store = useUiStore.getState();
  switch (action) {
    case "open-in-reader":
      store.emitKeyboardEvent?.("open-in-reader");
      break;
    case "open-in-browser":
      store.emitKeyboardEvent?.("open-in-browser");
      break;
    case "toggle-star":
      store.emitKeyboardEvent?.("toggle-star");
      break;
    case "toggle-read":
      store.emitKeyboardEvent?.("toggle-read");
      break;
    case "mark-all-read":
      store.emitKeyboardEvent?.("mark-all-read");
      break;
  }
}

function handleShareAction(
  action: string,
  store: ReturnType<typeof useUiStore.getState>,
): void {
  const articleId = store.selectedArticleId;
  if (!articleId) return;

  switch (action) {
    case "copy-link":
      // Will be connected to copy_to_clipboard command
      break;
    case "open-in-default-browser":
      // Will be connected to open_in_browser command
      break;
    case "add-to-reading-list":
      // Will be connected to add_to_reading_list command
      break;
  }
}
```

注: `navigateArticle`, `navigateFeed`, `emitKeyboardEvent` はTask 5以降で実装。ここではオプショナルチェーン(`?.`)で安全に呼び出す。Share actionsのTauriコマンド接続もTask 6で実装。

- [ ] **Step 4: テスト実行 — 成功確認**

Run: `rtk vitest run src/__tests__/lib/actions.test.ts`
Expected: PASS

- [ ] **Step 5: use-keyboard.tsのアクション実行をactions.tsに委譲**

`src/hooks/use-keyboard.ts` を編集:

switch文内の各caseで、`executeAction()`で処理できるもの（`set-view-mode`, `open-settings`等）は`executeAction()`に委譲する。ただし、`emit`タイプのアクション（記事操作系）は既存のemitパスを維持。

具体的には:

1. `import { executeAction } from "@/lib/actions";` を追加
2. `case "open-settings":` → `executeAction("open-settings")` に置換
3. `case "set-view-mode":` → `executeAction("set-filter-" + resolvedAction.mode)` に置換
4. `emit`タイプはそのまま維持

- [ ] **Step 6: テスト実行**

Run: `rtk vitest run`
Expected: 全テスト成功

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/actions.ts src/__tests__/lib/actions.test.ts src/hooks/use-keyboard.ts
rtk git commit -m "feat: create actions.ts shared action module, integrate with keyboard hook"
```

---

## Task 5: フロント — useMenuEventsフック + AppShell統合

### Files

- Create: `src/hooks/use-menu-events.ts`
- Modify: `src/components/reader/app-shell.tsx`
- Modify: `src/dev-mock-data.ts`

- [ ] **Step 1: use-menu-events.tsを作成**

`src/hooks/use-menu-events.ts` を作成:

```typescript
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { executeAction } from "@/lib/actions";

export function useMenuEvents(): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<string>("menu-action", (event) => {
      executeAction(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // Non-Tauri context (browser dev mode) — no-op
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
```

- [ ] **Step 2: app-shell.tsxにuseMenuEventsを追加**

`src/components/reader/app-shell.tsx` を編集:

1. `import { useMenuEvents } from "@/hooks/use-menu-events";` を追加
2. コンポーネント内に `useMenuEvents();` を追加（`useKeyboard()`の隣）

- [ ] **Step 3: settings-modal.tsxの重複リスナーを整理**

Task 3 Step 4で`settings-modal.tsx`に追加した`"menu-action"`リスナーを削除。`useMenuEvents`が全メニューアクションを一元処理し、`executeAction("open-settings")`/`executeAction("open-settings-accounts")`が`store.openSettings()`を呼ぶため、settings-modal側のリスナーは不要になる。

注: settings-modalが`settingsOpen`の変更を検知してモーダルを開く既存パターンはそのまま動く。

- [ ] **Step 4: dev-mock-data.tsに新規コマンドのmockを追加**

`src/dev-mock-data.ts` の `setupDevMocks` 関数内（mock IPCハンドラ登録部分）に追加:

```typescript
// copy_to_clipboard mock
mockIPC("copy_to_clipboard", async () => {});

// add_to_reading_list mock
mockIPC("add_to_reading_list", async () => {});
```

- [ ] **Step 5: テスト実行**

Run: `rtk vitest run`
Expected: 全テスト成功

- [ ] **Step 6: コミット**

```bash
rtk git add src/hooks/use-menu-events.ts src/components/reader/app-shell.tsx src/components/settings/settings-modal.tsx src/dev-mock-data.ts
rtk git commit -m "feat: add useMenuEvents hook, integrate with AppShell"
```

---

## Task 6: フロント — tauri-commands.ts + Share actions接続

### Files

- Modify: `src/api/tauri-commands.ts`
- Modify: `src/lib/actions.ts`

- [ ] **Step 1: tauri-commands.tsに新コマンドラッパーを追加**

`src/api/tauri-commands.ts` の末尾に追加:

```typescript
export const copyToClipboard = (text: string) =>
  safeInvoke<void>("copy_to_clipboard", { text });

export const addToReadingList = (url: string) =>
  safeInvoke<void>("add_to_reading_list", { url });
```

- [ ] **Step 2: actions.tsのShare actionsをTauriコマンドに接続**

`src/lib/actions.ts` の `handleShareAction` を更新:

```typescript
import {
  copyToClipboard,
  addToReadingList,
  openInBrowser,
} from "@/api/tauri-commands";

function handleShareAction(action: string): void {
  const store = useUiStore.getState();
  const articleUrl = store.selectedArticleUrl;
  if (!articleUrl) return;

  switch (action) {
    case "copy-link":
      void copyToClipboard(articleUrl).pipe(
        Result.tap(() => store.showToast?.("Link copied to clipboard")),
        Result.tapErr((e) => store.showToast?.(e.message)),
      );
      break;
    case "open-in-default-browser":
      void openInBrowser(articleUrl);
      break;
    case "add-to-reading-list":
      void addToReadingList(articleUrl).pipe(
        Result.tap(() => store.showToast?.("Added to Reading List")),
        Result.tapErr((e) => store.showToast?.(e.message)),
      );
      break;
  }
}
```

注: `selectedArticleUrl`は`ui-store`から取得する必要がある。現在のstoreに`selectedArticleUrl`がなければ、記事データからURLを解決するヘルパーを追加する。

- [ ] **Step 3: テスト実行**

Run: `rtk vitest run`
Expected: 全テスト成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/api/tauri-commands.ts src/lib/actions.ts
rtk git commit -m "feat: connect Share menu actions to Tauri clipboard and reading list commands"
```

---

## Task 7: フロント — フィード/記事ナビゲーション + 新キーボードショートカット

### Files

- Modify: `src/stores/ui-store.ts`
- Modify: `src/lib/actions.ts`
- Modify: `src/lib/keyboard-shortcuts.ts`
- Modify: `src/hooks/use-keyboard.ts`

- [ ] **Step 1: keyboard-shortcuts.tsにCtrl+J/K, Rを追加**

`src/lib/keyboard-shortcuts.ts` を編集:

新しいショートカットアクション定義を追加:

- `Ctrl+J` → `next-feed`
- `Ctrl+K` → `prev-feed`
- `R` → `reload-webview`

既存の`DEFAULT_SHORTCUTS`マップに追加。

- [ ] **Step 2: use-keyboard.tsで新ショートカットを処理**

`src/hooks/use-keyboard.ts` のswitch文に新しいcaseを追加:

- `prev-feed` / `next-feed` → `executeAction("prev-feed")` / `executeAction("next-feed")`
- `reload-webview` → WebView reload処理

- [ ] **Step 3: actions.tsにnavigateFeed/navigateArticle実装**

`src/lib/actions.ts` にナビゲーション関数を実装。React Queryのキャッシュからフィード/記事一覧を取得し、現在の選択位置から前後に移動:

```typescript
function navigateFeed(direction: number): void {
  const store = useUiStore.getState();
  // フィード一覧はサイドバーの表示順序に基づく
  // selectedFeedIdから前後を計算してsetSelectedFeedId()を呼ぶ
  // 実装はui-storeのfeed list状態に依存
}

function navigateArticle(direction: number): void {
  const store = useUiStore.getState();
  // 記事リストの表示順序に基づく
  // selectedArticleIdから前後を計算してsetSelectedArticleId()を呼ぶ
}
```

注: 具体的な実装はui-storeとReact Queryキャッシュの構造に依存するため、既存のj/kキー処理パターンを参考にする。

- [ ] **Step 4: テスト実行**

Run: `rtk vitest run`
Expected: 全テスト成功

- [ ] **Step 5: コミット**

```bash
rtk git add src/stores/ui-store.ts src/lib/actions.ts src/lib/keyboard-shortcuts.ts src/hooks/use-keyboard.ts
rtk git commit -m "feat: add feed/article navigation, Ctrl+J/K shortcuts, R for reload"
```

---

## Task 8: 品質チェック + 最終検証

Files: All modified files

- [ ] **Step 1: フォーマット**

Run: `mise run format`
Expected: フォーマット適用済み

- [ ] **Step 2: lint**

Run: `mise run lint`
Expected: エラー 0件

- [ ] **Step 3: テスト**

Run: `mise run test`
Expected: 全テスト成功

- [ ] **Step 4: Rustビルド確認**

Run: `rtk cargo build -p ultra-rss-reader-lib`
Expected: ビルド成功（warning 0）

- [ ] **Step 5: 最終コミット（必要に応じて）**

フォーマット/lint修正があれば:

```bash
rtk git add -A
rtk git commit -m "chore: format and lint fixes"
```
