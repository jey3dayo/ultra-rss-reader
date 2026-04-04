# Preview Eye Toggle Design

## Summary

記事ツールバーの `S/P` preset toggle を廃止し、未読・スターと同じ単一の icon toggle に置き換える。
表示ラベルは画面上に出さず、tooltip と `aria-label` で意味を補う。
アイコンは `Eye` を第一候補とし、pressed state は「Webプレビュー表示中」を表す。

## Goals

- 記事ツールバー上の表示モード操作を、他の article-local action と同じ見た目に揃える
- `S/P` という抽象ラベルをやめ、初見でも意味が推測しやすい操作に寄せる
- 既存の app-level default display mode との責務衝突を弱める
- 内部の display preset / fallback ロジックは壊さず、UI surface だけを簡素化する

## Non-Goals

- settings 側の `Default display mode` select を廃止すること
- `standard` / `preview` の内部 preset モデルを削除すること
- feed ごとの display mode override や precedence ルールを変更すること
- preview overlay や article pane のレイアウトを再設計すること

## Current State

- settings 画面は app-wide な既定値として `standard` / `preview` を select で持っている
- article toolbar も同じ 2 択 preset を `S/P` toggle group で露出している
- 内部的には article display が `app default + feed override + temporary override` で解決される
- そのため user-facing では同じ 2 択が 2 箇所に見え、scope の違いが伝わりにくい

## Design

### User-Facing Interaction

- article toolbar では `DisplayModeToggleGroup` を廃止する
- 代わりに `IconToolbarToggle` ベースの単一 toggle を置く
- icon は `Eye` を使う
- default state:
  - unpressed: preview off
  - pressed: preview on
- visible text label は出さない
- tooltip / `aria-label` は stateful にする
  - off 時: `Webプレビューを開く`
  - on 時: `Webプレビューを閉じる`

### Responsibility Boundary

- settings の `Default display mode` は今後も app-wide default の入口として残す
- article toolbar の eye toggle は「今選択中の記事の preview surface を出すかどうか」の local action として扱う
- これにより:
  - settings = 全体既定
  - toolbar = その場の表示切替
 という責務分離を視覚的にも明確にする

### Behavior Mapping

- toolbar の eye toggle は、内部的には既存の temporary override を使って実現する
- 実装上は `standard` / `preview` preset 解決を維持してよい
- UI は boolean toggle でも、内部は次の対応でよい
  - toggle off -> `readerMode=on`, `webPreviewMode=off`
  - toggle on -> `readerMode=on`, `webPreviewMode=on`
- article に preview URL がない場合は、既存どおり fallback して warning copy を表示する

### Icon Choice Rationale

- `Globe` 系は既存の外部ブラウザ導線と意味が衝突しやすいため避ける
- `Eye` は「見る / preview する」の意味に寄せやすく、単一トグルと相性が良い
- `Split` や `stacked surface` 系の icon は layout change の意味が強く、preview action としてはやや抽象度が高い

## Implementation Targets

- `src/components/reader/article-view.tsx`
- `src/components/reader/article-toolbar-view.tsx`
- `src/components/reader/article-toolbar-view.stories.tsx`
- `src/components/reader/display-mode-toggle-group.tsx`
- `src/locales/en/reader.json`
- `src/locales/ja/reader.json`
- 関連テスト

## Testing

- article toolbar に `S/P` group が表示されず、単一 icon toggle が表示されること
- preview off/on の状態で tooltip / `aria-label` が切り替わること
- toggle 操作で既存どおり preview overlay が開閉すること
- preview URL がない記事では既存 fallback が維持されること
- settings 側の `Default display mode` select はそのまま残ること

## Risks

### Eye Can Read As Generic Visibility

`Eye` は「非表示/表示」全般にも読めるため、tooltip 文言が重要になる。
icon 単体ではなく `Webプレビュー` を含む label で意味を固定する必要がある。

### Two Preview Controls Can Drift

既存の `open in browser` toggle と新しい eye toggle の責務が曖昧だと、
どちらが preview surface を直接表すのか分かりにくくなる。
実装では button label と pressed state の意味を揃える必要がある。
