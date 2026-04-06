# Settings Sync Loading Button Design

## Summary

設定モーダル内のアカウント詳細で使っているローディング表現を見直し、
`IndeterminateProgress` による上端バー主体の演出から、
押したボタン自身が小さく回る局所的なローディング表現へ寄せる。

対象は以下の 2 操作。

- 接続テスト
- 今すぐ同期

どちらも `shared` の共通コンポーネントである `LoadingButton` を使い、
`接続中…` / `同期中…` のラベル切り替えとボタン内スピナーを統一する。

一方で、全体同期や自動同期は従来どおりアプリ全体の処理として扱い、
上部の全体ローディング表示やサイドバーの同期アイコンを残す。

## Current State

- `src/components/settings/account-detail.tsx`
  - 接続テスト時に `testingConnection` と `settingsLoading` を両方使っている
  - 手動アカウント同期時に `syncProgress` とは別で `settingsLoading` を立てている

- `src/components/settings/account-credentials-section-view.tsx`
  - 接続テストボタンは通常の `Button` を直接描画している
  - `isTestingConnection` で disabled とラベル切替のみを行っている

- `src/components/settings/account-sync-section-view.tsx`
  - 同期ボタンは通常の `Button` を直接描画している
  - `isSyncing` で disabled とラベル切替のみを行っている

- `src/components/settings/settings-modal-view.tsx`
  - `isLoading` が true のとき、モーダル上端に `IndeterminateProgress` を出す

- `src/components/app-shell.tsx`
  - `appLoading` が true のとき、アプリ最上部に `IndeterminateProgress` を出す

- `src/stores/ui-store.ts`
  - `syncProgress.kind` で `manual_all` / `manual_account` / `automatic` を区別している
  - ただし `applySyncProgress` はどの種別でも `appLoading: true` を立てる

- `src/components/reader/sidebar-header-view.tsx`
  - `isSyncing` が true のとき、サイドバーの同期アイコンを `animate-spin` している

この結果、設定モーダルで手動アカウント同期を行うと、
設定モーダル上端バー、背面の全体バー、同期ボタン文言が同時に変化し、
「押した場所以上に画面全体が騒がしい」状態になっている。

## Goals

- 設定モーダル内の接続テストと手動アカウント同期を、ボタン内スピナー主体の演出に統一する
- `shared` に共通の `LoadingButton` を追加し、今後ほかの非同期操作にも再利用できる形にする
- 手動アカウント同期 (`manual_account`) では、設定モーダル上端バーとアプリ全体バーを出さない
- 手動アカウント同期 (`manual_account`) では、背面サイドバーの同期アイコンも回さない
- 全体同期 (`manual_all`) と自動同期 (`automatic`) は従来どおり全体ローディング表示を維持する
- 既存の文言 (`接続中…`, `同期中…`) と disabled 制御を保つ

## Non-Goals

- 進捗率付きの determinate progress を追加すること
- Rust 側の sync event payload や command contract を変更すること
- `Button` コンポーネント自体に `loading` props を追加すること
- 全ての設定画面ボタンを今回まとめて `LoadingButton` 化すること
- 接続テストや同期以外の設定操作のローディング表現を一括で変更すること

## Design

### 1. `shared/LoadingButton` を追加する

新規に `src/components/shared/loading-button.tsx` を追加し、
既存の `Button` をラップする小さな共通コンポーネントとして実装する。

責務は以下に絞る。

- `loading` が true のとき、ボタン内に小さなスピナーを描画する
- `loadingLabel` があるときは表示ラベルを切り替える
- `disabledWhenLoading` により連打防止を行う
- 既存 `Button` の `variant`, `size`, `className`, `aria-label`, `onClick` をそのまま透過する

このコンポーネントは同期専用にせず、
接続テストのような一般的な非同期操作にも使える名前と API にする。
ただし最初の利用箇所は 2 か所に限定し、過剰な抽象化は避ける。

### 2. 設定モーダル内の 2 つのボタンを `LoadingButton` に置き換える

`src/components/settings/account-credentials-section-view.tsx` の接続テストボタンと、
`src/components/settings/account-sync-section-view.tsx` の同期ボタンを `LoadingButton` 化する。

表示ルールは共通。

- 非ローディング時
  - 既存ラベルを表示する
- ローディング時
  - ボタン左側に小さなスピナーを表示する
  - ラベルを `testingConnectionLabel` / `syncingLabel` に切り替える
  - ボタンを disabled にする

これにより、ユーザーが操作した場所だけが反応して見える。
今回選んだ A 案の「ボタンがぐるぐる」の体験をそのまま実装へ落とし込む。

### 3. 接続テストでは `settingsLoading` を使わない

`src/components/settings/account-detail.tsx` の `handleTestConnection` は
`testingConnection` をローカル state としてすでに持っている。

この処理から `setSettingsLoading(true/false)` を外し、
設定モーダル上端の `IndeterminateProgress` が出ないようにする。

資格情報の保存待ち (`commitCredentials`) や接続テスト本体の非同期時間は、
`testingConnection` を通じて接続テストボタン自身が表現する。

これにより、モーダル全体をロックしたような見え方を避けつつ、
処理中であることは押したボタンで十分に伝えられる。

### 4. 手動アカウント同期では全体ローディングを立てない

`src/stores/ui-store.ts` の `applySyncProgress` を見直し、
`event.kind === "manual_account"` の場合は `appLoading` を true にしない。

整理すると以下のルールになる。

- `manual_account`
  - `syncProgress.active` は true にする
  - `syncProgress.activeAccountIds` も従来どおり更新する
  - ただし `appLoading` は false のままにする
- `manual_all` / `automatic`
  - 従来どおり `appLoading` を true にする

これにより、設定モーダルで特定アカウントだけを同期したときは、
アプリ全体の上部ローディングバーを抑制できる。

### 5. サイドバーの同期アイコンは全体同期だけで回す

`src/components/reader/sidebar.tsx` では、
`SidebarHeaderView` に渡す `isSyncing` を `syncProgress.active` そのままではなく、
全体同期系だけを対象にした条件へ変更する。

想定条件:

- `syncProgress.active && syncProgress.kind !== "manual_account"`

これにより、設定モーダルの裏でサイドバーの同期アイコンが回る状態を防ぐ。
一方で、サイドバーからの全体同期や自動同期では従来どおりアイコンが回る。

### 6. 設定モーダル上端バーは「設定面全体を待たせる処理」にだけ残す

`src/components/settings/settings-modal-view.tsx` 自体の構造は変えず、
`isLoading` が true のときに上端バーを出す現在の仕様は維持する。

今回の変更点は、接続テストと手動アカウント同期が
その `isLoading` を立てなくなることにある。

これにより次の整理になる。

- 接続テスト
  - 上端バーなし
  - ボタンだけローディング
- 手動アカウント同期
  - 上端バーなし
  - ボタンだけローディング
- データ設定など、モーダル全体の待機が自然な処理
  - 上端バーあり

## Data Flow

### Test Connection

1. user が接続テストボタンを押す
2. `handleTestConnection()` が `testingConnection = true` をセットする
3. 必要なら `commitCredentials()` を待つ
4. `testAccountConnection(account.id)` を呼ぶ
5. ボタンは `LoadingButton` によりスピナー + `接続中…` を表示する
6. 処理完了後、toast を出して `testingConnection = false` に戻す

### Manual Account Sync

1. user が今すぐ同期ボタンを押す
2. `handleSyncNow()` が `syncAccount(account.id)` を呼ぶ
3. Rust 側から `sync-progress` が `kind = "manual_account"` で飛ぶ
4. `ui-store.applySyncProgress()` が `syncProgress` は更新するが `appLoading` は立てない
5. `AccountDetail` は `syncProgress.activeAccountIds` を見て対象アカウントの `isSyncing` を true にする
6. 同期ボタンは `LoadingButton` によりスピナー + `同期中…` を表示する
7. `sync-completed` または `finished` で同期 state をクリアする
8. toast と query invalidation は従来どおり行う

### Manual All / Automatic Sync

1. user がサイドバーから全体同期する、または自動同期が走る
2. `sync-progress` が `kind = "manual_all"` または `automatic` で飛ぶ
3. `ui-store.applySyncProgress()` が `appLoading = true` にする
4. `AppShell` 上部の `IndeterminateProgress` と `SidebarHeaderView` の回転アイコンが表示される
5. `finished` で従来どおり解除する

## Error Handling / Edge Cases

- 接続テスト前に資格情報保存が必要
  - 既存どおり `commitCredentials()` を先に待つ
  - その待機時間も接続テストボタンの loading で表現する

- 接続テストが失敗した
  - toast を出し、`testingConnection` を false に戻す
  - 全体バーは出ない

- 手動アカウント同期が失敗した
  - 既存どおり toast を出す
  - `sync-completed` / `finished` 後にボタンの loading は解除される

- 全体同期中に設定モーダルを開いた
  - `manual_all` / `automatic` は従来どおり全体ローディングを表示してよい

- 手動アカウント同期中に別アカウントへ切り替えた
  - `syncProgress.activeAccountIds` に基づいて対象アカウントだけ loading 表示される
  - 切替後の表示アカウントが対象外なら同期ボタンは通常状態でよい

- `LoadingButton` を将来ほかの画面で使う
  - 汎用コンポーネントとして成立するが、今回は spinner のサイズやレイアウトは最小限に保つ

## Testing

### Unit / Component Tests

- `src/__tests__/components/account-sync-section-view.test.tsx`
  - `isSyncing = true` のとき、同期ボタンに `同期中…` が表示される
  - スピナーが描画される
  - ボタンが disabled になる

- `src/__tests__/components/account-detail.test.tsx`
  - `manual_account` の sync progress で `syncSection.isSyncing` が true になる
  - 接続テスト時、資格情報保存完了前に接続確認が走らないことを維持する
  - 必要なら `settingsLoading` を使わなくても接続テストが成立することを補強する

- `src/__tests__/components/sidebar.test.tsx`
  - `manual_account` の sync progress ではサイドバーの同期アイコンが回らない
  - `manual_all` の sync progress では従来どおり回る
  - `appLoading` も `manual_account` と `manual_all` で分けて確認する

- `src/__tests__/components/settings-modal-view.test.tsx`
  - `isLoading` を true にしたとき上端バーが描画される既存仕様は維持する
  - 必要なら周辺テストで、接続テスト / 手動アカウント同期が `isLoading` を立てないことを確認する

### Manual Verification

- 設定モーダルで接続テストを押すと、そのボタンだけが小さく回る
- 設定モーダルで今すぐ同期を押すと、そのボタンだけが小さく回る
- 接続テスト中にモーダル上端バーが出ない
- 手動アカウント同期中にモーダル上端バーが出ない
- 手動アカウント同期中に背面のアプリ上端バーが出ない
- 手動アカウント同期中に背面サイドバーの同期アイコンが回らない
- 全体同期では従来どおりアプリ上端バーとサイドバー同期アイコンが動く

## Scope

### 変更対象

- `src/components/shared/loading-button.tsx`
  - 新規追加

- `src/components/settings/account-credentials-section-view.tsx`
  - 接続テストボタンを `LoadingButton` に置き換える

- `src/components/settings/account-sync-section-view.tsx`
  - 同期ボタンを `LoadingButton` に置き換える

- `src/components/settings/account-detail.tsx`
  - 接続テスト / 手動アカウント同期の loading 制御を整理する

- `src/stores/ui-store.ts`
  - `manual_account` では `appLoading` を立てないようにする

- `src/components/reader/sidebar.tsx`
  - サイドバー同期アイコンの回転条件を見直す

- テスト
  - account sync / account detail / sidebar / settings modal 周辺

### 変更しないもの

- Rust backend の sync command / event schema
- `SettingsModalView` の基本レイアウト
- `Button` の既存 API
- 全体同期 (`manual_all`) と自動同期 (`automatic`) の見せ方
