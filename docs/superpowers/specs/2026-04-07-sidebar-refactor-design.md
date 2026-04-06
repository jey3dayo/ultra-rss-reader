# Sidebar Refactor Design

## Overview

`src/components/reader/sidebar.tsx` と `src/components/reader/feed-tree-view.tsx` は、現状だと 600 行超の責務が集中している。
今回の目的は、見た目の大きな再設計ではなく、次の 3 点を満たす分割に寄せること。

- `sidebar.tsx` を section orchestration に集中させる
- `feed-tree-view.tsx` から drag/drop の追跡ロジックを分離する
- `shared` への昇格は薄いレイアウト shell に限定し、reader 固有の意味論は `reader/` に残す

補足: ユーザー指定により、この作業は `main` ブランチ上で進める。

## Goals

- 大きい `tsx` を single-responsibility に近づける
- sidebar の section ごとの見通しを改善する
- 小さな visual polish を入れつつ、情報設計や操作モデルは変えない
- 将来の再利用に備えて、sidebar 系の spacing / header / toggle の共通土台を作る

## Non-Goals

- sidebar の IA 再設計
- feed / folder drag-and-drop の操作仕様変更
- `reader/` の業務ロジックを広く `shared/` に押し出すこと
- `article-view.tsx` や settings 全体の同時リファクタ

## Recommended Approach

Section-first split を採用する。

- `sidebar.tsx` は store, React Query hooks, Tauri event listener, derived view model assembly を担当する coordinator とする
- section ごとの JSX は別コンポーネントへ抽出する
- `feed-tree-view.tsx` は tree composition に寄せ、pointer drag session 管理を hook へ移す
- `shared` には「sidebar 風 panel section を包む薄い shell」だけを追加する

この方針なら、過剰共通化を避けつつ、最も肥大化している reader sidebar 周辺から安全に縮小できる。

## File Plan

### New Files

| File | Purpose |
| --- | --- |
| `src/components/shared/sidebar-section-shell.tsx` | section の余白、header row、optional toggle を揃える薄い共通 shell |
| `src/components/reader/sidebar-account-section.tsx` | account switcher セクションの wrapper |
| `src/components/reader/sidebar-feed-section.tsx` | feeds section と empty state の composition |
| `src/components/reader/sidebar-tag-section.tsx` | tag section の wrapper |
| `src/components/reader/sidebar-footer-actions.tsx` | feed cleanup / settings の footer action row |
| `src/components/reader/feed-tree-row.tsx` | 個々の feed row 描画 |
| `src/components/reader/feed-tree-folder-section.tsx` | folder block 描画 |
| `src/components/reader/feed-tree-drag-overlay.tsx` | drag 中の floating preview |
| `src/components/reader/use-feed-tree-drag.ts` | pointer drag state, hover target, listener orchestration |

### Modified Files

| File | Change |
| --- | --- |
| `src/components/reader/sidebar.tsx` | section orchestration 中心へ縮小 |
| `src/components/reader/feed-tree-view.tsx` | row / folder / drag logic を委譲する composition component へ縮小 |
| `src/components/shared/sidebar-section-toggle.tsx` | shell から利用しやすいように軽微な調整が必要なら実施 |

## Component Boundaries

### `sidebar.tsx`

残す責務:

- `useUiStore`, `usePreferencesStore`, `useAccounts`, `useFeeds`, `useFolders`, `useTags` などの接続
- sync event listener と toast 制御
- feed / folder / tag / smart view の選択制御
- feed tree に渡す view model の組み立て
- drag/drop mutation 実行 (`useUpdateFeedFolder`)

外に出す責務:

- account section の markup
- feed section header / shell / empty state rendering
- tag section の shell rendering
- footer action row

### `feed-tree-view.tsx`

残す責務:

- tree 全体の composition
- folder list / unfoldered list / overlay の描画順序
- empty state と open / close に応じた top-level branching

外に出す責務:

- feed row 表示
- folder section 表示
- drag overlay 表示
- pointer drag session の tracking, listener 登録, hover target 算出

### `shared`

`shared` に上げるのは、sidebar-like panel section shell のみ。

この shell は以下だけを持つ:

- section outer spacing
- header row
- optional toggle slot
- body container

以下は `reader/` に残す:

- feed row / folder row
- drag handle / drag overlay semantics
- empty state 文言や account-aware branching
- Tauri sync / feed mutation に紐づく UI

## Data Flow

1. `sidebar.tsx` が store / query / preference から状態を読む
2. `sidebar.tsx` が section 向け props を整形する
3. 各 section component は props-driven に UI を描画する
4. `sidebar-feed-section.tsx` が `FeedTreeView` を利用する
5. `FeedTreeView` が `useFeedTreeDrag` を使い、pointer drag state を受け取る
6. drop 完了時の実 mutation は `sidebar.tsx` にコールバックで返す

重要なのは、drag の UI 状態は tree に閉じ込めつつ、feed folder 更新という業務操作は sidebar coordinator 側に残すこと。

## Error Handling

- sync listener の warning / failure toast は引き続き `sidebar.tsx` が責務を持つ
- feed drag/drop の mutation error も `sidebar.tsx` 側で処理し、tree subcomponents には API error knowledge を持たせない
- section component は表示専用に寄せ、例外系の分岐は `disabled`, `emptyState`, `activeDropTarget` などの props に落として受け取る
- `use-feed-tree-drag.ts` は UI interaction state のみ扱い、mutation retry や toast は行わない

## Visual Polish Scope

見た目の変更は最小限に留める。

- section 間の vertical rhythm を統一する
- feed section と tag section の header / body spacing を揃える
- footer action row の密度を少し落として視認性を上げる
- folder 配下の feed list の indentation / border の見え方を微調整する

やらないこと:

- アイコン体系の変更
- sidebar のナビゲーション順序変更
- 新しい hover interaction の導入

## Testing Strategy

既存テストをベースに、必要最小限の追加で分割後の退行を防ぐ。

### Keep / Update

- `src/__tests__/components/sidebar.test.tsx`
- `src/__tests__/components/feed-tree-view.test.tsx`

### Add if Needed

- `src/__tests__/components/sidebar-feed-section.test.tsx`
- `src/__tests__/components/sidebar-footer-actions.test.tsx`
- `src/__tests__/hooks/use-feed-tree-drag.test.tsx`

### Verify

- section toggle の開閉が従来通り動く
- account 未選択時 / feed 未登録時の empty state が維持される
- drag hover, drop to folder, drop to unfoldered が維持される
- selected state, unread counts, context menu が壊れない
- visual polish により spacing や footer action のクリック領域が崩れない

## Risks and Mitigations

### Risk: drag/drop regression

pointer drag logic を hook に出す過程で hover target の判定がずれる可能性がある。

Mitigation:

- `getDropTargetAtPoint` 相当の振る舞いを hook 内に閉じ込める
- 既存 test case を移植または維持して drop path を確認する

### Risk: over-abstraction into `shared`

sidebar 固有の事情を共通化しすぎると、他の画面で使いにくい shell になる。

Mitigation:

- shell は layout-only に限定する
- 業務意味を持つ prop 名や branching を入れない

### Risk: visual drift

section 分割時に spacing が subtly 変わる可能性がある。

Mitigation:

- shell に spacing responsibility を寄せる
- story / existing test snapshots がある部分は差分を確認する

## Implementation Notes

- 既存の `src/components/reader/folder-section.tsx` とは別文脈なので、新規分割は `feed-tree-*` 系の命名で揃える
- `control-chip` と `sidebar-section-toggle` は既存資産として使い続ける
- 分割後も `sidebar.tsx` は最終的に sidebar 全体の entry point として残す

## Definition of Done

- `sidebar.tsx` と `feed-tree-view.tsx` の責務が明確に縮小している
- section / tree subparts が別ファイルへ切り出されている
- `shared/sidebar-section-shell.tsx` が薄い共通 shell として導入されている
- 主要な sidebar / feed tree テストが通る
- `mise run check` を通せる状態である
