# Sidebar Density Setting Design

## Summary

設定画面の `外観 > 一般` に `リスト密度` オプションを追加し、
sidebar の行間と縦方向の密度を `狭く / 標準 / 広く` の 3 段階で切り替えられるようにする。

ユーザー向けラベルは `リスト密度` とするが、
内部実装は当面 sidebar にだけ効く `sidebar_density` preference として定義する。
これにより、今回の要求範囲を sidebar に閉じつつ、
将来ほかのリストへ拡張したい場合にも移行しやすい形を残す。

## Current State

- `src/components/settings/use-appearance-settings-view-props.ts`
  - `外観 > 一般` には `リスト選択スタイル`, `レイアウト`, `テーマ`, `不透明サイドバー`, `グレースケールファビコン` が並んでいる
  - sidebar の密度に関する設定項目は存在しない

- `src/stores/preferences-store.ts`
  - `layout`, `theme`, `font_style`, `font_size` などの appearance preference は schema と default が集中管理されている
  - sidebar 専用の密度 preference は存在しない

- `src/components/reader/sidebar-nav-button.tsx`
  - sidebar row の基本的な高さと縦 padding を持っている

- `src/components/reader/feed-tree-row.tsx`
  - feed row の drag handle のサイズと左 padding を直接持っている

- `src/components/reader/feed-tree-folder-section.tsx`
  - folder toggle のサイズ、配下 feed 群の `space-y`、上マージンを直接持っている

- `src/components/reader/feed-tree-view.tsx`
  - top-level tree block の `space-y` を直接持っている

- `src/components/reader/feed-tree-unfoldered-section.tsx`
  - unfoldered feed 群の縦間隔を直接持っている

- `src/components/reader/tag-list-view.tsx`
  - tag list の縦間隔を直接持っている

この結果、sidebar の視認性調整に関わる class が複数ファイルへ散っており、
オプション化や将来の再調整を行う際に変更漏れが起きやすい。

## Goals

- 設定画面 `外観 > 一般` に `リスト密度` を追加する
- 選択肢を `狭く / 標準 / 広く` の 3 段階で提供する
- internal preference key は `sidebar_density` にする
- sidebar row 高さ、縦 padding、tree gap、toggle size、drag handle size を設定値から一貫して決定できるようにする
- 既存の sidebar UI を大きく作り変えず、密度だけを切り替えられるようにする
- `mise run check` を通せる状態にする

## Non-Goals

- article list や settings list など sidebar 以外へ今回の密度設定を適用すること
- `list_density` という汎用 preference に今すぐ一般化すること
- typography 全体の line-height system を再設計すること
- font size や list selection style の既存挙動を同時に変えること
- unrelated な sidebar refactor を進めること

## Recommended Approach

`sidebar_density` preference + sidebar 専用 density token helper を採用する。

理由:

- 設定画面上は `リスト密度` という自然な文言を出せる
- 実装責務は sidebar に閉じられ、今回の要件と一致する
- `h-9`, `space-y-0.5` のような class を scattered override するより、
  density helper 1 か所で定義した方が今後の調整が安全
- 将来 `list_density` に昇格させたくなった場合も、
  まずは sidebar 用 token を流用して拡張できる

## Design

### 1. Appearance Settings に `リスト密度` を追加する

`src/components/settings/use-appearance-settings-view-props.ts` の
`appearance-general` section に新しい select control を追加する。

想定:

- label: `appearance.list_density`
- name: `sidebar_density`
- value: `resolvePreferenceValue(prefs, "sidebar_density")`
- options:
  - `compact` → `appearance.compact_density`
  - `normal` → `appearance.normal_density`
  - `spacious` → `appearance.spacious_density`
- onChange: `(value) => setPref("sidebar_density", value)`

配置は `リスト選択スタイル` の近くが自然なので、
`list_selection_style` の直後に置く。

### 2. Preference Store に `sidebar_density` を追加する

`src/stores/preferences-store.ts` に新しい enum schema を追加する。

想定値:

- `compact`
- `normal`
- `spacious`

追加箇所:

- schema 定義
- `preferenceSchemas`
- `corePreferenceDefaults`

default は `normal` にする。
これにより既存ユーザーは見た目を急変させずに新設定を受け取れる。

### 3. Sidebar 専用 density helper を導入する

新規に sidebar 専用の helper を追加し、
各コンポーネントが density から class token を受け取れるようにする。

例:

- `src/components/reader/sidebar-density.ts`

責務:

- `sidebar_density` を受け取る
- row 高さ、padding、toggle size、drag handle size、tree gaps を返す

想定 token:

- `navButton`
- `dragHandle`
- `folderToggle`
- `treeRootGap`
- `treeChildGap`
- `unfolderedSectionGap`
- `tagListGap`
- `dragOffsetPadding`

ここで大事なのは、helper は sidebar 専用に留めること。
generic な `list density` helper にしない。

### 4. Sidebar 関連コンポーネントは helper を参照する

対象:

- `src/components/reader/sidebar-nav-button.tsx`
- `src/components/reader/feed-tree-row.tsx`
- `src/components/reader/feed-tree-folder-section.tsx`
- `src/components/reader/feed-tree-view.tsx`
- `src/components/reader/feed-tree-unfoldered-section.tsx`
- `src/components/reader/tag-list-view.tsx`

各コンポーネントは raw class の直接分岐を持たず、
必要な token を helper 経由で読む。

期待する整理:

- row 高さは `SidebarNavButton` が density aware になる
- drag handle / folder toggle は row と同じ密度階層に揃う
- tree 配下リストや tag list の `space-y` も同じ density で動く
- `pl-9` のような drag handle offset も density に追従する

### 5. Preference の読み出しは sidebar root か controller に寄せる

`sidebar_density` の参照は sidebar ルート近辺で行い、
props または hook を通して必要な箇所へ渡す。

候補:

- `src/components/reader/use-sidebar-controller.ts`
- `src/components/reader/sidebar.tsx`

避けるべきこと:

- 各 leaf component が個別に `usePreferencesStore` を読むこと

理由:

- dependency を広げない
- test 時の props 注入を簡単にする
- sidebar density の責務を sidebar tree に閉じ込める

### 6. 旧系 sidebar コンポーネントの扱い

`src/components/reader/feed-item.tsx` と `src/components/reader/folder-section.tsx` は
storybook / test 用の旧系実装として残っている。

今回の原則:

- 実運用の sidebar 導線で使っている `feed-tree*` を優先して density 化する
- 旧系コンポーネントを変更するかどうかは、
  そのテストと story の整合性を保つ最小限に留める
- この機会に大きく統合リファクタはしない

## UX Notes

- デフォルトは `標準` にし、現在の見え方を基準にする
- `狭く` は情報密度を高めたいユーザー向け
- `広く` は視認性と誤操作抑制を優先するユーザー向け
- ラベルは `行間` ではなく `リスト密度` にする
  - 実際には row 高さ、toggle サイズ、インデント周辺までまとめて変わるため
  - ユーザーの mental model と実際の挙動が一致しやすい

## Data Flow

1. app 起動時に `preferences-store` が `sidebar_density` を load する
2. sidebar controller / root が `resolvePreferenceValue(prefs, "sidebar_density")` を読む
3. density helper が UI token を返す
4. sidebar row / tree / tag list が token を用いて描画される
5. settings で値を変更すると `setPref("sidebar_density", value)` が走る
6. store 更新に応じて sidebar が再描画され、密度が即時反映される

## Error Handling / Edge Cases

- persisted value が壊れている
  - schema validation により `normal` へ fallback する

- settings 画面と sidebar を同時に見ている状態で変更する
  - existing preference update flow に乗せることで即時反映する

- compact / spacious で drag handle や folder toggle だけサイズがズレる
  - helper で同一 density contract にまとめることで防ぐ

- 旧系 component test が現行 sidebar とズレる
  - 旧系を触るなら最小限の assertion 更新だけに留める

## Testing Strategy

### 1. Preference / Settings Tests

対象:

- `src/__tests__/stores/preferences-store.test.ts`
- `src/__tests__/components/settings-surface-views.test.tsx`

確認:

- `sidebar_density` が invalid value で `normal` に fallback する
- Appearance settings に `リスト密度` select が出る
- `狭く / 標準 / 広く` の option が選べる

### 2. Density Helper Tests

新規候補:

- `src/__tests__/components/sidebar-density.test.ts`

確認:

- `compact`, `normal`, `spacious` で token が変化する
- row / gap / handle size が意図した方向に増減する

### 3. Sidebar UI Tests

対象:

- `src/__tests__/components/feed-tree-view.test.tsx`
- `src/__tests__/components/sidebar.test.tsx`

確認:

- `compact` で row 高さと handle size が詰まる
- `normal` で default density が維持される
- `spacious` で gap と row 高さが広がる
- drag/drop affordance と unread count 表示は壊れない

## Risks and Mitigations

### Risk: density logic が別の見た目調整と混ざる

Mitigation:

- helper を sidebar density 専用にする
- font size や list selection style と責務を混ぜない

### Risk: raw class が残って一部だけ切り替わらない

Mitigation:

- sidebar tree で縦密度に効く class を洗い出して helper へ寄せる
- test で representative component を複数見る

### Risk: preference 名と表示名のズレで混乱する

Mitigation:

- user-facing copy は `リスト密度`
- internal key は code comment なしでも意味が分かる `sidebar_density`
- spec / plan で「当面 sidebar 限定」であることを明記する

## Definition of Done

- `外観 > 一般` に `リスト密度` が追加されている
- `sidebar_density` preference が schema/default/fallback を持つ
- sidebar の密度 class が helper 経由で決まる
- `狭く / 標準 / 広く` を切り替えると sidebar が即時反映される
- 関連 tests と `mise run check` が通る
