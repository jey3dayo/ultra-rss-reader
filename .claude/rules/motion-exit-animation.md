# 退場アニメーション

リストから消える行・要素に収縮やフェードを付けるときのルール。

## 制約

- **遷移元の値を持つ base クラスは、退場していない平常時から当てる。** 状態の切り替えは `data-*` 属性だけで行う。退場が始まる瞬間にクラスを付ける実装にしない
- 退場のために要素を出し入れしない。ラッパーは常時同じ位置にマウントし続ける。要素を作り直すと focus が飛び、トランジションの遷移元も失われる
- 収縮のイージングは入場用トークンを流用しない（選び方は [../../DESIGN.md](../../DESIGN.md) の Transitions が正本）
- 親と子の両方に収縮を掛けない。親が退場するときは親だけ、親が生存していて子が退場するときは子だけ、と owner を 1 つに決める。二重に掛けると高さの減少が重なる
- 退場中の要素は即座に操作対象から外す。`pointer-events: none` や `inert` だけに頼らず、アプリ独自の ID / DOM 探索に使われている属性（navigation 登録、選択マーカー、drop target 等）を実際に外す
- 退場の後始末を `transitionend` に依存しない。トランジションが走らない条件（`prefers-reduced-motion`、補間非対応のプロパティ）ではイベントが発火せず、要素が永久に残る

## 根拠

CSS トランジションは、変更前の計算値が存在して初めて補間できる。退場時にクラスを付ける実装では、そのクラスが持つ `transition` 宣言と終了値が同時に現れるため、遷移元が確定せず補間されない。`grid-template-rows` を使う収縮では、トラックが `none` から `0fr` へ一段で変わるので必ずジャンプする。

この失敗は DOM とテストの両方をすり抜ける。要素自体は常時マウントされていて「退場状態になり、時間経過で消える」ことはテストで固定できるため、ゲートは緑のまま通る。気づけるのは平常時の DOM にクラスが無いことを見たときか、実画面で見たときだけ。

## 例

### 正しい

```tsx
// クラスは常設、属性だけトグル
<div
  className={MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME}
  {...(collapsing ? { [MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE]: "true" } : {})}
>
```

```css
/* base が遷移元と transition を持つ */
.motion-sidebar-row-collapse {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--motion-duration-contextual) var(--motion-ease-collapse),
    opacity var(--motion-duration-contextual) var(--motion-ease-collapse);
}

.motion-sidebar-row-collapse[data-motion-sidebar-row-leaving="true"] {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
  margin-top: 0;
}
```

### 不正

```tsx
// 退場時に初めてクラスが付く。遷移元が無いので補間されずジャンプする
<div className={collapsing ? MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME : undefined}>
```

## 収縮の外側の余白

`grid-template-rows: 0fr` はトラックを 0 にするだけで、その要素の外側にある `margin` / `border` / 親の `space-y-*` は残る。最終的な占有高を 0 にするには、退場状態でそれらも明示的に潰すこと。`sidebar-density.ts` の `childGap` のように密度で変わる余白は、密度ごとに確認する。

## 参照実装

`src/components/reader/feed-tree-row-collapse.tsx` と、`src/styles/motion.css` の
`.motion-sidebar-row-collapse`。motion 規則は `global.css` から切り出してあり、
`--motion-*` トークンだけが `global.css` の `:root` に残る。読み込み順が
効くので、`src/main.tsx` と `.storybook/preview.ts` で `global.css` の後に
読むこと（`src/__tests__/config/motion-css-cascade-order-contract.node.test.ts` が固定）。保持側の状態機械は
`src/components/reader/hooks/sidebar/use-feed-tree-presence.ts`。

## 強制

- [x] 手動レビュー
- [x] 実画面確認（[ui-design-review-loop.md](./ui-design-review-loop.md) の必須フロー）

## 関連ルール

- [ui-browser-prep.md](./ui-browser-prep.md): 実画面で確認する手順。背景タブではアニメーションの時計が進まない
- [ui-design-review-loop.md](./ui-design-review-loop.md): 完了前の観点別チェック
- [async-side-effect-policy.md](./async-side-effect-policy.md): 保持タイマーの cleanup と stale 完了の扱い
