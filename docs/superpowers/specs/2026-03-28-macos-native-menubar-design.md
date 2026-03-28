# macOS Native Menu Bar Implementation Design

## Overview

Ultra RSS Readerに macOS ネイティブメニューバーを実装する。5つのメニュー（View / Accounts / Subscriptions / Item / Share）を追加し、既存のキーボードショートカットとの統合、設定画面への導線、外部ブラウザ連携を提供する。

## 設計方針

- ハイブリッドショートカット: ⌘付きショートカットはメニューアクセラレータ（Rust側）、単キー（j/k/m/s等）はフロント側で処理を維持
- メニュー状態: 常時有効 + no-op。動的な有効/無効制御は行わない
- アーキテクチャ: `menu.rs`モジュールに分離（ビルダーモジュール方式）
- イベント設計: 単一の`"menu-action"`イベントにアクション文字列をペイロードとして送信。シングルウィンドウアプリのため`emit_to()`によるウィンドウ指定は不要、`emit()`でブロードキャスト

## メニュー構成

### Ultra RSS Reader（アプリメニュー — 既存拡張）

| 項目                   | アクセラレータ | 動作               |
| ---------------------- | -------------- | ------------------ |
| About Ultra RSS Reader | —              | Aboutダイアログ    |
| Settings...            | ⌘,             | 設定モーダルを開く |
| ───                    |                |                    |
| Quit                   | ⌘Q             | アプリ終了         |

### Edit（既存維持）

| 項目       | アクセラレータ | 動作     |
| ---------- | -------------- | -------- |
| Undo       | ⌘Z             | 取り消し |
| Redo       | ⌘⇧Z            | やり直し |
| Cut        | ⌘X             | 切り取り |
| Copy       | ⌘C             | コピー   |
| Paste      | ⌘V             | 貼り付け |
| Select All | ⌘A             | 全選択   |

### View

| 項目               | アクセラレータ | 動作                |
| ------------------ | -------------- | ------------------- |
| Unread             | ⌘1             | フィルター: UNREAD  |
| All                | ⌘2             | フィルター: ALL     |
| Starred            | ⌘3             | フィルター: STARRED |
| ───                |                |                     |
| Sort Unread to Top | —              | 未読ソート切替      |
| Group by Feed      | —              | グループ化切替      |
| ───                |                |                     |
| Full Screen        | ⌃⌘F            | フルスクリーン切替  |

### Accounts

| 項目           | アクセラレータ | 動作                      |
| -------------- | -------------- | ------------------------- |
| Sync All       | ⌘R             | 全アカウント同期          |
| ───            |                |                           |
| Show Accounts  | —              | 設定 > Accountsタブを開く |
| Add Account... | —              | 設定 > Accountsタブを開く |

### Subscriptions

| 項目                | アクセラレータ | 動作                                   |
| ------------------- | -------------- | -------------------------------------- |
| Add Subscription... | —              | フィード追加ダイアログ                 |
| ───                 |                |                                        |
| Previous Feed       | —              | 前のフィードを選択（フロント: Ctrl+K） |
| Next Feed           | —              | 次のフィードを選択（フロント: Ctrl+J） |

### Item

| 項目                | 表示キー | 動作                   | 備考                                 |
| ------------------- | -------- | ---------------------- | ------------------------------------ |
| Previous            | K        | 前の記事               | アクセラレータ未登録（フロント処理） |
| Next                | J        | 次の記事               | アクセラレータ未登録（フロント処理） |
| ───                 |          |                        |                                      |
| Open in Reader      | V        | アプリ内ブラウザで開く | アクセラレータ未登録                 |
| Open in Browser     | B        | 外部ブラウザで開く     | アクセラレータ未登録                 |
| ───                 |          |                        |                                      |
| Toggle Star         | S        | スター切替             | アクセラレータ未登録                 |
| Mark as Read/Unread | M        | 既読/未読切替          | アクセラレータ未登録                 |
| Mark All as Read    | A        | 一括既読               | アクセラレータ未登録                 |

### Share

| 項目                | アクセラレータ | 動作                                   |
| ------------------- | -------------- | -------------------------------------- |
| Copy Link           | —              | 記事URLをクリップボードにコピー        |
| ───                 |                |                                        |
| Open in Browser     | —              | デフォルトブラウザで開く               |
| Add to Reading List | —              | Safari Reading Listに追加（macOSのみ） |

### フロント側キーボードショートカット（メニュー非連動）

| キー   | アクション       |
| ------ | ---------------- |
| J      | Next Article     |
| K      | Previous Article |
| Ctrl+J | Next Feed        |
| Ctrl+K | Previous Feed    |
| V      | Open in Reader   |
| B      | Open in Browser  |
| S      | Toggle Star      |
| M      | Toggle Read      |
| A      | Mark All Read    |
| F      | Cycle Filter     |
| /      | Search           |
| R      | Reload (WebView) |

## Rust側アーキテクチャ

### 新規ファイル: `src-tauri/src/menu.rs`

2つの公開関数を提供:

```rust
pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>>
pub fn handle_event(app: &AppHandle, event: MenuEvent)
```

`build()`: 各メニュー（App / Edit / View / Accounts / Subscriptions / Item / Share）を構築して`Menu`を返す。各メニュー項目にIDを付与（例: `"view-all"`, `"item-toggle-star"`, `"share-copy-link"`）。

`handle_event()`: メニューIDでmatch分岐し、フロントへTauriイベントを発火。

```rust
match event.id().as_ref() {
    "view-all"            => emit("menu-action", "set-filter-all"),
    "view-unread"         => emit("menu-action", "set-filter-unread"),
    "view-starred"        => emit("menu-action", "set-filter-starred"),
    "view-sort-unread"    => emit("menu-action", "toggle-sort-unread"),
    "view-group-by-feed"  => emit("menu-action", "toggle-group-by-feed"),
    "view-fullscreen"     => emit("menu-action", "toggle-fullscreen"),
    "accounts-sync"       => emit("menu-action", "sync-all"),
    "accounts-show"       => emit("menu-action", "open-settings-accounts"),
    "accounts-add"        => emit("menu-action", "open-settings-accounts"),
    "subs-add"            => emit("menu-action", "open-add-feed"),
    "subs-prev"           => emit("menu-action", "prev-feed"),
    "subs-next"           => emit("menu-action", "next-feed"),
    "item-prev"           => emit("menu-action", "prev-article"),
    "item-next"           => emit("menu-action", "next-article"),
    "item-reader"         => emit("menu-action", "open-in-reader"),
    "item-browser"        => emit("menu-action", "open-in-browser"),
    "item-toggle-star"    => emit("menu-action", "toggle-star"),
    "item-toggle-read"    => emit("menu-action", "toggle-read"),
    "item-mark-all-read"  => emit("menu-action", "mark-all-read"),
    "share-copy-link"     => emit("menu-action", "copy-link"),
    "share-open-browser"  => emit("menu-action", "open-in-default-browser"),
    "share-reading-list"  => emit("menu-action", "add-to-reading-list"),
    "settings"            => emit("menu-action", "open-settings"),
    _                     => {}
}
```

### lib.rsの変更

既存のメニュー構築コード（`build_menu()`関数およびインラインのメニュー構築）を削除し、`setup`フック内で以下のように統合:

```rust
mod menu;

// run() 内の setup フック
.setup(|app| {
    let handle = app.handle();
    app.set_menu(menu::build(handle)?)?;
    app.on_menu_event(move |app, event| menu::handle_event(app, event));
    // ... 既存の setup コード
    Ok(())
})
```

注: `.menu()` / `.on_menu_event()` ビルダーメソッドではなく、`setup` 内の `app.set_menu()` + `app.on_menu_event()` を使用する。これにより AppHandle へのアクセスが可能になり、既存の setup コードとの統合が容易になる。

## 新規Tauriコマンド

| コマンド              | 用途                        | 実装方式                                           |
| --------------------- | --------------------------- | -------------------------------------------------- |
| `copy_to_clipboard`   | URLをクリップボードにコピー | `tauri-plugin-clipboard-manager`                   |
| `add_to_reading_list` | Safari Reading Listに追加   | `std::process::Command` + `osascript`（macOSのみ） |

### 追加依存

- `tauri-plugin-clipboard-manager`: クリップボード操作用
  - `Cargo.toml`に依存追加 + `tauri.conf.json`の`plugins`に登録
  - `lib.rs`の`setup`内で`.plugin(tauri_plugin_clipboard_manager::init())`を登録

### 追加不要なコマンド

- Sync All → 既存の`trigger_sync`
- Open in Browser → 既存の`open_in_browser`
- フィルター/ソート/グループ → フロント側store操作
- フルスクリーン → Tauri Window API直接操作
- Previous/Next Feed → フロント側store操作

## フロント側アーキテクチャ

### 新規ファイル: `src/hooks/use-menu-events.ts`

Tauriの`"menu-action"`イベントをリッスンし、アクションに応じてフロント側の処理を呼び出すカスタムフック。

```typescript
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { executeAction } from "@/lib/actions";

export function useMenuEvents() {
  useEffect(() => {
    let cancelled = false;
    const unlisten = listen<string>("menu-action", (event) => {
      executeAction(event.payload);
    }).catch(() => {
      // Non-Tauri context (browser dev mode) — no-op
    });
    return () => {
      cancelled = true;
      unlisten.then((fn) => fn?.()).catch(() => {});
    };
  }, []);
}
```

注: ブラウザ開発モード（非Tauri環境）では`listen()`が失敗するため、`.catch()`でガードする。既存の`settings-modal.tsx`と同じパターン。

### 新規ファイル: `src/lib/actions.ts`

キーボードショートカットとメニューイベントの共通アクション実行ロジック。

```typescript
export function executeAction(action: string): void {
  switch (action) {
    case "set-filter-all":
      store.setViewMode("all");
      break;
    case "set-filter-unread":
      store.setViewMode("unread");
      break;
    case "set-filter-starred":
      store.setViewMode("starred");
      break;
    case "toggle-sort-unread":
      togglePreference("sort_unread");
      break;
    case "toggle-group-by-feed":
      togglePreference("group_by");
      break;
    case "toggle-fullscreen":
      appWindow.toggleMaximize();
      break;
    case "sync-all":
      triggerSync();
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
    case "prev-feed":
      navigateFeed(-1);
      break;
    case "next-feed":
      navigateFeed(1);
      break;
    case "prev-article":
      navigateArticle(-1);
      break;
    case "next-article":
      navigateArticle(1);
      break;
    case "open-in-reader":
      openInReader();
      break;
    case "open-in-browser":
      openInBrowser();
      break;
    case "toggle-star":
      toggleStar();
      break;
    case "toggle-read":
      toggleRead();
      break;
    case "mark-all-read":
      markAllRead();
      break;
    case "copy-link":
      copyLink();
      break;
    case "open-in-default-browser":
      openInDefaultBrowser();
      break;
    case "add-to-reading-list":
      addToReadingList();
      break;
  }
}
```

### 変更ファイル

- `src/hooks/use-keyboard.ts` — アクション実行部分を`actions.ts`の`executeAction()`に委譲
- `src/components/reader/app-shell.tsx` — `useMenuEvents()`フック追加
- `src/components/settings/settings-modal.tsx` — `"open-settings"`リスナーを`"menu-action"`に統合
- `src/api/tauri-commands.ts` — `copyToClipboard`, `addToReadingList`ラッパー追加
- `src/dev-mock-data.ts` — 新規コマンドのmockハンドラ追加

## 実装上の注意事項

### 前提となるUI状態の引き上げ

以下のAPIは現状存在しないため、実装時に追加が必要:

- `ui-store`に`openSettings(tab?: string)`を追加: 現在の`openSettings()`を拡張し、オプションのタブ名を受け取る。`settings-modal.tsx`は`ui-store`のタブ指定を初期選択タブとして使用する。具体的には:
  - `ui-store`に`settingsInitialTab: string | null`ステートを追加
  - `openSettings(tab?)`が`isSettingsOpen = true` + `settingsInitialTab = tab ?? null`をセット
  - `settings-modal.tsx`がマウント時に`settingsInitialTab`を読み取り、該当タブを選択

- Add Feedダイアログのopen状態を`ui-store`に引き上げ: 現在は`sidebar.tsx`のローカル`useState`で管理されている`isAddFeedOpen`を、`ui-store`の`isAddFeedDialogOpen` + `openAddFeedDialog()` / `closeAddFeedDialog()`に移動。`sidebar.tsx`はstoreから読み取るように変更。

- `navigateFeed(direction)` / `navigateArticle(direction)`ヘルパー: `actions.ts`内で実装。現在の`ui-store`の`selectedFeedId` / `selectedArticleId`と、フィード/記事一覧の順序（サイドバーの表示順 / 記事リストの表示順）から前後を計算して`setSelectedFeedId()` / `setSelectedArticleId()`を呼ぶ。フィード一覧はReact Queryのキャッシュから取得。

### メニュー状態管理

- View > Sort / Group: チェックマーク表示で現在の状態を反映する。フロント側の設定変更時に`app.set_menu()`で再構築、またはTauri 2の`CheckMenuItem`を使用
- Item / Share: 記事未選択時は動作不要だが、メニュー項目自体は常時有効（no-op）を維持。ネイティブアプリでもItem系が常時有効なケースは多い
- View > Full Screen: `appWindow.toggleMaximize()`ではなく、Tauri 2の`appWindow.setFullscreen(!current)`で真のmacOSフルスクリーンを実現

### ショートカット競合の回避

- `⌘R`（Sync All）: アプリ内ブラウザ（WebView）にフォーカスがあるときはWebViewのリロードと競合しうる。メニューアクセラレータはアプリレベルで先に消費されるため、WebView内でのリロードはフロント側で単キー`R`として実装（WebViewフォーカス時のみ有効）

### macOS専用機能のゲーティング

```rust
#[cfg(target_os = "macos")]
#[tauri::command]
fn add_to_reading_list(url: String) -> Result<(), AppError> {
    // AppleScript文字列のエスケープ: ダブルクォートとバックスラッシュを処理
    let escaped_url = url.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"tell application "Safari" to add reading list item "{}""#,
        escaped_url
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| AppError::UserVisible(format!("Failed to run osascript: {}", e)))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::UserVisible(
            format!("Failed to add to Reading List: {}", stderr)
        ));
    }
    Ok(())
}
```

- メニュー構築時にも`cfg!(target_os = "macos")`で`Add to Reading List`項目の表示を制御
- エラー時はフロントへ`AppError::UserVisible`としてトースト通知

### Tauri 2メニューAPI

実装時に以下のTauri 2 APIを使用:

- `Menu::with_items()` — メニュー構築
- `Submenu::with_items()` — サブメニュー構築
- `MenuItem::with_id()` — ID付きメニュー項目
- `CheckMenuItem::with_id()` — チェック付きメニュー項目（View > Sort / Group）
- `PredefinedMenuItem::separator()` — セパレータ
- `PredefinedMenuItem::about()` — Aboutダイアログ
- `PredefinedMenuItem::quit()` — 終了
- `AppHandle::on_menu_event()` — イベントハンドリング

`build()`の戻り値は`tauri::Result<Menu<tauri::Wry>>`とし、`lib.rs`では`setup`フック内で`app.set_menu(menu::build(&app.handle())?)`と`app.on_menu_event(menu::handle_event)`を使用する。

## テスト

### Rust

- `menu.rs`: メニュー構築テスト（IDの一意性検証）

### TypeScript

- `use-menu-events.ts`: イベント→アクション変換テスト
- `actions.ts`: 各アクションの単体テスト

## 変更ファイル一覧

### Rust側（新規）

- `src-tauri/src/menu.rs`

### Rust側（変更）

- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/` （新規コマンド追加）
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

### TypeScript側（新規）

- `src/hooks/use-menu-events.ts`
- `src/lib/actions.ts`

### TypeScript側（変更）

- `src/hooks/use-keyboard.ts`
- `src/components/reader/app-shell.tsx`
- `src/components/settings/settings-modal.tsx`
- `src/api/tauri-commands.ts`
- `src/dev-mock-data.ts`
