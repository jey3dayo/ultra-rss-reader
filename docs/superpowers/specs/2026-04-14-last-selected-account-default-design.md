# Last Selected Account Default Design

## Summary

アプリ全体のアカウント初期選択を、
「常に先頭アカウント」ではなく
「最後に使ったアカウントを優先し、存在しなければ先頭へフォールバック」
へそろえる。

今回の対象は以下の 2 箇所。

- 読書画面のサイドバー初期選択
- 設定モーダルのアカウント詳細初期表示

一覧の見た目順は変えず、
初期選択ルールだけを統一する。

## Current State

- `src/components/reader/use-sidebar-account-selection.ts`
  - `prefs.selected_account_id` を見て復元し、
    無効な場合は `accounts[0]` を選ぶ

- `src/components/settings/settings-modal.tsx`
  - Accounts セクションへ入ったとき、
    `settingsAccountId` が未設定なら常に `accounts[0]` を選ぶ

- `src/components/settings/use-settings-modal-view-props.tsx`
  - 設定画面のアカウント一覧は `accounts` をそのまま描画している

- `src-tauri/src/infra/db/sqlite_account.rs`
  - アカウント一覧取得に `ORDER BY` がなく、
    実質的に保存順に依存している

このため、サイドバーと設定画面で
初期表示ルールが揃っておらず、
設定画面では `Local` が先頭にある限り
毎回 `Local` が開きやすい。

## Goals

- 最後に使ったアカウントを、次回起動時や画面遷移時の初期選択に使う
- サイドバーと設定画面で同じ判定ルールにそろえる
- アカウント一覧の並び順は変更しない
- 新しい永続化キーや DB カラムを追加しない

## Non-Goals

- アカウント一覧の手動並び替え
- お気に入りアカウントの概念追加
- `selected_account_id` を先頭に寄せる一覧並び替え
- Rust 側でアカウント取得順を変更すること

## Design

### 1. 初期選択判定を共通化する

`accounts` と `savedAccountId` から
次に選ぶべきアカウント ID を返す小さな helper を追加する。

判定ルールは以下に固定する。

- アカウントが 0 件なら `null`
- `savedAccountId` が現在の `accounts` に存在すればそれを返す
- それ以外は `accounts[0].id` を返す

責務は「初期値を決める」ことだけに絞り、
UI 状態更新までは持たせない。

### 2. サイドバーは helper を使って既存挙動を維持する

`src/components/reader/use-sidebar-account-selection.ts` の
復元判定を helper 利用へ置き換える。

挙動自体は基本的に変えず、
以下を維持する。

- 有効な `selectedAccountId` があれば何もしない
- `activeDevIntent === "open-web-preview-url"` のときは何もしない
- 復元時は `restoreAccountSelection()` を使う
- 復元結果が保存値と異なるときだけ `selected_account_id` を更新する

### 3. 設定画面も同じ helper を使う

`src/components/settings/settings-modal.tsx` で
Accounts セクションを開いた際の自動選択に
同じ helper を使う。

ルールは以下。

- `settingsCategory === "accounts"`
- `settingsAccountId` が未設定
- `settingsAddAccount` が false

この条件下で helper の結果があればその ID を選ぶ。
結果が `null` なら従来どおり Add Account 画面へ進める。

これにより、
設定画面だけが常に先頭アカウントへ戻る不整合を解消する。

## Data Flow

1. ユーザーがサイドバーでアカウントを切り替える
2. 既存処理が `selected_account_id` を保存する
3. 次回起動または再表示時にアカウント一覧を取得する
4. helper が `savedAccountId` を検証する
5. 有効ならそのアカウントを初期選択する
6. 削除済みなどで無効なら先頭アカウントへフォールバックする

設定画面でも同じ 4-6 の流れを使う。

## Error Handling / Edge Cases

- 保存済みアカウントが削除されていた
  - 先頭アカウントへフォールバックする

- アカウントが 0 件
  - サイドバーは既存どおり未選択状態にする
  - 設定画面は Add Account を開く

- すでに有効な選択中アカウントがある
  - 初期選択ロジックは上書きしない

- 一覧順が変わった
  - 見た目順はそのままなので、
    保存済み ID が無効なときだけ先頭にフォールバックする

## Testing

- helper 単体
  - 保存済み ID が存在する場合はその ID を返す
  - 保存済み ID が無効な場合は先頭 ID を返す
  - アカウント 0 件なら `null` を返す

- 設定モーダル
  - Accounts セクションを開いたとき、
    `selected_account_id` が有効ならそのアカウント詳細を開く
  - 保存値が無効なら先頭アカウントを開く
  - アカウント 0 件なら Add Account を開く

- サイドバー
  - 保存済み ID が有効ならそのアカウントを復元する
  - 保存値が無効なら先頭へフォールバックする
