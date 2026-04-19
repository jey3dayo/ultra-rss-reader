---
paths:
  - "src-tauri/src/lib.rs"
  - "src/lib/window-chrome.ts"
  - "src/components/app-shell.tsx"
  - "src/components/app-layout.tsx"
  - "src/components/shared/workspace-header.tsx"
  - "src/components/shared/workspace-header.stories.tsx"
  - "src/components/reader/sidebar-header-view.tsx"
  - "src/components/reader/*"
  - "src/styles/global.css"
  - "src/__tests__/app.test.tsx"
  - "src/__tests__/components/app-shell.test.tsx"
  - "src/__tests__/components/design-shared-components.test.tsx"
  - "src/__tests__/components/sidebar-header-view.test.tsx"
  - "src/__tests__/components/shared-stories.test.tsx"
  - "src/__tests__/components/*"
---

# Tauri window chrome / header ルール

## 背景

Tauri の window chrome は OS ごとに前提が違う。特に macOS は overlay titlebar を使うと、コンテンツがネイティブ titlebar 領域の下に潜り込む前提になる。一方で Windows は通常 titlebar のまま扱う方が自然で、browser mode はそもそも desktop chrome 前提を持たない。

この差分を無視して共通 header を組むと、macOS では信号ボタン領域と drag surface が壊れ、Windows では mac 用の余白が残り、browser mode では desktop 前提の offset が混入する。

## 現在の実装

- ネイティブ側は `src-tauri/src/lib.rs` で macOS のみ `tauri::TitleBarStyle::Overlay`、それ以外は `Visible` を使う
- フロント側の判定入口は `src/lib/window-chrome.ts` の `hasTauriRuntime()` と `shouldUseDesktopOverlayTitlebar()` に閉じる
- `shouldUseDesktopOverlayTitlebar()` は `macos + Tauri runtime` のときだけ `true`
- 初回 desktop render で `platformKind === "unknown"` でも、`navigator.platform` が mac なら一時的に overlay として扱い、1 フレームだけ mac 余白が跳ねるのを防ぐ
- `src/components/app-layout.tsx` は top flush を保ち、pane header 自体が上端を取る
- `src/components/app-shell.tsx` は shell-wide の透明 drag strip を置かず、pane header / toolbar が個別に top chrome を持つ
- `src/components/shared/workspace-header.tsx` は 3 モードで責務を分ける
  - `browser`: drag-region なし、desktop offset なし、eyebrow は top row
  - `windows + Tauri`: compact desktop header。drag-region なし、mac 用 offset なし、eyebrow は top row
  - `macOS + Tauri overlay`: drag-region あり、左 drag region 幅 `72px`、title group offset `24px`、eyebrow は title group
- `src/components/reader/sidebar-header-view.tsx` の `pl-20` は mac overlay のときだけ有効。Windows と browser では入れない
- Storybook では `src/components/shared/workspace-header.stories.tsx` に `BrowserPreview / MacDesktop / WindowsDesktop` を持ち、runtime mock を初回描画から同期適用して比較できる状態にする
- `src/__tests__/components/design-shared-components.test.tsx`、`sidebar-header-view.test.tsx`、`shared-stories.test.tsx` で mac 維持 / windows 圧縮 / browser 非 desktop を固定する

## 制約

- OS ごとの titlebar 方針を勝手に共通化しない
- macOS overlay titlebar を使う変更では、Rust 側の `TitleBarStyle` とフロント側の offset / drag region を必ずセットで見直す
- `desktop-titlebar-offset` / `desktop-overlay-titlebar` を `AppLayout` や pane root に再度付けない
- shell-wide の透明 drag overlay を再導入しない。visible な pane header / toolbar の drag spacer を優先する
- header の見た目だけを直すために、`padding-top` や `top` を場当たり的に足して帳尻を合わせない
- `data-tauri-drag-region` を interactive 要素まで広げない。button / input / link / menu trigger / search field / toggle は drag region に含めない
- browser mode に desktop chrome 前提の offset / drag-region / padding を混入させない
- Windows / Linux 向け変更で macOS overlay 専用クラスを常時有効にしない
- desktop overlay 時に top row や title group の drag surface を interactive 要素より前面に置かない。必要なら passive wrapper 側で `pointer-events-none`、button 側で `pointer-events-auto` を使う
- Windows header を詰める変更では、compact 化は `WorkspaceHeader` 側の分岐に閉じ、browser と mac を巻き込まない
- 大きい drag surface を敷く場合、text wrapper や row wrapper がその上で hit test を奪わないようにする。passive content 側の wrapper には `pointer-events-none` を検討し、interactive 要素だけ `pointer-events-auto` で戻す

## drag 方針

- macOS overlay titlebar では、ユーザーが自然に掴む visible header / toolbar の非インタラクティブ面を drag 可能にする
- drag は「狭い spacer を探して掴む」前提にしない。タイトル、eyebrow、説明文、空き面などの passive content があるなら、その面を drag に使ってよい
- 一方で action button や search input などの操作要素は必ず drag から外す。クリック性・入力可能性を優先する
- shell-wide の透明 drag 層ではなく、各 pane の visible header / toolbar がそれぞれ drag 責務を持つ
- 祖先クラス経由の CSS `app-region` 依存で drag を成立させる設計は避け、Tauri の `data-tauri-drag-region` を直接使う構造を優先する
- 「header 全体を drag にする」か「中央 spacer のみ」に固定するのではなく、`操作要素を除いた visible surface` を drag にするのがデフォルト方針
- browser overlay のように上端 rail 自体がほぼ passive surface の場合は、その rail 全体を drag region にしてよい
- 逆に toolbar が操作要素だけで埋まっていて passive surface がほぼ無い場合のみ、狭い spacer 方式を許容する
- drag surface の可視化は有効だが、「色が付いている = 掴める」ではない。実際の hit testing は積層順と pointer-events に左右される

## 変更時の確認ポイント

- macOS で visible header の passive surface を自然にドラッグできること
- macOS で `WorkspaceHeader` の左 drag region 幅と title offset が維持されていること
- macOS で戻る / 閉じる / shortcut などの action button が drag に奪われず普通に押せること
- Windows で mac 用の上余白や左逃がしが残らず、compact header が使われていること
- browser mode で desktop offset や drag-region が混入しないこと
- `TitleBarStyle`、`shouldUseDesktopOverlayTitlebar()`、`WorkspaceHeader` / `SidebarHeaderView` の分岐が矛盾していないこと
- Storybook で `browser / mac / windows` の 3 story が import error なしで開くこと
- 実アプリ確認時は、Windows は Tauri 実機、browser は `mise run app:dev:browser`、mac は story / テスト / 実機のいずれかで確認する
- 実機では title 文字の真上、eyebrow の真上、説明文の真上、右上ボタンの左側の空き面の 4 点で drag を試すこと

## テスト方針

- macOS overlay 判定を変えたら `src/__tests__/app.test.tsx` を更新する
- shell の titlebar 補助要素を変えたら `src/__tests__/components/app-shell.test.tsx` を更新する
- `WorkspaceHeader` の mode 分岐を変えたら `src/__tests__/components/design-shared-components.test.tsx` と `src/__tests__/components/shared-stories.test.tsx` を更新する
- `SidebarHeaderView` の mac 専用逃がしを変えたら `src/__tests__/components/sidebar-header-view.test.tsx` を更新する
- drag テストは「spacer がある」ことより、「interactive 要素が drag region に含まれないこと」と「passive surface 側に drag region が置かれていること」を確認する
- Storybook 確認導線を触ったら `workspace-header.stories.tsx` の runtime mock と `shared-stories.test.tsx` の両方を見直す
- drag 修正の完了判定は DOM テストだけで終えない。`tauri-dev-screenshot` や browser 実画面確認で layout 崩れと drag surface の位置を必ず目視確認する

## 避けること

- macOS の空白を消したいだけで overlay titlebar の仕組みを理解せず CSS だけ削る
- `desktop-titlebar-offset` を shell と layout の両方に入れて二重に top inset を作る
- pane header より前面に透明な drag 要素を被せてクリックを奪う
- header 内の interactive 要素を drag region で覆う
- browser mode を desktop app の一種として扱い、Windows と同じ compact desktop 分岐に混ぜる
- 掴める面が十分ある header なのに、40px x 72px のような狭い strip や中央 spacer のみに drag を閉じ込める
- ancestor selector で `app-region: drag` を当てないと動かない前提の CSS に依存する
- drag surface を広げるために上段 wrapper を増やし、その wrapper 自体が title block を押し下げる
- drag 可視化の色だけ見て「掴めるはず」と判断し、実機の hit testing を確認しない
- ネイティブ側は `Visible` のまま、フロントだけ overlay 前提の offset を入れる
- 逆にネイティブ側だけ `Overlay` にして、フロント側の offset / helper root を追加しない
- Storybook の stale cache / HMR 崩れを app ロジックの不具合と決めつける。まず fresh 起動で `workspace-header` の 3 story を見直す

## 強制

- [x] 手動レビュー
