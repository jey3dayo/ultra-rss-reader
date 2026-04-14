# Mute Keyword Settings Design

## Summary

RSS 記事をキーワード単位で非表示にする `ミュート` 機能を追加する。
初版は `Settings` モーダル内に `Mute` タブを新設し、
各ルールを `キーワード + 適用対象（タイトル / 本文 / タイトルと本文）` で管理する。

保存したミュートルールは通常一覧と検索結果に即時反映する。
一方で、`ミュート時に自動既読` は将来拡張として UI だけ先に置き、
初版では `工事中` として無効化する。

見た目は X の専用管理画面に寄せすぎず、
既存の `SettingsPageView` / `Labeled*Row` ベースのフォーム構成に合わせる。
これにより、設定画面全体のトーンを崩さずに機能を追加する。

## Current State

- 記事取得は Tauri command 経由で `list_articles` / `list_account_articles` / `search_articles` が担っている
- 設定画面は `src/components/settings/settings-page-view.tsx` を共通骨格に持ち、
  左ラベル・右コントロールの行レイアウトで統一されている
- 設定値の永続化は `preferences` と account 設定が中心で、
  ミュートルールのような繰り返し構造を持つ保存先はまだ存在しない
- 未読数やバッジは article / feed 集計に基づいており、
  UI 非表示ロジックとはまだ分離されていない

## Goals

- `Settings` 内に自然に馴染む `Mute` 設定画面を追加する
- ミュートルールを保存・削除できるようにする
- 保存後すぐに通常一覧と検索結果から該当記事を除外する
- 全アカウント共通のルールとして扱う
- `ミュート時に自動既読` は将来枠として UI に位置だけ確保する

## Non-Goals

- 初版で自動既読を実装すること
- 初版で未読数、サイドバー件数、バッジ件数を再計算すること
- account 単位のミュートスコープを追加すること
- 完全一致、正規表現、期間指定など高度なルールを追加すること
- `編集` アクションを付けること

## UX Decisions

### 1. ルールモデル

各ミュートルールは以下の 2 値だけを持つ。

- `keyword`
- `scope`
  - `title`
  - `body`
  - `title_and_body`

一致方式は初版では `部分一致のみ` に固定する。
完全一致や複雑な matcher は導入しない。

### 2. 画面構成

`Settings` に `Mute` タブを追加し、画面の並びは次の順番にする。

1. `新規追加`
2. `機能設定`
3. `保存済みキーワード一覧`

`ミュート時に自動既読` は `機能設定` セクションに固定で置く。
保存済みキーワード一覧の後ろに置かない。
これにより、ルール件数が増えても「機能全体の設定」が遠くならない。

### 3. フォームの見た目

UI は既存 settings の文法に合わせる。

- `SettingsPageView` のセクション構造を使う
- 1 行ごとに `左ラベル / 右コントロール` を維持する
- 入力欄、select、disabled control は既存 `LabeledInputRow` / `LabeledSelectRow` / `LabeledSwitchRow` と同じ密度に寄せる
- 保存済みルール一覧も「管理テーブル」ではなく設定行の延長として見せる

これにより、ミュート機能だけが別プロダクトの UI に見える状態を避ける。

### 4. 保存済みルールの操作

保存済みルールの各行は次だけを持つ。

- キーワード
- 適用対象の小さな表示
- `削除`

`編集` は初版では持たない。
理由は、1 ルールの情報量が少なく、
「削除して再追加」で十分に扱える一方で、
毎行に `編集 / 削除` を並べると設定画面より管理画面に見えやすいため。

### 5. 自動既読の見せ方

`ミュート時に自動既読` は次の見せ方にする。

- 設定行として表示する
- disabled にする
- `工事中` の控えめな補助表示を付ける
- 初版では保存もしない

派手な警告色や大きな notice ではなく、
既存 settings の disabled 行として自然に見せる。

## Data Model

新規にミュートルール専用の永続化層を追加する。
初版は `preferences` の JSON 逃がしではなく、
専用テーブルで管理する。

想定カラム:

- `id`
- `keyword`
- `scope`
- `created_at`
- `updated_at`

補足:

- グローバル設定なので `account_id` は持たない
- `scope` は文字列 enum で十分
- `keyword` は空文字禁止、前後 trim を行う
- 同一 `keyword + scope` の重複は保存時に防ぐ

## Architecture

### 1. Persistence

Rust 側にミュートルール repository を追加する。
責務は以下。

- list
- create
- delete
- duplicate check

将来 `update` を足せる形にはしてよいが、
今回の command surface には expose しない。

### 2. Tauri Commands

TypeScript から使う command と schema を追加する。

- `list_mute_keywords`
- `create_mute_keyword`
- `delete_mute_keyword`

これらは `safeInvoke` と Zod schema を通す既存パターンに合わせる。

### 3. UI Layer

React 側では `Settings` 配下に `MuteSettings` を追加する。

責務は分ける。

- container
  - query / mutation を扱う
- view
  - settings row と section の組み立てを行う

インラインで小コンポーネントを作らず、
既存 settings と同じく view props を返す形へ寄せる。
これは `vercel-react-best-practices` の
`rerender-no-inline-components` にも沿う。

### 4. Filtering Point

ミュート判定は UI で後処理せず、
記事取得時点で Tauri / SQLite 側に寄せる。

対象は以下。

- `list_articles`
- `list_account_articles`
- `search_articles`

理由:

- 一覧と検索の挙動を一致させやすい
- 将来のページングや件数制御を壊しにくい
- 後から `自動既読` を追加するときも責務がぶれない

## Filtering Rules

### 1. 通常一覧

対象 article の `title` / `content_sanitized` に対し、
保存済みルールを部分一致で評価し、
一致した article は結果セットから除外する。

### 2. 検索結果

検索結果にも同じミュート判定を適用する。
初版で「検索だけ見える」挙動にはしない。

### 3. 未読数

未読数、サイドバー件数、バッジ件数は初版では変更しない。
つまり「見えないが件数には残る」状態を許容する。

この設計は不完全だが、
自動既読を導入するタイミングで件数再設計をまとめて行うほうが整合がよい。

## Data Flow

### Create Rule

1. user がキーワードと適用対象を入力する
2. create mutation が Tauri command を呼ぶ
3. Rust 側で trim / validation / duplicate check を行う
4. 保存成功後、ミュートルール query を再取得する
5. article 関連 query を invalidate して一覧と検索を更新する

### Delete Rule

1. user が保存済み行の `削除` を押す
2. delete mutation が対象 rule を削除する
3. ルール一覧と article 関連 query を再取得する

### Read Articles

1. React が article list / account article / search を要求する
2. Tauri command が repository からミュートルール一覧を読む
3. SQLite article query にミュート除外条件を適用する
4. ミュート済み article を除いた結果だけを TypeScript に返す

## Error Handling / Edge Cases

- 空文字、空白のみ
  - 保存を拒否する
- 同一 `keyword + scope` の重複
  - 保存を拒否し、toast などで伝える
- `keyword` の前後空白
  - trim してから評価する
- 本文が `NULL` の article
  - title / body 判定で安全に扱う
- ルールが大量に増えた場合
  - 初版では件数上限は設けないが、一覧 UI は単純な縦積みで耐える範囲に留める
- 自動既読トグル
  - disabled 表示のみ
  - 値は保存しない

## Testing

### Rust

- ミュートルール repository の CRUD
- duplicate check
- `list_articles` が title scope で除外される
- `list_articles` が body scope で除外される
- `list_account_articles` が除外される
- `search_articles` が除外される
- ルール未登録時は従来結果を維持する

### TypeScript / React

- `Mute` タブが settings navigation に表示される
- 新規追加フォームが既存 settings row と同じ構造で描画される
- 保存済みルール行に `削除` のみが出る
- `自動既読` 行が disabled + 工事中で描画される
- ルール追加 / 削除後に article query invalidation が走る

## Open Follow-Up

次フェーズでまとめて検討する。

- `ミュート時に自動既読` の実装
- 未読数 / バッジ件数との整合
- account 単位ミュート
- ルール編集
