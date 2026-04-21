# Account Setup Lock Design

## Summary

アカウント登録直後に初回同期が終わる前でも通常画面へ戻れてしまい、
ユーザーが「もう使える」と誤解しやすい。

この問題に対して、アカウント登録成功後は既存の設定モーダルを
`セットアップ専用モード` に切り替え、
その新規アカウントの初回同期が成功するまで
閉じる・移動する・切り替える操作を止める。

成功時は設定モーダルを自動で閉じ、
新規アカウントの `未読` へ着地させる。
失敗時は閉じずにその場へ留め、
`再試行` と `認証情報を修正` だけを許可する。

## Current State

- `src/components/settings/account-config-form.tsx`
  - `addAccount()` 成功後に `selectAccount(account.id)` と `setSettingsAccountId(account.id)` を呼ぶ
  - 追加直後に新規アカウント詳細へは遷移するが、初回同期は開始しない

- `src/App.tsx`
  - 起動時に `triggerStartupSync(selectedAccountId)` を走らせる
  - これはアプリ全体の起動時同期であり、アカウント登録直後専用の完了ゲートではない

- `src/components/settings/settings-modal-view.tsx`
  - close button と nav rail、accounts rail を常に操作可能な前提で描画している

- `src/components/settings/use-settings-modal-view-props.tsx`
  - 設定カテゴリ選択とアカウント選択の操作は無条件で有効になっている

- `src/components/settings/use-account-detail-sync-controls.ts`
  - 既存の `今すぐ同期` は `syncAccount(account.id)` を手動実行できる
  - ただし「登録直後の初回セットアップ専用同期」としては扱っていない

- `src/stores/ui-store.ts`
  - `settingsOpen`, `settingsCategory`, `settingsAccountId`, `settingsAddAccount`, `syncProgress` は持っている
  - どのアカウントが `登録直後のセットアップ中` なのかを表す専用状態はない

- `src/components/reader/sidebar-content-sections.tsx`
  - `selectedAccountId` があると通常の feed tree empty state に進む
  - 初回同期中であることを理由に reader/navigation を止める仕組みはない

この結果、登録直後の同期が終わっていないのに
サイドバー空状態や通常の empty state が見え、
「データがない」だけなのか「準備中」なのかが分かりづらい。

## Goals

- アカウント登録成功直後は、初回同期が終わるまでユーザーをセットアップフローから逃がさない
- 別ダイアログを増やさず、既存の設定モーダル内でセットアップ状態を明示する
- セットアップ中は `閉じる` `設定カテゴリ移動` `別アカウント選択` `アカウント追加` を無効化する
- 初回同期成功時は設定モーダルを自動で閉じ、新規アカウントの `未読` へ遷移させる
- 初回同期失敗時は、その場で `再試行` と `認証情報を修正` だけを許可する
- 成功・失敗・進行中の状態を UI とテストで明確に扱えるようにする

## Non-Goals

- アプリ起動時の一般的な startup sync の設計を置き換えること
- 既存の background sync / automatic sync のルールを再設計すること
- 初回同期の内部アルゴリズムや backend progress event format を大きく作り変えること
- 設定モーダル以外の onboarding flow や welcome screen を新設すること
- 同期結果が空購読であるケースを失敗扱いに変えること

## Recommended Approach

`設定モーダルをセットアップ専用モードへ切り替える方式` を採用する。

理由:

- 既存の account detail 画面をそのまま使えるため、文脈が切れない
- 登録したアカウントを今セットアップしていることが視覚的に一貫する
- モーダルの上にさらに blocking dialog を重ねるより軽く、見通しが良い
- 失敗時も同じ画面で `再試行` と `認証情報修正` を提供できる
- 実装責務を `settings modal + account detail + ui store` に閉じやすい

## Design

### 1. 登録成功直後にセットアップ専用モードを開始する

`src/components/settings/account-config-form.tsx` で `addAccount()` 成功後、
現在の `selectAccount(account.id)` と `setSettingsAccountId(account.id)` に加えて、
新規アカウント ID をキーにした `account setup session` を開始する。

この session は少なくとも次の情報を持つ:

- `accountId`
- `state`: `syncing | failed | succeeded`
- `errorMessage` もしくは UI 表示に必要な failure summary

session 開始と同時に、その新規アカウント向けの初回同期を
明示的に起動する。
起動元は account config form 側でも account detail controller 側でもよいが、
「登録直後の初回同期」であることが UI から追跡できる位置に寄せる。

### 2. UI Store にセットアップ状態を追加する

`src/stores/ui-store.ts` に、
登録直後のアカウントセットアップを表す state を追加する。

想定:

- `accountSetupSession: { accountId: string; state: "syncing" | "failed" | "succeeded"; errorMessage?: string } | null`
- `startAccountSetup(accountId)`
- `markAccountSetupFailed(accountId, errorMessage?)`
- `markAccountSetupSucceeded(accountId)`
- `clearAccountSetup()`

この state は `syncProgress` の代替ではなく、
`登録直後の初回セットアップゲート` を表す補助 state とする。

理由:

- 既存の `syncProgress` は全体同期や通常の手動同期も表すため、意味が広い
- 今回は「どの account が setup gate の対象か」が必要
- settings modal / account detail / reader 側が同じ状態を参照しやすくなる

### 3. 設定モーダルをセットアップ専用モードへ切り替える

`src/components/settings/settings-modal.tsx`
`src/components/settings/use-settings-modal-view-props.tsx`
`src/components/settings/settings-modal-view.tsx`
に setup-aware な props を追加する。

モーダルが setup session 対象アカウントを表示中で、
その state が `syncing` または `failed` の間は、
通常の設定ブラウズではなく `セットアップ専用モード` として扱う。

セットアップ専用モードで行うこと:

- close button を無効化する
- settings category nav を無効化する
- accounts nav の別アカウント選択と `アカウントを追加...` を無効化する
- `onOpenChange(false)` からの close も無視する
- 画面上部に `初回セットアップ中` または失敗文言を固定表示する

無効化は silent ではなく、
画面内の補助文として
`同期が終わるまでこの画面は閉じられません`
を常時見せる。

### 4. Account Detail を setup 状態に応じて描き分ける

`src/components/settings/use-account-detail-view-props.tsx`
`src/components/settings/account-detail-view.tsx`
`src/components/settings/account-detail.types.ts`
`src/components/settings/account-sync-section-view.tsx`
を拡張し、
setup mode のメッセージ、進行表示、失敗時アクションを描けるようにする。

`syncing` 時:

- heading: `初回セットアップ中`
- description: `未読一覧を使える状態にするため、最初の同期を完了しています。同期が終わるまでこの画面は閉じられません。`
- `今すぐ同期` は通常ボタンではなく、進行中表示へ置き換える
- 可能なら `接続確認` `購読一覧の取得` `記事の取得` のような段階ラベルを出す
- 段階ラベルが難しい場合でも `同期中…` と blocking reason は必須

`failed` 時:

- heading: `セットアップを完了できませんでした`
- description: `認証情報またはサーバー状態を確認してください`
- primary action: `再試行`
- secondary action: `認証情報を修正`
- close / nav lock は維持する

`succeeded` 時:

- setup 専用表示は即座に teardown 対象になる
- 成功 UI を長く留めず、自動 close + unread 遷移へ進む

### 5. 初回同期成功時は自動で閉じて未読へ遷移する

新規アカウントの初回同期が成功したら、

1. `markAccountSetupSucceeded(account.id)`
2. `selectAccount(account.id)` を維持
3. `selectSmartView("unread")`
4. `closeSettings()`
5. `showToast("セットアップが完了しました")`

の順で reader 側へ戻す。

戻り先はユーザー承認どおり `未読` に固定する。
これにより「使える状態になったので、すぐ読む」という着地が明確になる。

### 6. 成功条件と失敗条件を明確に固定する

初回セットアップ判定は、
`この登録フローから起動した初回同期リクエストの結果`
だけで判定する。

扱い:

- success:
  - 初回同期リクエストが成功で返る
  - フィード 0 件でも success 扱いにする

- failed:
  - 初回同期リクエストが error を返す
  - retry pending や warning を success に丸めず、失敗寄りに扱う

- syncing:
  - request 発火から success / failure 確定まで

これにより「空なのか未完了なのか」を UI で混同しない。

### 7. Reader 側は setup session を直接開始しない

今回の入口は account registration 成功時に限定する。

そのため、reader/sidebar 側は
「setup 中かもしれないので勝手に通常 empty state を出さない」補助対応はあり得るが、
setup session の開始・終了の主責務は持たせない。

主責務は次へ閉じる:

- account registration success
- settings modal lock
- account detail setup state
- auto close and unread landing

これにより startup sync と account setup sync の責務が混ざりにくくなる。

## UX Notes

- 別ダイアログを重ねて閉じ込めるより、
  現在いる画面を setup mode に切り替える方が自然
- ただ無効化するだけだと「押せない」理由が分からないため、
  blocking reason を常時表示する
- success 後に設定画面へ留めず自動で未読へ返すことで、
  セットアップ完了の達成感と利用開始地点を一致させる
- failure 時は永久ロックに見えないように、
  `再試行` と `認証情報を修正` のみを明示的に残す
- blank state を見せる前に「まだ準備中」を必ず伝えることを優先する

## Data Flow

1. ユーザーが Add Account Form で認証情報を送信する
2. `addAccount()` 成功後、新規 account を選択し settings account detail を表示する
3. 同時に `startAccountSetup(account.id)` を発火する
4. 初回同期を明示的に起動する
5. settings modal と account detail が setup session を参照して lock UI を表示する
6. 同期成功時:
   - `markAccountSetupSucceeded(account.id)`
   - `selectSmartView("unread")`
   - `closeSettings()`
   - 完了トースト表示
   - `clearAccountSetup()`
7. 同期失敗時:
   - `markAccountSetupFailed(account.id, message?)`
   - setup mode のまま失敗 UI を表示する
   - `再試行` または `認証情報を修正` を待つ

## Error Handling / Edge Cases

- 認証情報が間違っていて初回同期が失敗する
  - setup mode のまま `認証情報を修正` を表示する

- サーバー一時障害で失敗する
  - setup mode のまま `再試行` を表示する

- フィードが 0 件の正常アカウント
  - success 扱いにして lock を解除する
  - その後 reader 側の `no-feeds` empty state へ進むのは許可する

- 同期 progress event が粗く、段階ラベルが出せない
  - `同期中…` と blocking reason を最低ラインとして出す

- setup 中に modal close や category change が試みられる
  - action は無視し、画面内メッセージだけで理由を伝える

- アプリ再描画や query refresh が起きる
  - UI store に setup session を持つことで lock 状態を維持する

## Testing Strategy

### 1. Registration Flow Tests

対象候補:

- `src/__tests__/components/add-account-form.test.tsx`
- `src/__tests__/components/settings-modal.test.tsx`

確認:

- 登録成功後に setup session が開始する
- 登録成功直後に新規アカウント detail が setup mode で表示される

### 2. Settings Lock Tests

対象候補:

- `src/__tests__/components/settings-modal-view.test.tsx`
- `src/__tests__/components/use-settings-modal-view-props.test.tsx`

確認:

- setup 中は close button が無効化される
- setup 中は category nav が切り替わらない
- setup 中は accounts nav の account select / add account が無効化される

### 3. Account Detail Setup Tests

対象候補:

- `src/__tests__/components/account-detail-view.test.tsx`
- `src/__tests__/components/account-detail.test.tsx`

確認:

- `syncing` で setup heading / description / loading state が出る
- `failed` で `再試行` と `認証情報を修正` が出る
- 通常の `sync now` UI が setup mode 中は置き換わる

### 4. Completion Flow Tests

対象候補:

- `src/__tests__/components/account-detail.test.tsx`
- `src/__tests__/app-root.test.tsx` ではなく setup 専用テストを追加する

確認:

- 初回同期 success で `closeSettings()` と `selectSmartView("unread")` が呼ばれる
- 完了トーストが出る
- setup session が clear される

### 5. Failure Flow Tests

対象候補:

- `src/__tests__/components/account-detail.test.tsx`

確認:

- 初回同期 failure で setup mode が維持される
- `再試行` が再度同期を発火する
- `認証情報を修正` が credentials editing 導線を残す
