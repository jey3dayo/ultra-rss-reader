# Embedded Browser Widescreen Design

## Overview

Ultra RSS Reader の「ワイドスクリーン」表示を、漫画や縦長コンテンツを読みやすい形へ戻す。
`wide` かつ実効表示モードが `widescreen` のときは左端の購読 sidebar を隠し、`article list + content pane` の 2 ペインにする。
さらに、右上 toolbar に既読・スターと同じ押し込みトグル系の browser ボタンを追加し、右ペインの中身を `reader` と `embedded webview` の間で切り替えられるようにする。

## Goals

- `WebviewWindow` / sub window を使わず、main window 内へ webview を埋め込む
- 漫画向けに右ペインの読書面積を最大化する
- 既存の表示モード制御を壊さずに `browser` 表示を差し込む
- 設定画面、サイドバーの購読選択、ヘッダー上の表示モード切替の責務を分離する
- 既存の `browserUrl`, `contentMode`, `DisplayModeToggleGroup` を可能な限り活かす

## Non-Goals

- 新しい別 window / popup browser の追加
- display mode の意味を `reader/browser` 切替に置き換えること
- icon デザインの最終決定
- compact / mobile に widescreen 専用 UI を追加すること

## Approved UX

### Primary Layout

- `layoutMode === "wide"` かつ実効 `displayMode === "normal"`:
  - 従来どおり `sidebar + article list + content` の 3 ペイン
- `layoutMode === "wide"` かつ実効 `displayMode === "widescreen"`:
  - `article list + content` の 2 ペイン
  - 左端の購読 sidebar は非表示
- `layoutMode === "compact" | "mobile"`:
  - 既存のスライディング pane 挙動を維持

### Browser Toggle

- 右ペイン toolbar に、既読トグル・スタートグルと同じ UI 系統の browser トグルを追加する
- browser トグルは display mode とは別ボタンにする
- browser トグル ON:
  - 右ペインの中身を `reader` から `embedded webview` に切り替える
  - `widescreen` では漫画向けに webview の縦スペースを優先する
- browser トグル OFF:
  - 同じ記事の `reader` 表示へ戻る
- icon は後で差し替えやすいように isolated な 1 箇所で管理する

### Manga-Optimized Presentation

承認されたモックは `A. Focused Browser`。

- `widescreen + browser ON` では右ペイン上部の reader 用メタ情報を最小限にする
- 右ペインは URL バー相当の最小 chrome と browser ナビゲーションのみを持つ
- 漫画本文に使える縦方向スペースを最大化する

## Control Precedence

制御は次の順序で決定する。

1. `layoutMode`
   - viewport width から決まるレスポンシブ状態
   - `wide / compact / mobile`

2. `displayMode`
   - 設定画面の `reader_view` と feed 単位の `display_mode` から実効値を決める
   - `feed.display_mode ?? prefs.reader_view`
   - `normal | widescreen`

3. `browser toggle`
   - 現在表示中の記事に対する一時的な中身の切替
   - `reader ⇄ embedded browser`
   - display mode や feed preference は変更しない

責務の対応は以下のとおり。

- 設定画面:
  - 基本となる default display mode を決める
- サイドバーの購読選択:
  - どの feed の実効 display mode を使うかを決める
- 記事一覧ヘッダーの display mode control:
  - 現在 feed の `display_mode` を更新する
- 右ペイン toolbar の browser toggle:
  - 右ペインの中身だけを `reader/browser` で切り替える

## State Model

既存の Zustand state を中心に再利用する。

### Keep

- `layoutMode`
- `focusedPane`
- `contentMode`
- `selectedArticleId`
- `browserUrl`
- `openBrowser(url)`
- `closeBrowser()`

### Semantics

- `contentMode === "reader"`
  - 右ペインは sanitized article content を描画
- `contentMode === "browser"`
  - 右ペインは embedded webview を描画
- `contentMode === "empty"`
  - 選択なし empty state

### Proposed Derived State

`widescreen` 判定は専用 helper に寄せる。

```ts
isWidescreenFeed = resolveEffectiveDisplayMode(selectedFeed?.display_mode, prefs.reader_view) === "widescreen"
showSidebarInWide = !isWidescreenFeed
isBrowserOpen = contentMode === "browser"
```

## Frontend Design

### `src/components/app-layout.tsx`

- `wide` では `resolveLayout()` が `displayMode` を考慮できるようにする
- `widescreen` のとき `sidebar` を返さない
- `content` pane は常に残す

### `src/hooks/use-layout.ts`

- 既存 `resolveLayout(layoutMode, focusedPane, contentMode)` を拡張し、wide の sidebar 表示判定に widescreen を加える
- `contentMode === "browser"` を layout の主因にしない
- browser ON/OFF では pane 数を変えず、右ペインの中身だけ変える

### `src/components/reader/article-view.tsx`

- toolbar に browser toggle を追加する
- `showOpenInBrowserButton` は維持するが、意味を `embedded browser toggle` として再定義する
- `isBrowserOpen` は `contentMode === "browser"` を渡す
- ON 時は `useUiStore.getState().openBrowser(article.url)` を使う
- OFF 時は `closeBrowser()` で `reader` に戻す
- icon は final decision を後から差し替えやすいよう、トグル定義を 1 箇所に閉じ込める

### `src/components/reader/browser-view.tsx`

- 役割を「dedicated window controller」から「embedded child webview controller」に変更する
- toolbar はそのまま右ペイン上部に残す
- URL 表示、戻る、進む、再読み込みは継続
- `browserUrl` の変化を child webview に同期する
- `selectedArticleId` 切替時に browser mode 継続中なら URL を差し替える

### `src/components/reader/article-list.tsx`

- 既存の `DisplayModeToggleGroup` は維持する
- feed 単位 `display_mode` 更新時に `normal -> widescreen` / `widescreen -> normal` を反映する
- `normal` へ戻したときは browser mode を自動で閉じる

## Backend Design

### Chosen Approach

`WebviewWindowBuilder` は使わない。
main window に child webview を追加する。

この repo はすでに `tauri = { features = ["unstable"] }` を有効化しているため、multiwebview API を使える前提で進める。

### Research Notes

実装方針は以下の一次情報を根拠にする。

- Context7 で確認した Tauri 2 docs:
  - `@tauri-apps/api/webview` の `new Webview(window, label, { url, x, y, width, height })`
  - `setSize()` / `setPosition()` による webview の再配置
- ローカル環境の `tauri 2.10.3` source:
  - `window.add_child(WebviewBuilder::new(...), position, size)`
  - `Webview::set_bounds`, `set_size`, `set_position`

### `src-tauri/src/browser_webview.rs`

- dedicated browser window を表す責務を外す
- 代わりに main window 配下の embedded browser webview の label・state tracker・navigation helper を持つ
- `BROWSER_WINDOW_LABEL` は `BROWSER_WEBVIEW_LABEL` へ改名候補
- `browser_window()` は `browser_webview()` 相当に置き換える

### `src-tauri/src/commands/browser_webview_commands.rs`

- `create_or_update_browser_webview`:
  - main window 上に child webview がなければ作成
  - 既存があれば再利用して navigate
- 新規または変更される command:
  - `create_or_update_browser_webview(url, bounds)`
  - `set_browser_webview_bounds(bounds)`
  - `go_back_browser_webview()`
  - `go_forward_browser_webview()`
  - `reload_browser_webview()`
  - `close_browser_webview()`
- `bounds` は React 側で測定した content pane の logical rect を受け取る

### Capability Changes

現在の `src-tauri/capabilities/default.json` は `windows: ["main"]` を使っている。
Tauri の multiwebview では、window 単位 capability はその window 配下の全 webview に効くため、このままだと embedded browser webview にも app 本体と同じ IPC 権限が渡ってしまう。

そのため capability 設計を以下へ変更する。

- app 本体 webview:
  - `windows` ではなく `webviews: ["main"]` のように main app webview を明示する
- embedded browser webview:
  - 専用 label を付ける
  - app command を許可しない
  - 必要なら opener / navigation 系のみを最小権限で別 capability に切り出す

この変更は embedded browser の security boundary として必須。

### Child Webview Lifecycle

1. `browser ON`
   - frontend が content pane の rect を計測
   - Rust command に `{ url, x, y, width, height }` を渡す
   - child webview を create or update
2. resize / mode switch
   - frontend が再計測して bounds update command を送る
3. `browser OFF`
   - child webview を destroy
   - state tracker を clear

### Geometry Source of Truth

描画位置の source of truth は frontend DOM。

- content pane container に ref を置く
- `ResizeObserver` と window resize で rect を再計測する
- OS titlebar offset や border 分を含む最終座標は frontend で補正して Rust へ渡す
- Rust 側は受け取った logical bounds をそのまま child webview へ適用する

## Security

- child webview に Tauri IPC capability を与えない
- 表示可能 URL は `http://` / `https://` のみ
- `javascript:` / `file:` は拒否する
- 既存の URL validation を維持する
- child webview は browser content 専用 label を使い、main app webview と capability を分離する
- multiwebview 化に合わせて capability 定義を window 単位から webview 単位へ切り替える

## Failure Handling

### Embedded Browser Creation Failure

- child webview 作成に失敗したら `contentMode` を `reader` へ戻す
- 必要なら外部ブラウザへ fallback する
- トースト文言は「別ウィンドウ」前提から更新する

### Unsupported / Blocked URL

- 対象 URL を in-app で表示できない場合は reader を維持する
- 外部ブラウザを開く導線は残す

### Stale Browser State

- 記事が切り替わったとき:
  - browser mode 維持可能なら URL 更新
  - 維持不能なら reader へ戻す
- feed 切替、selection clear、display mode 変更時:
  - child webview を破棄して stale state を残さない

## Testing

### Frontend

- `src/__tests__/hooks/use-layout.test.ts`
  - `wide + normal` で 3 ペイン
  - `wide + widescreen` で `sidebar` が消える
  - `browser ON/OFF` で pane 構成が崩れない
- `src/__tests__/components/article-view.test.tsx`
  - browser toggle の押下
  - `isBrowserOpen` の反映
  - OFF で reader に戻る
- `src/__tests__/components/browser-view.test.tsx`
  - URL 同期
  - 埋め込み webview command 呼び出し
  - fallback 時の toast と mode reset

### Backend

- URL validation の継続
- tracker start / finish / clear の継続
- child webview が再利用されること
- bounds update が既存 webview に適用されること

## Alternatives Considered

### A. Focused Browser

- 右ペインをほぼ webview に全振りする
- 漫画向けの読みやすさを最優先
- 採用

### B. Hybrid Browser

- reader 用タイトル・メタを上部に残して webview を下に置く
- 文脈は分かりやすいが縦スペースを消費する
- 今回は不採用

### Dedicated `WebviewWindow`

- 既存実装に近い
- 右ペインとの一体感を失う
- ユーザー要件に反するため不採用

## Open Points

- browser toggle icon の最終決定
- DOM rect から Tauri logical bounds へ変換する補正式の詳細
- provider / site ごとの embed block 判定をどこまで proactive に行うか

## Implementation Summary

この変更は「表示モード」と「右ペインの中身切替」を分離するリファクタでもある。

- `displayMode`:
  - 3 ペインか widescreen かを決める
- `browser toggle`:
  - 右ペインを reader で描くか embedded browser で描くかを決める
- backend:
  - dedicated browser window をやめ、main window child webview を管理する

この形なら、設定画面、購読ごとの display mode、記事ペイン toolbar の 3 経路が互いに衝突せず、漫画向けの widescreen を main window 内で自然に復活できる。
