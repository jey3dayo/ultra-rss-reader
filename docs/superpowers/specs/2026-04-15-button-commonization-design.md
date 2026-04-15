# Button Commonization Design

## Summary

ボタンの見た目と責務が画面ごとにばらついているため、
既存の `Button` 基盤は維持しつつ、
用途別の薄い共通コンポーネントへ寄せて独自デザインのパーツを減らす。

今回の初回スコープでは、特に差分が大きい以下を対象にする。

- 横幅いっぱいの選択行
- 購読整理の意思決定ボタン
- chip / filter 系ボタンの見た目整理

一方で、reader 専用のサイドバーナビや toolbar のように
すでに一貫性があり役割が強いものは無理に統合しない。

## Current State

### 既存の共通基盤

- `src/components/ui/button.tsx`
  - アプリ全体の基底 `Button`
  - `variant` と `size` を `cva` で管理している

- `src/components/shared/loading-button.tsx`
  - 非同期操作用の薄いラッパ

- `src/components/shared/delete-button.tsx`
  - destructive 系の薄いラッパ

- `src/components/shared/form-action-buttons.tsx`
  - フォーム送信用の組み合わせ部品

- `src/components/shared/icon-toolbar-control.tsx`
  - icon toolbar 専用のボタン群

- `src/components/reader/sidebar-nav-button.tsx`
  - reader サイドバー専用の行ボタン

### ばらつきが目立つ箇所

- `src/components/settings/accounts-nav-view.tsx`
  - アカウント一覧の選択行を生の `<button>` で実装している

- `src/components/settings/settings-nav-view.tsx`
  - 設定カテゴリ一覧の選択行を別スタイルの生 `<button>` で実装している

- `src/components/settings/service-picker.tsx`
  - サービス選択行をまた別の生 `<button>` で実装している

- `src/components/subscriptions-index/subscriptions-list-pane.tsx`
  - 購読一覧の選択行が独自カード風ボタンになっている

- `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
  - `残す / あとで確認 / 削除` を独自の色付きボタンで実装している
  - フィルタ群も独自ボタンになっている

- `src/components/subscriptions-index/subscriptions-overview-summary.tsx`
  - サマリーカード全体を押せる CTA として独自実装している

### ブラウザ確認で見えたこと

`http://127.0.0.1:4173` を実画面で確認した結果、
以下の傾向があった。

- ホーム画面の reader サイドバーは比較的一貫している
- 購読一覧では「一覧行」「サマリーカード」「下部 CTA」がそれぞれ別の見た目言語になっている
- 購読整理では「フィルタ chip」と「意思決定ボタン」が独自デザインの比率を押し上げている

確認時のスクリーンショット:

- `tmp/screenshots/button-review-home.png`
- `tmp/screenshots/button-review-subscriptions.png`
- `tmp/screenshots/button-review-cleanup.png`

## Goals

- ボタンの役割ごとに共通コンポーネントを用意し、画面ごとの小さなズレを減らす
- `Button` 自体は基底のまま維持し、用途別ラッパで設計を整理する
- 設定 / 購読一覧 / 購読整理の主要画面で、角丸・余白・選択状態・hover の言語を揃える
- 他エージェントが同時に動いていても安全に進められるよう、初回スコープを狭く保つ

## Non-Goals

- アプリ内の全 `<button>` を今回一気に `Button` へ置き換えること
- `SidebarNavButton` や `IconToolbar*` を `Button` に吸収して消すこと
- DnD や Base UI の `Trigger` 都合を持つ特殊ボタンまで共通化すること
- デバッグ HUD やタグ色ピッカーの特殊 UI を今回整理対象に含めること
- サマリーカード全体の押下表現を初回で完全に統一すること

## Approaches

### A. `Button` へすべて統合する

`variant` と `size` を大量に増やして、ほぼすべてのボタンを `Button` へ寄せる。

- 利点
  - 見た目の定義が 1 箇所に集まる
- 欠点
  - `Button` の責務が肥大化する
  - 行選択や chip のような役割差まで `variant` に押し込むことになる
  - DnD や context menu trigger との相性が悪い

### B. 既存基盤を残し、用途別の薄い共通部品を追加する

`Button` を基底として維持しつつ、
役割が明確なボタン群だけを小さな共通部品にまとめる。

- 利点
  - 既存構造に合う
  - 役割ごとに責務がはっきりする
  - 初回スコープを限定しやすい
- 欠点
  - コンポーネント数は少し増える

### C. まず棚卸しだけして、実装は後回しにする

- 利点
  - 変更リスクが最小
- 欠点
  - デザインのブレは残る
  - 今回の目的を直接は解決しない

### Recommendation

B を採用する。

このリポジトリにはすでに `Button`, `LoadingButton`, `DeleteButton`,
`FormActionButtons`, `SidebarNavButton`, `IconToolbar*` があり、
土台不足ではなく「用途別の整理不足」が主問題だからである。

## Design

### 1. 維持する既存コンポーネント

以下は今回の共通化対象にせず、そのまま維持する。

- `src/components/ui/button.tsx`
- `src/components/shared/loading-button.tsx`
- `src/components/shared/delete-button.tsx`
- `src/components/shared/form-action-buttons.tsx`
- `src/components/shared/icon-toolbar-control.tsx`
- `src/components/reader/sidebar-nav-button.tsx`

理由:

- `Button` は基底として十分に成立している
- `SidebarNavButton` は reader 専用の密度・選択表現を強く持っている
- `IconToolbar*` は compact icon control として責務が明確

### 2. `NavRowButton` を追加する

新規に `src/components/shared/nav-row-button.tsx` を追加し、
「横幅いっぱいの選択行」用の共通部品を作る。

責務は以下に限定する。

- 行全体が押せる
- `selected` / `disabled` の見た目を統一する
- leading / trailing / title / description を柔軟に渡せる
- text alignment, gap, hover, active tone を共通化する

想定 props:

- `selected?: boolean`
- `disabled?: boolean`
- `leading?: ReactNode`
- `trailing?: ReactNode`
- `title: ReactNode`
- `description?: ReactNode`
- `className?: string`
- `onClick?: () => void`

初回の適用対象:

- `src/components/settings/accounts-nav-view.tsx`
- `src/components/settings/settings-nav-view.tsx`
- `src/components/settings/service-picker.tsx`
- `src/components/subscriptions-index/subscriptions-list-pane.tsx`

補足:

`SidebarNavButton` の置き換えではなく、
settings / subscriptions 系の「似ているが別実装」の行を寄せる。

### 3. `DecisionButton` を追加する

新規に `src/components/shared/decision-button.tsx` を追加し、
購読整理で使う意味付きアクションを統一する。

責務:

- `intent` に応じて色・hover・foreground を切り替える
- 通常の CTA とは別物として扱う
- icon + label の並びと余白を統一する

想定 props:

- `intent: "keep" | "defer" | "delete"`
- `size?: "sm" | "default"`
- `children: ReactNode`
- `className?: string`

初回の適用対象:

- `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`

このコンポーネントは `DeleteButton` を置き換えるものではない。
`DeleteButton` は destructive 汎用、
`DecisionButton` は triage 用の意味付き操作という切り分けにする。

### 4. chip / filter 系は `control-chip` の再利用を広げる

`src/components/shared/control-chip.ts` はすでに存在するため、
新しい filter 専用コンポーネントを乱立させず、
button で使いやすい薄いラッパを追加する。

候補:

- `ControlChipButton`
- もしくは `controlChipVariants` を使う小ラッパ関数

責務:

- chip らしい丸み、余白、pressed 表現を統一する
- filter row で `Button` と生 `<button>` のスタイル差を減らす

初回の適用対象:

- `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
- 必要に応じて `src/components/reader/sidebar-footer-actions.tsx` と整合を取る

### 5. `CardActionButton` は初回では見送る

`src/components/subscriptions-index/subscriptions-overview-summary.tsx`
のカード全体押下は、通常ボタンとも行ボタンとも異なる。

これは将来的に `CardActionButton` へ整理できるが、
初回でここまで触るとスコープが広がるため見送る。

初回では以下のみ行う。

- 現状の独自カード CTA を把握する
- `NavRowButton` / `DecisionButton` 導入後に、必要なら 2 回目で着手する

## Scope

### 初回で変更する対象

- `src/components/shared/nav-row-button.tsx` を追加
- `src/components/shared/decision-button.tsx` を追加
- `src/components/shared/control-chip.ts` かその周辺へ button 用ラッパを追加
- `src/components/settings/accounts-nav-view.tsx`
- `src/components/settings/settings-nav-view.tsx`
- `src/components/settings/service-picker.tsx`
- `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`

### 初回で変更しない対象

- `src/components/reader/sidebar-nav-button.tsx`
- `src/components/shared/icon-toolbar-control.tsx`
- `src/components/subscriptions-index/subscriptions-overview-summary.tsx`
- DnD / context menu trigger と強く結びついたボタン群
- debug HUD

## Data / UI Rules

### `NavRowButton`

- selected 時
  - 背景を上げる
  - foreground のコントラストを上げる
  - 必要なら subtle な border or ring を入れる

- unselected 時
  - hover で背景だけを軽く上げる

- leading slot
  - icon / avatar / service badge を許容する

- trailing slot
  - unread count や chevron を許容する

### `DecisionButton`

- `keep`
  - 緑系
- `defer`
  - neutral / zinc 系
- `delete`
  - 赤系

ただし購読整理専用の意味色として定義し、
アプリ全体の primary / destructive と混同しない。

### chip / filter

- pressed 時の背景と文字色を共通化する
- unpressed 時の境界線と muted foreground を共通化する
- 同じ画面の意思決定ボタンより視覚的優先度を下げる

## Risks / Edge Cases

- `subscriptions-list-pane` は card らしさが強いため、
  `NavRowButton` に寄せると情報量が落ちる可能性がある
  - 対策: title / description / metadata slot を許容する

- `service-picker` は disabled provider を持つ
  - 対策: `NavRowButton` 側で disabled の cursor / opacity を扱う

- `accounts-nav-view` と `settings-nav-view` は sidebar 配色を使う
  - 対策: `tone` か `surface` を導入し、通常面と sidebar 面を分ける

- `feed-cleanup-queue-panel` のボタンは他エージェントが触っている可能性が高い
  - 対策: 初回は設計承認後に対象差分をよく確認してから実装する

## Testing

### Automated

- `NavRowButton` の selected / disabled / leading / trailing 表示をテストする
- 置き換えた各 view の既存コンポーネントテストを更新する
- `DecisionButton` の `intent` ごとの class と disabled を確認する
- `feed-cleanup-queue-panel` の action button 表示条件を維持する

### Manual

- `mise run app:dev:browser` でホームを確認する
  - reader サイドバーが変わっていないこと

- 購読一覧を確認する
  - 一覧行の選択状態と hover が揃っていること

- 購読の整理を確認する
  - filter chip の見た目が揃っていること
  - `残す / あとで確認 / 削除` が同じ設計言語にまとまること

- `mise run check` を通す

## Implementation Order

1. `NavRowButton` を追加する
2. settings / subscriptions の行ボタンを置き換える
3. `DecisionButton` を追加する
4. `feed-cleanup-queue-panel` の意思決定ボタンを置き換える
5. `control-chip` の button ラッパを追加し、購読整理の filter に適用する
6. `mise run check` とブラウザ巡回で確認する

## Open Questions Resolved

- `SidebarNavButton` を統合対象にするか
  - 今回はしない。reader 専用部品として維持する

- `CardActionButton` を初回で作るか
  - 今回は作らない。2 回目の候補とする

- 画面確認をどう行うか
  - `http://127.0.0.1:4173` のブラウザ実画面で確認し、主要 3 画面を固定巡回対象にする
