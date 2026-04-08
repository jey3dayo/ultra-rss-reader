# Web Preview Minimal Viewer Design

## Overview

既存の `Web Preview` は、reader の 3 ペイン文脈を引きずったまま overlay を重ねているため、右端の面積を十分に使えず、`×` ボタンや HUD も含めて「中途半端なモーダル」に見えている。

今回の変更では、`Web Preview` を `X` の画像ビューアに近い `Minimal Viewer` へ置き換える。
記事から開いた場合も、`intent=open-web-preview-url` で直接開いた場合も、同じ viewer shell に着地させる。

## Goals

- `Web Preview` 中は sidebar / article list / article pane を隠し、閲覧面積を最大化する
- viewer shell を `intent` 起動と通常起動で完全に共通化する
- native WebView の bounds 計算を単純化し、viewport 基準の stable な inset に寄せる
- 左上 `×` と右上の最小アクションだけを残し、タイトルラベルや余計な chrome を排除する
- WebView 外の scrim 領域クリックで閉じる、ダイアログに近い自然な操作感を持たせる

## Non-Goals

- 外部ブラウザ相当のフル機能 chrome を app 内へ再現すること
- `Web Preview` 専用の別 window を増やすこと
- 通常 reader 画面の pane 構成自体を全面的に作り直すこと
- site ごとの CSS 注入や viewport ハックで中央寄せレイアウトを矯正すること

## Problem Statement

現状の HUD 計測では、native WebView と host rect 自体は一致している。

- viewport: `1274x801`
- host: `976x735`
- native: `976x735`
- match: `100%`

つまり主問題は Rust / Tauri 側の child webview のズレではなく、「どこまで viewer shell に面積を与えるか」という app layout の設計である。
そのため、小さな補正を積み重ねるより、viewer mode へ明確に振り切る方が UX と実装の両面で合理的である。

## Approved UX

### Chosen Pattern

採用案は `Minimal Viewer`。

- 背景の reader UI は黒い scrim で沈める
- sidebar / article list / article pane は viewer 中は視覚的に退かす
- 左上に `×`
- 右上に最小アクションだけを置く
- `WEBプレビュー` のタイトル文字は表示しない

## Viewer Shell

viewer shell は `modal` より `immersive viewer mode` として扱う。

- viewer は viewport のほぼ全面を使う
- 初期 inset 目安:
  - `left: 16-20px`
  - `right: 16-20px`
  - `top: 16px`
  - `bottom: 12-16px`
- native WebView はこの shell 内で最大限広げる
- 背景 reader は interaction を受けず、viewer 終了まで視覚的な文脈だけ残す

### Chrome Density

- 左上:
  - close (`×`)
- 右上:
  - 第一段階では `open externally (↗)` のみ
  - 将来的に `…` を足せる構造にはする
- 常設 title / subtitle / helper copy は置かない

## Entry Points

以下の 2 経路は、見た目も state model も同一にする。

1. 通常の `Web Preview` 起動
2. `intent=open-web-preview-url` による直接起動

これにより、開発用の別レイアウトを持たず、スクリーンショット検証と HUD 計測も常に同じ条件で行える。

## Interaction Model

### Open

- 記事から `Web Preview` を開く
- dev intent から URL を渡して直接 `Web Preview` を開く
- どちらも同じ `Minimal Viewer` shell に入る

### Close

- 左上 `×`
- `Esc`
- **WebView 外の黒い scrim 領域クリック**

外側クリックは 1 回で即 close とする。
右上アクション押下は close 条件に含めない。
WebView 本体内クリックでは閉じない。

### Motion

- open: `fade + slight scale`
- close: その逆
- duration は `180-220ms`
- background scrim は viewer と同時に暗くする

## Layout and Bounds Strategy

### Source of Truth

viewer の geometry source of truth は frontend DOM とする。

- React が viewer host rect を決める
- Rust はその rect を native WebView にそのまま一致させる
- 特別な site-aware 補正や、intent 専用の別 bounds 計算は増やさない

### Simplified Responsibility Split

- React:
  - viewer shell の表示
  - inset の決定
  - scrim / buttons / HUD の配置
- Rust:
  - 受け取った bounds へ native WebView を一致させる

この分離により、調査ポイントを `viewer shell` と `native bounds sync` の 2 箇所に限定できる。

## HUD Strategy

- HUD は `設定 > デバッグ` が ON のときだけ表示する
- viewer 最上部へ細い rail として重ねる
- 通常時は完全に消す
- `intent` 起動でも通常起動でも同じ HUD を使う

これにより、dev 専用 UI と通常 UI の差異を作らない。

## Implementation Approach

### Frontend

- `BrowserView` に immersive viewer shell を持たせる
- 記事起動と intent 起動の差は `ArticleView` もしくはその上位で吸収し、表示コンポーネントは共通化する
- 既存の `main-stage` 内 pane 計算へ寄せすぎず、viewer 用には viewport 基準の単純な inset を採用する
- scrim click で close する hit area を WebView 外周に持たせる

### Backend

- 既存の native WebView create/update 経路は維持する
- 新 shell に合わせて渡される host rect をそのまま適用する
- intent 用の別 native window や別 label flow は増やさない

## Accessibility

- close button は明確な `aria-label` を持つ
- `Esc` で閉じられる
- icon-only action は tooltip / label を持つ
- scrim click で閉じるが、誤爆しやすい hover-only affordance にはしない
- reduced motion 環境では open/close animation を短縮または無効化できるようにする

## Testing

### Frontend

- `intent` 起動でも通常起動でも同じ viewer shell が描画される
- `WEBプレビュー` タイトルが表示されない
- 左上 `×` が表示される
- 右上 `↗` が表示される
- scrim click で close する
- WebView host click では close しない
- `Esc` で close する
- HUD は設定 ON のときだけ表示される

### Screenshot Verification

- Tauri dev 再起動後に `intent=open-web-preview-url` で viewer を直接開く
- 右端の未使用 gutter がほぼ消えていることを確認する
- `×` と右上 action の chrome バランスが極端に浮かないことを確認する

## Alternatives Considered

### A. Balanced Overlay

- 既存の `WEBプレビュー` タイトル付き overlay を少しだけ広げる
- 実装差分は小さい
- ただし「中途半端なモーダル感」が残るため不採用

### B. Minimal Viewer

- viewer shell をほぼ全面化し、最小アクションだけ残す
- UX と実装の両面で最も素直
- 採用

### C. Full Bleed Viewer

- 完全な edge-to-edge で button も直置き
- 没入感は最大だが、close chrome の安全余白や app との調和がやや荒くなる
- 初手としては強すぎるため不採用

## Risks

### Reader Context Loss

viewer 中は sidebar や article list を完全に退かすため、一覧文脈は一時的に消える。
ただし今回の要求は「web page を見ているときは sidebar は不要」であり、要求と整合するため許容する。

### Scrim Close Misfire

WebView 外クリック close は自然だが、外周が狭すぎると狙って閉じにくい。
viewer inset は close hit area を十分確保できる値にする必要がある。

## Implementation Targets

- `src/components/reader/browser-view.tsx`
- `src/components/reader/article-view.tsx`
- `src/components/app-layout.tsx`
- `src/hooks/use-layout.ts`
- `src/__tests__/components/browser-view.test.tsx`
- `src/__tests__/components/article-view.test.tsx`
- Tauri native browser webview の bounds 同期まわり

