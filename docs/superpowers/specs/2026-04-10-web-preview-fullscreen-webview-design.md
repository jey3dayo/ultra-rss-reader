# Web Preview Fullscreen Webview Design

## Overview

`Web Preview` の現在の `main-stage` 表示は、native child webview 自体が崩れているのではなく、React 側で余白付きの `stage` を定義し、その小さい host rect を Rust 側へそのまま渡しているため、「ウィンドウ内フルスクリーン」に見えない。

今回の変更では、前日の `Minimal Viewer` 方針をさらに進め、`main-stage` では `true fullscreen` を採用する。
browser mode 中は native webview を app window の client area 全面に合わせ、操作 chrome はその上に最小限だけ重ねる。

## Goals

- `main-stage` の browser mode で native child webview を window 内いっぱいに広げる
- `overlay -> host -> native child webview` の geometry chain を単純化する
- close / external browser の操作 chrome を surface と独立させ、surface 面積を削らない
- diagnostics を表示しても surface を押し下げない
- fullscreen にした結果として誤爆しやすくなる `scrim click close` を `main-stage` では外す

## Non-Goals

- browser mode 専用の別 window を増やすこと
- site ごとの CSS 注入で中央寄せレイアウトを補正すること
- content-pane 用の埋め込み表示まで同じ見た目に寄せること
- フルブラウザ相当の navigation bar や address bar を app 内に追加すること

## Problem Statement

現状の Rust 側は、frontend が渡した bounds をそのまま native child webview に適用している。

- React:
  - `main-stage` 用 geometry で `left/right/bottom = 16px` と top inset を固定する
  - `hostRef.getBoundingClientRect()` を child webview bounds の source of truth にする
- Rust:
  - 受け取った logical bounds をそのまま `add_child` / `set_bounds` に使う

そのため問題の本質は Tauri の window 内 fullscreen 制約ではなく、`main-stage` viewer shell が意図的に inset stage として設計されている点にある。

## Approved UX

### Chosen Pattern

採用案は `A. Pure Full Bleed`。

- browser mode surface は app shell の overlay 全面を使う
- `stage` は見た目の箱として扱わず、fullscreen host のラッパ程度に落とす
- 左上に close、右上に external browser の 2 ボタンだけを残す
- top rail や大きい HUD reserve lane は作らない
- page 本体がそのまま主役になる immersive viewer に振り切る

### Why This Option

- いちばん直接的に「なんで綺麗にウィンドウ内部でフルスクリーンできないんだ」という不満を解消できる
- React と Rust の両方で geometry の責務が明快になる
- 既存の inset stage より、reader overlay ではなく browser mode に切り替わった感触が強い

## Geometry Model

### Root Coordinate Space

`main-stage` browser mode の root は app webview client area 全体とする。

- overlay root は既存どおり app shell 直下の `data-browser-overlay-root`
- `main-stage` fullscreen browser mode では `host === overlay client area`
- native child webview の bounds は fullscreen host rect だけから決める

この mode では、従来の `overlay -> inset stage -> host -> native` ではなく、実質的に `overlay -> host -> native` の 1 系統へ単純化する。

### Main-Stage Geometry

- `left = 0`
- `top = 0`
- `right = 0`
- `bottom = 0`
- `border radius = 0`

つまり `main-stage` browser mode の host surface は full-bleed とする。
mobile / narrow width でも surface 自体は縮めず、compact 化は chrome 側だけで吸収する。

### Content-Pane Geometry

`content-pane` 側の browser embedding は今回の primary target ではないため、既存の inset geometry を維持してよい。
fullscreen 化の仕様は `main-stage` browser mode に限定する。

## Interaction Model

### Open

- article toolbar から browser mode を開く
- browser-only state から URL を直接開く

どちらも `main-stage` browser mode では同じ fullscreen shell に着地する。

### Close

`main-stage` fullscreen browser mode の close 手段は以下に限定する。

- 左上 close button
- `Esc`

### Removed Interaction

fullscreen 化後は `scrim click close` を `main-stage` では廃止する。

理由:

- fullscreen surface と背景の境界が消えるため、scrim と surface の hit area を安全に分けにくい
- page interaction が多い mode で accidental close を避けたい
- close affordance は `Esc` と固定ボタンで十分成立する

## Chrome Strategy

### Persistent Controls

常設 chrome は 2 ボタンだけに絞る。

- 左上: close
- 右上: open in external browser

### Visual Treatment

- ボタンは icon-only のまま維持する
- 背景は半透明の dark glass にして、明るい page でも視認性を保つ
- top rail や wide chrome lane は削除する

`B. Soft Top Veil` は今回は採用しない。
まずは pure full bleed で fullscreen geometry を成立させ、必要になった場合だけ button readability の補助を追加する。

## Diagnostics Strategy

diagnostics HUD は surface geometry の一部として扱わない。

- HUD は fullscreen surface の上に absolute overlay として重ねる
- diagnostics 表示の有無で host rect は変えない
- `showDiagnostics = true` でも native child webview bounds は縮めない

これにより、debug mode の有無で fullscreen 感が変わることを防ぐ。

## Implementation Approach

### Frontend

主変更箇所:

- `src/lib/browser-viewer-geometry.ts`
- `src/components/reader/browser-view.tsx`
- 必要に応じて `src/components/reader/article-view.tsx`

変更内容:

- `main-stage` geometry を full-bleed 化する
- compact 判定は surface ではなく chrome sizing にだけ使う
- `chromeRail` を実質廃止するか、`main-stage` では非表示固定にする
- `stage` に border / shadow / radius を与えていた visual shell を削る
- `hostRef` が fullscreen host を指すようにする
- `scrim` は close hit area としては使わず、必要なら purely visual layer に落とす

### Backend

主変更は不要。

対象:

- `src-tauri/src/commands/browser_webview_commands.rs`

現状の責務は適切であり、`validated_bounds` と `child_webview_rect_from_viewport_bounds()` の pass-through 方針を維持する。
必要ならコメントや diagnostics wording を更新し、fullscreen host が source of truth であることを明示する。

## Testing

### Frontend Unit Tests

`src/__tests__/components/browser-view.test.tsx` を中心に期待値を更新する。

- `main-stage` で `browser-overlay-stage` が `left/top/right/bottom = 0px` になる
- `main-stage` fullscreen browser mode で `create_or_update_browser_webview` に fullscreen host bounds が渡る
- narrow width でも host bounds は full-bleed のまま維持される
- close / external browser ボタンは compact 化しても surface を縮めない
- diagnostics を ON にしても stage / host bounds が変わらない
- `browser-overlay-top-rail` を期待しない
- scrim click で close しない
- `Esc` では close する

### Integration Expectations

- browser-only state でも article-origin でも同じ fullscreen shell が見える
- native bounds diagnostics では `host == native` を維持したまま `overlay fill == 100%` に近づく

### Manual Verification

- `mise run app:dev`
- browser mode を wide layout で開く
- window を resize しても native child webview が surface 全面に追従することを確認する
- 明るい page / 暗い page の両方で button contrast が破綻しないことを確認する
- diagnostics ON/OFF で surface 面積が変わらないことを確認する

## Risks

### Bright Page Contrast

soft veil を入れないため、白背景サイトではボタンの視認性が落ちる可能性がある。
初手では button background と border の調整で対応し、それでも不足する場合だけ top veil を別改善として検討する。

### Behavior Drift Between Main-Stage And Content-Pane

`main-stage` だけ fullscreen に寄せるため、`content-pane` との見た目差は広がる。
ただし今回の不満は `main-stage` fullscreen 感に集中しているため、差分は許容する。

### Old Tests Encoding The Wrong UX

現状テストは inset stage を正しい見た目として固定している。
実装時はその期待値を壊すことが目的なので、単なる snapshot 修正ではなく「何を正に置き換えるか」を明確に更新する必要がある。

## Alternatives Considered

### A. Pure Full Bleed

- webview を全面に広げる
- chrome は小さく上に重ねる
- 採用

### B. Full Bleed + Soft Top Veil

- fullscreen は実現できる
- readability には有利
- ただし初手から top overlay を追加すると fullscreen の素直さが薄れるため今回は不採用

### C. Reduced Inset Stage

- 今の stage を少しだけ広げる
- 実装差分は小さい
- ただし「なぜ full screen にならないのか」という不満の芯を解決しないため不採用

## Implementation Targets

- `src/lib/browser-viewer-geometry.ts`
- `src/components/reader/browser-view.tsx`
- `src/components/reader/article-view.tsx`
- `src/__tests__/components/browser-view.test.tsx`
- 必要に応じて `src/__tests__/components/article-view.test.tsx`
- optional: `src-tauri/src/commands/browser_webview_commands.rs` の comment / diagnostics 補助
