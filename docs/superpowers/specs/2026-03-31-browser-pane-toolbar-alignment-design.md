# Browser Pane Toolbar Alignment Design

## Overview

記事詳細の 3 ペイン表示では、右ペイン上部の toolbar は `h-12` の固定高で安定している。
一方で browser mode は `src/components/reader/browser-view.tsx` が `py-3` と複数行テキストで構成されており、表示切替時に toolbar の高さと本文開始位置がずれて見える。

今回の変更では、browser mode の上部バーを 3 ペイン表示の toolbar と同じ垂直リズムへ揃え、説明文をヘッダーから外して視線のノイズを減らす。
対象は「右ペイン内の browser status strip の整理」に限定し、専用 browser window の生成方式や、strip 以外のレイアウト構造は変えない。

## Goals

- reader mode と browser mode で、右ペイン上部バーの高さを同じ `h-12` に揃える
- browser mode のヘッダーを 1 行基調へ圧縮し、URL と操作ボタンのグリッドを安定させる
- 常時表示している説明文を減らし、webview 関連の文言を短くする
- browser mode へ切り替えた瞬間に「レイアウトが膨らんだ」印象を出さない

## Non-Goals

- Tauri の dedicated browser window を pane 内 Webview に置き換える
- native Webview の角丸・クリップ・埋め込み方式を変更する
- 記事本文カラム幅、サイドバー階層、記事一覧ハイライトなど他の UI 改善を同時に行う
- browser mode のために新しい汎用 toolbar 抽象化を導入する

## Current State

- `src/components/reader/article-toolbar-view.tsx` は `flex h-12 items-center border-b border-border px-4`
- `src/components/reader/article-list-header.tsx` も `flex h-12 items-center ...`
- `src/components/reader/browser-view.tsx` は `border-b border-border bg-muted/20 px-4 py-3`
- browser header 内では以下の 3 行が積まれている
  - `browser_view`
  - URL
  - `browser_loading` または `browser_window_hint`
  - loading 中はさらに `browser_loading_hint`

このため browser mode へ切り替えると、右ペイン上部だけ高さが増え、記事表示時のタイトル開始位置と揃わない。
また URL・補助文・ツール群が別々のグリッドに見え、上部 chrome が面としてまとまっていない。

## Design

### Browser Status Strip

`BrowserView` は現行どおり strip-only のコンポーネントとして扱う。
今回は body 側に新しい surface や empty-state を足さず、header 相当の status strip だけを固定高へ揃える。

- root は `flex h-12 items-center border-b border-border px-4`
- 現行の dedicated browser window 方式は維持する
- bar 以外の DOM 構造は広げない

この変更で、browser mode へ切り替えても右ペインの上端リズムは reader mode と一致する。
差分は toolbar と copy の整理に絞り、空き領域の扱いは今回のスコープに含めない。

### Header Layout

browser header は 2 段以上にしない。
レイアウトは「左: URL/status」「右: browser actions」の 1 行に固定する。

- root: `flex h-12 items-center gap-3`
- left cluster: `min-w-0 flex-1`
- URL は 1 行 `truncate`
- loading 中のみ、小さな status badge を URL の横に置く
- right cluster は現行ボタン順を維持する
  - back
  - forward
  - reload
  - open external
  - close

button 自体の affordance や tooltip は既存実装を維持し、今回の変更では配置と密度だけを整える。

### Copy Strategy

browser mode の文言は「説明」ではなく「状態」に寄せる。
常設の長文ヘルプは削除し、必要な情報だけを短く出す。

#### Header で表示するもの

- URL
- loading 中の短い状態表示

#### Header で表示しないもの

- `browser_view` の見出しラベル
- `browser_loading_hint`
- `browser_window_hint`

#### 文言方針

- `browser_loading`: `ページを読み込み中...` → `読込中`
- `browser_window_fallback`: 長文説明ではなく短い結果通知へ寄せる
  - ja: `外部ブラウザで開きました`
  - en: `Opened in your external browser`

`browser_view`、`browser_loading_hint`、`browser_window_hint` は browser header の表示経路から外す。
key 自体を削除するか未使用のまま残すかは実装時判断でよいが、今回の UI では常時表示しない。

### Visual Rules

- toolbar 背景は article toolbar と同じトーンへ寄せ、browser mode だけ強く浮かせない
- left edge は reader mode の toolbar と同じ `px-4` 基準に揃える
- URL と action buttons の垂直中央を揃える
- loading 状態はテキスト量ではなく、短い badge と reload icon の回転で伝える

これにより、browser mode は「別の見た目の情報帯」ではなく、右ペインの同じ chrome に見えるようになる。

## Accessibility

- URL は truncate されても、DOM 上は完全な文字列を保持する
- icon button の `aria-label` と tooltip は既存文言を維持する
- loading badge を追加する場合は `aria-live="polite"` か既存の読み上げ導線を壊さない配置にする
- bar 高固定後もキーボード操作順は現行と同じに保つ

## Testing

更新対象の主テストは `src/__tests__/components/browser-view.test.tsx` とする。

- browser mode で header root が `h-12` を持つこと
- URL が表示され、旧ラベル `Browser View` が描画されないこと
- loading 中に長文ヒントが表示されず、短い loading 状態だけが出ること
- load 完了後に `Showing in a separate window.` が描画されないこと
- fallback 時の toast 文言が短い結果通知になること
- back / forward / reload / external / close の各操作が従来どおり動作すること
- listener を先に登録してから window を開く既存挙動を維持すること
- iframe / subresource URL を無視しつつ、履歴ボタン状態を保つ既存挙動を維持すること
- native close で browser mode を抜けること
- 明示 close と unmount が重なっても `close_browser_webview` が 1 回だけ送られること
- truncate 表示になっても URL 文字列自体は DOM 上で保持されること
- loading state の表示変更が、既存の fallback timeout 判定を壊さないこと

locale 変更が入るため、`src/locales/ja/reader.json` と `src/locales/en/reader.json` の文字列更新もテスト期待値へ反映する。

## Risks

### Information Drop

header から説明文を減らしすぎると、「右ペインが空に見える」印象が強まる可能性がある。
ただし今回の主問題は高さの膨らみと文言ノイズであるため、まずは toolbar の圧縮を優先する。
必要なら次段で body 側の empty-state 表現を別 spec として検討する。

### Class-Coupled Tests

`h-12` のような class そのものを厳密にテストすると、将来の微調整に弱くなる。
ただし今回は「固定高へ揃える」こと自体が要求なので、browser header の高さトークンはテストしてよい。

## Implementation Targets

- `src/components/reader/browser-view.tsx`
- `src/locales/ja/reader.json`
- `src/locales/en/reader.json`
- `src/__tests__/components/browser-view.test.tsx`
