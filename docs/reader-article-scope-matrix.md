# Reader Article Scope Matrix

記事一覧の表示対象は `resolveReaderQuery(selection, viewMode, selectedAccountId)` で `source / scope / filter` に正規化する。`ReaderQuery` は UX 上の表示意図だけを表し、ページング、ソート、API 最適化、表示ラベル、フォーカス制御は別レイヤで扱う。

実装上のデバッグ単位は `ReaderSourcePlan`。`ReaderQuery` に加えて、呼ぶ hook、`mode`、snapshot key、最近見た順を維持するかをまとめた読み取り専用の plan として扱う。

## ReaderQuery

| 項目     | 値         | 意味                                 |
| -------- | ---------- | ------------------------------------ |
| `source` | `articles` | 通常の記事集合                       |
| `source` | `recent`   | 最近見た記事集合。account scope 専用 |
| `scope`  | `account`  | 選択中アカウント全体                 |
| `scope`  | `folder`   | フォルダ配下                         |
| `scope`  | `feed`     | フィード配下                         |
| `scope`  | `tag`      | タグ付き記事                         |
| `filter` | `unread`   | 現在未読の記事                       |
| `filter` | `all`      | 現在の母集合の全件                   |
| `filter` | `starred`  | 現在スター付きの記事                 |

`selectedAccountId === null` の場合は `ReaderQuery | null` の `null` を返し、hook 側は取得を無効化する。全アカウント横断ビューは今回のスコープ外で、将来必要になった場合だけ `{ type: "global" }` を追加する。

## UX Mapping

| 操作                           | ReaderQuery                     | 下部フィルタ           | 備考                                              |
| ------------------------------ | ------------------------------- | ---------------------- | ------------------------------------------------- |
| 未読スマートビュー             | `articles + account + unread`   | 未読のみ               | 全購読の未読。`viewMode` よりスマートビューを優先 |
| スタースマートビュー           | `articles + account + starred`  | 未読 / すべて          | スター記事だけを母集合にする                      |
| 最近見た記事                   | `recent + account + all`        | 未読 / すべて / スター | 最近見た順を維持                                  |
| 最近見た + 未読                | `recent + account + unread`     | 未読 / すべて / スター | 最近見た集合を現在の未読状態で絞る                |
| 最近見た + スター              | `recent + account + starred`    | 未読 / すべて / スター | 最近見た集合を現在のスター状態で絞る              |
| `selection: all`               | `articles + account + viewMode` | 未読 / すべて / スター | 下部フィルタをそのまま使う                        |
| 通常フォルダクリック           | `articles + folder + unread`    | 未読 / すべて / スター | `all` 表示中でも未読へ戻す                        |
| 通常フィードクリック           | `articles + feed + unread`      | 未読 / すべて / スター | `all` 表示中でも未読へ戻す                        |
| 通常タグクリック               | `articles + tag + unread`       | 未読 / すべて / スター | タグにも下部フィルタを適用する                    |
| スター文脈からフォルダクリック | `articles + folder + starred`   | 未読 / すべて / スター | スター絞り込みを維持                              |
| スター文脈からフィードクリック | `articles + feed + starred`     | 未読 / すべて / スター | スター絞り込みを維持                              |
| スター文脈からタグクリック     | `articles + tag + starred`      | 未読 / すべて / スター | スター絞り込みを維持                              |

## API Matrix

| ReaderQuery                              | ReaderSourcePlan                                                       | API / hook                                           | Filter timing | Paging order                            |
| ---------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ------------- | --------------------------------------- |
| `articles + account + unread`            | `sourceKind: account`, `accountMode: unread`                           | `useAccountArticles(accountId, { mode: "unread" })`  | DB 側         | アカウント + 未読適用後                 |
| `articles + account + all`               | `sourceKind: account`, `accountMode: all`                              | `useAccountArticles(accountId, { mode: "all" })`     | DB 側         | アカウント適用後                        |
| `articles + account + starred`           | `sourceKind: account`, `accountMode: starred`                          | `useAccountArticles(accountId, { mode: "starred" })` | DB 側         | アカウント + スター適用後               |
| `articles + folder + unread/all/starred` | `sourceKind: folder`, `folderMode: mode`                               | `useFolderArticles(folderId, { mode })`              | DB 側         | フォルダ + mode 適用後                  |
| `articles + feed + unread/all/starred`   | `sourceKind: feed`, `feedMode: mode`                                   | `useArticles(feedId, { mode })`                      | DB 側         | フィード + mode 適用後                  |
| `articles + tag + unread/all/starred`    | `sourceKind: tag`, `tagMode: mode`                                     | `useArticlesByTag(tagId, accountId, { mode })`       | DB 側         | タグ + account + mode 適用後            |
| `recent + account + unread/all/starred`  | `sourceKind: recent`, `recentMode: mode`, `preservesRecentOrder: true` | `useRecentArticles(accountId, { mode })`             | DB 側         | account + mode 適用後、`viewed_at DESC` |

`ReaderQuery -> API` は 1 対 1 にしない。`use-article-list-sources` は正規化されたクエリを、より少ない取得や DB 側 filter に落とす最適化レイヤとして扱う。

## Source Rules

- データ取得と表示対象決定は `ReaderQuery` を見る。
- hook の選択、snapshot key、mode は `ReaderSourcePlan` を見る。
- UI 表示名、フォーカス、履歴キー、空状態ラベルなど UI 固有の処理は `selection` を見てもよい。
- `recent + unread/starred` は「最近見た時点」ではなく、現在の記事状態で判定する。
- `recent` は常に `viewed_at DESC` を維持し、通常記事側の sort 設定を適用しない。
- タグは `articles` source の scope として扱い、下部フィルタを DB 側で適用する。これはタグ表示が独立表示寄りだった従来挙動からの仕様変更。
- フィード、フォルダ、タグでは、絞り込み前に account articles の先頭 50 件へ切り詰めない。
- フォルダは `sourceKind: folder` として扱う。`accountArticles` に混ぜて後段で folder filter しない。

## Freshness And Stale Content Contract

Reader の freshness 表示は、account、feed、article list で同じ sync result model を使う。表示対象が違っても、同じ状態を別の severity や別ラベルにしない。

| Sync result | Account surface | Feed surface | Article list surface |
| --- | --- | --- | --- |
| All success | 最新として表示する | 最新として表示する | stale warning なし |
| Partial success | 部分的に更新済みとして表示する | 失敗した feed だけ stale として表示する | stale feed が含まれる場合だけ部分更新 warning を表示する |
| All failed | 前回同期時点の内容として表示する | 前回同期時点の内容として表示する | stale content banner を表示する |
| Offline detected | オフラインの可能性として表示する | オフラインの可能性として表示する | stale content banner を表示する |

Freshness indicator contract:

- Account surface は、account 全体の `last successful sync` と stale feed count を表示単位にする。
- Feed surface は、その feed の `last successful feed sync` を表示単位にする。
- Article list surface は、現在の `ReaderQuery` に含まれる feed のうち stale な feed があるかを表示単位にする。
- Partial success は success toast だけで終わらせず、stale feed count を account/feed/article list のいずれでも追える状態にする。
- All failed と offline detected は、古い記事を読める状態でも「現在の内容が最新とは限らない」ことを表示する。
- Manual sync failed は、既存記事を消さずに stale state を維持する。空状態へ置き換えない。

Stale content banner policy:

- Account view: all failed、offline detected、または stale feed count が 1 以上で last successful sync が表示閾値を超えたときに出す。
- Feed view: その feed の sync が失敗中、offline detected、または last successful feed sync が表示閾値を超えたときに出す。
- Article view/list: 現在開いている記事または一覧が stale feed に属する場合に出す。
- Banner dismiss は session-local にする。Account/feed を切り替えたら、別 scope の stale state を隠さない。
- Error toast は一時的な失敗通知、stale content banner は閲覧中データの鮮度表示として分ける。

## Transition Rules

| 経路                                | 通常文脈                                                      | スター文脈                                                     |
| ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| サイドバーのフィード                | `selectFeedFromCurrentContext` が `viewMode: unread` を設定   | `selectFeedFromCurrentContext` が `viewMode: starred` を設定   |
| サイドバーのフォルダ                | `selectFolderFromCurrentContext` が `viewMode: unread` を設定 | `selectFolderFromCurrentContext` が `viewMode: starred` を設定 |
| サイドバーのタグ                    | `selectTagFromCurrentContext` が `viewMode: unread` を設定    | `selectTagFromCurrentContext` が `viewMode: starred` を設定    |
| フィードキーボード遷移              | サイドバー選択処理に従う                                      | サイドバー選択処理に従う                                       |
| コマンドパレットのフィード/タグ     | context-aware action に従う                                   | context-aware action に従う                                    |
| コマンドパレットの記事              | context-aware feed 遷移後に記事を選択                         | context-aware feed 遷移後に記事を選択                          |
| 記事本文/記事リストからの feed 遷移 | context-aware action に従う                                   | context-aware action に従う                                    |

通常のフォルダ/フィード/タグクリックは、新しい購読スコープへ明示移動した操作なので `unread` に戻す。スター文脈から購読ツリーを掘る操作では `starred` を維持する。

`selectFeed` / `selectFolder` / `selectTag` は互換用の通常選択 action として残す。ユーザー操作で現在文脈を引き継ぐ経路は `selectFeedFromCurrentContext` / `selectFolderFromCurrentContext` / `selectTagFromCurrentContext` を正規ルートにする。

## Debugging Checklist

- `resolveReaderQuery` / `ReaderSourcePlan` の結果と実際に呼ばれた hook の `mode` が一致しているか。
- folder/feed/tag/recent は filter 適用後に paging されているか。
- folder が `account` source に偽装されず、`folder` source として取得されているか。
- recent は `viewed_at DESC` を維持しているか。
- starred/unread view で、選択中記事の retained article が画面遷移まで残るか。
- `selectedAccountId === null` で API が呼ばれていないか。
- partial sync success、all failed、offline detected で account/feed/article list の freshness 表示が同じ状態分類を使っているか。
- stale content banner と error toast が別の役割として表示され、古い記事一覧を空状態に置き換えていないか。
- 画面確認は `debug` アカウントで行う。
