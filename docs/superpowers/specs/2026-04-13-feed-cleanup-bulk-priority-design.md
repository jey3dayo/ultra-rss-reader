# Feed Cleanup Bulk Actions And Priority Design

## Summary

`Feed Cleanup` に残っている TODO のうち、
`一括操作` と `優先度表示` を現在の 3 カラム構成のまま追加する。

今回の方針は「新しい scoring モデルを増やす」のではなく、
既存の `summarizeCleanupCandidate()` が返す
`tone / titleKey / summaryKey` をそのまま活かしながら、
一覧と overview での意思決定速度を上げることにある。

## Goals

- 現在表示中の候補に対して `まとめて継続` と `まとめて保留` を実行できる
- queue と review で、候補の優先度が今より短時間で把握できる
- integrity mode の体験を崩さない
- 既存の candidate heuristic と queue ordering を変更しない
- 既存の state / panel 分割方針を維持する

## Non-Goals

- candidate scoring に `confidence` や数値 score を追加すること
- broken references view に bulk action を持ち込むこと
- `残す / あとで見る / 削除` 以外の action model を増やすこと
- page layout を大きく変えること
- server side や DB に bulk action state を永続化すること

## Current State

- priority は queue row と review panel にすでに表示されている
- ただし、既存表示は「結果ラベル」としては見えるが、
  一覧を上から判断するときの補助としてはまだ弱い
- `keep / later` は単体 action のみで、filtered queue 全体への操作はない
- `useFeedCleanupPageState()` は `visibleCandidates` を持っているため、
  bulk action の対象範囲を追加計算せずに扱える

## Approved Direction

### Bulk Actions

- 対象は `現在の filter と deferred 表示条件で visible な candidate`
- action は 2 つに絞る
  - `Keep all visible`
  - `Defer all visible`
- 配置は `FeedCleanupOverviewPanel` の filter セクション直下
- `integrityMode` 中は非表示
- visible candidate が 0 件のときは disabled

### Priority Display

- `tone / titleKey / summaryKey` の既存モデルをそのまま使う
- queue row の priority pill は維持しつつ、
  overview に priority summary copy を少し補強する
- review panel は既存の headline / summary を活かし、
  priority badge をより「判断の強さ」として読める copy に寄せる
- 数値 score や additional enum は足さない

## Component Changes

### `use-feed-cleanup-page-state.ts`

- `markVisibleCandidatesKept`
- `markVisibleCandidatesDeferred`

を追加する。

実装は `visibleCandidates` の `feedId` を走査し、
既存の `keptFeedIds` / `deferredFeedIds` に対してまとめて追加する。

選択中 item の再選択は既存の `visibleCandidates[0]` 自動選択 effect に任せる。

### `feed-cleanup-page.tsx`

- overview panel へ bulk action 用の label / disabled state / handler を渡す
- locale から bulk action copy を読む
- TODO 完了後は `TODO.md` を更新する

### `feed-cleanup-overview-panel.tsx`

- filters の下に bulk action row を追加する
- CTA は secondary / outline 系で destructive に見せない
- counts を添えて「いま表示中に効く」ことを明示する

### `feed-cleanup-queue-panel.tsx`

- priority pill は現行のまま使う
- ただし priority を一覧で読みやすくする補助 copy を導入する場合でも、
  card density は増やしすぎない

### `feed-cleanup-review-panel.tsx`

- 既存の headline / body / badge の関係を維持する
- locale 調整で「priority label が recommendation に見える」方向へ寄せる

## Locale Changes

追加候補:

- `bulk_actions`
- `bulk_keep_visible`
- `bulk_defer_visible`
- `bulk_visible_count`

必要に応じて以下も調整する。

- `priority_review_now`
- `priority_consider`
- `priority_keep`
- `summary_headline_*`

ただし key 増加は最小限に留める。

## Testing

### Component / Integration

- visible candidate があるとき bulk action ボタンが出る
- `Keep all visible` 実行で visible queue が消える
- `Defer all visible` 実行で queue から消え、`Show deferred` 後に戻る
- integrity mode では bulk action が表示されない
- priority copy は queue / review の既存 assertions を壊さない

### Storybook

- `FeedCleanupOverviewPanel` に bulk action 行を追加した状態を反映
- `FeedCleanupQueuePanel` は priority pill の見え方を維持
- `FeedCleanupReviewPanel` は recommendation copy の状態を維持

## Risks

### Bulk Action Can Hide Too Much At Once

`Keep all visible` を押すと queue が一気に空になり得る。
このため destructive ではなくても、
「現在表示中だけに効く」ことを copy で明示する必要がある。

### Deferred And Visible Scope Can Be Misread

`Defer all visible` は active filters と `showDeferred` の状態に依存する。
「全候補」ではなく「現在表示中」であることを label に含める。

### Priority Copy Can Drift From Existing Tests

priority label を変えすぎると queue / review の既存テストや
比較済み copy と衝突する。
今回は structural change を優先し、copy の変更は小さく保つ。
