# Platform OS 抽象化設計

## 概要

Windows と macOS で挙動差がある機能を、その場しのぎの `cfg` 分岐や `navigator.platform` 判定で実装しているため、挙動不一致と再発が起きやすい。

この設計では、バックエンドとフロントエンドの両方で参照する共通の `PlatformInfo` / `PlatformCapabilities` を導入し、OS 依存ロジックを集約する。UI は capability を見て事前に出し分け、バックエンドは最終防衛として OS 固有実装を保持する。

## 背景と課題

- Windows では dev credential 保存先の解決が macOS / Unix 前提になりやすく、OS keyring に誤ってフォールバックしうる
- フロントエンドでは `navigator.platform` で OS を直接推測しており、Tauri 側の実際の platform 判定とずれる余地がある
- macOS 専用機能である Reading List 追加が、UI 上は常に実行可能に見え、非対応 OS では押してから失敗する
- ブラウザ起動や WebView navigation のような機能差が複数箇所に散っており、新しい OS 分岐の追加時に漏れが起きやすい

## 目標

- Windows / macOS の差分を 1 つの platform レイヤーに集約する
- フロントエンドとバックエンドで同じ platform 情報を参照する
- 非対応機能は UI 上で事前に表現し、通常操作で unsupported error が出ないようにする
- 既存の OS 固有実装は保ちつつ、判定ロジックだけを共通化する

## 非目標

- Linux 向けに新機能を追加すること
- 既存の macOS / Windows 専用実装を全面的に書き換えること
- OS ごとの UI デザインを大きく変えること

## アプローチ比較

### 案1: 個別パッチ型

見つかった箇所を順に修正する。

- メリット: 変更量が少なく短期で終わる
- デメリット: 新しい OS 分岐漏れを防げない

### 案2: Platform 抽象化型

推奨案。Rust 側で `PlatformInfo` / `PlatformCapabilities` を定義し、フロントエンドもその情報だけを参照する。

- メリット: 差分の責務が明確で再発しにくい
- メリット: UI と backend の判定ずれを防げる
- デメリット: API と store の追加が必要

### 案3: Rust 側だけ共通化型

バックエンドだけ platform helper を作り、フロントは現状維持する。

- メリット: Rust 側は整理される
- デメリット: `navigator.platform` 依存が残り、UI の誤表示が解消されない

## 推奨方針

案2を採用する。OS 固有処理そのものは各実装に残し、判定と capability の定義だけを共通 platform レイヤーに集約する。

## 設計

### PlatformInfo の導入

Rust 側に `src-tauri/src/platform/` を追加し、以下を定義する。

```rust
pub enum PlatformKind {
    Macos,
    Windows,
    Linux,
    Unknown,
}

pub struct PlatformCapabilities {
    pub supports_reading_list: bool,
    pub supports_background_browser_open: bool,
    pub supports_runtime_window_icon_replacement: bool,
    pub supports_native_browser_navigation: bool,
    pub uses_dev_file_credentials: bool,
}

pub struct PlatformInfo {
    pub kind: PlatformKind,
    pub capabilities: PlatformCapabilities,
}
```

`PlatformInfo::current()` で compile-time / runtime 情報から現在 platform を解決する。Tauri command と内部 helper の両方から参照できるようにする。

### Tauri command: `get_platform_info`

フロントエンドに platform 情報を渡すため、引数なしの `get_platform_info` command を追加する。

用途:

- `useAppIconTheme` が runtime icon replacement 可否を判定する
- 記事アクション UI が Reading List を表示するか判断する
- 将来的な OS 差分機能追加時の共通入口にする

### Rust バックエンド変更

#### `infra/keyring_store.rs`

- 既存の dev credential path 解決を `platform` helper 経由に統一する
- Windows では `LOCALAPPDATA` / `USERPROFILE` / `HOMEDRIVE` + `HOMEPATH`
- Unix系では `XDG_DATA_HOME` → `HOME/.local/share`
- dev file credential を使う条件も platform capability と対応づける

#### `commands/article_commands.rs`

- `open_in_browser` は `cfg!(target_os = "macos")` の直接参照をやめ、`PlatformInfo::current().capabilities.supports_background_browser_open` を参照する
- capability が false の場合、background 指定があっても通常の `open::that` にフォールバックする

#### `commands/share_commands.rs`

- macOS の `osascript` 実装は維持する
- 非 macOS 向け fallback 実装も維持する
- ただし UI が capability を見て事前に制御するため、通常操作では unsupported に落ちない状態を目指す

#### `browser_webview.rs`

- native navigation availability が使える platform を capability として表現する
- macOS / Windows の native API 分岐は保持しつつ、「native navigation を使う platform / fallback history を使う platform」の意図を platform レイヤーで明示する

### フロントエンド変更

#### platform API / store / hook

- `src/api/tauri-commands.ts` に `getPlatformInfo()` を追加
- `src/api/schemas/` に `PlatformInfoSchema` を追加
- `src/stores/` または `src/hooks/` に platform info を 1 回だけロードして保持する薄い state を追加する

想定フロー:

```text
AppShell mount
  -> load platform info
  -> store に保存
  -> hooks / UI が capability を参照
```

#### `hooks/use-app-icon-theme.ts`

- `navigator.platform` 判定を削除する
- `supports_runtime_window_icon_replacement` を見て、dev 中の macOS だけ runtime icon replacement を skip する
- これにより frontend 独自の OS 推測をなくす

#### `components/reader/article-view.tsx`

- Reading List action の表示可否を platform capability で制御する
- 非対応 OS では:
  - 第一候補: 項目自体を表示しない
  - 代替: disabled 表示 + 補足 tooltip

今回の推奨は「非表示」。ユーザーに押して失敗させないことを優先する。

#### `dev-mocks.ts`

- browser-only 開発時にも `get_platform_info` を返せるようにする
- 既定値は Windows か non-macOS に寄せ、必要ならテストで上書き可能にする

## データフロー

```text
Rust platform module
  -> get_platform_info command
  -> frontend platform store
  -> UI / hooks が capabilities を参照

keyring / browser open / webview navigation
  -> Rust 内部 helper が platform module を参照
```

この構成により、platform 差分の source of truth を Rust 側 1 箇所に寄せる。

## UI / UX 方針

- 非対応機能は「押して失敗」ではなく「見せない / 無効化する」
- OS ごとの差分は capability で表現し、画面上の文言で OS 名をベタ書きしない
- エラーは backend に残すが、通常操作で到達しない設計を優先する

## 変更ファイル

### 新規作成

- `src-tauri/src/platform/mod.rs`
- `src-tauri/src/commands/platform_commands.rs`
- `src/__tests__/hooks/use-platform-info.test.ts` または同等の platform hook/store test

### 変更する

- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/article_commands.rs`
- `src-tauri/src/commands/share_commands.rs`
- `src-tauri/src/browser_webview.rs`
- `src-tauri/src/infra/keyring_store.rs`
- `src/api/tauri-commands.ts`
- `src/api/schemas/commands.ts`
- `src/api/schemas/` 配下の response schema
- `src/hooks/use-app-icon-theme.ts`
- `src/components/app-shell.tsx`
- `src/components/reader/article-view.tsx`
- `src/dev-mocks.ts`
- 関連フロントテスト

### 変更しない

- Reading List の macOS 実装そのもの
- WebView2 / WKWebView の native API 呼び出しそのもの
- 既存の updater や sync ロジック

## テスト

### Rust

- platform kind / capability 解決の unit test
- dev credential path 解決の Windows / Unix 分岐 test
- `open_in_browser` の background capability 判定 test を追加検討

### Frontend

- `useAppIconTheme` が platform info を見て icon replacement を skip する test
- `ArticleView` / share menu が non-macOS で Reading List を表示しない test
- `get_platform_info` response schema の validation test

### Dev Mock

- browser-only mode で `get_platform_info` が返る test
- Windows / macOS の mock 切り替えで UI 分岐が再現できることを確認

## リスクと対策

- platform info のロード前に UI が先に描画される
  - 対策: conservative default を non-macOS capability false に寄せる
- capability 名が増えてフロントで誤用される
  - 対策: `kind` ではなく `capabilities` を優先して参照するルールにする
- backend の `cfg` 分岐と capability 定義が乖離する
  - 対策: platform module の unit test を追加し、各 capability の用途をコメントで固定する

## 完了条件

- frontend に `navigator.platform` の直接参照が残らない
- OS 判定の新規 source of truth が `PlatformInfo` に統一される
- Reading List が非対応 OS で事前に隠れる、または無効化される
- dev credential path 解決が Windows / macOS で明示的になる
- 関連テストと既存チェックが通る
