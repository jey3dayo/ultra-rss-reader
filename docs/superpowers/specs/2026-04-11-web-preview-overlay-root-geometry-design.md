# Web Preview Overlay Root Geometry Design

## Overview

`main-stage` の web preview は、単に `host` を full-bleed に見せるだけでは不十分だった。
実際には `overlay / stage / host / native child webview` のどれを正本とするかが曖昧で、DOM 上の `host` が広く見えていても、native child webview が別の寸法で残る崩れが起きていた。

今回の変更では、`data-browser-overlay-root` を viewer geometry の唯一の正本にする。
`main-stage` browser mode では、`overlay root` を window client area 相当の root space として扱い、最小の top rail safe lane を差し引いた `host rect` を一度だけ計算し、その rect を `stage` の見た目、`host` の DOM アンカー、`native child webview` の bounds に共通利用する。

## Goals

- `main-stage` browser mode で native child webview を left/right いっぱいまで設定する
- `overlay root -> stage -> host -> native` の geometry chain を 1 つの rect contract に揃える
- close / external browser の chrome を常に見えて押せる状態に保つ
- app 側の余白と、埋め込んだ site viewer 側の余白を見分けやすくする
- close button を shared icon button のまま自然な見た目に直す

## Non-Goals

- site ごとに CSS 注入して viewer 自体の中央寄せや zoom を補正すること
- content-pane embedding を main-stage と同じ visual contract に揃えること
- browser mode 専用の navigation bar や address bar を追加すること
- diagnostics HUD を常設 UI として昇格すること

## Problem Statement

現状の browser mode は次の 2 つが混ざっていた。

- React 側は `hostRef.getBoundingClientRect()` を native bounds の source of truth にしている
- しかし fullscreen overlay の root, stage, host の責務が曖昧で、見た目の shell と native child webview の実寸がズレても切り分けにくい

この結果、以下のような状態が起こる。

- DOM 上の `browser-webview-host` は広く見える
- それでも native child webview の描画面だけが右端まで伸びない
- close button は webview と競合しやすく、視覚上も `×` の字形で中心がずれて見える

問題の芯は「full screen にしたいのに inset が残っている」だけではなく、viewer geometry の正本が分散していることにある。

## Approved UX

### Chosen Pattern

採用案は `overlay root as the single source of truth`。

- `main-stage` browser mode の root は `data-browser-overlay-root`
- root 上部にだけ、ごく薄い top rail safe lane を置く
- close / external browser はその lane に置く
- native child webview は lane の下から左右いっぱいに始まる
- diagnostics は一時的な検証 overlay として重ねるが、surface rect 自体は変えない

### Why This Option

- `app 側の余白` と `site viewer 側の余白` の責務を明確に分けられる
- Windows child webview の重なり方に対しても、操作 chrome を守りやすい
- `host` と `native` がズレたとき、どの layer が壊れているか追いやすい

## Geometry Model

### Root Coordinate Space

`main-stage` browser mode の root coordinate space は `data-browser-overlay-root` とする。

- root は app shell 直下に存在する fullscreen overlay container
- root は window client area と同じ logical pixel space として扱う
- `main-stage` では pane 内レイアウトや list width を geometry source にしない

### Safe Lane

root 上部にのみ、最小の safe lane を持つ。

- lane の目的は `×` と external action を native child webview の外へ逃がすこと
- lane は「存在は分かるがほぼ見えない」強さの top rail とする
- lane 高さは button size と必要最小限の inset だけで決める
- lane の有無で左右幅を削らない

### Single Host Rect Contract

`main-stage` browser mode では、1 つの `host rect` だけを計算する。

- `host.left = 0`
- `host.right = 0`
- `host.top = safe lane bottom`
- `host.bottom = 0`

この `host rect` を以下すべてに共通利用する。

- `stage` の visible surface
- `browser-webview-host` の DOM placement
- native child webview の create/update bounds
- diagnostics 比較時の `expected rect`

別の rect を再計算しない。

### Stage And Host Relationship

`main-stage` では `stage === host` を原則とする。

- stage は decorative card ではなく、surface boundary の薄い表現だけを担う
- border radius や inset card 感は持たせない
- right side に app 側の死にスペースを作らない

### Content-Pane Contract

`content-pane` の browser embedding は今回の primary target ではない。
既存の inset contract は維持してよい。
この spec は `main-stage` browser mode だけを更新対象にする。

## Chrome Strategy

### Top Rail

- safe lane 上にごく薄い top rail を敷く
- rail は `ほぼ見えない` 強さに留める
- rail は full width だが、高さは最小限とする

### Actions

- 左上: close
- 右上: open in external browser

どちらも webview 面の外に置く。

### Close Button

- shared `IconToolbarButton` は継続利用する
- 中身の literal `×` glyph は廃止する
- action button と同系統の SVG icon に置き換える
- icon box を固定して optical centering を合わせる

これにより、shared component を維持しつつ close だけ中心からずれて見える問題を解消する。

## Interaction Model

### Open

- article toolbar から browser mode を開く
- browser-only state から URL を直接開く

どちらも `main-stage` では同じ overlay root geometry contract に着地する。

### Close

close 手段は以下を正とする。

- 左上 close button
- `Esc`

### Removed Interaction

`main-stage` では scrim click close を使わない。

理由:

- fullscreen child webview 周辺では accidental close を起こしやすい
- safe lane で close affordance が成立している
- webview interaction と背景 interaction を混ぜないほうが安定する

## Diagnostics Strategy

diagnostics は常設 UI ではなく、geometry verification 用の一時 overlay とする。

- 必要なときだけ `overlay / stage / host / native` を同じ単位で表示する
- diagnostics の表示有無で `host rect` を変えない
- `host == native` を第一確認項目にする

見た目が崩れたときは、まず `host` が壊れているか `native` が壊れているかを切り分ける。

## Implementation Approach

### Frontend

主変更箇所:

- `src/components/app-shell.tsx`
- `src/components/reader/browser-view.tsx`
- `src/lib/browser-viewer-geometry.ts`
- 必要に応じて `src/components/shared/icon-toolbar-control.tsx`

変更方針:

- `data-browser-overlay-root` を fullscreen viewer root として明確化する
- `main-stage` geometry は root 基準で `host rect` を 1 回だけ計算する
- `stage` と `host` の rect contract を統一する
- close / external action は top rail safe lane に固定する
- close icon は SVG 化して action button と optical balance を揃える

### Backend

主変更は不要の想定。

- `src-tauri/src/commands/browser_webview_commands.rs`

Rust 側は「受け取った logical bounds をそのまま child webview へ適用する」責務を維持する。
必要なら diagnostics wording やコメントだけを更新し、frontend の `host rect` が source of truth であることを明示する。

## Testing

### Automated

少なくとも以下を更新または追加する。

- `src/__tests__/components/browser-view.test.tsx`
- `src/__tests__/components/app-shell.test.tsx`
- `src/__tests__/lib/browser-viewer-geometry.test.ts`

期待値:

- `main-stage` では overlay root が fullscreen root として使われる
- `host rect` は `left/right = 0` で、`top = safe lane bottom`
- `stage` と `host` が同じ surface contract を持つ
- `create_or_update_browser_webview` / `set_browser_webview_bounds` に渡る bounds が `host rect` と一致する
- close button は shared button を使いながら icon 中心が安定する
- scrim click で close しない
- `Esc` では close する

### Manual

- `mise run app:dev`
- browser mode を wide layout で開く
- `×` が常に見えて押せること
- native child webview が left/right いっぱいまで設定されること
- right side の app 背景露出が消えていること
- 残る黒余白が site viewer 側由来であると見分けられること

### Review Checklist

この作業は次の checklist を満たすまで loop する。

- `×ボタンがある`
- `左端から右端まで、webviewが設定されている`
- `codex-code-review` で重大指摘なし
- `ui-ux-pro-max` 観点で close/action/rail の関係が自然

## Risks

### Windows Child Webview Resize Drift

Windows child webview が DOM rect 更新に対して遅れて追従する可能性がある。
その場合でも rect contract は `overlay root -> host -> native` の一方向に保ち、補正は 1 箇所に集める。

### Over-Correcting Site Viewer Layout

app 側 geometry を直したあとも、埋め込んだ site viewer 自体が中央寄せや黒背景を持つことがある。
それは site 側の責務として切り分け、今回の scope には入れない。

### Visual Noise From Top Rail

top rail が強すぎると immersive 感を壊す。
そのため rail は「存在だけ分かる」強度に留め、視認性は button background と focus state で支える。

## Alternatives Considered

### A. Keep DOM Host Flow And Patch Resize Timing

- 実装差分は小さい
- ただし root/stage/host/native の責務曖昧さが残る
- 再発しやすいため不採用

### B. Viewport-Driven Bounds Only

- full width は取りやすい
- ただし DOM 側の root/stage/host と native の整合が見えにくくなる
- 今回は geometry source を `overlay root` に寄せる方が自然なため不採用

### C. Overlay Root As Single Source Of Truth

- root/stage/host/native を一つの contract に揃えられる
- chrome と surface の責務を分けやすい
- 採用

## Implementation Targets

- `src/components/app-shell.tsx`
- `src/components/reader/browser-view.tsx`
- `src/lib/browser-viewer-geometry.ts`
- `src/components/shared/icon-toolbar-control.tsx` or local icon usage in `browser-view.tsx`
- `src/__tests__/components/app-shell.test.tsx`
- `src/__tests__/components/browser-view.test.tsx`
- `src/__tests__/lib/browser-viewer-geometry.test.ts`
