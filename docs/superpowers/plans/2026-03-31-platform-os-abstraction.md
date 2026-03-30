# Platform OS Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows / macOS の差分を `PlatformInfo` / `PlatformCapabilities` に集約し、frontend と backend が同じ platform 判定を使うようにする。

**Architecture:** Rust 側に platform module と `get_platform_info` command を追加し、OS 依存 helper をそこへ寄せる。frontend は platform store を 1 回ロードして capability を参照し、`navigator.platform` や ad-hoc な OS 推測を削除する。

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Zod, Zustand, Vitest, cargo test/check

Spec: `docs/superpowers/specs/2026-03-31-platform-os-abstraction-design.md`

---

## File Structure

| Action | File | Responsibility |
| --- | --- | --- |
| Create | `src-tauri/src/platform/mod.rs` | `PlatformKind` / `PlatformCapabilities` / `PlatformInfo` と unit test |
| Create | `src-tauri/src/commands/platform_commands.rs` | `get_platform_info` Tauri command |
| Modify | `src-tauri/src/commands/dto.rs` | frontend に返す `PlatformInfoDto` schema-compatible shape |
| Modify | `src-tauri/src/commands/mod.rs` | `platform_commands` module を公開する |
| Modify | `src-tauri/src/lib.rs` | platform command を invoke handler に登録 |
| Modify | `src-tauri/src/infra/keyring_store.rs` | dev credential path 解決を platform helper 経由に統一 |
| Modify | `src-tauri/src/commands/article_commands.rs` | background browser open 判定を capability ベースに変更 |
| Modify | `src-tauri/src/browser_webview.rs` | native navigation 可否の意図を platform helper に寄せる |
| Create | `src/api/schemas/platform-info.ts` | frontend 用 `PlatformInfoSchema` |
| Modify | `src/api/schemas/index.ts` | platform schema export |
| Modify | `src/api/tauri-commands.ts` | `getPlatformInfo()` wrapper |
| Create | `src/stores/platform-store.ts` | platform info の load / cache / default capability 管理 |
| Modify | `src/components/app-shell.tsx` | 起動時に platform info をロード |
| Modify | `src/lib/window-chrome.ts` | overlay titlebar 判定を platform info ベースに変更 |
| Modify | `src/components/app-layout.tsx` | overlay titlebar 用に platform store を参照する |
| Modify | `src/hooks/use-app-icon-theme.ts` | `navigator.platform` をやめて platform capability を参照 |
| Modify | `src/components/reader/article-view.tsx` | Reading List action の表示可否を capability で制御 |
| Modify | `src/dev-mocks.ts` | browser-only dev で `get_platform_info` を返す |
| Modify | `tests/helpers/tauri-mocks.ts` | test mock に `get_platform_info` を追加 |
| Modify | `src/__tests__/api/schemas.test.ts` | `PlatformInfoSchema` validation test |
| Modify | `src/__tests__/api/tauri-commands.test.ts` | `getPlatformInfo()` command test |
| Create or Modify | `src/__tests__/stores/platform-store.test.ts` | platform store load test |
| Modify | `src/__tests__/app.test.tsx` | overlay titlebar の platform 分岐 test |
| Modify | `src/__tests__/hooks/use-app-icon-theme.test.tsx` | icon replacement gating test |
| Modify | `src/__tests__/components/article-view.test.tsx` | non-macOS で Reading List を隠す test |

---

### Task 1: Rust platform module と `get_platform_info` command を追加する

**Files:**

- Create: `src-tauri/src/platform/mod.rs`
- Create: `src-tauri/src/commands/platform_commands.rs`
- Modify: `src-tauri/src/commands/dto.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: `src-tauri/src/platform/mod.rs` に failing test を先に書く**

追加する test の軸:

```rust
#[test]
fn macos_capabilities_enable_reading_list_and_background_open() {}

#[test]
fn windows_capabilities_enable_native_navigation_but_not_reading_list() {}

#[test]
fn non_windows_non_macos_falls_back_to_safe_defaults() {}
```

テスト対象は `platform_info_for_kind(kind: PlatformKind) -> PlatformInfo` のような pure helper にする。`current()` を直接テスト対象にせず、環境非依存の helper を先に作る。

- [ ] **Step 2: test が失敗することを確認する**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml platform:: -- --nocapture
```

Expected: `platform` module or helper が未定義で FAIL。

Windows で Tauri test harness に既知問題が出る環境では代替で:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --tests
```

Expected: test module 未定義または compile error を確認。

- [ ] **Step 3: `PlatformKind` / `PlatformCapabilities` / `PlatformInfo` を最小実装する**

`src-tauri/src/platform/mod.rs` に以下を実装する:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlatformKind {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformCapabilities {
    pub supports_reading_list: bool,
    pub supports_background_browser_open: bool,
    pub supports_runtime_window_icon_replacement: bool,
    pub supports_native_browser_navigation: bool,
    pub uses_dev_file_credentials: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformInfo {
    pub kind: PlatformKind,
    pub capabilities: PlatformCapabilities,
}
```

`platform_info_for_kind()` と `PlatformInfo::current()` を実装し、`current()` は compile-time `cfg!` を使って kind を解決する。

- [ ] **Step 4: frontend 返却用 DTO と command を追加する**

`src-tauri/src/commands/dto.rs` に追加:

```rust
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PlatformKindDto {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlatformCapabilitiesDto {
    pub supports_reading_list: bool,
    pub supports_background_browser_open: bool,
    pub supports_runtime_window_icon_replacement: bool,
    pub supports_native_browser_navigation: bool,
    pub uses_dev_file_credentials: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlatformInfoDto {
    pub kind: PlatformKindDto,
    pub capabilities: PlatformCapabilitiesDto,
}
```

`From<crate::platform::PlatformInfo> for PlatformInfoDto` を実装する。

`src-tauri/src/commands/platform_commands.rs` に追加:

```rust
#[tauri::command]
pub fn get_platform_info() -> PlatformInfoDto {
    PlatformInfoDto::from(crate::platform::PlatformInfo::current())
}
```

`src-tauri/src/commands/mod.rs` に `pub mod platform_commands;` を追加する。  
`src-tauri/src/lib.rs` に `pub mod platform;` を追加し、`invoke_handler` に `commands::platform_commands::get_platform_info` を登録する。

- [ ] **Step 5: test を再実行して GREEN にする**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml platform:: -- --nocapture
```

Expected: `platform` module の unit test が PASS。

Windows fallback:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --tests
```

Expected: compile error なし。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/platform/mod.rs src-tauri/src/commands/platform_commands.rs src-tauri/src/commands/dto.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add shared platform info command"
```

---

### Task 2: backend の OS 依存 helper を platform capability に寄せる

**Files:**

- Modify: `src-tauri/src/infra/keyring_store.rs`
- Modify: `src-tauri/src/commands/article_commands.rs`
- Modify: `src-tauri/src/browser_webview.rs`

- [ ] **Step 1: `keyring_store.rs` と `article_commands.rs` に pure helper test を先に足す**

`keyring_store.rs`:

- 既存の path test を `platform` helper 経由の API に合わせて更新する

`article_commands.rs`:

- `should_use_background_browser_open(background_requested: bool, info: &PlatformInfo) -> bool` のような pure helper を追加し、以下の test を先に書く

```rust
#[test]
fn background_open_is_used_only_when_requested_and_supported() {}

#[test]
fn unsupported_platform_falls_back_to_normal_open() {}
```

`browser_webview.rs`:

- `supports_native_navigation(info: &PlatformInfo) -> bool` のような helper に対する test を先に書く

- [ ] **Step 2: test が失敗することを確認する**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml keyring_store -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml article_commands -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml browser_webview -- --nocapture
```

Expected: helper 未定義または assertion failure で FAIL。

Windows fallback:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --tests
```

Expected: compile error を確認。

- [ ] **Step 3: `keyring_store.rs` を platform helper ベースに整理する**

やること:

- dev credential path 解決で `PlatformInfo::current()` または `platform_info_for_kind()` に依存する helper を使う
- Windows は `LOCALAPPDATA` 優先
- Unix 系は `XDG_DATA_HOME` → `HOME/.local/share`
- 既存の path test を新 helper に合わせて維持する

- [ ] **Step 4: `open_in_browser` の background open 判定を helper 化する**

`article_commands.rs` に pure helper を追加:

```rust
fn should_use_background_browser_open(
    background_requested: bool,
    info: &crate::platform::PlatformInfo,
) -> bool {
    background_requested && info.capabilities.supports_background_browser_open
}
```

`open_in_browser` 本体は:

- `parse_browser_http_url(&url)?;`
- `let platform = crate::platform::PlatformInfo::current();`
- helper が true なら macOS の `open -g`
- false なら `open::that`

既存の macOS 実装は残し、判定だけ helper 経由にする。

- [ ] **Step 5: `browser_webview.rs` の native navigation 意図を helper に寄せる**

やること:

- `PlatformInfo::current().capabilities.supports_native_browser_navigation` を参照する pure helper を作る
- 既存の `#[cfg(target_os = "macos")]` / `#[cfg(windows)]` 分岐は維持する
- test は helper の戻り値に集中し、副作用のある webview 本体は既存どおり compile-time 分岐に任せる

- [ ] **Step 6: targeted test / compile を回す**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml keyring_store -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml article_commands -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml browser_webview -- --nocapture
```

Expected: unit test PASS。

Windows fallback:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --tests
```

Expected: compile error なし。

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/infra/keyring_store.rs src-tauri/src/commands/article_commands.rs src-tauri/src/browser_webview.rs
git commit -m "refactor: route backend os checks through platform info"
```

---

### Task 3: frontend schema / API / mock を追加する

**Files:**

- Create: `src/api/schemas/platform-info.ts`
- Modify: `src/api/schemas/index.ts`
- Modify: `src/api/tauri-commands.ts`
- Modify: `tests/helpers/tauri-mocks.ts`
- Modify: `src/dev-mocks.ts`
- Modify: `src/__tests__/api/schemas.test.ts`
- Modify: `src/__tests__/api/tauri-commands.test.ts`

- [ ] **Step 1: `PlatformInfoSchema` の failing test を先に書く**

`src/__tests__/api/schemas.test.ts` に追加:

```ts
it("parses platform info response", () => {
  expect(
    PlatformInfoSchema.parse({
      kind: "windows",
      capabilities: {
        supports_reading_list: false,
        supports_background_browser_open: false,
        supports_runtime_window_icon_replacement: true,
        supports_native_browser_navigation: true,
        uses_dev_file_credentials: true,
      },
    }),
  ).toBeTruthy();
});
```

`src/__tests__/api/tauri-commands.test.ts` に追加:

```ts
it("returns platform info from getPlatformInfo", async () => {
  const value = Result.unwrap(await getPlatformInfo());
  expect(value.kind).toBe("windows");
});
```

- [ ] **Step 2: test を実行して RED を確認する**

Run:

```bash
pnpm exec vitest run src/__tests__/api/schemas.test.ts src/__tests__/api/tauri-commands.test.ts
```

Expected: `PlatformInfoSchema` または `getPlatformInfo` 未定義で FAIL。

- [ ] **Step 3: schema と tauri command wrapper を最小実装する**

`src/api/schemas/platform-info.ts`:

```ts
import { z } from "zod";

export const PlatformCapabilitiesSchema = z.object({
  supports_reading_list: z.boolean(),
  supports_background_browser_open: z.boolean(),
  supports_runtime_window_icon_replacement: z.boolean(),
  supports_native_browser_navigation: z.boolean(),
  uses_dev_file_credentials: z.boolean(),
});

export const PlatformInfoSchema = z.object({
  kind: z.enum(["macos", "windows", "linux", "unknown"]),
  capabilities: PlatformCapabilitiesSchema,
});
```

`src/api/schemas/index.ts` で export 追加。  
`src/api/tauri-commands.ts` に以下を追加:

```ts
export const getPlatformInfo = () => safeInvoke("get_platform_info", { response: PlatformInfoSchema });
```

- [ ] **Step 4: test mocks に `get_platform_info` を追加する**

`tests/helpers/tauri-mocks.ts` と `src/dev-mocks.ts` に既定レスポンスを追加:

```ts
{
  kind: "windows",
  capabilities: {
    supports_reading_list: false,
    supports_background_browser_open: false,
    supports_runtime_window_icon_replacement: true,
    supports_native_browser_navigation: true,
    uses_dev_file_credentials: true,
  },
}
```

macOS 分岐が必要な test はカスタム handler で上書きする。

- [ ] **Step 5: test を再実行して GREEN にする**

Run:

```bash
pnpm exec vitest run src/__tests__/api/schemas.test.ts src/__tests__/api/tauri-commands.test.ts
```

Expected: 両 test file PASS。

- [ ] **Step 6: Commit**

```bash
git add src/api/schemas/platform-info.ts src/api/schemas/index.ts src/api/tauri-commands.ts tests/helpers/tauri-mocks.ts src/dev-mocks.ts src/__tests__/api/schemas.test.ts src/__tests__/api/tauri-commands.test.ts
git commit -m "feat: add frontend platform info schema and mocks"
```

---

### Task 4: platform store を追加して `AppShell` / `AppLayout` で利用する

**Files:**

- Create: `src/stores/platform-store.ts`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/window-chrome.ts`
- Modify: `src/components/app-layout.tsx`
- Create or Modify: `src/__tests__/stores/platform-store.test.ts`
- Modify: `src/__tests__/app.test.tsx`

- [ ] **Step 1: platform store の failing test を書く**

`src/__tests__/stores/platform-store.test.ts` を追加し、以下を確認する:

```ts
it("loads platform info once and stores it", async () => {
  // getPlatformInfo mock -> windows
  // loadPlatformInfo()
  // expect store.platform?.kind === "windows"
});

it("uses safe non-macos defaults before loading", () => {
  // expect supports_reading_list === false
});
```

`src/__tests__/app.test.tsx` では overlay titlebar 判定も更新する:

```ts
it("uses overlay titlebar only when tauri runtime is available on macos platform info", () => {
  // unknown / unloaded default -> false
  // macos + tauri runtime -> true
  // windows + tauri runtime -> false
});
```

- [ ] **Step 2: test を実行して RED を確認する**

Run:

```bash
pnpm exec vitest run src/__tests__/stores/platform-store.test.ts src/__tests__/app.test.tsx
```

Expected: store 未定義で FAIL。

- [ ] **Step 3: `src/stores/platform-store.ts` を最小実装する**

推奨 shape:

```ts
type PlatformInfo = z.infer<typeof PlatformInfoSchema>;

const defaultPlatformInfo: PlatformInfo = {
  kind: "unknown",
  capabilities: {
    supports_reading_list: false,
    supports_background_browser_open: false,
    supports_runtime_window_icon_replacement: false,
    supports_native_browser_navigation: false,
    uses_dev_file_credentials: false,
  },
};
```

state:

- `platform: PlatformInfo`
- `loaded: boolean`
- `loadPlatformInfo: () => Promise<void>`

`loadPlatformInfo` は `getPlatformInfo()` を 1 回呼び、失敗時は default を維持したまま `loaded: true` にする。

- [ ] **Step 4: `AppShell` にロード処理を追加し、`AppLayout` / `window-chrome` を platform store ベースへ寄せる**

やること:

- `src/components/app-shell.tsx` で `useEffect` を使い、mount 時に `loadPlatformInfo()` を呼ぶ
- `src/lib/window-chrome.ts` は `navigator.platform` の直接参照をやめ、`PlatformInfo["kind"]` を引数で受ける pure helper にする
- `src/components/app-layout.tsx` は platform store から `kind` を読んで `shouldUseDesktopOverlayTitlebar` に渡す

初回描画では `unknown` / conservative default を使うので、platform load 前は overlay titlebar も false に倒す。

- [ ] **Step 5: test を再実行して GREEN にする**

Run:

```bash
pnpm exec vitest run src/__tests__/stores/platform-store.test.ts src/__tests__/app.test.tsx
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/stores/platform-store.ts src/components/app-shell.tsx src/lib/window-chrome.ts src/components/app-layout.tsx src/__tests__/stores/platform-store.test.ts src/__tests__/app.test.tsx
git commit -m "feat: load shared platform info in app shell"
```

---

### Task 5: `useAppIconTheme` を platform capability ベースに切り替える

**Files:**

- Modify: `src/hooks/use-app-icon-theme.ts`
- Modify: `src/__tests__/hooks/use-app-icon-theme.test.tsx`

- [ ] **Step 1: hook test を先に更新する**

既存 test の `navigator.platform` 前提を置き換える。新しい期待:

```ts
it("skips runtime icon replacement when platform capability disables it", async () => {
  usePlatformStore.setState({
    platform: {
      kind: "macos",
      capabilities: {
        supports_runtime_window_icon_replacement: false,
        ...
      },
    },
    loaded: true,
  });
});
```

Linux/Windows 相当では icon が設定される test も残す。

- [ ] **Step 2: test を RED で確認する**

Run:

```bash
pnpm exec vitest run src/__tests__/hooks/use-app-icon-theme.test.tsx
```

Expected: `useAppIconTheme` が platform store をまだ見ておらず FAIL。

- [ ] **Step 3: `use-app-icon-theme.ts` を最小変更する**

やること:

- `navigator.platform` 参照を削除
- `usePlatformStore` から `supports_runtime_window_icon_replacement` を読む
- `loaded` が false または capability が false のとき runtime icon replacement を skip

`theme === "system"` の既存挙動はそのまま維持する。

- [ ] **Step 4: hook test を GREEN にする**

Run:

```bash
pnpm exec vitest run src/__tests__/hooks/use-app-icon-theme.test.tsx
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-app-icon-theme.ts src/__tests__/hooks/use-app-icon-theme.test.tsx
git commit -m "refactor: drive app icon behavior from platform capabilities"
```

---

### Task 6: `ArticleView` の Reading List action を capability で出し分ける

**Files:**

- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: failing component test を先に書く**

`src/__tests__/components/article-view.test.tsx` に追加:

```ts
it("hides reading list action when platform does not support it", async () => {
  // platform store = windows
  // article selected
  // open share menu
  // expect queryByText("Add to Reading List") not.toBeInTheDocument()
});

it("shows reading list action on macos", async () => {
  // platform store = macos
  // open share menu
  // expect findByText("Add to Reading List")
});
```

既存の share menu button test と干渉しないよう、platform store の初期化を `beforeEach` で明示する。

- [ ] **Step 2: test を RED で確認する**

Run:

```bash
pnpm exec vitest run src/__tests__/components/article-view.test.tsx
```

Expected: Reading List action が常に表示されて FAIL。

- [ ] **Step 3: `article-view.tsx` を最小変更する**

やること:

- `usePlatformStore` を読む
- `supports_reading_list` が true のときだけ `Menu.Item` を描画する
- keyboard shortcut ハンドラの `addToReadingList` 呼び出しも capability false のときは early return する

推奨:

```tsx
const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
```

share menu 内では条件付き render にする。

- [ ] **Step 4: component test を GREEN にする**

Run:

```bash
pnpm exec vitest run src/__tests__/components/article-view.test.tsx
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/article-view.tsx src/__tests__/components/article-view.test.tsx
git commit -m "feat: gate reading list ui by platform capability"
```

---

### Task 7: 全体確認と polish

**Files:**

- Verify only

- [ ] **Step 1: frontend で `navigator.platform` の直接参照が残っていないことを確認する**

Run:

```bash
rg -n -F "navigator.platform" src tests
```

Expected: 0 hit。

- [ ] **Step 2: targeted test をまとめて実行する**

Run:

```bash
pnpm exec vitest run src/__tests__/api/schemas.test.ts src/__tests__/api/tauri-commands.test.ts src/__tests__/stores/platform-store.test.ts src/__tests__/app.test.tsx src/__tests__/hooks/use-app-icon-theme.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS。

- [ ] **Step 3: TypeScript 型チェック**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: エラー 0 件。

- [ ] **Step 4: Rust compile / lint**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --tests
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Expected: compile / clippy ともに成功。

- [ ] **Step 5: 既定の品質チェック**

Run:

```bash
mise run check
```

Expected: repo 既存の format / lint / test が PASS。

既知の Windows 環境制約で `cargo test` が harness error になる場合は、その事実をログ付きで残し、`cargo check --tests` と `clippy` の成功を証跡にする。

- [ ] **Step 6: 最終 commit**

```bash
git add src-tauri/src/platform/mod.rs src-tauri/src/commands/platform_commands.rs src-tauri/src/commands/dto.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/infra/keyring_store.rs src-tauri/src/commands/article_commands.rs src-tauri/src/browser_webview.rs src/api/schemas/platform-info.ts src/api/schemas/index.ts src/api/tauri-commands.ts src/stores/platform-store.ts src/components/app-shell.tsx src/lib/window-chrome.ts src/components/app-layout.tsx src/hooks/use-app-icon-theme.ts src/components/reader/article-view.tsx src/dev-mocks.ts tests/helpers/tauri-mocks.ts src/__tests__/api/schemas.test.ts src/__tests__/api/tauri-commands.test.ts src/__tests__/stores/platform-store.test.ts src/__tests__/app.test.tsx src/__tests__/hooks/use-app-icon-theme.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "refactor: centralize platform-specific behavior"
```
