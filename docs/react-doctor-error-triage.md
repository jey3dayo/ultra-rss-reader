---
type: reference
title: React Doctor の render 中 ref 書き換えに関する証拠記録
description: Issue #260 で報告された14件について、コード、読み手、再実行時の挙動、既存テストを記録する。
resource: urn:ultra-rss-reader:docs:react-doctor-error-triage
tags: [category/quality, audience/developer, tool/react-doctor]
timestamp: 2026-09-10
audience: developer
owner: project-maintainers
---

# React Doctor の render 中 ref 書き換えに関する証拠記録

Issue #260 の14件を、コード上の事実と既存テストの対応として記録する。
この文書には分類や判定の欄を設けない。

## 1. StoryQueryClientProvider のテスト用 callback

対象：`src/__tests__/components/story-query-client-provider.node.test.tsx:12`、`no-prop-callback-in-render`

1. 書いているもの：`onClient(queryClient)`。
   `onClient` は `(queryClient: QueryClient) => void` 型の prop で、テスト側へ `useQueryClient()` の値を渡す callback である。
2. いつ書かれるか：ref への書き込みではない。
   `QueryClientProbe` の render body で、コンポーネントが render されるたびに callback を呼ぶ。
3. 誰がいつ読むか：`onClient` は同じ render body の12行で呼び出される。
   呼び出し先はテストの `firstClientProbe` または `secondClientProbe`（いずれも `vi.fn()`）で、読み手は render 中の callback である。
4. 二重実行：なる。
   StrictMode の二重 render では `vi.fn()` が二度呼ばれ、並行 render が破棄されても破棄された render 側の callback 呼び出しは外部 mock に残る。
5. 既存のテスト：`src/__tests__/components/story-query-client-provider.node.test.tsx` の `creates an isolated non-retrying query client per story render`。
   callback の戻り値ではなく、各 render の QueryClient と設定および unmount 後の cache クリアを確認している。

## 2. ArticleReaderBody のコンテンツ click listener

対象：`src/components/reader/article-reader-body.tsx:228`、`no-ref-current-in-render`

1. 書いているもの：`contentContainerClickListenerRef.current = (event: globalThis.MouseEvent) => { ... }`。
   ref の型は `((event: globalThis.MouseEvent) => void) | null` で、記事本文のリンク click を処理する最新 callback を保持する。
2. いつ書かれるか：条件分岐の外にある render body で、毎 render 書き換える。
   callback はその render の `articleUrl` を closure に保持する。
3. 誰がいつ読むか：同ファイル98行の `contentContainerEventHandlerRef` が、DOM click listener として呼ばれたときに `contentContainerClickListenerRef.current?.(event)` を実行する。
   読み手は event handler であり、listener は257から269行の callback ref 経由で本文コンテナへ capture 登録される。
4. 二重実行：なる。
   StrictMode では同じ props に対する代入が二度起きるが、並行 render が破棄された場合は、commit されていない `articleUrl` を捕捉した callback が commit 済みの DOM event handler から読まれる可能性がある。
5. 既存のテスト：`src/__tests__/components/article-reader-body.test.tsx` の `resolves relative content links against the article URL`、`delegates content link clicks added after the article body renders`、`delegates nested element clicks to the owning content link`、`does not intercept modified content link clicks`、`does not open relative content links without an article URL base`、`cleans up delegated content link clicks when switching articles`。

## 3. useArticleListData の source plan

対象：`src/components/reader/hooks/article-list/use-article-list-data.ts:103`、`no-ref-current-in-render`

1. 書いているもの：`sourcePlanRef.current = sourcePlan`。
   ref の型は `ReaderSourcePlan` で、記事一覧の query、source kind、scope key、filter、effective view mode、source order などを表す。
2. いつ書かれるか：render body 内の条件分岐で、`buildArticleListSourcePlanKey` の結果が変わったときだけ書く。
   key は `sourceKey`、`sourceKind`、`query.filter`、`effectiveViewMode`、`preservesRecentOrder` から作られる。
3. 誰がいつ読むか：102行で前回値の key を render 中に読み、105行で `stableSourcePlan` として再度読む。
   `stableSourcePlan` は111行以降の `useMemo` の依存値と callback 内の `buildArticleListData` に渡される。
4. 二重実行：判断材料が足りない。
   通常の同値 plan の再生成は key で同じ値を保ち、通常 render の挙動はテストで固定されているが、並行 render の破棄と useMemo の再計算を組み合わせた直接テストはない。
5. 既存のテスト：`src/__tests__/components/use-article-list-data.node.test.tsx` の `keeps filtered article memo stable when an equivalent sourcePlan object is recreated`。
   さらに `src/__tests__/lib/article-list.node.test.ts` の `builds a stable article list source plan key from semantic fields` と `scopes article list source plan keys by account switch context` が key の同値性と account 差分を確認している。

## 4. Add Feed の discovery URL

対象：`src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts:88`、`no-ref-current-in-render`

1. 書いているもの：`latestDiscoveryUrlRef.current = trimmedUrl`。
   ref の型は `string` で、最後に render された入力 URL（`state.url.trim()`）を保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：141行の `isLatestDiscovery` callback が、`discoverFeeds(requestUrl)` の成功または失敗後に呼ばれる判定で `current` を読む。
   読み手は async command の continuation と、その中の `Result.inspect` callback である。
4. 二重実行：なる。
   StrictMode では同じ URL が二度書かれるが、並行 render が破棄された場合は、未 commit の URL が旧 discovery の完了判定に使われ、旧結果の採用または破棄が commit 済み入力とずれる可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-add-feed-dialog-actions.node.test.tsx` の `ignores stale discovery responses after a newer URL discovery starts`、`ignores a discovery response after the URL changes before another discovery starts`、`ignores same-URL discovery responses after the dialog closes and reopens`。

## 5. Add Feed の open 状態

対象：`src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts:89`、`no-ref-current-in-render`

1. 書いているもの：`openRef.current = open`。
   ref の型は `boolean` で、Add Feed dialog が open かどうかを保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：196行の `isLatestSubmit` callback が `runFeedMutationWithOptimisticRollback` の rollback、folder 作成後、feed 追加後、folder assignment 後の async continuation から呼ばれ、`openRef.current` を読む。
   読み手は submit の async callback と rollback callback である。
4. 二重実行：なる。
   StrictMode では同じ open 値が二度書かれるが、並行 render が破棄された場合は、commit されていない open 値で submit 完了時の dispatch、toast、dialog close の可否を判定する可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-add-feed-dialog-actions.node.test.tsx` の `keeps late submit success quiet after the dialog is externally closed while pending`。
   close 後の submit 完了で `onOpenChange` と toast を呼ばないことを確認している。

## 6. Feed tree drag の最新 callback 集合

対象：`src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts:43`、`no-ref-current-in-render`

1. 書いているもの：`latestParamsRef.current = { setPointerDragPreview, setPointerHoverTarget, queueSuppressHandleClickReset, clearPointerTracking, onDragStartFeed, onDragEnterFolder, onDragEnterUnfoldered, onDropToFolder, onDropToUnfoldered, onDragEnd }`。
   ref は `UseFeedTreePointerDragEventsParams` から `isPointerTracking` と `pointerDragRef` を除いた callback 集合を保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：63行で drag 完了処理が drop callback 集合を読み、87行で pointer move handler が preview、hover、drag-start、drag-enter callback を読む。
   これらの handler は56行の effect が window の `pointermove`、`pointerup`、`pointercancel`、`keydown`、`blur` に登録する event listener である。
4. 二重実行：なる。
   StrictMode の effect 再登録自体は cleanup で管理されるが、並行 render が破棄された場合は、window listener が読み取る callback 集合に未 commit の props が混ざり、drop や hover の送信先が commit 済みの表示とずれる可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-feed-tree-pointer-drag-events.node.test.tsx` の `keeps window listeners fixed for the drag session while using latest callbacks` と `cancels the current drag session on pointercancel`。
   前者は rerender 後に listener を増設せず最新 callback を使うこと、後者は cancel 時の cleanup callback を確認している。

## 7. Credentials editor の active account id

対象：`src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts:183`、`no-ref-current-in-render`

1. 書いているもの：`activeAccountIdRef.current = account.id`。
   ref の型は account id の `string` で、async 処理が現在表示中の account を確認するために保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：210、218、255、275、298、309、332、378、423行。
   210、218、255、275、298、309、332、378行は connection verification または credential save の async continuation と queued promise continuation、423行は設定画面の secondary action callback が読む。
4. 二重実行：なる。
   StrictMode では同じ account id が二度書かれるが、並行 render が破棄された場合は、旧 account の save または connection test の continuation が未 commit account id を読み、stale result の採用可否を誤る可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-account-detail-credentials-editor.node.test.tsx` の `ignores a stale connection failure after switching accounts`、`drops a queued credential draft when the account changes before the in-flight save settles`、`does not test a stale account after credential persistence finishes on a previous account`、`does not restore focus from a stale account detail handler`。

## 8. Credentials editor の draft revision

対象：`src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts:184`、`no-ref-current-in-render`

1. 書いているもの：`draftRevisionRef.current = state.draftRevision`。
   ref の型は `number` で、credential draft が変更されるたび reducer が増分する revision を保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：210、218、256、276、299、310、333、378行。
   connection verification、save task、queued save、test connection の async continuation が request 時点の revision と比較する。
4. 二重実行：なる。
   StrictMode の同一 state では同じ数値になるが、並行 render が破棄された場合は、未 commit の draft revision が旧 save または test の stale 判定に使われ、別 draft の結果を処理する可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-account-detail-credentials-editor.node.test.tsx` の `ignores a stale connection success when the draft changes before the result returns`、`does not apply a stale credential save when the draft changes before the save returns`、`queues a changed credential draft until the in-flight save settles`、`drops a queued credential draft when the account changes before the in-flight save settles`。

## 9. Name editor の active account id

対象：`src/components/settings/hooks/account-detail/use-account-detail-name-editor.ts:76`、`no-ref-current-in-render`

1. 書いているもの：`activeAccountIdRef.current = account.id`。
   ref の型は account id の `string` で、rename の async 完了が同じ account に対するものか確認するために保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：109行の `commitRename` async continuation が `renameAccount(requestAccountId, trimmed)` の完了後に読む。
   `commitRename` は Enter の key event handler（133行）から呼ばれる。
4. 二重実行：なる。
   StrictMode では同じ account id が二度書かれるが、並行 render が破棄された場合は、旧 account の rename 完了が未 commit account id と比較され、stale rename の扱いが表示中 account とずれる可能性がある。
5. 既存のテスト：`src/__tests__/hooks/use-account-detail-name-editor.node.test.tsx` の `ignores a stale rename response after switching accounts and starting a new edit` と `clears saving state when a stale rename response arrives after switching accounts`。

## 10. TagsSettings の state snapshot

対象：`src/components/settings/tags-settings.tsx:124`、`no-ref-current-in-render`

1. 書いているもの：`stateRef.current = state`。
   ref の値は `TagsSettingsState`（create/edit の入力値、対象 TagDto、revision、削除対象）である。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：154、160行の tag create の async continuation、198、204行の tag rename の async continuation が読む。
   いずれも `mutateAsync` の成功後または catch 内で、request revision と現在 state の revision または対象 id を比較する。
4. 二重実行：なる。
   StrictMode では同じ state が二度書かれるが、並行 render が破棄された場合は、未 commit state の revision または編集対象が旧 mutation の完了判定に使われ、toast や reset の対象が表示中 state とずれる可能性がある。
5. 既存のテスト：`src/__tests__/components/tags-settings.test.tsx` の `does not reset or toast from a stale tag creation after the draft changes` と `does not close or toast from a stale tag rename after the edit draft changes`。

## 11. TagsSettings の tag query snapshot

対象：`src/components/settings/tags-settings.tsx:126`、`no-ref-current-in-render`

1. 書いているもの：`tagsRef.current = tags`。
   ref の型は `TagDto[]` で、`useTags()` の query data（`id`、`name`、`color` を持つ tag 一覧）を保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：174行の `handleRename` と216行の `handleDelete` が mutation 開始前に読む。
   どちらも TagsSettingsView から UI event として呼ばれる handler で、対象 tag id が現在の query 一覧にあるかを `some` で確認する。
4. 二重実行：なる。
   StrictMode では同じ query data が二度書かれるが、並行 render が破棄された場合は、UI event handler が未 commit の tag 一覧を読み、表示中の edit または delete 対象の存在判定がずれる可能性がある。
5. 既存のテスト：`src/__tests__/components/tags-settings.test.tsx` の `closes edit dialog without renaming when the target tag disappears` と `keeps delete dialog visible but disabled when the target tag disappears`。

## 12. SubscriptionsListPane の scroll callback

対象：`src/components/subscriptions-index/subscriptions-list-pane.tsx:131`、`no-ref-current-in-render`

1. 書いているもの：`onListScrollTopChangeRef.current = onListScrollTopChange`。
   ref の型は `(scrollTop: number) => void` または `undefined` で、親へ list の scrollTop を通知する最新 callback を保持する。
2. いつ書かれるか：条件分岐の外にある render body で毎 render 書き換える。
3. 誰がいつ読むか：149行の `commitPendingScrollTop` が `onListScrollTopChangeRef.current?.(pendingScrollTop)` として読む。
   `commitPendingScrollTop` は scroll event が設定した timer callback（183行）または unmount cleanup（175行）から呼ばれる。
4. 二重実行：なる。
   StrictMode では同じ callback が二度書かれるが、並行 render が破棄された場合は、commit 済み pane の scroll flush が未 commit の親 callback を呼び、scroll state の通知先が表示中 props とずれる可能性がある。
5. 既存のテスト：`src/__tests__/components/subscriptions-list-pane.test.tsx` の `delegates feed clicks and batches list scroll position changes through separate callbacks`、`flushes the latest pending list scroll position on unmount`、`drops a pending list scroll position when the restored scroll top changes`、`drops a pending list scroll position when reset identity changes with the same restored top`。

## 13. Stable translation の open language capture

対象：`src/lib/i18n/use-stable-open-translation.ts:10`、`no-ref-current-in-render`

1. 書いているもの：`openLanguageRef.current = i18n.resolvedLanguage ?? i18n.language`。
   ref の型は `string | null` で、dialog または settings surface が open になった時点の locale を保持する。
2. いつ書かれるか：render body 内の `open && current === null` 条件が真のときだけ書く。
   open 中は初回の locale capture 後に書かず、close 中の12行が null に戻す。
3. 誰がいつ読むか：9行と11行の条件式、15行の `const openLanguage = openLanguageRef.current` が render 中に読む。
   15行の値は17行以降の `useMemo` の依存値となり、返却された `TFunction` は settings、shortcuts、command palette の render で読む。
4. 二重実行：なる。
   StrictMode の同じ open と locale なら同じ locale を二度 capture するが、並行 render が破棄された場合は、未 commit の locale が次の open 状態の memo と返却関数へ残る可能性がある。
5. 既存のテスト：`src/__tests__/components/shortcuts-settings.test.tsx` の `keeps open shortcut settings labels on one locale while language changes`、`src/__tests__/components/shortcuts-help-modal.test.tsx` の `keeps open help labels on one locale while language changes`、`src/__tests__/components/settings-modal.test.tsx` の `keeps open modal chrome on one locale while language changes`。

## 14. Stable translation の close reset

対象：`src/lib/i18n/use-stable-open-translation.ts:12`、`no-ref-current-in-render`

1. 書いているもの：`openLanguageRef.current = null`。
   13件目と同じ `string | null` ref を、close 中に保持していた locale から未 capture 状態へ戻す。
2. いつ書かれるか：render body 内の `!open && current !== null` 条件が真のときだけ書く。
   null に戻した後の render では条件が偽になる。
3. 誰がいつ読むか：11行の条件式と15行の `openLanguageRef.current` が render 中に読む。
   15行の `openLanguage` は `useMemo` の依存値になり、返却された `TFunction` は hook の利用側の render で読む。
4. 二重実行：なる。
   StrictMode の同じ close 状態なら null への代入結果は同じだが、並行 render が破棄された場合は、未 commit の close reset が別 render の open language capture と干渉し、memo が参照する locale 状態が commit 済み open 値とずれる可能性がある。
5. 既存のテスト：`src/__tests__/components/shortcuts-settings.test.tsx` の `keeps open shortcut settings labels on one locale while language changes`、`src/__tests__/components/shortcuts-help-modal.test.tsx` の `keeps open help labels on one locale while language changes`、`src/__tests__/components/settings-modal.test.tsx` の `keeps open modal chrome on one locale while language changes`。
