# Feed Cleanup Interaction Model Design

## Summary

`Feed Cleanup` を「記事詳細の変種」ではなく、
`読む` とは別の `意思決定ワークスペース` として定義する。

今回の設計で固めるのは以下の 4 点。

- `Reading / Cleanup / Settings` の役割分離
- single action と bulk action を同じ decision model に揃えること
- `Keep / Defer` を状態、`Delete` を破壊操作として分離すること
- keyboard 操作を含めて一貫した interaction language を持たせること

この spec は visual mock で合意した interaction model を、
実装でぶらさないための正本として残す。

## Goals

- `Feed Cleanup` を right-stage 上の明確な workspace mode として見せる
- `Keep / Defer / Delete` の意味を single / bulk / keyboard で一致させる
- `Keep / Defer` は速く、`Delete` は重く扱う interaction を保つ
- queue 上での判断速度を上げつつ、誤操作コストを下げる
- compact layout でも wide と同じ mental model を維持する

## Non-Goals

- feed cleanup heuristic 自体を変更すること
- `Keep / Defer / Delete` 以外の新しい action state を増やすこと
- `Settings` を main stage に統合すること
- article reader 自体の feature set を拡張すること
- animation detail や motion timing をこの spec で決め切ること

## Approved Product Model

### Surface Roles

- `Reading`
  - app の main stage
  - left = navigation
  - center = selection list
  - right = article / reader / web preview
- `Cleanup`
  - main stage 上に乗る別モード
  - right-stage の「詳細」ではなく、意思決定 workspace
  - queue / review / decision の流れを扱う
- `Settings`
  - app-wide setting を扱う temporary overlay
  - main stage を置き換えず、dialog として重ねる

### Why This Split

- `Reading` は継続的な主タスクなので stage の主役に置く
- `Cleanup` は滞在時間の長い判断タスクなので modal より workspace が合う
- `Settings` は補助タスクなので overlay が最も認知負荷が低い

## Layout Direction

### Wide

- left: sidebar / account / navigation
- center: queue or article list
- right: main stage

`right` は常に最も強い視覚重みを持つ。
ただし `Cleanup` では right 単体を強くするのではなく、
`queue + console` を含む cleanup stage 全体でひとつの task surface を作る。

### Compact

- main stage は 1 面ずつ見せる
- `Cleanup` は full modal ではなく dedicated task surface として扱う
- `Settings` のみ overlay sheet / modal として扱う

## Reading Surface Rules

- article list は `選択用 UI` に寄せる
- selected row は「位置表示」を優先し、過度なカード感を持たせない
- reader は width / contrast / spacing を強め、主役感を担保する
- reader toolbar は補助的に扱い、本文領域の没入感を壊さない

### Visual Priority

- primary: article title / reader body
- secondary: source / time / read state
- tertiary: chips / meta / secondary controls

## Cleanup Surface Rules

### Cleanup As Workspace Mode

- cleanup に入ったことが一目で分かる banner または mode indicator を置く
- `Reading / Cleanup` のモード差分は copy と色で補強する
- queue は `読む一覧` ではなく `処理待ち一覧` として見せる

### Cleanup Queue

- row は candidate を短時間で比較できる密度を優先する
- table / list hybrid でもよいが、少なくとも
  - feed
  - unread
  - current status
  が横並びで読めること
- checkbox multi-select を前提にする

### Feed Console

- right 側は `Selected feed card` ではなく `Feed console`
- 説明文よりも、状態・理由・メトリクスを優先する
- 例:
  - current status
  - unread / stars / last article
  - reasons
  - folder

`読ませるパネル` ではなく `判断するための状態パネル` に寄せる。

## Decision Model

### Core Semantics

- `Keep`
  - 状態
  - この candidate は残す
- `Defer`
  - 状態
  - この candidate は今は決めない
- `Delete`
  - 行為
  - subscription を削除する

### Why Keep / Defer / Delete Are Asymmetric

`Keep` と `Defer` は reversible な判断状態であり、
`Delete` は不可逆寄りの破壊操作である。

このため UI でも以下を分ける。

- `Keep / Defer`
  - segment / state switch として見せる
- `Delete`
  - isolated danger action として見せる

### Decision Rail

- single candidate では right console 下に `decision rail` を置く
- rail は card 内の loose buttons ではなく、独立した操作帯として見せる
- recommended shape:
  - `Status`
  - `[ Keep | Defer ]`
  - separator / distance
  - `[ Delete ] [ ⋯ ]`

### Current State Visibility

- rail 上部または console header に `Current: Keep` のような現在状態表示を置く
- rail 自体も active segment を持つ

これにより「押せるボタン群」ではなく「現在状態を切り替える UI」に見せる。

## Bulk Actions

### Scope

- bulk target は `明示的に checkbox で選ばれた rows` のみ
- `visible all` bulk ではない

### Selection Entry

- 各 queue row に checkbox を置く
- checkbox は explicit bulk targeting の入口

### Bulk Bar

- queue の上部に bulk bar を置く
- `1件以上 selected` のときだけ表示する
- bulk bar は queue に対して sticky / fixed 扱いが望ましい

### Bulk Actions In The Bar

- `Keep`
- `Defer`
- `Delete`
- optional `⋯`

ただし semantics は single rail と同じ。

- `Keep / Defer`
  - 即時反映
  - Undo toast を出す
- `Delete`
  - confirm dialog を経由する

### After Apply

- successful apply 後は selection を clear する
- Undo により戻せる

## Feedback Model

### Keep / Defer

- queue / console はその場で更新
- toast で結果と `Undo` を提示
- user flow は止めない

### Delete

- confirm dialog を必須にする
- dialog には対象件数と feed list を表示する
- `Delete` は keep/defer より一段遅い flow にする

### Undo

- toast は dismissable
- high-visibility だが modal ではない
- single / bulk で同じ feedback language を使う

## Keyboard Interaction Model

### Navigation

- `J / K`
  - queue row の上下移動
- `Space`
  - focused row の checkbox toggle
- `Enter`
  - focused row を right console target に送る

### Decision Routing

- selected rows が 1 件以上ある場合:
  - `K / L / D` は `selection set` に対して作用する
- selected rows が 0 件の場合:
  - `K / L / D` は `focused row` に対して作用する

### Focus vs Selection

- focus:
  - thin focus ring
  - keyboard target を表す
- selection:
  - checkbox checked
  - selected row background
  - bulk target を表す

focused + selected は共存してよい。

### Why Selection Wins

bulk selection は explicit intent であり、
focus は navigation context である。

そのため keyboard action routing は
`selection-first` が最も自然。

`Enter` は例外的に focused row を console target に送る。
これにより `操作対象` と `閲覧対象` を分離できる。

## Copy Guidance

- `Later` より `Defer` の方が状態意味が明確なら置き換えを検討してよい
- bulk bar では対象を明示する copy が望ましい
  - 例: `3 feeds selected`
- keyboard route の説明は help / tooltip / hint line で補強できる
- bulk mode の rail は必要に応じて
  - `Keep selected`
  - `Defer selected`
  - `Delete selected`
  のように対象を copy で明示してもよい

## Implementation Notes

### UI State

少なくとも以下の state が必要になる。

- focused cleanup row id
- selected cleanup row ids
- current cleanup candidate status
- pending bulk delete confirmation
- latest reversible cleanup action for undo

### Components / Responsibilities

- queue panel
  - list rendering
  - checkbox selection
  - focus indication
  - bulk bar visibility
- feed console
  - focused row detail
  - single decision rail
- confirm dialog
  - bulk delete confirmation
- toast / undo
  - reversible feedback

### Relationship To Existing Feed Cleanup

今回の spec は heuristic や candidate generation を変更しない。
主対象は interaction model と view hierarchy である。

## Risks

### Bulk Bar Can Be Too Subtle

selection 状態が分かりにくいと bulk の存在に気づきにくい。
bar の背景 / border / elevation は通常 UI より一段だけ強くする。

### Focus Ring Can Be Lost Under Selection

selected row が強すぎると focused row が埋もれる。
focus ring は selection fill と独立して視認できる必要がある。

### Console Can Become Too Explanatory

feed console が説明文を持ちすぎると decision speed を落とす。
copy より state / metrics / reasons を優先する。

### Delete Can Drift Toward The Fast Path

bulk rail 上で delete を keep/defer と同列に見せすぎると危険。
位置・距離・confirm flow の 3 つで重みを維持する。

## Testing

### Surface Behavior

- cleanup open 時に workspace mode indicator が見える
- settings open 時は overlay surface になり cleanup stage を置き換えない
- reader stage が article list より強い visual priority を維持する

### Single Decision

- `Keep / Defer` で current status が更新される
- `Delete` は confirm なしでは完了しない
- single action 後に undo toast が出る

### Bulk Decision

- checkbox selection がある時だけ bulk bar が出る
- bulk keep/defer 実行後に selection が clear される
- bulk delete は confirm dialog を出す
- undo で直前の bulk keep/defer を戻せる

### Keyboard

- `J / K` で focused row が移動する
- `Space` で focused row の selected state が切り替わる
- selected rows がある時 `K / L / D` は selection set に効く
- selected rows がない時 `K / L / D` は focused row に効く
- `Enter` で focused row が console target に反映される

## Open Follow-Ups

- animation / motion timing の仕様化
- keyboard hint の visible strategy
- `Defer` という copy を最終採用するか
- bulk rail の selected-aware label を常時出すか tooltip に留めるか
