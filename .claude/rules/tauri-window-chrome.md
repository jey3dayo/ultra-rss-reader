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
- `src/components/app-shell.tsx` は shell-wide の drag strip を置かず、`data-browser-overlay-root` にだけ titlebar helper class を付ける
- `src/components/app-layout.tsx` は常に top flush を保ち、pane header 自体が titlebar 領域まで上がる前提で組む
- 各 pane の visible header / toolbar が個別に top chrome を持つ。`sidebar-header-view.tsx`、`article-list-header.tsx`、`article-toolbar-view.tsx` の下線位置は揃える
- drag region の実装は現在まだ混在している。今後の変更では「狭い spacer を置く」より「visible header 内の非インタラクティブ面を自然に掴める」ことを優先する

## 制約

- OS ごとの titlebar 方針を勝手に共通化しない
- macOS overlay titlebar を使う変更では、Rust 側の `TitleBarStyle` とフロント側の offset / drag region を必ずセットで見直す
- `desktop-titlebar-offset` / `desktop-overlay-titlebar` を `AppLayout` や pane root に再度付けない
- shell-wide の透明 drag overlay を再導入しない。visible な pane header / toolbar の drag spacer を優先する
- header の見た目だけを直すために、`padding-top` や `top` を場当たり的に足して帳尻を合わせない
- `data-tauri-drag-region` を interactive 要素まで広げない。button / input / link / menu trigger / search field / toggle は drag region に含めない
- Windows / Linux 向け変更で macOS overlay 専用クラスを常時有効にしない

## drag 方針

- macOS overlay titlebar では、ユーザーが自然に掴む visible header / toolbar の非インタラクティブ面を drag 可能にする
- drag は「狭い spacer を探して掴む」前提にしない。タイトル、eyebrow、説明文、空き面などの passive content があるなら、その面を drag に使ってよい
- 一方で action button や search input などの操作要素は必ず drag から外す。クリック性・入力可能性を優先する
- shell-wide の透明 drag 層ではなく、各 pane の visible header / toolbar がそれぞれ drag 責務を持つ
- 祖先クラス経由の CSS `app-region` 依存で drag を成立させる設計は避け、Tauri の `data-tauri-drag-region` を直接使う構造を優先する
- 「header 全体を drag にする」か「中央 spacer のみ」に固定するのではなく、`操作要素を除いた visible surface` を drag にするのがデフォルト方針
- browser overlay のように上端 rail 自体がほぼ passive surface の場合は、その rail 全体を drag region にしてよい
- 逆に toolbar が操作要素だけで埋まっていて passive surface がほぼ無い場合のみ、狭い spacer 方式を許容する

## 変更時の確認ポイント

- macOS で visible な pane header / toolbar の passive surface を自然にドラッグできること
- macOS で pane 全体が 44px 下がらず、header が titlebar 領域まで上がっていること
- macOS で action button が drag に奪われず普通に押せること
- macOS でタイトル文字や説明文の近くを掴んでも drag が始まる一方、戻る/閉じる/検索などの操作は普通に動くこと
- sidebar / list / content の top border が 1px ずれず横一直線に見えること
- Windows で overlay 前提の余白や drag strip が混入しないこと
- `TitleBarStyle`、`shouldUseDesktopOverlayTitlebar()`、shell 側 helper class の 3 点が矛盾していないこと

## テスト方針

- macOS overlay 判定を変えたら `src/__tests__/app.test.tsx` を更新する
- shell の titlebar 補助要素を変えたら `src/__tests__/components/app-shell.test.tsx` を更新する
- header / toolbar の drag region 範囲や top border を変えたら `article-list-header` / `sidebar-header-view` / `article-toolbar-view` / `workspace-header` のテストを更新する
- drag テストは「spacer がある」ことより、「interactive 要素が drag region に含まれないこと」と「passive surface 側に drag region が置かれていること」を確認する

## 避けること

- macOS の空白を消したいだけで overlay titlebar の仕組みを理解せず CSS だけ削る
- `desktop-titlebar-offset` を shell と layout の両方に入れて二重に top inset を作る
- pane header より前面に透明な drag 要素を被せてクリックを奪う
- header 内の interactive 要素を drag region で覆う
- 掴める面が十分ある header なのに、40px x 72px のような狭い strip や中央 spacer のみに drag を閉じ込める
- ancestor selector で `app-region: drag` を当てないと動かない前提の CSS に依存する
- ネイティブ側は `Visible` のまま、フロントだけ overlay 前提の offset を入れる
- 逆にネイティブ側だけ `Overlay` にして、フロント側の offset / helper root を追加しない

## 強制

- [x] 手動レビュー
