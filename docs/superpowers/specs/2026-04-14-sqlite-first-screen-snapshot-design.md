# SQLite-First Screen Snapshot Design

## Summary

Ultra RSS Reader の読み取り系 UI を、
「query の一時状態をそのまま描画する」方式から、
「SQLite にある最後の成功状態を先に表示し、裏で再取得して整合が取れたタイミングで差し替える」
方式へ寄せる。

対象はまず以下の 3 画面。

- sidebar
- article list
- settings / accounts

今回の直接の起点は sidebar だが、
設計は他画面へ横展開できる共通基盤を前提にする。

## Current State

- `src/hooks/create-query.ts`
  - `useQuery` の薄いラッパのみで、
    再取得中の表示保持や画面単位の反映制御を持たない

- `src/components/reader/use-sidebar-sources.ts`
  - `feeds`, `folders`, `accountArticles` などの query 結果を
    そのまま sidebar 描画に渡している

- `src/components/reader/use-article-list-sources.ts`
  - `selection` ごとの query 結果をそのまま記事一覧に渡している

- `src/components/settings/*`
  - accounts / preferences / sync status の到着順に依存しやすい

このため、
SQLite に実データが入っていても、
起動直後や dev/HMR・再取得中に `pending` や一時的な `undefined` を
画面が空状態として扱い、
`+ でフィードを追加` のような誤った empty state を出しやすい。

## Goals

- 初期表示は SQLite の既存データを優先して見せる
- 裏で再取得しても、再取得中に既存表示を消さない
- 画面単位で整合が取れたときだけ UI を差し替える
- 真の empty と loading / revalidating を明確に分離する
- sidebar 以外の読み取り画面にも同じ原則を適用できるようにする

## Non-Goals

- Rust 側に新しいキャッシュ層を追加すること
- SQLite とは別の永続キャッシュ DB を持つこと
- すべての query を一度に全面刷新すること
- mutation 系 UI の optimistic update を今回まとめて設計すること

## Approaches Considered

### 1. 画面ごとに React Query の `placeholderData` / 既存値維持を個別実装する

最小変更で始められるが、
画面ごとに判定ロジックが散りやすく、
「何を empty とみなすか」がずれやすい。
今回のような再発防止策としては弱い。

### 2. 画面単位の screen snapshot controller を導入する

各画面が「最後に表示してよい成功状態」を保持し、
query は裏で更新しつつ、
反映は画面ごとの整合条件を満たしたときだけ行う。

SQLite-first / revalidate-later を UI で素直に表現でき、
共通基盤を薄く保ちながら各画面の事情も扱える。

### 3. 全 query を transaction 的な versioned snapshot 基盤へ寄せる

最も強力だが、
現状のアプリ規模に対して重い。
導入コスト・移行コストともに過大。

## Recommended Approach

Approach 2 を採用する。

理由:

- sidebar / article list / settings の「画面単位で整合を見たい」という要求に合う
- SQLite に既にあるデータを最初に見せる、という方針を自然に表現できる
- query ラッパを少し拡張しつつ、反映条件は画面側に残せる
- 将来必要なら 3 に進化できるが、今はそこまで重くない

## Design

### 1. Query と Screen Snapshot を分離する

query は今後も
「SQLite-backed IPC から現在値を取る」
責務のまま残す。

その上に画面単位の snapshot hook を置く。

例:

- `useSidebarSnapshot`
- `useArticleListSnapshot`
- `useSettingsSnapshot`

各 snapshot hook は、
複数 query の生結果から
「今 UI に見せてよい一貫した状態」
を 1 つ作る。

### 2. 共通 hook は薄く保つ

共通化は `useScreenSnapshot` のような薄い hook に留める。
責務は以下のみ。

- 最後に採用した snapshot を保持する
- 新しい候補 snapshot が採用可能か判定して差し替える
- 初回成功前か、再取得中か、更新失敗かを区別する

一方で、
「どの query が主データか」
「どの query が補助データか」
「どの組み合わせで整合が取れたとみなすか」
は各画面 hook に残す。

これにより、
共通基盤を肥大化させずに
画面ごとの差を扱える。

### 3. 表示ルールは SQLite-first / stale-while-revalidate に統一する

すべての対象画面で以下を共通ルールとする。

- 初回成功前
  - loading 表示
  - empty CTA は出さない

- 初回成功後の再取得中
  - 既存 snapshot をそのまま表示
  - 画面ヘッダーや補助ラベルで控えめに「更新中」を示す

- 再取得失敗
  - snapshot を維持
  - toast または status 表示だけ更新

- 真の empty
  - 主データ query が成功し、
    かつ件数 0 と確定した場合のみ表示

### 4. 画面ごとに主データと補助データを分ける

#### Sidebar

主データ:

- `selectedAccountId`
- `feeds`
- `folders`

補助データ:

- `accounts`
- `tags`
- `tagArticleCounts`
- `accountArticles`

sidebar 本体を empty にしてよいのは、
`feeds` と `folders` が成功し、
当該アカウントで本当に 0 件のときだけ。

`tagArticleCounts` や `accountArticles` が遅れても、
購読ツリーは前回 snapshot を維持する。

#### Article List

主データは `selection` に応じて変わる。

- feed 選択: `articles`
- folder / smart / all: `accountArticles`
- tag 選択: `tagArticles`

補助データ:

- `feeds` 名称マップなど

本文リストの主データがまだ成功していないときは
既存 snapshot を維持し、
補助データ未到着だけで画面を空にしない。

#### Settings / Accounts

主データ:

- `accounts`
- `preferences`

補助データ:

- `sync status`

sync status の一時失敗や遅延で
設定画面全体を loading / empty に戻さない。

### 5. 起動・復帰・明示操作を再取得トリガーにする

再取得トリガーは次を前提とする。

- 起動時
- 明示的な手動リロード
- 画面復帰 / visibility change
- スリープ復帰
- 既存の関連イベント (`sync-completed` など)

ただし、
どのトリガーでも表示ルールは同じで、
既存 snapshot を維持したまま裏更新する。

## Data Flow

### 共通

1. 画面が mount する
2. query が SQLite-backed IPC から現在値を取る
3. 画面 hook が初回成功 snapshot を採用する
4. 裏で再取得が始まる
5. 再取得中も既存 snapshot を表示する
6. 主データの整合が取れた新 snapshot が作れたら差し替える
7. 失敗時は既存 snapshot を維持し、補助通知だけ更新する

### Sidebar

1. `selectedAccountId` が確定する
2. `feeds` と `folders` の成功結果をもとに snapshot を採用する
3. 再取得が走っても購読ツリーは既存 snapshot を維持する
4. 新しい `feeds` / `folders` が成功したら、
   smart views / tags / counts を含む snapshot を更新する

### Article List

1. `selection` が決まる
2. 対応する主データ query の成功結果をもとに snapshot を採用する
3. 再取得中も既存記事リストを維持する
4. 新しい主データ成功時に一覧を更新する

## Error Handling / Edge Cases

- query が `pending`
  - `empty` として扱わない
  - 既存 snapshot があれば維持、なければ loading

- 一部 query だけ失敗
  - 主データ失敗であっても既存 snapshot があれば維持
  - 補助データ失敗では本体表示を崩さない

- アカウント切替直後
  - 新アカウント用の初回成功 snapshot ができるまで、
    前アカウント表示を残すか loading を出すかは明示的に決める必要がある
  - 今回は誤認を避けるため、
    アカウント切替時だけは新アカウント向け loading を優先する

- 真の empty と一時空状態の混同
  - `query success && count === 0` のみ true empty
  - `undefined`, `pending`, `error with previous snapshot` は empty ではない

- dev/HMR 中の callback drop
  - IPC の一時失敗や callback 消失が起きても、
    既存 snapshot を捨てないことで空表示を避ける

## Testing

### Unit

- `useScreenSnapshot`
  - 初回成功時に snapshot を採用する
  - 再取得中は以前の snapshot を保持する
  - 再取得失敗でも以前の snapshot を保持する
  - 主データ未成立では新 snapshot を採用しない

### Sidebar

- `feeds/folders` pending 中は empty CTA を出さない
- 既存 snapshot がある状態で再取得しても購読ツリーを維持する
- `feeds/folders` success かつ 0 件のときだけ empty CTA を出す
- `tag counts` や `accountArticles` 失敗で購読ツリーが消えない

### Article List

- 既存記事を表示中に再取得しても一覧が空にならない
- `selection` 切替時は新主データ成功前に前 selection を混ぜない
- 主データ success 0 件時だけ empty state を出す

### Settings / Accounts

- preferences / accounts success 後に snapshot を採用する
- sync status 遅延中でも設定本体は維持する

## Rollout Plan

1. `useScreenSnapshot` の薄い共通 hook を追加
2. sidebar に適用し、empty / loading / revalidating を整理
3. article list に適用
4. settings / accounts に適用
5. 既存の query 利用箇所で `pending === empty` になっている箇所を棚卸しする

## Open Decisions Resolved

- 適用範囲: sidebar 起点で、横展開可能な共通基盤まで
- 反映単位: 画面単位
- 再取得中の見せ方: 既存表示維持 + 控えめな更新中表示
- 更新トリガー: 起動、明示操作、復帰系を含める

