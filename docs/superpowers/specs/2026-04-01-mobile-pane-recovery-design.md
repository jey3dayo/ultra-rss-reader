# Mobile Pane Recovery Design

## Summary

幅 375px 前後の mobile レイアウトで、初期表示や詳細表示から戻ったあとに sidebar へ戻れず、
設定・同期・フィード追加・アカウント切り替え導線が画面外へ退避したままになる不具合を解消する。

方針は「通常利用では list を主表示にする」「空状態では sidebar を主表示にする」
「どの pane にいても mobile で詰まらない戻り導線を保証する」の 3 点とする。

## Current State

- `src/stores/ui-store.ts`
  - 初期状態は `focusedPane: "sidebar"`
  - 一方で `selectAccount` / `selectFeed` / `selectFolder` / `selectSmartView` / `selectTag` / `selectAll`
    はすべて `focusedPane: "list"` に遷移する
  - `selectArticle` は `focusedPane: "content"` に遷移する
  - `clearArticle` / `closeBrowser` は `contentMode` のみ戻し、pane の戻り先は呼び出し側依存

- `src/hooks/use-breakpoint.ts`
  - viewport 幅に応じて `layoutMode` のみを更新し、mobile 時にどの pane を見せるかは補正しない

- `src/components/app-layout.tsx`
  - mobile/compact の描画は store の `focusedPane` をそのまま使って `translateX` を決める
  - そのため viewport 切替直後や戻り操作後に `focusedPane` が不適切でも、描画側で救済されない

- `src/components/reader/article-view.tsx`
  - `表示を閉じる` は `clearArticle()` の後で `layoutMode !== "wide"` の場合に `focusedPane = "list"` を明示している
  - ただし browser を閉じる経路や、list から sidebar に戻る経路は別途保証されていない

## Goals

- 幅 `375x900` の初期表示で、少なくとも 1 つの主要導線が必ず画面内にある
- アカウント未選択や空状態では sidebar を前面にし、設定/アカウント追加導線を操作可能にする
- 通常利用で list を前面表示しても、mobile で sidebar へ戻る導線を常に確保する
- 記事詳細や browser 表示から閉じたあと、list へ戻り、そこから sidebar へ戻れる
- compact / wide の既存挙動は変更しない

## Non-Goals

- wide / compact のレイアウト構造の再設計
- 新しいモバイル専用ナビゲーション UI の導入
- 設定モーダル自体の構成変更

## Design

### 1. Mobile の実表示 pane を描画時に解決する

`src/hooks/use-layout.ts` に mobile 用の純粋関数を追加し、store の `focusedPane` をそのまま採用せず、
描画時に「実際に前面へ出す pane」を決める。

解決ルール:

- `layoutMode !== "mobile"` の場合は store の `focusedPane` をそのまま使う
- `layoutMode === "mobile"` かつ `selectedAccountId === null` の場合は `sidebar`
- `layoutMode === "mobile"` かつ `focusedPane === "content"` の場合は `content`
- `layoutMode === "mobile"` で通常利用時は `list`

これにより、初期化順や viewport 切替の一瞬のズレで `list` と `sidebar` のどちらを見せるべきかが
不安定でも、最終描画は mobile 向けの期待値に収束する。

### 2. Store は「操作後にどこを見るか」を担当する

`src/stores/ui-store.ts` の責務は viewport 条件ではなく、ユーザー操作起点の遷移に限定する。

- `selectAccount` / `selectFeed` / `selectFolder` / `selectSmartView` / `selectTag` / `selectAll`
  - 既存どおり `focusedPane = "list"`
- `selectArticle`
  - 既存どおり `focusedPane = "content"`
- `clearArticle`
  - `contentMode = "empty"` に戻すだけでなく、mobile/compact からの「閉じる」系で使う場合は
    呼び出し側で `focusedPane = "list"` を合わせる既存方針を明示する
- `closeBrowser`
  - browser を閉じたあと `selectedArticleId` があれば `reader`、なければ `empty`
  - さらに mobile/compact では `focusedPane = "list"` を戻り先として保証する

`closeBrowser` に戻り先を内包させることで、「記事を閉じる導線は戻るが、browser を閉じる導線だけ戻らない」
という分岐漏れを防ぐ。

### 3. Mobile で sidebar へ戻る導線を常設する

初期 pane の解決だけでは再発を防ぎきれないため、`list` と `content` から sidebar へ戻る導線を追加する。
既存 UI を大きく崩さず、以下のどちらかの導線で対応する。

推奨:

- `list` ヘッダーに sidebar を開くボタンを追加する
- `content` ヘッダーにも同様の戻り導線を追加する
- 表示条件は `layoutMode === "mobile"` のみ

この導線は「モバイルで account/feed/settings へ戻るためのナビゲーション」として扱い、
見た目の close/back ではなく「sidebar を開く」という意味の操作にする。

### 4. AppLayout は解決済み pane を使って描画する

`src/components/app-layout.tsx` では store の `focusedPane` を直接使わず、
`use-layout` の解決関数から得た `activePane` を `computeTranslateX` と `isPaneVisible` に渡す。

これにより:

- mobile 初期表示の pane が描画責務として安定する
- store 側のイベント遷移と viewport 条件が分離される
- compact / wide のロジックへの影響を最小化できる

## Data Flow

### Initial Render on Mobile

1. `useBreakpoint()` が viewport 幅から `layoutMode = "mobile"` をセットする
2. `AppLayout` が store state を読み取る
3. `use-layout` の解決関数が `selectedAccountId` と `focusedPane` から `activePane` を決定する
4. `SlidingPaneLayout` が `activePane` を使って `translateX` と `aria-hidden` / `inert` を決める

### User Navigation on Mobile

1. feed/account/tag/smart view 選択時は store が `focusedPane = "list"` に更新する
2. article 選択時は store が `focusedPane = "content"` に更新する
3. browser / reader を閉じると store が `focusedPane = "list"` を戻り先として保証する
4. sidebar ボタンを押すと store が `focusedPane = "sidebar"` に更新する

## Error Handling / Edge Cases

- アカウント未設定
  - mobile では常に `sidebar` を前面表示にする
- 記事未選択で browser を閉じる
  - `contentMode = "empty"` に戻しつつ `focusedPane = "list"` に戻す
- desktop/compact から mobile へのリサイズ直後
  - store state が `content` なら content を維持
  - store state が `sidebar` / `list` でも、`selectedAccountId` の有無で `sidebar` or `list` を解決する
- settings modal 開閉
  - pane 解決には関与させず、モーダルを閉じたあとも underlying layout が詰まらない状態を維持する

## Testing

### Unit Tests

- `src/hooks/use-layout.ts`
  - mobile 初期 pane 解決関数のテスト
  - `selectedAccountId === null` なら `sidebar`
  - 通常利用時は `list`
  - `focusedPane === "content"` は維持

- `src/stores/ui-store.ts`
  - `closeBrowser()` が mobile/compact の戻り先として `focusedPane = "list"` を保証する
  - 既存の list 指向アクションが `focusedPane = "list"` を維持する

### Integration Tests

- `src/components/app-layout.tsx`
  - mobile 幅で `focusedPane` と `selectedAccountId` の組み合わせに応じて正しい pane が前面表示される
  - `aria-hidden` / `inert` が `activePane` に追従する

### Browser/E2E Verification

- viewport `375x900`
- 初期表示で account 未設定時に sidebar が画面内にある
- 通常利用時に list が前面表示される
- list から sidebar へ戻る導線が押せる
- article open → `表示を閉じる` → list → sidebar と戻れる
- browser open → close → list → sidebar と戻れる

## Scope

### 変更対象

- `src/hooks/use-layout.ts`
  - mobile の実表示 pane 解決関数追加
- `src/components/app-layout.tsx`
  - mobile 時に解決済み pane を使うよう変更
- `src/stores/ui-store.ts`
  - `closeBrowser` の戻り先保証
- mobile で list/content から sidebar を開く導線を持つコンポーネント
  - 候補: `src/components/reader/article-list.tsx`
  - 候補: `src/components/reader/article-view.tsx`

### 変更しないもの

- settings modal の構造
- wide / compact の表示ルール
- データ取得や同期ロジック
