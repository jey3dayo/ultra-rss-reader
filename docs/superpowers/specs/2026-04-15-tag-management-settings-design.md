# Tag Management Settings Design

## Summary

サイドバーの `タグ` セクション見出しに右クリックメニューを追加し、
`タグを追加` と `タグを管理` を提供する。
同時に `Settings` モーダルへ `タグ` カテゴリを新設し、
既存タグの追加・編集・削除を 1 か所で扱える管理画面を追加する。

実装は既存のタグ用 hook / dialog / settings 共通部品を優先して再利用し、
サイドバーと設定画面のどちらから操作しても同じデータ更新と同じ UI 体験になるように揃える。

## Current State

- サイドバーの各タグ行には `TagContextMenuContent` があり、`編集` と `削除` はすでに提供されている
- 一方で `タグ` セクション見出しは `SidebarSectionToggle` をそのまま使っており、見出し固有のメニューはない
- タグ操作のデータ更新は `useCreateTag` `useRenameTag` `useDeleteTag` が担っており、React Query invalidate も集約されている
- 設定画面は `SettingsNavView` と `SettingsModal` を中心にカテゴリ切り替えしており、`general` `appearance` などの固定カテゴリだけを持つ
- タグの作成 UI は記事本文側の `ArticleTagChips` に閉じていて、タグをまとめて管理する専用画面はない

## Goals

- `タグ` セクション見出しを右クリックしたときに `タグを追加` と `タグを管理` を表示する
- `Settings` モーダル内に `タグ` カテゴリを追加する
- 設定画面からタグの一覧表示、新規追加、編集、削除を行えるようにする
- 既存のタグダイアログ、hook、settings 共通コンポーネントを再利用する
- サイドバーと設定画面のどちらから操作しても即時に同じデータへ反映されるようにする

## Non-Goals

- 各タグ行の右クリックメニュー項目を増やすこと
- タグの並び替えや検索、バルク操作を追加すること
- タグ管理を別ウィンドウや別ページへ分離すること
- 新しい永続化形式や専用 store を追加すること
- タグの色仕様やタグモデル自体を変更すること

## UX Decisions

### 1. サイドバー見出しメニュー

`タグ` セクション見出し自体を右クリック可能にする。
メニュー項目は初版では次の 2 つだけに絞る。

- `タグを追加`
- `タグを管理`

`タグを追加` はその場で新規タグ用ダイアログを開く。
`タグを管理` は `Settings` モーダルを開き、`タグ` カテゴリをアクティブにする。

見出しの通常クリック挙動はこれまで通り開閉トグルのままにする。
右クリック導線を足しても、左クリック操作を変えない。

### 2. 設定画面の構成

`Settings` の左ナビに `タグ` を追加する。
カテゴリは account 設定より上の一般設定群に含め、
`general` と同じレベルで切り替えられるようにする。

本文は次の 2 セクション構成にする。

1. `新しいタグ`
2. `既存のタグ`

`新しいタグ` は名前入力と作成ボタンを持つ。
色は初版では入力欄に持たず、作成時は `null` を既定値とする。
色付きタグの作成は見出しメニューや記事側よりも制約が強くなるが、
初版では「設定画面でタグをまとめて管理できること」を優先し、
色編集は `編集` ダイアログに委ねる。

`既存のタグ` は管理テーブルではなく、
既存 settings の行レイアウトに寄せた一覧として見せる。
各行は左に色ドットとタグ名、右に `編集` `削除` ボタンを置く。

### 3. ダイアログ再利用

タグ編集と削除は既存の `RenameTagDialogView` と `DeleteTagDialogView` をそのまま使う。
これにより、サイドバー各タグ行の右クリックと設定画面で
同じ確認導線と同じ色編集 UI を共有する。

見出しメニューからの `タグを追加` だけは新規作成用の小さなダイアログを追加する。
ただし内部で使う入力部品は既存 `StackedInputField` や `FormActionButtons` に揃える。
将来的に必要なら作成と編集を共通ダイアログへ寄せられるよう、
新規作成ダイアログは責務を狭く保つ。

## Architecture

### 1. Sidebar Section Header

`SidebarSectionToggle` かその周辺を拡張し、
通常トグルに加えて任意の context menu trigger を受け取れる形にする。
タグ専用の実装を `TagListView` に直接埋め込まず、
他セクションでも再利用できるよう「セクション見出しにメニューを載せる」抽象度で止める。

タグセクション側ではその拡張ポイントに
`TagSectionContextMenuContent` を差し込む。
ここでは `タグを追加` と `タグを管理` の 2 操作だけを持つ。

### 2. Settings Category

`SettingsCategory` に `tags` を追加する。
`useSettingsModalViewProps` のナビ項目と `settingsCategoryByNavId` を更新し、
`SettingsModal` の本文切り替えに `TagsSettings` を追加する。

`openSettings("tags")` を使えば、
サイドバーからでも直接 `タグ` カテゴリを開けるようにする。
この遷移は既存の settings state を流用し、新しい modal state は持たない。

### 3. Tags Settings View

`TagsSettings` は container と view を分ける。

- container
  - `useTags` と tag mutations を呼ぶ
  - 入力 state や dialog open state を持つ
  - toast や mutation 成否を処理する
- view
  - `SettingsContentLayout` `SettingsSection` `Labeled*Row` などを組み合わせて描画する

`SettingsPageView` の control union は変更しない。
タグ一覧行は行ごとにボタンが 2 つ必要なため、
既存の select / switch / text / action の 4 種に押し込まず、
専用 view を作るほうが自然で保守しやすい。

## Data Flow

### 1. 見出しメニューから `タグを追加`

1. user が `タグ` 見出しを右クリックする
2. `タグを追加` を選ぶ
3. 新規タグダイアログを開く
4. `useCreateTag` で保存する
5. 成功時は dialog を閉じ、`["tags"]` の invalidate により sidebar / settings の一覧を同期する
6. 失敗時は toast を出し、入力値は保持する

### 2. 見出しメニューから `タグを管理`

1. user が `タグ` 見出しを右クリックする
2. `タグを管理` を選ぶ
3. `openSettings("tags")` を呼ぶ
4. `Settings` モーダルが開き、`タグ` ナビが active になる

### 3. 設定画面での追加・編集・削除

- 追加:
  - 上段フォームから `useCreateTag` を呼ぶ
  - 成功時は入力欄を空に戻す
- 編集:
  - 行の `編集` から `RenameTagDialogView` を開く
  - 保存時は `useRenameTag` を呼ぶ
- 削除:
  - 行の `削除` から `DeleteTagDialogView` を開く
  - 確認後に `useDeleteTag` を呼ぶ

どの操作でも query invalidation は既存 hook に任せる。
container 側で個別の再フェッチ順序を持たない。

## Error Handling

- 作成・編集・削除の失敗は `showToast` で短く通知する
- 失敗時に入力欄や dialog state は閉じず、そのまま再試行できるようにする
- 設定画面からタグを削除した結果、現在の選択が存在しないタグを指す場合は、
  安全な fallback selection を適用する
  - 第一候補: `all`
  - 必要なら既存の sidebar visibility fallback と同じ責務に寄せる
- `タグを管理` の遷移は modal category の切り替えだけに留め、
  余計な selection 変更や article state のリセットは行わない

## Testing

- `Tag` 見出しの右クリックでメニューが開き、`タグを追加` と `タグを管理` が見えること
- `タグを管理` が `openSettings("tags")` につながること
- 設定ナビに `タグ` 項目が増え、選択状態が正しく反映されること
- `TagsSettings` で既存タグ一覧が描画されること
- `TagsSettings` から追加フォーム送信、編集ダイアログ起動、削除ダイアログ起動ができること
- 既存の `TagContextMenuContent` の挙動を壊していないこと

## Implementation Notes

- 追加する主な単位は次を想定する
  - `TagSectionContextMenuView` / `TagSectionContextMenuContent`
  - `CreateTagDialogView` もしくは同等の小さな新規作成ダイアログ
  - `TagsSettings` `TagsSettingsView`
- 既存 dialog の色プリセット定義が `TagContextMenuContent` に閉じているため、
  必要なら tags 用の shared 定数へ移す
- locale は `reader` と `settings` のどちらに置くかを明確に分ける
  - サイドバー見出しメニュー文言は `sidebar` か `reader`
  - 設定画面の見出しや説明は `settings`

## Open Questions Resolved

- 右クリックメニューの対象は `タグ` セクション見出しのみとする
- 見出しメニュー項目は `タグを追加` と `タグを管理` の 2 つに限定する
- 設定画面には `タグ` カテゴリを追加し、そこで追加・編集・削除を行えるようにする
- 実装は共通コンポーネントと既存タグダイアログを優先して再利用する
