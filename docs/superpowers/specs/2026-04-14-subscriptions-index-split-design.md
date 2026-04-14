# Subscriptions Index Split Design

## Summary

現在の `購読の整理` は、
名前から受ける期待に対して実体が `整理候補レビュー画面` に寄りすぎている。

この spec では、
`全体を俯瞰して管理する画面` と
`整理候補を判断する画面` を分離する。

新しい構成は次の 2 画面を基準にする。

- `購読一覧`
  - 全購読を俯瞰し、検索・絞り込み・状態確認を行う主画面
- `購読の整理`
  - 候補だけを集めて `残す / あとで確認 / 削除` を判断する専用画面

この変更で解消したい違和感は、
`最初からどれを消すか決める画面になっていて、全体が見えない`
という情報設計上のズレである。

## Goals

- 初期表示を `判断` ではなく `俯瞰` から始められるようにする
- 全購読を対象に、検索・状態確認・軽い管理操作を行える主画面を定義する
- 既存の `購読の整理` を `候補レビュー` に責務限定し、役割を明確にする
- `購読一覧` から `購読の整理` へ文脈付きで遷移できるようにする
- 既存の cleanup candidate 算出ロジックは可能な限り再利用し、再設計を広げすぎない

## Non-Goals

- feed cleanup heuristic 自体を今回の spec で変更すること
- `購読一覧` に `残す / あとで確認` の判断フローを持ち込むこと
- `購読の整理` を全件管理画面として作り変えること
- sidebar の情報構造全体をこの spec で再設計すること
- 新しい集計基盤や DB スキーマ変更を先に必須化すること

## Problem Statement

現状の `購読の整理` は、UI と copy の両方が
`購読全体を管理する場所` のように見える一方で、
実際の surface は `整理候補キュー` と `1件レビュー` を中心に構成されている。

具体的なズレは次の通り。

- 候補生成は `90日以上更新なし / 未読なし / スターなし` の rule-based subset である
- 画面構成は `候補キュー + 詳細レビュー + 判断操作` に寄っている
- 全購読の一覧性や横断的な比較は弱い
- そのため `購読を見渡したい` という期待に対して、初手の体験が強すぎる

このズレは wording の問題だけではなく、surface role の問題として扱う。

## Approved Product Model

### Surface Roles

- `購読一覧`
  - 購読管理の主画面
  - 全購読を対象に、俯瞰・検索・絞り込み・個別詳細確認を行う
- `購読の整理`
  - subset review workspace
  - 候補だけを対象に、判断と破壊操作を行う

### Why Two Pages

- `俯瞰` と `判断` は同じ情報でも task が異なる
- `購読一覧` は data-dense な管理面として設計したほうが自然
- `購読の整理` は queue-driven な decision workspace として設計したほうが自然
- 1 画面に同居させると、どちらの task も弱くなりやすい

## Information Architecture

### 1. 購読一覧

#### Role

`購読一覧` は `source of truth` として扱う。
全購読を対象にした主画面であり、
ユーザーはここで `いま購読全体がどうなっているか` を把握する。

#### Layout

画面は 2 段 + 右ペインの構成を基本とする。

- 上段: overview summary
- 下段左: subscription list
- 下段右: selected subscription detail

wide では左右分割、
compact では detail を下段または別 pane に畳んでもよいが、
mental model は `一覧が主、詳細は従` を維持する。

#### Overview Summary

上段 summary には次を置く。

- 総購読数
- 要確認件数
- 90日以上更新なし件数
- 参照エラー件数

必要に応じて次を追加してよい。

- 未読ゼロ件数
- フォルダ別件数
- 最近更新があった購読割合

ただし summary は `analytics dashboard` ではなく、
一覧への導線として短く保つ。
チャートは必須ではなく、軽い distribution 表現までに留める。

#### Subscription List

一覧は `バランス型リスト` を採用する。
完全な table-first でも card-first でもなく、
読みやすさと管理性の中間に置く。

各行には少なくとも次を表示する。

- 購読タイトル
- フォルダ名
- 未読数
- 最終更新
- 状態チップ
- 行操作の入口

状態チップの例:

- `通常`
- `要確認`
- `90日停止`
- `参照エラー`

一覧は全件を対象にする。
`候補だけ` の絞り込みは可能だが、初期状態は全件表示を基本とする。

#### Right Detail Pane

`購読一覧` で 1 行を選択したときは、
右ペインに `選択中の購読詳細` を出す。

右ペインの役割は `判断` ではなく `状態確認と次アクションへの橋渡し` である。

表示内容:

- 購読タイトル
- フォルダ
- feed URL
- 状態チップ
- 未読数
- スター数
- 最終更新
- 最近の更新頻度または更新印象
- 直近記事 3 件程度のプレビュー

操作:

- `編集`
- `再取得`
- `購読の整理で開く`
- `削除`

ここでは `残す / あとで確認` は置かない。
判断操作は `購読の整理` に寄せる。

#### Empty / Error States

- 未選択時:
  - `購読を選ぶと詳細が表示されます`
- 一覧 0 件:
  - `一致する購読はありません`
  - 検索条件を解除しやすくする
- 取得失敗:
  - empty state と区別して error state を出す

`0 件` と `取得失敗` は必ず分離する。

### 2. 購読の整理

#### Role

`購読の整理` は `subset view` として扱う。
全件管理ではなく、整理対象の判断を行う専用面に限定する。

#### Scope

この画面が扱うのは次のような候補集合である。

- 要確認
- 90日以上更新なし
- 未読なし
- スターなし
- 参照エラー

candidate の導出は既存ロジックを再利用する。
一覧対象を全件に広げない。

#### Interaction Model

interaction language は既存の cleanup 設計を維持する。

- queue
- review panel
- `残す / あとで確認 / 削除`

本 spec の目的は interaction model の変更ではなく、
surface positioning の修正である。

## Navigation And Hand-off Rules

### Entry Points

`購読一覧` から `購読の整理` に入るときは、
必ず `文脈付き` にする。

例:

- `要確認だけを見る`
- `90日以上更新なしを整理する`
- `参照エラーを確認する`
- `この購読を整理画面で開く`

`購読の整理` 単体を main entry にしない。

### Return Behavior

`購読の整理` から `購読一覧` に戻ったときは、
可能な限り次を維持する。

- 検索条件
- 並び順
- 選択中の購読
- スクロール位置

一覧を起点とした管理フローが途切れないことを優先する。

### Deep-Link Ready State

将来的に状態を URL や route state に載せられるよう、
view context は暗黙 state に閉じ込めすぎない。

例:

- `購読一覧?filter=review`
- `購読の整理?reason=stale_90d`

初回実装で URL 同期まで必須にはしないが、
route / state 設計はそれを阻害しない形にする。

## Architecture Direction

### Frontend Composition

新規または更新対象の中心は frontend surface である。

想定コンポーネント:

- `SubscriptionsIndexPage`
- `SubscriptionsOverviewSummary`
- `SubscriptionsList`
- `SubscriptionDetailPane`
- 既存 `FeedCleanupPage` 群

既存 cleanup component 群は、
`購読の整理` 側で継続利用する。

### Data Reuse

候補算出ロジックは既存 helper を再利用する。

- `buildFeedCleanupCandidates`
- `summarizeCleanupCandidate`

`購読一覧` は全件 feed データを基準にしつつ、
必要に応じて candidate helper の結果を chip や summary に反映する。

これにより、
`候補判定` と `画面責務` を分離する。

### State Ownership

- `購読一覧`
  - 検索文字列
  - 並び順
  - フィルタ条件
  - 選択中 feed
- `購読の整理`
  - cleanup filter
  - focused candidate
  - selected candidate set
  - keep / defer の一時状態

state を片画面ごとに閉じることで、
責務の混線を避ける。

## Copy Direction

### 購読一覧

copy は `全体把握` に寄せる。

- title: `購読一覧`
- subtitle 例:
  - `購読全体の状態を確認し、必要なものだけ整理します。`

### 購読の整理

copy は `候補レビュー` に寄せる。

- title は現状維持でもよいが、
  subtitle は `動きの少ない購読を、削除する前に見直します。` のように
  subset review であることを明示する

必要なら将来的に title 自体を
`整理候補を確認`
に寄せてもよいが、
今回の spec では必須にしない。

## Error Handling

### 購読一覧

分けて扱うべき状態:

- 全件取得失敗
- 検索結果 0 件
- 個別再取得失敗
- 参照エラー検出

一覧が空である理由を曖昧にしない。

### 購読の整理

分けて扱うべき状態:

- 候補 0 件
- 削除失敗
- 再取得失敗
- 参照エラー修復未対応

`候補がない` と `処理に失敗した` を混同させない。

## Testing

### 購読一覧

- summary card が全件ベースで表示されること
- 一覧が全購読を表示できること
- `候補だけ` などの絞り込みが動くこと
- 行選択で右ペインが切り替わること
- 右ペインから `購読の整理で開く` 遷移ができること
- 一覧 0 件と取得失敗の表示が分かれていること

### 購読の整理

- 既存の queue/review interaction が維持されること
- `購読一覧` から渡された文脈で初期表示できること
- `残す / あとで確認 / 削除` の挙動が既存どおりであること

## Risks

### Two Surfaces Can Drift

`購読一覧` と `購読の整理` が別々に進化すると、
状態ラベルや candidate 意味づけがズレる可能性がある。

そのため、
candidate summary と status label は可能な限り shared helper / shared copy に寄せる。

### Too Many Actions In The Index

`購読一覧` 側に操作を入れすぎると、
再び `整理画面を主画面に埋め込む` 状態へ戻ってしまう。

`購読一覧` では軽い管理操作までに留め、
判断フローは `購読の整理` に維持する。

### Sidebar Overlap

フォルダ軸の探索は既存 sidebar と役割が近い。
そのため `購読一覧` では folder tree を主役にせず、
全件一覧を主役に保つ。

## Open Questions Resolved In This Spec

- 初期表示は整理画面ではなく `購読一覧` にする
- `購読一覧` と `購読の整理` は別ページに分ける
- `購読一覧` は `summary + バランス型一覧 + 右ペイン詳細` を採る
- `購読一覧` の詳細は右ペインに出す
- `残す / あとで確認` は `購読の整理` に限定する

## Next Step

この spec の次は、
`購読一覧` の追加と
`購読の整理` の責務整理を段階化した implementation plan を作る。
