# Pane Transition Animation Design

## Summary

購読→記事一覧→記事詳細のペイン遷移時にスライドアニメーションを追加する。
mobile / compact モードで `focusedPane` が切り替わる際に、ペインが水平スライドで遷移する。

## Current State

- `app-layout.tsx` が `resolveLayout()` の結果に基づき条件付きレンダリング（`&&`）でペインを表示/非表示
- wide モードでは常に全ペイン表示、compact で2ペイン、mobile で1ペイン
- ペイン切替は即時で、アニメーションなし

## Design

### Approach: CSS transform + transition

3ペインを常にレンダリングし、`overflow-hidden` コンテナ内で `translateX` によるスライドを行う。

### Layout Modes

Wide mode (≥1100px): 変更なし。3ペインを flex で並べる従来の条件付きレンダリング動作。

Mobile mode (<500px): 3ペインを各 `w-full shrink-0` で横並びにし、`focusedPane` に応じてスライドトレイを `translateX` で移動。

| focusedPane | translateX |
| ----------- | ---------- |
| sidebar     | `0%`       |
| list        | `-100%`    |
| content     | `-200%`    |

スライドトレイ全体幅: `300%`（各ペイン 100%）

Compact mode (500-1099px): sidebar(280px) + list(380px) + content を横並びにし、2ペインずつ表示。

| focusedPane    | 表示ペア       | translateX |
| -------------- | -------------- | ---------- |
| sidebar / list | sidebar + list | `0px`      |
| content        | list + content | `-280px`   |

スライドトレイ全体幅: `calc(100% + 280px)`

- これにより content ペインの幅 = `ビューポート幅 - 380px` となり、compact で list+content が正しく収まる。

### contentMode "browser" の扱い

compact/mobile モードでの browser モード:

- `contentMode === "browser"` のとき、`focusedPane` は `"content"` に設定される（既存の ui-store 動作）
- スライド位置の計算は通常の `focusedPane === "content"` と同じ
- sidebar/list は画面外に隠れ、`inert` で無効化される
- ブラウザビューから戻る操作で `focusedPane` が `"list"` に戻り、スライドアニメーションで list に遷移する

### Implementation

#### `app-layout.tsx` の変更

```tsx
export function AppLayout() {
  const { layoutMode, focusedPane, contentMode } = useUiStore();

  // Wide mode: 従来の条件付きレンダリング（アニメーションなし）
  if (layoutMode === "wide") {
    const panes = resolveLayout(layoutMode, focusedPane, contentMode);
    return (
      <div className="flex h-full overflow-hidden">
        {panes.includes("sidebar") && (
          <div className="w-[280px] shrink-0">
            <Sidebar />
          </div>
        )}
        {panes.includes("list") && (
          <div className="w-[380px] shrink-0">
            <ArticleList />
          </div>
        )}
        {panes.includes("content") && (
          <div className="min-w-0 flex-1">
            <ArticleView />
          </div>
        )}
      </div>
    );
  }

  // Mobile / Compact: スライドアニメーション
  return (
    <SlidingPaneLayout layoutMode={layoutMode} focusedPane={focusedPane} />
  );
}
```

#### `isPaneVisible` ヘルパー（`use-layout.ts` に追加）

```typescript
export function isPaneVisible(
  layoutMode: "compact" | "mobile",
  focusedPane: "sidebar" | "list" | "content",
  pane: Pane,
): boolean {
  if (layoutMode === "mobile") return focusedPane === pane;
  // compact: sidebar/list → sidebar+list 表示、content → list+content 表示
  if (focusedPane === "content") return pane !== "sidebar";
  return pane !== "content";
}
```

#### `computeTranslateX` ヘルパー（`use-layout.ts` に追加）

```typescript
export function computeTranslateX(
  layoutMode: "compact" | "mobile",
  focusedPane: "sidebar" | "list" | "content",
): string {
  if (layoutMode === "mobile") {
    switch (focusedPane) {
      case "sidebar":
        return "0%";
      case "list":
        return "-100%";
      case "content":
        return "-200%";
    }
  }
  // compact: sidebar+list → list+content
  return focusedPane === "content" ? "-280px" : "0px";
}
```

#### `SlidingPaneLayout` コンポーネント

```tsx
function SlidingPaneLayout({
  layoutMode,
  focusedPane,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
}) {
  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div className="h-full overflow-hidden">
      <div
        className={cn(
          "flex h-full transition-transform duration-300 ease-in-out motion-reduce:duration-0",
          isMobile ? "w-[300%]" : "w-[calc(100%+280px)]",
        )}
        style={{ transform: `translateX(${translateX})` }}
      >
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "w-[280px] shrink-0")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "sidebar")}
          {...(!isPaneVisible(layoutMode, focusedPane, "sidebar")
            ? { inert: "" }
            : {})}
        >
          <Sidebar />
        </div>
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "w-[380px] shrink-0")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "list")}
          {...(!isPaneVisible(layoutMode, focusedPane, "list")
            ? { inert: "" }
            : {})}
        >
          <ArticleList />
        </div>
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "min-w-0 flex-1")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "content")}
          {...(!isPaneVisible(layoutMode, focusedPane, "content")
            ? { inert: "" }
            : {})}
        >
          <ArticleView />
        </div>
      </div>
    </div>
  );
}
```

### Wide ↔ Compact/Mobile リサイズ遷移

layoutMode が wide から compact/mobile（またはその逆）に切り替わる際:

- React の条件分岐で `SlidingPaneLayout` ↔ wide レイアウトが切り替わる
- 切替時は `transition-transform` が適用されないため（DOM が再構築される）、ちらつきは発生しない
- compact/mobile 間の切替はスライドトレイが維持されるため、`translateX` の値変更に transition が適用される

### Accessibility

- 非表示ペインに `aria-hidden="true"` と `inert` 属性を付与（`isPaneVisible` で統一判定）
- `inert` によりフォーカストラップが効き、Tab キーで非表示ペインに移動しない
- `motion-reduce:duration-0` Tailwind クラスで `prefers-reduced-motion: reduce` 時にアニメーションを無効化

### Performance

- `transform` は GPU 合成レイヤーで処理、レイアウト再計算不要
- 実装時にジャンクが観測される場合は `will-change: transform` の追加を検討。スライド中のトレイのみに適用し、アイドル時は外すのが望ましい
- 非表示ペインは `inert` で入力を無効化するが、React ツリーは維持（state 保持のため）

### Testing

### `computeTranslateX` 単体テスト（6パターン）

- mobile x sidebar → "0%"
- mobile x list → "-100%"
- mobile x content → "-200%"
- compact x sidebar → "0px"
- compact x list → "0px"
- compact x content → "-280px"

### `isPaneVisible` 単体テスト（18パターン = 2 layoutMode x 3 focusedPane x 3 pane）

### `AppLayout` 統合テスト

- wide モードで3ペイン条件付きレンダリング（従来動作維持）
- mobile モードで全ペインレンダリング + 適切な aria-hidden/inert
- compact モードで全ペインレンダリング + 適切な aria-hidden/inert
- focusedPane 変更でスライドトレイの transform 値が更新される

### Scope

### 変更ファイル

- `src/components/app-layout.tsx` — SlidingPaneLayout 追加、wide 分岐
- `src/hooks/use-layout.ts` — `computeTranslateX`, `isPaneVisible` 追加

### 新規テスト

- `computeTranslateX` と `isPaneVisible` のユニットテスト
- `AppLayout` の layoutMode 別レンダリングテスト

### 変更なし

- `src/stores/ui-store.ts` — focusedPane の既存ロジックで対応可能
- `src/index.css` — Tailwind の `motion-reduce:` で対応するため CSS 追加不要
