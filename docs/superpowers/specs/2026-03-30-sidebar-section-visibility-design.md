# Sidebar Section Visibility — Design Specification

## Overview

サイドバー内の一部セクションは、ユーザーによっては常に必要ではない。
`Unread`、`Starred`、`Tags` を個別に表示・非表示できる設定を追加し、各ユーザーがサイドバー密度を調整できるようにする。

この変更は「サイドバーに出すかどうか」だけを対象にし、機能自体を無効化するものではない。
`Starred` や `Tags` を非表示にしても、既存のコマンド、内部状態、将来の他導線はそのまま維持する。

## Goals

- `Unread`、`Starred`、`Tags` をそれぞれ個別にサイドバー表示切替できる
- 既定値は現状維持とし、初回起動時はすべて表示する
- `アカウント切替` と `Feeds` は常時表示のまま維持する
- 現在表示中の項目を非表示にした場合でも、破綻しない fallback 遷移を行う

## Non-Goals

- フィード一覧やアカウント切替自体を非表示にする
- `Starred` や `Tags` 機能そのものを無効化する
- 汎用的な「任意の sidebar item を並べ替え/管理する設定システム」を導入する
- 非表示セクションに合わせたデータ取得最適化まで今回含める

## Scope

### 常時表示

- アカウント切替
- Feeds セクション

### 設定で切替対象

- Unread
- Starred
- Tags

### 非表示の意味

設定を OFF にした対象は「サイドバーから消える」だけとする。
内部の selection 型、既存アクション、将来のショートカットや別 UI からの導線は維持する。

## Preference Model

`src/stores/preferences-store.ts` に以下の boolean string preference を追加する。

- `show_sidebar_unread`
- `show_sidebar_starred`
- `show_sidebar_tags`

既定値はすべて `"true"` とし、現行 UI をそのまま引き継ぐ。
既存 preference と同じく schema・default・normalize の対象に含める。

## Settings UI

設定画面の General 内に、サイドバー表示制御用の 3 つの個別スイッチを追加する。

- `Unread を表示`
- `Starred を表示`
- `Tags を表示`

UI 上の意味は「サイドバーに表示するかどうか」であり、機能全体の有効/無効ではない。
その意図が伝わるよう、既存の sidebar/list 表示設定に近い位置へ配置する。

## Sidebar Rendering

実際の表示制御は `src/components/reader/sidebar.tsx` に集約する。

### Smart Views

`Unread` と `Starred` は既存の smart view 配列から描画されているため、view model を生成した後ではなく、描画対象の smart view を preference で絞り込む。

- `show_sidebar_unread = false` のとき `Unread` 行を描画しない
- `show_sidebar_starred = false` のとき `Starred` 行を描画しない

count 表示ロジック自体は既存仕様を維持する。
今回の変更は view の存在可否だけを制御し、count 算出仕様までは変更しない。

### Tags

`Tags` セクションは既存の `tags.length > 0` 条件に加えて、`show_sidebar_tags = true` のときだけ描画する。

つまり Tags が表示される条件は以下の両方を満たす場合のみである。

- タグデータが存在する
- 表示設定が ON

## Fallback Behavior

設定変更で「現在の selection がサイドバー上で無効になる」場合だけ、自動 fallback を行う。
有効な selection を持っている場合は何も変えない。

### fallback ルール

1. 現在が `Starred` で、`show_sidebar_starred = false` になった場合は `Unread` へ移動する
2. 現在が `Tag` で、`show_sidebar_tags = false` になった場合は `Unread` へ移動する
3. 現在が `Unread` で、`show_sidebar_unread = false` になった場合は `Feeds` 側へ移動する
4. `Unread` へ移動したいが `show_sidebar_unread = false` の場合は、現在アカウント内の feed selection へ移す
5. 明示的な feed selection が作れない場合は、現在アカウントの先頭 feed か既存 safe default にフォールバックする

### 再表示時の挙動

一度非表示にして fallback した項目を、あとから再表示しても自動では戻さない。
表示状態の復元と現在選択中の画面遷移は分離する。

## State Boundaries

selection の canonical source は引き続き `src/stores/ui-store.ts` とする。
今回の変更では selection 型自体は増やさず、`sidebar.tsx` 側で「この selection は今の設定で有効か」を判断して必要時のみ既存 action を呼ぶ。

これにより preference 層は単純な永続状態のまま保ち、fallback の責務を sidebar に閉じ込める。

## Error Handling

この機能は preference の読込失敗時でも、既定値 `"true"` により現状どおり全表示になることを優先する。
新 preference が未保存または未知値でも、`resolvePreferenceValue` の既存フォールバックで安全に `"true"` 扱いへ戻す。

## Testing

追加・更新するテストは既存のテスト層に合わせる。

### Store

`src/__tests__/stores/preferences-store.test.ts`

- 新しい 3 preference が既定値 `"true"` に解決されること
- 無効な永続値が入っても既定値に正規化されること

### Settings Surface

`src/__tests__/components/settings-surface-views.test.tsx` または General settings の既存テスト層

- `Unread / Starred / Tags` の各スイッチが描画されること
- switch 操作が `setPref` に委譲されること

### Sidebar

`src/__tests__/components/sidebar.test.tsx`

- preference OFF で該当 smart view / tags section が描画されないこと
- `アカウント切替` と `Feeds` は常に残ること
- `Tags` は「タグあり」かつ「設定 ON」でのみ表示されること
- 現在表示中項目を OFF にしたとき、`Starred` / `Tag` は `Unread`、`Unread` は `Feeds` 側へ fallback すること
- 再度 ON にしても自動では元の selection に戻らないこと

## Risks

### effect loop

`sidebar.tsx` で設定変更を監視して selection を動かす際、条件が広すぎると再レンダリングごとに `selectSmartView` や `selectFeed` を呼び続ける危険がある。
そのため fallback は「現在の selection が無効になった瞬間」に限定する必要がある。

### hidden but still accessible

「非表示だが機能は残る」挙動は柔軟だが、設定ラベル次第では誤解を生みやすい。
設定画面では「サイドバーに表示する項目」という文脈が分かる配置にする。

### feed fallback ambiguity

`Unread` 非表示時の fallback は feed データの読込タイミングに依存する。
先頭 feed がまだ取れていない瞬間でも破綻しないよう、既存の safe default を最後の逃げ先として維持する。

## Implementation Targets

- `src/stores/preferences-store.ts`
- `src/components/settings/general-settings.tsx`
- `src/components/reader/sidebar.tsx`
- `src/__tests__/stores/preferences-store.test.ts`
- `src/__tests__/components/sidebar.test.tsx`
- General settings 表示テスト
