# Feed Cleanup Copy And Information Design

## Summary

`Feed Cleanup` 画面の役割を、抽象的な「管理」ではなく
「購読を見直して整理する体験」として再定義する。

今回のスコープは candidate selection や 3 カラム構成そのものを変えることではなく、
copy と information design を洗練し、
ユーザーが「何をする画面か」「なぜその判断が出ているか」を
短時間で理解できる状態にすることにある。

中心方針は次の 2 点。

- 直感的に理解できる日本語へ統一する
- AI や heuristics の判断は、抽象表現ではなく理由つきで示す

## Goals

- 画面を開いた瞬間に「購読の整理画面」だと分かる
- 候補カードを一覧しただけで主要な判断材料を読める
- 右カラムで「結論」と「理由」の関係が自然に伝わる
- `ja` と `en` の i18n が同じ意図を共有し、片方だけ不自然にならない
- destructive action を過度に強くも曖昧にもせず、自然な操作語へ寄せる

## Non-Goals

- candidate heuristics や filter のロジックを変更すること
- 3 カラム構成を別レイアウトに作り直すこと
- 一括操作や score 表示を今回の実装へ含めること
- broken references view の概念整理まで同時にやり切ること
- editor / maintenance section の機能範囲を広げること

## Current Problems

- `フィード管理` だと、整理・見直しの画面なのか、設定・編集の画面なのかが曖昧
- `残してよさそう` は柔らかいが、なぜそう言えるのかが伝わりにくい
- `整理キュー` は内部用語に近く、一般ユーザーに一拍の解釈が必要
- `Must Read ・ 0d ・ 17未読 ・ 0スター` のような condensed metadata は視認負荷が高い
- `スターした記事がありません` のような同一文言が繰り返し現れるとノイズになる
- `削除` は行為として強く見えすぎる一方、購読解除であることが UI 上で直感的ではない

## Design Direction

### Positioning

画面全体の位置づけを `管理` から `整理` へ寄せる。

- sidebar label も page title も同じ意味に統一する
- 見出しは action-oriented にする
- 補足説明は「なぜ今ここを見るのか」を端的に伝える

### Tone

判断支援 copy は `行動提案 + 理由説明` のハイブリッドにする。

- 見出し: 次にどうするとよいかを示す
- 補足文: その判断の理由を短く示す

これにより、単なる状態ラベルよりも意思決定が速くなり、
black-box な AI 判定にも見えにくくなる。

## Approved UX Copy

### Japanese Direction

- `フィード管理` -> `購読の整理`
- `静かになった購読を、消す前に見直します。` -> `更新が少ない購読を見直しましょう`
- `整理キュー` -> `見直しリスト`
- `確認` -> `判断の詳細`
- `残す` -> `継続`
- `削除` -> `購読解除`
- `あとで見る` -> `保留`

priority / summary tone も抽象度を下げ、recommendation と review-needed を分ける。

- `優先確認` -> `見直し優先`
- `確認候補` -> `要確認`
- `残してよさそう` -> `継続をおすすめ`
- `いったん残してよさそうです` -> `この購読は継続がおすすめです`

summary body は、結論ではなく理由に寄せる。

- `最近も更新があります`
- `未読記事があるため、すぐの解除はおすすめしません`
- `最近の動きがあり、残しておく理由があります`

### English Direction

英語は直訳ではなく、英語 UI として自然な phrasing を優先する。

- `Feed Cleanup` -> `Review Subscriptions`
- `Review quiet subscriptions before you delete them.` -> `Review low-activity subscriptions before you unsubscribe.`
- `Cleanup Queue` -> `Review List`
- `Review` -> `Decision Details`
- `Keep` -> `Keep Subscribed`
- `Delete` -> `Unsubscribe`
- `Later` -> `Snooze`

English でも recommendation copy は abstract label を避ける。

- review-needed tone label は `Needs review`
- keep-oriented tone label は `Recommended to keep`
- summary headline は `This subscription looks worth keeping`
- body は `It still shows recent activity.` のように reason-first にする

## Information Architecture Changes

### Candidate Cards

一覧カードは「圧縮された raw metrics」ではなく
「判断に使える短い labeled facts」を見せる。

現在のような condensed row:

- `Must Read ・ 0d ・ 17未読 ・ 0スター`

は次のような読み方へ寄せる。

- `フォルダ: Must Read`
- `最終更新: 0日前`
- `未読: 17件`
- `お気に入り: 0件`

実装上は完全に縦積みにする必要はなく、横並びのままでもよい。
重要なのは、各値に label が付き、一目で意味が取れること。

### Reason Tags

候補理由は、定型文の長文 repeated text ではなく tag と short sentence を併用する。

- 一覧では compact tags を表示
- 詳細では short sentence または tag + sentence で展開

`スターした記事がありません` のような zero-state 文は常時表示しない。
理由として意味を持つときだけ出す。

### Review Panel

右カラムは「判断の詳細」として扱い、情報の順番を次に揃える。

1. 結論
2. 理由の短い説明
3. 主要メタ情報
4. 候補理由の一覧
5. 操作

この順にすることで、まず recommendation を理解し、
そのあと facts で納得し、最後に action へ移れる。

## Filters

filter label も少しだけ natural language に寄せる。

- `90日以上更新なし` -> `長期間更新なし`
- `未読なし` -> `未読0件`
- `スターなし` -> `お気に入りなし`

ここでは heuristic 自体を変えず、
user-facing copy だけを理解しやすくする。

## Scope Boundaries

今回の実装で変えるのは以下に限定する。

- sidebar と cleanup page の名称統一
- cleanup page 内の section / button / summary copy 更新
- candidate card の metadata 表記改善
- review panel の recommendation copy 改善
- repeated noise text の抑制
- `ja` / `en` locale と関連テストの更新

今回の実装では変えない。

- candidate scoring
- queue ordering rules
- bulk actions
- keep / later / delete 以外の action model
- integrity mode の大幅な再設計

## Future Work

今回の議論で価値があると確認できたが、実装を分ける項目。

- 一括操作
  - `すべて継続`
  - `すべて解除候補へ`
- 優先度や confidence を示す補助表示
  - `高 / 中 / 低`
  - recommendation の根拠をさらに短く理解できる補助 UI

これらは今回の implementation には含めず、`TODO.md` で追跡する。

## Implementation Targets

- `src/locales/ja/cleanup.json`
- `src/locales/en/cleanup.json`
- `src/locales/ja/sidebar.json`
- `src/locales/en/sidebar.json`
- `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- cleanup page に対する component tests
- locale consistency tests

関連する dialog title や auxiliary copy も、`購読の整理` の positioning と
矛盾しないか確認しながら更新する。

## Testing

- sidebar label と page title が新しい positioning に揃うこと
- candidate card の metadata が label 付きで読めること
- recommendation panel が `結論 + 理由` の順で読めること
- `ja` と `en` のテキストが同じ意味を表していること
- 既存の cleanup interaction test が新 copy に合わせて成立すること

## Risks

### Copy Can Become Too Verbose

説明を増やしすぎると、今度は cleanup page の密度が下がる。
一覧では short labels を優先し、長い説明は review panel に寄せる必要がある。

### English May Drift From Japanese Intent

自然な英語を優先しすぎると、日本語側の recommendation tone と
意味がずれる可能性がある。
各 key は literal match ではなく intent match でレビューする。

### Mixed Terminology Across Related Surfaces

sidebar だけ `管理` が残る、dialog だけ `削除` が残る、のような partial rename は
かえって迷いを生む。
surface 単位ではなく flow 単位で terminology を見直す必要がある。
