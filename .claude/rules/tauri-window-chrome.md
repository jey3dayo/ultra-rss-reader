---
paths:
  - "src-tauri/src/lib.rs"
  - "src/lib/window-chrome.ts"
  - "src/components/app-shell.tsx"
  - "src/components/app-layout.tsx"
  - "src/components/reader/*"
  - "src/styles/global.css"
  - "src/__tests__/app.test.tsx"
  - "src/__tests__/components/app-shell.test.tsx"
  - "src/__tests__/components/*"
---

# Tauri window chrome / header ルール

## 背景

Tauri の header / titlebar は OS ごとに挙動が違う。特に macOS は overlay titlebar を使うと、コンテンツがネイティブ titlebar 領域の下に潜り込む前提になる一方、Windows は通常 titlebar のまま扱う方が自然。

この差分を無視して共通 header を組むと、macOS では上端に謎の空白が見えたり、逆にドラッグできない領域ができたりする。

## 現在の実装

- `src-tauri/src/lib.rs` では macOS のみ `tauri::TitleBarStyle::Overlay`、それ以外は `Visible` を使う
- `src/lib/window-chrome.ts` の `shouldUseDesktopOverlayTitlebar()` も macOS + Tauri runtime のときだけ `true` を返す
- フロント側は `src/styles/global.css` の `--desktop-titlebar-offset: 44px` を使うが、この offset は `AppLayout` には入れない
- `src/components/app-shell.tsx` が macOS overlay 時専用の `desktop-titlebar-drag-strip` と `data-browser-overlay-root` を持ち、titlebar helper class は shell 側だけに付ける
- `src/components/app-layout.tsx` は常に top flush を保ち、pane header 自体が titlebar 領域まで上がる前提で組む
- 各 header / toolbar 内の `data-tauri-drag-region` は中央の spacer に限定し、ボタン群を drag region に含めない。これで操作ボタンのクリック性を守る

## 制約

- OS ごとの titlebar 方針を勝手に共通化しない
- macOS overlay titlebar を使う変更では、Rust 側の `TitleBarStyle` とフロント側の offset / drag region を必ずセットで見直す
- `desktop-titlebar-offset` / `desktop-overlay-titlebar` を `AppLayout` や pane root に再度付けない
- header の見た目だけを直すために、`padding-top` や `top` を場当たり的に足して帳尻を合わせない
- `data-tauri-drag-region` を header 全体に広げない。操作ボタンが押せなくなるため、drag は専用 strip または中央 spacer に限定する
- Windows / Linux 向け変更で macOS overlay 専用クラスを常時有効にしない

## 変更時の確認ポイント

- macOS で上端の見えている帯を実際にドラッグできること
- macOS で pane 全体が 44px 下がらず、header が titlebar 領域まで上がっていること
- macOS で action button が drag に奪われず普通に押せること
- Windows で overlay 前提の余白や drag strip が混入しないこと
- `TitleBarStyle`、`shouldUseDesktopOverlayTitlebar()`、shell 側 helper class の 3 点が矛盾していないこと

## テスト方針

- macOS overlay 判定を変えたら `src/__tests__/app.test.tsx` を更新する
- shell の titlebar 補助要素を変えたら `src/__tests__/components/app-shell.test.tsx` を更新する
- header / toolbar の drag region 範囲を変えたら `article-list-header` / `sidebar-header-view` / `article-toolbar-view` のテストを更新する

## 避けること

- macOS の空白を消したいだけで overlay titlebar の仕組みを理解せず CSS だけ削る
- `desktop-titlebar-offset` を shell と layout の両方に入れて二重に top inset を作る
- header 内の interactive 要素を drag region で覆う
- ネイティブ側は `Visible` のまま、フロントだけ overlay 前提の offset を入れる
- 逆にネイティブ側だけ `Overlay` にして、フロント側の offset / drag strip を追加しない

## 強制

- [x] 手動レビュー
