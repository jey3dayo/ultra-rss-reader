# Browser Overlay Shell Role Design

## Goal

browser overlay を `section container` の延長ではなく `shell role` として定義し、操作 chrome と stage 境界の見た目責務を小さな shared API へ切り出す。
今回の目的は overlay 全体の再設計ではなく、`DESIGN.md` の surface governance に沿って `section` と `shell` の境界を明確にすることにある。

## Non-Goals

- browser overlay の文言、導線、ショートカット挙動の変更
- tooltip、dialog、本体 menu の見た目再設計
- webview geometry 計算ロジック自体の再設計
- article content や reader pane の information architecture 変更
- modal / command palette / app shell 全体を同時に共通化すること

## Current Problem

- `SurfaceCard` により `info card` と `section container` の整理は進んだが、browser overlay は依然として `rounded-full` と stage surface の class string が feature-local に散っている
- overlay の back / close / external action は card ではないが、何の role かが `DESIGN.md` に明示されていない
- `main-stage` と `content-pane` の stage boundary は section に見える部分と shell に見える部分が混在し、どこまで shared 化すべきか曖昧
- Storybook の `ui-reference-settings-canvas` には shell 例外が残っており、section 見本と exception 見本の境界が implementation knowledge 依存になっている

## Approved Direction

採用案は `Small Shell Primitives`。
browser overlay 専用の大型 kit は作らず、見た目責務だけを shared 側へ上げる。

- `OverlayActionSurface`
  overlay 上に浮く action surface を表す
- `OverlayStageSurface`
  `main-stage` / `content-pane` の境界 surface を表す
- geometry、absolute positioning、event handling は呼び出し側に残す
- `SurfaceCard` には shell を混ぜない
- `DESIGN.md` には shell role を `20px+ radius を許容する distinct outer surface` として追記する

## Role Model

### Section Container

`section container` は settings や overview のような構造面。
読みやすさ、情報グルーピング、layout separation を担う。

- 標準 radius: 8px default
- shared primitive: `SurfaceCard variant="section"`
- 20px+ は原則使わない

### Shell Role

`shell role` は overlay、modal、command palette、app-level outer frame などの外装面。
中身を読む card ではなく、上に載る chrome と framing boundary を担う。

- 20px+ radius を許容できる
- blur、floating elevation、translucent surface を持ちうる
- section container と見本を混ぜない

今回の browser overlay はこの `shell role` に属する。

## Component Boundaries

### `OverlayActionSurface`

browser overlay の action button 背景面だけを表す small primitive。

対象:

- back to reader
- close-only button
- open in external browser

責務:

- radius
- border
- background alpha
- blur
- hover / focus / active feedback
- compact / regular の size tone

責務外:

- absolute positioning
- icon choice
- aria-label
- click handler

### `OverlayStageSurface`

overlay で webview を囲う stage boundary の surface primitive。

対象:

- `main-stage`
- `content-pane`

責務:

- border 有無
- bg
- shadow
- clipping / overflow

責務外:

- geometry calculation
- stage rect の決定
- webview host placement

## API Direction

### `OverlayActionSurface`

想定 API:

```tsx
<OverlayActionSurface compact={isCompactViewer} tone="default">
  {children}
</OverlayActionSurface>
```

props:

- `compact: boolean`
- `tone: default | subtle`
- `className`
- `children`

この component は shell button の「背景面」を統一する。
button そのものの意味や icon は各 caller が持つ。

### `OverlayStageSurface`

想定 API:

```tsx
<OverlayStageSurface scope="content-pane">
  {children}
</OverlayStageSurface>
```

props:

- `scope: main-stage | content-pane`
- `className`
- `children`

`main-stage` は borderless で immersive 側、`content-pane` は framed 側、という差だけを shared に閉じ込める。

## Initial Scope

初回適用先は次の 3 ファイルに限定する。

- `src/components/reader/browser-overlay-presentation.ts`
- `src/components/reader/browser-overlay-chrome.tsx`
- `src/components/reader/browser-view.tsx`

必要に応じて `src/components/shared` 配下へ追加するが、tooltip や dialog には広げない。

## Storybook Handling

`ui-reference-settings-canvas` では shell 例外を section 見本から分離する。

- left rail outer frame
- main content outer frame
- dialog surface
- context menu

これらは `section` 見本ではなく `shell example` として扱う。
section 見本の reference canvas に shell 例外を混ぜたままにしない。

## Design Rules

### Action Chrome

- action chrome は card ではなく shell surface
- compact mode でも floating button の optical weight を保つ
- hover / focus / active は shell の透明感を崩さず、border と bg の差で見せる

### Stage Boundary

- `main-stage` は immersive 側の shell surface
- `content-pane` は framed 側の shell surface
- どちらも section card の延長ではなく、embedded viewer の framing として扱う

### Separation From Section

- settings section や overview panel と同じ radius language を使わない
- shell は shell として見せ、例外であることを reference 上でも分かるようにする

## Risks

1. shell と section の境界を曖昧にしたまま shared 化し、`SurfaceCard` と責務が競合する
対応:
shell 用 primitive を別名で分け、`SurfaceCard` に混ぜない

2. browser overlay 専用ロジックを shared primitive に持ち込みすぎる
対応:
geometry と positioning は caller に残し、見た目責務だけを shared 化する

3. Storybook の reference canvas が section 基準面として使いづらくなる
対応:
shell 例外を label 上も構造上も分離し、section 見本と混ぜない

## Validation

- `DESIGN.md` に shell role が section と分けて明記されている
- browser overlay の action chrome が shared shell primitive を使う
- browser overlay の stage boundary が shared shell primitive を使う
- `SurfaceCard` と shell primitive の責務が混ざっていない
- `ui-reference-settings-canvas` で shell 例外が section 見本から分離されている
- 最終的に `mise run check` を通す
