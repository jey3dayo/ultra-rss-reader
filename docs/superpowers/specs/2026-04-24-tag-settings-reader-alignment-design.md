# Tag Settings Reader Alignment Design

## Summary

`Settings > タグ` の `保存済みタグ` 一覧を、
reader サイドバーのタグ表現に寄せて整理する。

採用方針は次の通り。

- 行の主役は `小さい色ドット + タグ名`
- 右端に `編集` `削除` を静かに置く
- reader の `記事数` は設定画面には持ち込まない
- sidebar 用の選択状態や件数表示ロジックは共用しない
- 共通化するなら「タグの見え方」だけを shared primitive に切り出す

これにより、設定画面の一覧を軽くしつつ、
reader と settings の視覚言語を揃える。

## Current State

- `TagsSettingsView` は `LabeledControlRow` ベースで、
  左にタグ名、右に大きな色丸と `編集` `削除` ボタンを並べている
- 現状の行は settings のフォーム文法には沿っているが、
  タグそのものの識別より「操作列」が先に見えやすい
- reader 側の `TagListView` は `SidebarNavButton` ベースで、
  `小さい色ドット + タグ名 + 記事数` という軽い行構成になっている
- `DESIGN.md` ではタグ色を例外パレットとして中央管理し、
  theme の主色と混ぜない前提になっている

## Goals

- `保存済みタグ` 一覧を reader に近い軽い見え方へ寄せる
- タグ名と色の識別を主役にする
- `編集` `削除` を残しつつ、操作の圧を下げる
- settings と reader のタグ表現に視覚的一貫性を持たせる
- 実装は過剰な共通化を避け、責務の薄い shared primitive に留める

## Non-Goals

- `Settings > タグ` の機能追加を行うこと
- タグの並び順、検索、バルク操作を追加すること
- reader サイドバーのタグ行ロジックを settings にそのまま流用すること
- settings 側に記事数バッジを常時表示すること
- タグ色パレットやタグモデルを変更すること

## UX Decisions

### 1. 採用レイアウト

保存済みタグの各行は次の構成にする。

- 左: `小さい色ドット + タグ名`
- 右: `編集` `削除`

reader のタグ行に近い視覚言語を使うが、
settings はナビゲーションではないため、
行全体を選択状態付きボタンにはしない。

### 2. 記事数は表示しない

reader で出している数値は `そのタグに属する記事数` だが、
settings の主目的は閲覧ではなく管理である。

そのため settings では以下を優先する。

- 何のタグかをすぐ識別できること
- どの行を編集・削除するかを迷わないこと

`記事数` は reader では有効な補助情報だが、
settings では常時表示する優先度が低く、
一覧のノイズになりやすいため削る。

### 3. 操作のトーン

`編集` `削除` は残すが、
現状のように色丸と同列で強く主張させない。

意図は次の通り。

- まずタグを読む
- 次に必要なら右端の操作に触る

削除は引き続き danger tone を使うが、
一覧の第一印象を破壊しないサイズと密度に留める。

### 4. reader から借りるもの / 借りないもの

借りるもの:

- 小さな色ドット
- 名前主体の行構成
- 軽い余白感と情報密度

借りないもの:

- 折りたたみ
- 選択状態
- 記事数
- sidebar 専用 hover / focus / selected ロジック

これにより、見た目だけを揃えつつ、
settings と reader の役割差を保つ。

## Architecture

### 1. `TagListView` はそのまま流用しない

`TagListView` は以下を前提にしている。

- セクション開閉
- 行クリックでの選択
- selected indicator
- trailing の記事数表示
- sidebar 固有トークン

これらは settings の責務と一致しない。
そのため `TagListView` 自体を共用すると、
不要な props や分岐を増やしやすい。

### 2. 共通化は `Tag identity` 粒度で止める

必要なら次のような薄い shared primitive を追加する。

- `TagIdentity`
  - `color`
  - `name`
  - optional な size / tone

この primitive を

- reader のタグ行
- settings の保存済みタグ行
- 将来のタグ picker

で再利用できるようにする。

ただし今回の変更が小さければ、
先に settings 側だけで整えてから、
重複が残る場合に限って抽出してよい。

### 3. `TagsSettingsView` の責務

`TagsSettingsView` は引き続き settings 専用 view とする。

責務:

- `SettingsContentLayout`
- `SettingsSection`
- 保存済みタグ一覧
- 行ごとの `編集` `削除` アクション

ここに sidebar 専用コンポーネントや
選択系の状態管理は持ち込まない。

## Implementation Notes

- 既存の `LabeledControlRow` を保存済みタグ一覧で使い続けるかは固定しない
- ただし一覧の見え方を reader 寄せにするため、
  保存済みタグ行だけは専用 row markup に寄せる可能性が高い
- `TagColorPicker` や作成フォーム側の構成は今回の変更対象に含めない
- story を追加する場合は、
  `Settings/Page` 配下で `タグ` 画面の fixture を見られるようにする
- 比較用 mock では `B案 + 件数なし` を採用する

## Acceptance Criteria

- `保存済みタグ` 一覧で、色ドットとタグ名が主役に見える
- 各行の右端に `編集` `削除` が残っている
- 一覧に記事数バッジが表示されない
- reader のタグ行と見た目の系統が揃って見える
- sidebar の選択状態や件数ロジックを settings に持ち込んでいない
- 既存の編集 / 削除フローを壊していない

## Open Questions Resolved

- 採用案は `reader 寄せ` とする
- settings では `記事数` を表示しない
- `TagListView` 丸ごとの共用は行わない
- 共通化する場合は `タグの見え方` の薄い primitive に留める
