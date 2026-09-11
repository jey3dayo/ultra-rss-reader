---
type: reference
title: React Doctor 未 triage warning の分類（exhaustive-deps / no-adjust-state-on-prop-change）
description: Issue #249 の未 triage 53 件のうち、exhaustive-deps 18 件と no-adjust-state-on-prop-change 16 件の証拠と判定を記録する。
resource: urn:ultra-rss-reader:docs:react-doctor-warning-classification-249
tags: [category/quality, audience/developer, tool/react-doctor]
timestamp: 2026-09-10
audience: developer
owner: project-maintainers
---

# React Doctor 未 triage warning の分類（第 1 波）

Issue #249 の未 triage 53 件のうち 34 件を扱う。残り 19 件（`no-pass-data-to-parent` 7 /
`no-pass-live-state-to-parent` 5 / 他 7）は第 2 波。

走査は `mise run quality:react-doctor:full` と同一条件、`projects[]` がリポジトリ root のみで
あることを確認済み（`quality-policy.md`「React Doctor Scan Scope」の前提）。

判定の初稿は独立レビューで 3 件棄却された。棄却された内容とその証拠も本文に残す。理由は
[判定を誤った経緯](#判定を誤った経緯)に書く。

## exhaustive-deps 18 件は 1 つのルールだが 3 種類の指摘

メッセージを読むまで「依存を足せば済む 18 件」に見えるが、そうではない。

| メッセージ | 件数 |
| --- | --- |
| 「stale な X で実行されうる」= 依存が本当に無い | 1 |
| 「X は毎 render 作り直されるので毎回走る」= 名前は**既に依存配列にある**、identity churn の指摘 | 14 |
| 「`useCallback` の callback が別所定義で依存を検査できない」 | 3 |

中央の 14 件に「足すべき依存」は存在しない。件数を減らす作業として一括りにできない。
14 件が名指しする識別子（`feeds` / `tags` / `folders` / `feedList` / `folderList` /
`isClosedEventCurrent`）は全件、当該依存配列に既にある。

### A. `x ?? []` による identity churn（13 件）— must-fix 1 件 + accepted-risk 12 件

対象：`use-command-palette-data.ts:163,176,177,193,197,201,297` /
`use-sidebar-feed-section-controller.ts:61,62` / `use-sidebar-feed-tree.ts:30,34,41` /
`use-sidebar-sources.ts:69`

すべて同じ 1 行の書き方に帰着する。

```ts
const feeds = feedsQuery.data ?? [];
```

`data` が定義済みの間は TanStack Query のキャッシュ参照がそのまま渡り、下流の `useMemo` は正しく
memo として働く。`data` が `undefined` の間だけ `?? []` が毎 render 新しい空配列を作る。

#### `data === undefined` は「データ到着前の短い窓」ではない

2 つの経路で恒久化する。

- `src/hooks/create-query.ts:132` の `enabled: queryId !== null` — account 未選択の間、
  クエリは走らず `data` は undefined のまま。
- fetch が失敗した場合も `data` は undefined のまま残る。

#### must-fix: `use-sidebar-feed-section-controller.ts:62` の 1 件だけ

`feedList` / `folderList`（同ファイル 58, 59 行の `?? []`）はどちらも `:152,153` から
`useSidebarStartupFolderExpansion` へ直接渡るが、**届く先の effect が違う**。

- `folderList` は**永続化 effect**（`use-sidebar-startup-folder-expansion.ts:392-410`）の依存。
  この effect の early return は `!selectedAccountId` と `restore_previous` と skip token だけで、
  `foldersReady` を見ない。→ **`:62` は must-fix**
- `feedList` は**起動時 effect**（同 :352 付近）の依存で、こちらは `:327` の
  `if (!feedsReady || !foldersReady) return;` で早期 return する。`feedsReady = feeds !== undefined`
  なので、**`feedList` が churn する条件はその effect が即 return する条件と同じ**。書き込みは起きない。
  → **`:61` は accepted-risk**

初稿は 2 件とも must-fix としていた。「両方とも expansion hook へ渡る」ところで止め、どちらが
どの effect に届くかを見ていなかった。independent review（PR #296 の Codex 指摘）で訂正した。

永続化 effect が呼ぶ `setStoredSidebarExpandedFolders` は
`setStoredSidebarExpandedFolders(...)` を呼び、この関数は

- localStorage を read し
- prune し
- valibot `parse` を通し
- `tryWriteSidebarExpandedFoldersStorage` で**無条件に write する**

内容比較はどこにも無い。early return の条件は `!selectedAccountId` と
`startupFolderExpansion === "restore_previous"` と skip token の 3 つだけで、
`startup_folder_expansion` の既定値は `all_collapsed`（`src/schemas/preference-values.ts:222`）
なので既定設定では素通りする。

したがって **account 選択済み × folders クエリがエラー**の状態では、毎 render
localStorage の read + parse + write が走り続ける。これは shape ではなく実コストである。

#### accepted-risk: 残り 12 件

同じ idiom だが、下流が memo と描画に留まり、無条件の副作用に到達しない。

**`use-command-palette-data.ts:297` を当初 must-fix 候補と考えたが、書き込み経路については
否定した。** その memo が作る `historyProjection` は localStorage 書き込み effect の依存だが、
`writeNormalizedHistoryAfterResourceProjection`（`src/lib/command-palette/command-history-storage.ts:159`）
は書き込み前に前後の内容を比較して早期 return する。ただし同じ memo は毎回 `getHistory()` を
呼ぶので、**read + `JSON.parse` + valibot `safeParse` は毎 render 走る**（書き込みだけが止まる）。

#### remedy

初稿は「module scope の凍結済み空配列定数を共有し `?? EMPTY` にすれば 13 件すべて消える」と
書いた。**この設計は採れない。** 独立レビューが 2 点を一次情報で示した。

**1. query object の identity は安定でない。** `@tanstack/react-query` 5.102.8 の
`useBaseQuery.ts:139-142` は既定で `observer.trackResult(result)` を返し、
`query-core/queryObserver.ts:258-268` が**毎回 `new Proxy` を生成**する。このアプリは
`notifyOnChangeProps` を上書きしていない。`useRecentArticles` はさらに
`use-articles.ts:286` で毎 render `{ ...queryResult, data }` を作る。
`use-command-palette-data.ts:301-311` の依存には query object 自体が入っているので、
`?? []` を潰しても履歴 memo は `data` が定義済みでも毎 render 再評価される。
（公式: <https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations#referential-identity>）

**2. 素朴な `?? EMPTY` 置換は #295 を再導入する。** `undefined` を `[]` に潰すと、
`data !== undefined` で「取得できたか」を判定している箇所が壊れる。まさにその判定の誤りが
コマンドパレット履歴の全消去（#295、`032fd1a65` で修正）だった。

したがって remedy は「fallback を定数に替える」ではなく次の形になる。

- 生の `data` を取り、`data !== undefined` の readiness を**memo の外**で導出する
- その boolean と、計算で実際に使う値だけを memo の依存に入れる（query object を入れない）
- 型に合った安定 EMPTY は fallback が必要な箇所に限定し、**readiness 判定より後**に適用する
- 残り 12 件も同じく各下流の依存を確認してから個別に適用する

現在の依存配列（`use-command-palette-data.ts:301-311`）は次のとおりで、`feeds` と `feedsQuery`
の両方が入っている。後者 4 つが毎 render 新しい Proxy になるため、前者を安定させても効かない。

```ts
}, [actions, feeds, feedsQuery, folders, foldersQuery,
    recentArticleCandidates, recentArticlesQuery, tags, tagsQuery]);
```

query object が依存に入っているのは readiness の判定（`hasFetchedData(feedsQuery)` 等）を
memo の中で行っているためである。readiness を memo の外の boolean にすれば、query object を
依存から落とせる。#295 の修正で `hasFetchedData` は `data` しか見なくなったので、この分離は
既に可能になっている。

**この remedy には回帰ガードが要る。** `?? EMPTY` を readiness 判定より前に置くと #295 が戻る。
`032fd1a65` で入れた回帰テスト（`use-command-palette-data.node.test.tsx`、クエリ失敗時に履歴を
保つ）がその位置を守るので、remedy の実装中にこのテストが落ちたら順序を間違えている。

**「13 件すべて消える」「性能上の効果」はいずれも未検証**であり、実装後の再スキャンで確かめる。

### B. `useCallback(factory(t, key), [])`（3 件）— accepted-risk

対象：`use-account-detail-danger-zone.ts:158,162,166`

```ts
const showLocalSyncSettingsError = useCallback(createAccountDetailErrorToast(t, "..."), []);
```

第 1 引数は関数リテラルではなく**関数呼び出し**なので、毎 render 新しい closure が作られ、
`useCallback` の `[]` がそのうち初回のものだけを残す。結果として `t` は初回 render のものに固定
される。

- account detail へ届く `t` は `settings-modal.tsx:44` と `account-detail/account-detail.tsx:35`
  の**両方とも素の `useTranslation("settings")`**。locale を固定する `useStableOpenTranslation`
  はこの経路を通っていない（使われているのは `settings-modal.tsx:194` の別 component と
  shortcuts / command palette 系）。
- react-i18next の `useTranslation` は `i18n.getFixedT(currentLng, ...)` を返すので、`t` は
  生成時の言語に固定される。凍結された `t` は言語切替後も旧言語を返す。

つまり**機構としての不具合は実在する**。accepted-risk とするのは到達性による。`language` を
書き換えるのは `use-general-settings-view-props.ts:36` だけで、General カテゴリと account detail は
settings modal 内で排他表示なので、言語変更時に account detail は unmount 済みである。
**command palette / shortcut / OS locale 追従など言語変更経路が増えた時点で live になる。**

`[]` は locale の意図的な固定ではない。同じファイルの `showImportError` 等（156, 157, 169 行）は
`useCallback` に包まれておらず毎 render 新しい `t` を使う。`[]` が実際に担っているのは
209 行で閉じる load effect の再実行抑止で、locale 固定はその副作用である。修正するなら `[t]` へ
広げるのではなく（言語切替のたびに `getLocalAccountSyncSettings` の読み直しと 4 つの state 更新が
走る）、`t` を ref 経由にするか effect の依存から外す形になる。

### C. 依存が本当に無い 1 件 — accepted-risk

対象：`use-article-list-effects.ts:75`、欠けているのは `viewportRef`

prop として渡る `useRef` オブジェクトで、生成元は `use-article-list-interactions.ts:37`。ref
オブジェクトの identity は不変なので、依存配列に足しても再実行の条件は変わらない。指摘は形式的に
正しく、修正しても挙動は変わらない。直上に別 linter 向けの
`biome-ignore useExhaustiveDependencies` が既にある。

must-fix にしない。`quality-policy.md` の must-fix は「bug / regression / hot path / この変更が
持ち込んだもの」で、挙動が変わらない指摘はどれにも当たらない。

### D. default parameter の関数リテラル 1 件 — accepted-risk

対象：`use-browser-webview-events.ts:136`（`isClosedEventCurrent`）

```ts
isClosedEventCurrent = () => true,   // line 37
```

呼び出し側が省略すると、この default が毎 render 新しい関数になり、136 行の `useLayoutEffect` が
毎 render Tauri listener 4 本を解除・再登録する。**現在の唯一の production caller
（`use-browser-view-event-bridge.ts:70-85`）は `useCallback` で包んで渡しているので発火しない。**
default を module scope の定数へ出せば消える。

現状発火しないので must-fix ではない。将来の呼び出し側が省略すると live になる。

## no-adjust-state-on-prop-change 16 件

16 件のメッセージと help は**バイト単位で同一**で、違いは位置だけ。

### 観測: 報告位置はすべて「引数が定数の setter 呼び出し」

`null` / `false` / `new Set()` / `""` / `"title"` / `{}` / `"all"`。同じ effect の中でも引数が
計算式の setter は報告されていない。

| 報告されない例 | 引数 |
| --- | --- |
| `use-subscriptions-index-state.ts:97` | `setActiveAccountId(nextAccountId)`（別ルール `no-derived-state` が発火） |
| `use-subscriptions-index-state.ts:168` | `setSelectedFeedId(visibleRows[0]?.feed.id ?? null)` |
| `use-article-list-sources.ts:315` | `setRetainedArticlesSnapshot((previous) => ...)` |
| `use-subscriptions-index-state.ts:105` | `resetListScrollState()` |

**この規則性は 4 つの反例からの推定であって、ルール実装で確認したものではない。**
`oxlint-plugin-react-doctor` 0.9.13 の dist は minify 済みでルール本体を読めていない。
「定数引数だから報告された」を根拠に判定を組み立てない。

### 報告位置が effect の外にある 2 件

`use-sidebar-feed-drag-state.ts:18,19` は `useCallback`（17-20 行）の中で、effect ではない。
この callback は 102-110 行の effect からも、drop handler の `finally`（85, 98 行）からも呼ばれる。

### 判定

| 対象 | 判定 | 理由 |
| --- | --- | --- |
| `use-article-list-sources.ts:311` | **false-positive** | 消費側が同一条件で既に guard 済み（下記） |
| `use-sidebar-feed-drag-state.ts:18,19,119,126` | accepted-risk | 進行中の drag を巻き添えにせず remedy を適用できない |
| `use-account-detail-sync-controls.ts:184,185` | accepted-risk | 既存決定の前提（下記の相互参照） |
| `destructive-confirm-dialog-view.tsx:53` | accepted-risk | `key` remount が focus 復帰を壊す |
| `use-subscriptions-index-state.ts:98-104` | accepted-risk | `key` は warning を消さず、削除中の pending 契約を壊す（下記） |
| `use-subscriptions-index-state.ts:162` | 第 2 波へ送る | 下記のとおり再検証が必要 |

#### `use-article-list-sources.ts:311` は false-positive

effect（308-311 行）は `retainedArticleIds.size === 0` のとき snapshot を null にする。snapshot の
唯一の消費者 `mergeResolvedArticlesWithRetained`
（`src/lib/articles/article-list-filtering.ts:272-273`）は**同じ条件**で早期 return し snapshot を
読まない。したがってルールが主張する「stale な値が一瞬見える」は発生しない。

#### `use-subscriptions-index-state.ts:98-104` は accepted-risk

初稿では「remedy が無い」と書いたが誤りだった。

- **「mount 時のみの復元初期化が再適用される」は成立しない。**
  `subscriptions-index-page.tsx:77-79` の `scopedIndexReturnState` は
  `indexReturnState.accountId === selectedAccountId` のときだけ非 null。account 切替直後は
  旧 account の returnState なので `null` になり、lazy initializer が返すのは
  `null` / 空 Set / `""` / `"title"` / `{}` / `"all"` ＝ **effect が 98-104 行で設定する値と同一**。
- **「失うものは未保存の編集入力だけ」は誤りだった（独立レビューで訂正）。**
  `deleteTargetFeed` のクリアは無条件ではなく、`subscriptions-index-page.tsx:276-280` が
  `!deletePendingRef.current` で guard している。`:73-75` / `:222-243` は削除中の target、
  pending 表示、重複 submit guard を**同一 page instance で保持する契約**である。`key` で
  remount するとこれらを捨て、新 instance は `pending=false` から始まる一方、
  **旧 `mutateAsync` の削除は走り続ける**（`use-delete-feed.ts:36-59` に instance を跨ぐ
  guard や cancel は無い）。

**さらに、`key` を付けても 7 件の warning は消えない。** warning は 91-106 行の effect に
対して出ており、`key` を足しても effect は残る。消すには effect の削除と、この hook の
全 consumer が account 境界で remount される保証が要る。現行 hook は account prop 変更時の
reset 契約を単体テストで持っている（`use-subscriptions-index-state.node.test.tsx:390-424`）。

初稿の「構造上のブロッカーは無い」は訂正する。

**現時点の推奨は `key` 不採用。** 代わりに、account が不一致になった **idle な `editTargetFeed`
だけ**を閉じる。既存の account-scoped reset（`:91-106`）と pending delete の保持は維持し、
保存・削除の処理中は無条件 unmount しない。account 切替直後の render で旧対象への新規 submit を
許さない guard も併せて要る。**effect を 1 つ足せば pending も解決した、とはしない。**

**判定は accepted-risk で確定した（2026-09-11）。** 決め手は 2 つある。

1. **`key` を付けても 7 件の warning は消えない。** 上記のとおり warning は effect に対して
   出ており、`key` は effect を削除しない。「remedy を採れば消える finding」ではない。
2. **`key` は削除中の pending 契約を壊す。** これは仕様の好みではなくコード上の事実で、
   `use-delete-feed.ts:36-59` に instance を跨ぐ guard も cancel も無い。

したがって「remedy はあるが採らない」ではなく、**この設計では remedy が成立しない**。
`no-adjust-state-on-prop-change` の他の 8 件と同じ扱いになる。

account 切替時に旧 account のダイアログが残る問題そのものは、page 全体の remount ではなく
ダイアログ側で解く形で #301 が対応した（`feed-edit-dialog.tsx`）。編集ダイアログについては
そこで解消しており、この 7 件が指す state reset とは別の層の話である。

#### `use-subscriptions-index-state.ts:162` は第 2 波へ

`visibleRows` が空になったとき選択を外す effect。prop 変化への追従ではなく派生データへの整合
処理で、render 中に導出済みの `selectedRow`（157 行）との関係を含めて読み直す必要がある。
初稿では accepted-risk としたが、根拠が他の 15 件と同じ形をしておらず、再検証しないまま
分類を確定させない。

#### `use-sidebar-feed-drag-state` の理由（初稿の書き直し）

初稿は「ユーザーが掴んだ feed の記録だから derive 不可」と書いたが、これは**保存側**の話で、
ルールが指摘しているのは**表示側の stale** である。`draggedFeedId` / `activeDropTarget` を state
として持ったまま、有効性を render 中に導出する形（`feedById.has(draggedFeedId)` /
`canDropFeedToFolder(...)` はどちらも render 時に評価可能）は存在する。

accepted-risk とするのは `key` と event 側が成立しないためである。`key` remount は進行中の drag
セッションごと破棄する。`feedById` / `folderById` を変えるのは query 更新で、この hook の外にある。

## 既存決定との関係

- **`use-account-detail-sync-controls.ts:184,185`** が属する effect（179-185 行）は、
  `quality-policy.md`「Loading Flag Reset Findings」が既に決定の**前提**として参照している。
  同節は「guard が false のときは account.id 変更 effect（generation bump と ref/state reset を
  所有）か unmount が責務を終わらせる」と書いており、その effect がここで分類している対象である。
  **ここに `key` remedy を適用すると、その決定が黙って無効になる。**
- **`destructive-confirm-dialog-view.tsx`** の同じ effect（46-61 行）には
  `no-reset-all-state-on-prop-change` が**別 finding として `key` を直接推奨している**（46 行）。
  その finding はこの 16 件に含まれないが、**同じ理由で `key` は採れない**。`restoreFocusElementRef`
  （40, 48, 56 行）が open → close を跨いで生き残る必要があり、remount すると focus 復帰が壊れる。
  第 2 波で 46 行を扱う担当者はこの節を読むこと。

## gate への反映手順

accepted-risk と判定した finding は、記録するだけでは `quality:react-doctor:diff` を止め続ける。
`quality-policy.md`「Recording An Accepted Risk So The Gate Can See It」に従い、finding 位置へ
inline record を置く。

```text
// react-doctor-disable-next-line <full rule id> -- accepted risk (<family>), docs/react-doctor-warning-classification-249.md:<line>
```

inline record を置くと full scan の件数が動くので、`reactDoctorBaselines.full` の再 pin と
`classifiedWarningFamilies` への追加が同時に要る。**再 pin は feature branch から行わない**
（`scanSha` は main から到達可能でなければならない）。手順は #260 の 3 群と同じで、修正を land
してから main で測り直す。

## 判定を誤った経緯

初稿の 3 件の判定が独立レビューで棄却された。3 件とも同じ形の誤りである。

**1 つの経路を確認して、家族全体に一般化した。** §A では `use-command-palette-data.ts:297` の
localStorage 書き込みが内容比較で止まることを確認し、そこから「13 件に観測可能な副作用コストは
無い」と書いた。実際には sidebar 側に無条件書き込みの経路があり、確認していなかった。

`use-subscriptions-index-state.ts:98-104` と `use-article-list-sources.ts:311` も同じで、
「remedy が成立しない」「消費側の契約が無い」を、対象コードを読まずに family の形から推定した。

この誤りは #260 の 14 件の pass でも起きており（分類案 14 件中 12 件が棄却）、同じ日に 4 回
繰り返している。4 回目は本記録の訂正版で踏んだ——`feedList` と `folderList` が「どちらも
expansion hook へ渡る」ところで止め、**どちらがどの effect に届くか**を見ずに 2 件とも must-fix
とした。実際には片方は早期 return する effect にしか届かない。

**family として括った時点で、族の代表 1 件ではなく各件の下流を確認する。** 「同じ hook に渡る」
「同じファイルにある」「同じルールが出た」はいずれも下流が同じであることを意味しない。

2 回目の独立レビュー（`reviewer`、gpt-6-astra）でさらに 2 件の前提が棄却された。どちらも
**「remedy が効く」側の推定**で、誤りの向きは同じである。

- `?? EMPTY` で 13 件消える → query object が依存に入っているので履歴 memo には効かず、
  しかも素朴な置換は #295 を再導入する
- `key` で 7 件消える → warning は effect に対して出ているので `key` では消えず、
  さらに削除中の pending 契約を壊す

**「remedy が成立しない」と同じくらい、「remedy が効く」も検証を要する主張である。** 前者だけを
疑う癖がついていた。
