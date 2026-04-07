# Smart View Contextual Filters Design

## Overview

スマートビュー `未読` / `スター` の現在地が、サイドバー選択と下部フィルタの両方で強調されるため、
特に次の 2 状態がわかりづらい。

- `B`: サイドバーで `スター` を選択
- `C`: サイドバーで `未読` を選択したまま、記事一覧側で `スター` 条件をかける

今回の目的は、表示モードを増やすことではなく、
「どこを見ているか」と「必要なときだけ出る補助条件」を分離して、
迷子になりにくい情報設計へ整えること。

最終方針は次のとおり。

- サイドバー `未読` は、それ自体で完成したビューとして扱う
- サイドバー `スター` は、起点ビューとして扱う
- 下部バーは常設の万能フィルタではなく、起点に対して意味があるときだけ出す
- 記事一覧上部に、現在地を要約する静かなコンテキスト帯を追加する

## Goals

- `未読` と `スター` のスマートビューで迷わない UI にする
- `スター` が「起点」なのか「絞り込み条件」なのか曖昧にならないようにする
- `未読` 画面は余計なトグルを減らし、静かで美しい状態にする
- `スター` 画面では `未読だけ見たい / すべて見たい` を自然に切り替えられるようにする
- 現行の store モデルと article filtering をできるだけ活かして実装できる形にする

## Non-Goals

- 新しい永続設定を追加すること
- サイドバーの IA 全体を作り変えること
- Rust backend / IPC schema / SQLite schema を変更すること
- スマートビュー以外の feed / folder / tag の表示ルールを同時に再設計すること

## UX Decision

### 1. `未読` は補助フィルタを持たない

サイドバーで `未読` を選択した時点で、
ユーザーはすでに「未読を読みたい」という明確な意図を持っている。

この状態でさらに下部に `未読 / すべて / スター` のようなバーを出すと、
現在地よりも操作可能性が前に出てしまい、美しさと理解しやすさの両方を損なう。

そのため `未読` スマートビューでは、下部バーは表示しない。
代わりに記事一覧上部に `未読` のみを示す、薄いコンテキスト帯を表示する。

### 2. `スター` は起点ビュー + 2 択補助条件にする

サイドバーで `スター` を選択した場合、
ここで見たいのは「スターした記事群」であり、`スター` は補助条件ではなく起点そのものになる。

この状態では下部バーを次の 2 択に限定する。

- `未読`
- `すべて`

意味は「スター記事のうち未読だけ見る」または「スター記事をすべて見る」。

これにより、

- `B`: `スター + すべて`
- `C` 相当の体験を `未読` スマートビュー内で無理に作らない

という整理になる。

### 3. 現在地は一覧上部のコンテキスト帯に集約する

サイドバーと下部バーの両方が押下状態を持っていても、
「いま何を見ているか」の最終的な答えは記事一覧の上部に集約する。

ここでは `主ピル + 副ピル` の表現を使う。

- 主ピル
  - 起点ビュー
  - 例: `未読`, `スター`
- 副ピル
  - 補助条件
  - 例: `未読`, `すべて`

想定例:

- サイドバー `未読`
  - コンテキスト帯: `未読`
- サイドバー `スター` + footer `未読`
  - コンテキスト帯: `スター` + `未読`
- サイドバー `スター` + footer `すべて`
  - コンテキスト帯: `スター` + `すべて`

## Interaction Model

### Sidebar Smart Views

- `未読` を押す
  - selection は smart view `unread`
  - 記事一覧は未読記事のみ
  - footer filter は非表示
  - コンテキスト帯は `未読`

- `スター` を押す
  - selection は smart view `starred`
  - footer filter は表示
  - footer options は `未読 / すべて`
  - 初期値は `すべて` を推奨する

`スター` を初期値 `すべて` にする理由は、
「スターしたもの全体を見る」ことが起点として自然で、
そこから必要なら未読に絞るほうが理解しやすいから。

## State Model

既存の `selection.type = "smart"` と `viewMode` を活かしつつ、
スマートビュー時の footer option set を分岐させる。

### Proposed Semantics

- `selection = { type: "smart", kind: "unread" }`
  - `viewMode = "unread"`
  - footer options: なし

- `selection = { type: "smart", kind: "starred" }`
  - 一覧のデータ選択は `selection.kind === "starred"` を主条件にする
  - footer は `unread` / `all` の 2 択として機能する

実装の簡潔さを優先するなら、内部的には次のどちらかを選べる。

1. `selection.kind === "starred"` + `viewMode = "unread" | "all"` を許可する
2. 既存 `viewMode = "starred"` を残しつつ、smart view `starred` 時だけ footer の表示項目を特別扱いする

推奨は 1。
理由は、`viewMode` を純粋な「一覧内の読み方」に寄せられ、
`starred` を起点 selection として分離できるため。

## UI Layout

### 1. Article List Header の直下にコンテキスト帯を追加する

新しい帯は高さを低く、目立ちすぎない見た目にする。

- 背景は `bg-card` 系のまま、separator だけ薄く足す
- 左寄せにピルを並べる
- 主ピルは塗りあり
- 副ピルは塗り弱めまたは境界線主体

この帯は「現在地の答え」であり、操作の主役ではない。
そのためボタンらしさは抑える。

### 2. Footer Filter は smart view に応じて変形させる

- `未読` smart view
  - footer 自体を非表示、または高さを維持した表示専用帯にする
- `スター` smart view
  - `未読 / すべて` の 2 択
  - `スター` ボタンはここには出さない

`スター` ボタンを footer に残さないことで、
「スターは sidebar の起点」というルールが視覚的にも保たれる。

### 3. Sidebar Smart View の見た目は起点として一貫させる

サイドバーの `未読` / `スター` は今までどおり選択状態を持ってよい。
ただし一覧側のコンテキスト帯が入ることで、
サイドバー選択は「ナビゲーションの現在地」として読まれやすくなる。

## Data Flow

### When Smart View = Unread

1. user が sidebar `未読` を選ぶ
2. store は `selection = smart(unread)` に更新される
3. article list は未読記事だけを表示する
4. footer options は非表示にする
5. context strip は `未読` だけを表示する

### When Smart View = Starred

1. user が sidebar `スター` を選ぶ
2. store は `selection = smart(starred)` に更新される
3. article list はスター記事群を起点に表示する
4. footer options は `未読 / すべて` に切り替わる
5. footer `未読` 選択時は starred + unread の intersection を表示する
6. footer `すべて` 選択時は starred articles 全件を表示する
7. context strip は `スター` + (`未読` or `すべて`) を表示する

## Error Handling / Edge Cases

- `スター` smart view で `未読` を選び、該当記事が 0 件
  - 空状態を表示する
  - footer は維持する
  - context strip は `スター + 未読`

- 記事からスターを外した
  - `スター` smart view では、現状どおり retain の考え方を使って即消えを和らげてよい
  - ただし UI 設計としては、`スター` が起点ビューであることを明示することで驚きを減らす

- `未読` smart view で記事を既読化した
  - 現状どおり、必要なら retain により操作中のチラつきを抑える
  - footer がないため、「どのフィルタが効いているか」は context strip のみで十分伝わる

## Testing Strategy

### Component / UI Tests

- `src/__tests__/components/article-list.test.tsx`
  - smart view `unread` では footer filter が表示されない
  - smart view `starred` では footer filter が `未読 / すべて` の 2 択になる
  - smart view `starred` + footer `未読` で starred unread のみが表示される
  - smart view `starred` + footer `すべて` で starred 全件が表示される

- `src/__tests__/components/sidebar.test.tsx`
  - `未読` smart view 選択時に context strip 用状態が正しく反映される
  - `スター` smart view 選択時に footer option set が切り替わる

- context strip 用 component test
  - `未読`
  - `スター + 未読`
  - `スター + すべて`

### Manual Verification

- sidebar `未読` を押すと、下部バーなしで迷わず読める
- sidebar `スター` を押すと、`未読 / すべて` だけが出る
- `スター` 画面で未読に絞っても意味が自然に読める
- context strip を見るだけで現在地が説明できる

## Scope

### Changes Expected

- `src/stores/ui-store.ts`
  - smart view と footer filter の意味づけ整理

- `src/components/reader/article-list.tsx`
  - smart view ごとの footer option set 切り替え
  - context strip 導入

- `src/components/reader/article-list-footer.tsx`
  - option set を固定 3 択から動的に変更

- new component
  - `article-list-context-strip` 相当

- tests
  - smart view / footer / context strip の回帰テスト

### Out of Scope

- feed / folder / tag 全体の filter policy 再整理
- sidebar visual refactor 全般
- backend article query の最適化
