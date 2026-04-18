# FreshRSS 接続サマリー設計

## 概要

FreshRSS アカウント詳細では、認証状態を資格情報フォーム内の補助テキストではなく、
ページ見出し右のサマリーとして表示する。

通常時は `接続確認済み` と `最終確認` を表示し、
資格情報フォームは編集専用の静かな領域として保つ。
パスワード欄は未編集時に `••••••••` を表示する。

認証状態は永続化し、アプリ再起動後も前回確認結果を表示できるようにする。
今回の判断は既存の `DESIGN.md` で十分に説明できるため設計文書は更新せず、
再利用参照用に Storybook の `UI Reference/View Specimens Canvas` へ
settings header summary specimen を追加する。

## 背景と課題

- 現在の FreshRSS アカウント詳細では、
  サーバー URL、ユーザー名、パスワード、接続テストが同じフォーム内に並んでいる
- パスワード欄が空欄に見えるため、
  未入力なのか保存済みなのかが分かりにくい
- `接続確認済み`、`未確認`、`接続エラー` といった現在状態を
  一目で判別できる場所がない
- `接続テスト` は実行できるが、
  その結果が一時的なトーストに寄っており、
  次に設定画面を開いた時点では現在地が分からない

結果として、ユーザーは以下を区別しづらい。

- すでに使える状態なのか
- 資格情報は保存済みだが再確認が必要なのか
- 接続確認に失敗しており修正が必要なのか

## 目標

- FreshRSS アカウントの現在の信頼状態を、
  設定画面を開いた時点で即座に判断できるようにする
- 資格情報フォームを「状態説明の場」ではなく「編集の場」に戻す
- 認証状態と同期状態を混ぜず、
  それぞれ別の意味として扱う
- `DESIGN.md` に依存したまま、
  今回のパターンを Storybook UI Reference で再参照できるようにする

## 非目標

- sync status と認証 status を統合すること
- FreshRSS 以外の provider へ同時展開すること
- provider ごとに異なる認証表現を導入すること
- 相対時刻表示や履歴一覧を追加すること

## 設計

### 1. 認証状態は見出し右サマリーで扱う

FreshRSS アカウント詳細のページ見出し右に、
認証状態サマリーを表示する補助領域を追加する。

ここでは以下の 3 状態だけを扱う。

- `接続確認済み`
- `未確認`
- `接続エラー`

フォーム内には状態チップや長い注釈を置かず、
ページ見出し右を「このアカウントがいま使えるか」を確認する場所として固定する。

この方針により、設定フォームは既存どおり
左ラベル列と右コントロール列の整った構成を維持できる。

### 2. `接続確認済み` のときは最終確認時刻を出す

`接続確認済み` のときだけ、見出し右サマリーに
`最終確認 YYYY/MM/DD HH:mm` を表示する。

日時は相対表記ではなく絶対日時を採用する。
設定画面では「いつ確認された情報か」を誤解なく伝えることを優先し、
`5分前` のような軽い表現は使わない。

表記は `最終更新` ではなく `最終確認` とする。
同期時刻や記事更新時刻と意味が混ざることを防ぐためである。

### 3. パスワード欄は常に `••••••••` を表示する

未編集時のパスワード欄は、保存済み資格情報が存在する前提で
常に `••••••••` を表示する。

これにより、空欄に見えることによる
「まだ入力していないのでは」という不安を減らす。

パスワード欄の役割は以下に整理する。

- 未編集時: 保存済み資格情報があることを静かに示す
- 編集開始後: 新しい値の入力を受け付ける
- 認証の現在状態: 見出し右サマリーで示す

### 4. 未確認 / 接続エラーのときだけ再確認導線を強める

`未確認` または `接続エラー` のときは、
フォーム下部の `接続を確認` ボタンを通常時より少し強めて見せる。

一方で `接続確認済み` のときは、
同じボタンを存在させてもよいが強調しない。

これにより、
常時すべてのアカウントに行動を促すのではなく、
再確認が必要な状態だけを自然に目立たせられる。

### 5. 認証状態は永続化する

認証サマリーはセッション中の一時 state ではなく、
Account に紐づく永続データとして保持する。

保持対象は以下を想定する。

- `connection_verification_status`
- `connection_verified_at`
- `connection_verification_error`

これにより、設定画面を開いた時点で前回確認結果を表示できる。
再起動や画面再訪問のたびに `未確認` に戻る挙動は採用しない。

## 状態遷移

### 初期状態

既存 account で認証履歴を持たないものは `未確認` とする。

初期 migration では以下で埋める。

- `status = unverified`
- `verified_at = null`
- `verification_error = null`

### FreshRSS アカウント新規作成成功時

既存の `add_account` は FreshRSS 作成時に認証成功を要求しているため、
作成成功時点で以下を保存する。

- `status = verified`
- `verified_at = 現在時刻`
- `verification_error = null`

### 資格情報変更保存時

以下のいずれかが保存変更されたら、
認証状態は `未確認` に戻す。

- server URL
- username
- password

このとき以下もクリアする。

- `verified_at`
- `verification_error`

### 接続確認成功時

`test_account_connection` 成功時は以下を更新する。

- `status = verified`
- `verified_at = 現在時刻`
- `verification_error = null`

### 接続確認失敗時

`test_account_connection` 失敗時は以下を更新する。

- `status = error`
- `verification_error = 失敗メッセージ`

`verified_at` は更新しない。
以前の確認成功時刻を残すと「現在も有効」と誤解されやすいため、
資格情報変更時にクリアし、その後の失敗では再設定しない。

## 実装境界

### フロントエンド

- `SettingsContentLayout` に見出し右補助領域を追加できるようにする
- `AccountDetailView` から認証サマリーを渡せるようにする
- FreshRSS の credentials section は既存レイアウトを保ったまま、
  パスワードの表示ルールと確認ボタンの強弱のみ調整する
- サマリー文言は日本語 UI では以下を使う
  - `接続確認済み`
  - `未確認`
  - `接続エラー`
  - `最終確認`

### Tauri / DTO / 永続化

- `AccountDto` と `src/api/schemas/account.ts` に認証サマリー用フィールドを追加する
- Rust DTO と account repository に同等フィールドを追加する
- DB migration を追加して verification fields を永続化する
- `update_account_credentials` で資格情報変更時に `unverified` へ戻す
- `test_account_connection` で verification fields を更新する

`test_account_connection` の返り値は boolean のままでもよい。
今回必要なのは表示用の永続状態更新であり、
コマンド契約そのものを大きく変えることではない。

## Storybook / UI Reference

今回の判断は `DESIGN.md` の既存ルールで説明可能である。
特に以下の記述が支えになる。

- Settings Forms
- Settings and Review Hierarchy
- Layout Stability

そのため `DESIGN.md` は更新しない。

一方で、今回のような
「設定ページ見出し右に状態サマリーを置く」パターンは
現在の UI Reference には直接存在しない。

参照物として以下を追加する。

- `Settings/Page/AccountDetailView`
  - 認証サマリーありの concrete story
- `UI Reference/View Specimens Canvas`
  - settings header summary specimen
  - `verified / unverified / error` を比較できる小さな見本

`Input Controls Canvas` には追加しない。
今回の主題は入力行そのものではなく、
settings page の header-level state summary だからである。

## 変更対象

### 変更する

- `src/components/settings/settings-content-layout.tsx`
- `src/components/settings/account-detail-view.tsx`
- `src/components/settings/account-detail.types.ts`
- `src/components/settings/use-account-detail-credentials-editor.ts`
- `src/components/settings/use-account-detail-view-props.tsx`
- `src/api/schemas/account.ts`
- `src/api/tauri-commands.ts`
- `src-tauri/src/commands/dto.rs`
- account 永続化まわりの repository / migration
- `src/components/settings/account-detail-view.stories.tsx`
- `src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx`
- `src/components/storybook/ui-reference-canvas-specimens.tsx`

### 変更しない

- `DESIGN.md`
- FreshRSS 以外の provider 向け設定画面
- sync status の既存表現

## テスト

### フロントエンド

- `接続確認済み` のとき見出し右に status chip と `最終確認` が表示される
- `未確認` のとき見出し右に `未確認` が表示される
- `接続エラー` のとき見出し右に `接続エラー` が表示される
- 未編集時のパスワード欄が `••••••••` を表示する
- 資格情報変更保存後に状態が `未確認` へ戻る
- 見出し右サマリー追加後も settings layout の列揃えが崩れない

### バックエンド / データ

- migration 後の既存 account が `unverified` で初期化される
- FreshRSS アカウント作成成功時に `verified` と `verified_at` が保存される
- 資格情報更新時に `unverified` へ戻る
- 接続確認成功時に `verified` と `verified_at` が更新される
- 接続確認失敗時に `error` と失敗情報が保存される

### Storybook / Reference

- `AccountDetailView` の新 story が描画できる
- `UI Reference/View Specimens Canvas` に新 specimen が表示される

## 受け入れ条件

- FreshRSS アカウント詳細を開いた瞬間に、認証状態が一目で分かる
- 接続確認済みのとき、いつ確認された情報かが分かる
- パスワード欄が空欄に見えない
- 資格情報変更後は再確認が必要なことが伝わる
- `DESIGN.md` を増やさず、UI Reference でパターンを再参照できる
