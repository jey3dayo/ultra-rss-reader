# Feed Cleanup Page Design

## Summary

Ultra RSS Reader に、止まっているフィードや長期間触っていない購読を整理するための
専用管理ページ `Feed Cleanup` を追加する。

このページは既存の 3 ペイン読書体験とは役割を分け、`見つける -> 判断する -> 残す / あとで見る / 削除する`
を短いループで回せることを優先する。

初回実装では `Cleanup Queue` 方式を採用する。
左で候補条件を絞り込み、中央で候補フィードを順に確認し、右で判断材料を見ながら操作する。
削除は即実行ではなく、最終更新日や利用痕跡を再確認できる小さな確認ダイアログを挟む。

## Goals

- 止まっているフィードを一目で見つけられる
- 削除判断に必要な情報を、画面遷移なしで確認できる
- `残す / あとで見る / 削除` を軽い操作で回せる
- 読書画面を運用 UI で汚さず、専用面に責務を分離する
- 初回スコープでは「整理体験」を成立させ、過剰な自動化は入れない

## Non-Goals

- フィード管理全体をこの画面に統合すること
- 初回実装で重複フィード検出まで入れること
- 自動削除ルールやバッチ削除を導入すること
- 購読追加、名前変更、フォルダ移動 UI をこの画面の主役にすること
- 停止判定をサーバー同期や新しい DB 集計基盤で再設計すること

## Current State

- 現在の管理導線は sidebar と context menu に分散している
- フィードごとの操作は `rename` `move to folder` `unsubscribe` などの局所操作が中心
- 「最近更新がない」「長く開いていない」「削除候補を並べて判断する」といった一覧視点は存在しない
- そのため、止まっている購読を掃除したいときは sidebar を上から目視するしかなく、判断コストが高い

## Approved UX

### Page Positioning

- `Feed Cleanup` は読書画面とは別の管理ページとして出す
- settings の 1 セクションにはせず、一覧と判断パネルを広く取れる専用面にする
- 初回導線は app 内の管理操作から入れる前提とし、実装時に最小コストな入口を選ぶ
  - 例: sidebar 下部の管理導線、settings からの遷移、command palette action
- 重要なのは入口の位置より「入ったら管理モードに切り替わる」こと

### Layout

3 カラム構成を基本とする。

1. 左カラム: Candidate Filters
   - `90日以上更新なし`
   - `半年以上開いていない`
   - `スターなし`
   - `未読なし`
   - `同期失敗あり`
   - 条件の組み合わせで候補集合を作る
2. 中央カラム: Cleanup Queue
   - 条件に一致したフィード一覧
   - 各行にフィード名、所属フォルダ、最終更新からの経過日数、簡単な状態要約を表示
   - キューは「削除判断に近い順」で上から見られるようにする
3. 右カラム: Review Panel
   - 選択中フィードの判断材料を表示
   - `最終更新日` `最終閲覧日` `未読数` `スター数` `所属フォルダ` `URL` を確認できる
   - ここから `残す` `ミュート` `あとで見る` `削除` を実行する

### Candidate Heuristics

初回実装の候補判定は、複雑なスコアリングではなくルールベースに留める。

- stale:
  - 最終記事公開日または最終取得記事日時が一定日数以上前
- dormant:
  - 最後に開いた日時が一定期間より前
- low-signal:
  - スター 0 件
  - 未読 0 件
- error:
  - 最近の同期で失敗が続いている

これらを「削除してよさそうな理由」としてそのまま UI に表示する。
ブラックボックスな判定にはしない。

### Action Model

各候補には次の基本 3 操作を用意する。

- `残す`
  - 候補から外す
- `あとで見る`
  - 今は決めない候補をキューから一時退避する
- `削除`
  - 小さな確認ダイアログを挟んで購読解除する

加えて、既存データモデルや操作概念と素直に噛み合う場合に限って `ミュート` を拡張操作として足してよい。
ただし初回実装は `残す / あとで見る / 削除` だけでも成立する前提で設計する。

### Deletion Safety

ユーザーが選んだ `標準` 安全性に合わせ、削除前に以下を確認できるようにする。

- フィード名
- 最終更新日
- 最終閲覧日
- 未読数
- スター数

確認ダイアログでは「なぜ候補に上がったか」も短く再表示する。
これにより、毎回重すぎないが、誤削除しにくいバランスを取る。

## Visual Direction

- 既存アプリの dark base を維持する
- 通常の読書画面よりも、情報整理と判断を優先した密度の高い surface にする
- アクセントは青一辺倒ではなく、健康状態や候補性を示すために teal を主軸に使う
- 危険操作だけを orange 系で分離し、全体を警告色だらけにしない
- 強い演出より、状態バッジ・密度・コントラストで「運用画面らしさ」を出す

## Information Architecture

### Left Filters

- フィルタはトグルまたは chip 形式で並べる
- 条件数が増えても 1 画面で把握できるよう、短いラベルを使う
- しきい値の詳細編集は初回スコープでは入れず、固定ルールで始める

### Queue Rows

候補行には少なくとも次を表示する。

- フィード名
- 所属フォルダまたは account 名
- `xx日更新なし`
- `最後に開いたのは xx か月前` のような補助情報
- 失敗や未読 0 などの短いタグ

一覧だけで雑に判断できるが、最終判断は右パネルで行う設計にする。

### Review Panel

右パネルは「削除してよいか」を確認するための要約ビューとして扱う。

- main facts:
  - 最終更新日
  - 最終閲覧日
  - 未読数
  - スター数
  - フィード URL / site URL
  - 所属フォルダ
- rationale:
  - 候補に上がった理由を箇条書きで表示
- actions:
  - `残す`
  - `あとで見る`
  - `削除`
  - `ミュート` は Phase 2 候補

## Architecture

### Surface Composition

このページは frontend 側で独立した surface として組み立てる。

想定コンポーネント:

- `FeedCleanupPage`
- `FeedCleanupFilters`
- `FeedCleanupQueue`
- `FeedCleanupReviewPanel`
- `DeleteFeedConfirmDialog`

既存の feed context menu や dialog からロジックを一部再利用してよいが、
画面の主目的は「逐次候補レビュー」なので、既存 menu の寄せ集めにはしない。

### Data Sources

候補判定に必要なデータは、既存 query / command を組み合わせて得る。

- feeds
- folders
- articles または feed ごとの既存集計情報
- 同期状態やエラー情報
- 最後に開いた日時が store / DB に無い場合:
  - 初回実装ではその指標を optional 扱いにし、利用可能な signal だけで候補化する

新しい集計 API が必要なら「cleanup candidate を返す専用 query」ではなく、
既存データから導出できる pure helper を優先する。

### State Flow

1. ページ表示時に feed 一覧と関連メタデータを取得する
2. filter state をもとに candidate list を導出する
3. queue 先頭または直近選択候補を review panel に表示する
4. action 実行時に query を invalidate し、queue を再計算する

`残す` `あとで見る` は UI state または既存 preference に一時保存してよい。
ただし初回実装で永続化範囲を広げすぎないことを優先する。

## Error Handling

### Missing Signals

- `last opened at` が取得できない場合:
  - その理由を UI に出さず、単に表示項目を減らす
  - stale 判定自体は他の signal で継続する

### Delete Failure

- 削除に失敗した場合:
  - queue 上の候補は残す
  - toast で失敗を知らせる
  - review panel の state は維持し、再試行しやすくする

### Empty State

- 候補が 0 件の場合:
  - 空画面ではなく「今は整理候補がありません」を出す
  - 現在の filter 条件も一緒に見せ、解除しやすくする

## Implementation Targets

- app shell 内での新しい surface 追加箇所
- feed cleanup page 関連 components
- cleanup candidate 導出 helper
- 必要な query hook または command wrapper
- delete confirmation dialog
- i18n 文言
- 関連 tests / stories

具体パスは実装計画で確定するが、少なくとも frontend 中心の変更になる。

## Testing

- フィルタ条件で candidate queue が変わること
- candidate row 選択で review panel が切り替わること
- review panel に削除判断材料が表示されること
- `削除` 押下時に確認ダイアログが開くこと
- ダイアログ内にフィード名と重要指標が再表示されること
- 削除成功後に queue から候補が外れること
- 削除失敗時に queue が維持され、エラー通知が出ること
- 候補 0 件時の empty state が成立すること

## Risks

### Last Opened Signal May Not Exist Yet

`最後に開いた日時` が現状のデータモデルに存在しない可能性がある。
その場合、spec どおりの候補理由を一部出せない。
初回実装では optional signal として扱い、無いことを理由に全体を止めない方針にする。

### Mute Semantics May Be Ambiguous

既存アプリに「ミュート」の明確なモデルがない場合、UI だけ先行させると意味がぶれる。
初回実装で永続ミュートが重い場合は、`あとで見る` を先に入れ、
`ミュート` は軽い非表示または次段階に落としてよい。

### Separate Surface Can Increase Navigation Cost

専用ページ化で責務は明確になる一方、入口が遠いと使われなくなる。
実装では「たまに使う管理ページ」として十分な見つけやすさを確保する必要がある。

## Phased Delivery

### Phase 1

- feed cleanup surface
- fixed filters
- candidate queue
- review panel
- delete confirmation
- keep / later の最低限導線

### Phase 2

- mute の意味を明確化して永続化
- candidate heuristic の拡張
- 重複検出や安全候補バッジ
- 一括処理

## Open Questions For Planning

- `最後に開いた日時` をどこから取るか
- `ミュート` を本当に初回スコープへ入れるか
- 入口を sidebar / settings / command palette のどこに置くか
- candidate 導出を frontend helper で始めるか、backend 集計を足すか
