---
type: reference
title: React Doctor 未 triage warning の分類（第 2 波 21 件）
description: Issue #300 が対象とする第 2 波 21 件の finding ごとの証拠と判定、および走査条件と baseline drift の実測を記録する。
resource: urn:ultra-rss-reader:docs:react-doctor-warning-classification-300
tags: [category/quality, audience/developer, tool/react-doctor]
timestamp: 2026-09-18
audience: developer
owner: project-maintainers
---

# React Doctor 未 triage warning の分類（第 2 波）

Issue #249 の未 triage 53 件のうち、第 1 波（`exhaustive-deps` 18 /
`no-adjust-state-on-prop-change` 16）で扱わなかった残りを扱う。第 1 波の記録は
[react-doctor-warning-classification-249.md](./react-doctor-warning-classification-249.md)。

## 走査条件

- `mise run quality:react-doctor:full` と同一条件。main の `c470243678e85150d3f813679474c8e6d45026ce` で実行
- `tmp/react-doctor-full.json` の `projects[]` はリポジトリ root 1 件のみ。
  `quality-policy.md`「React Doctor Scan Scope」の前提を満たす
- report の `version` は **0.9.14**。`scripts/quality-baseline.ts` の pin は 0.9.13 だった。
  bump は `6ef1b4701`

## 件数は 21 件で、うち 1 件は既に判定済みだった

issue のタイトルは「残り 19 件」、本文の表は 21 件、
`untriagedWarningCountAtScan` は 20 と出る。三者が食い違う理由を実測で確定した。
**第 2 波 9 ルールの finding は 21 件**（issue 本文の表が正しい）。

`prefer-use-sync-external-store`（`subscriptions-index-page.tsx:81`）は 2026-09-08 の pass で
accepted-risk と決まっていたが（`quality-policy.md`「Behavioural Single Findings」）、
`classifiedWarningFamilies` にその entry が無い。逆に `require-pnpm-hardening` は count 1 で
登録されたまま、0.9.14 では **rule 自体が削除**されている（`react-doctor rules list` に無い）。
つまり登録漏れ 1 件と過剰計上 1 件が打ち消しあって 20 になっていた。

（この 1 件の accepted-risk は本 pass の独立レビューで棄却され、最終的に移行して finding を
消した。経緯は「独立レビューで棄却された判定」に書く。）

現 scan での照合:

```text
52 = 25（complexity family）
   +  7（実在する classified family: no-loading-flag-reset 3 / js-set-map-lookups 1
         / no-self-updating-effect 1 / prefer-html-dialog 1 / prefer-use-sync-external-store 1）
   + 20（本当に未判定）
```

未判定 20 件 + 既判定・未登録 1 件 = 21 件。

## warningCount 59 → 52 はコードの改善ではない

`react-doctor rules list`（0.9.14）で確認した内訳。

| rule | pin 時の扱い | 0.9.14 | 差分 |
| --- | --- | --- | --- |
| `js-tosorted-immutable` | classified 3（false-positive） | `off (default)` | -3 |
| `js-combine-iterations` | classified 4（accepted-risk） | `off (default)` | -4 |
| `require-pnpm-hardening` | classified 1（deferred, #264） | rule 削除 | 0（pin 時点で既に 0 件） |

-7 で 59 → 52 に一致し、他のルールの件数は動いていない。`js-set-map-lookups` は
0.9.14 でも `warn (default)` のままで、現在も 1 件報告されている。
**この drift は tool 側の既定 severity 変更であり、finding が直ったのではない。**

## inline suppress の総量（audit mode の実測）

`--no-respect-inline-disables` を付けた走査は、inline disable を無効化した総数を返す。
本 pass の作業前の実測値（fix 2 件適用後、disable 追加前）は
**respect: warnings 48 / audit: warnings 74** で、差 26 が inline disable による抑制量である
（第 1 波ぶん 24 + 検証用に一時的に置いた 2）。

`warningCount` の pin は suppress 後の数なので、それ単独では「直った」と「黙らせた」を
区別できない。再 pin の際は audit mode の値を併記する。

## 判定

21 件のうち 2 件は修正して finding を消した。残り 19 件は該当行に inline 記録を置く。

### 修正して finding を消した（3 件）

issue は「`rerender-lazy-ref-init` 2 件は適用すると `no-ref-current-in-render`(error) を生む」と
警告していたが、それは **rule 自身が示唆する remedy**（`useRef(null)` + render 中で初期化）の話である。
下の 2 つは別の remedy で、実測では error を増やさない。
**そしてこの 2 件は同じ rule だが remedy が違う。** ref が render 中に読まれるか、effect 内だけで
読まれるかで取れる手が変わる。

#### `article-tag-chip-list.tsx:13`

```ts
const initialAssignedTagIds = useRef(new Set(assignedTags.map((tag) => tag.id))).current;
```

この ref は `:22` の className 判定（`motion-list-item-enter` を付けるか）で **render 中に読まれる**が、
書き換えは一切ない。マウント時点で割り当て済みだったタグ ID のスナップショットで、
**props に追従してはいけない**（追従すると新規追加タグも「元から居た」扱いになり入場アニメーションが消える）。

`useState(() => new Set(...))` へ変更した。初期化関数は 1 回だけ評価されるので契約が保たれる。
`useMemo` は React が破棄しうる契約なのでマウント時スナップショットの保持には使えない。

実測: finding 消滅、error 2 のまま、同ファイルに新規 finding 0（warnings 52 → 51）。

検出力: 毎 render 再計算する形へ故障注入すると
`article-tag-picker-view.test.tsx`「animates only tags assigned after the initial render」が落ちる
（1 failed / 17 passed）。この既存テストが durable guard として機能している。

#### `use-article-list-navigation.ts:27`

```ts
const articleIdsSignatureRef = useRef(filteredArticles.map((article) => article.id).join("\0"));
```

この ref は `:39` の effect 内でしか読まれず、同じ effect の `:43` が書く。初期値は
「mount 時にその effect が早期 return する」ためだけに存在する。`useRef<string | null>(null)` に
変更した。

差は mount 時に `focusRequestGenerationRef` が 1 回 0 → 1 されることだけ。この generation は
navigate callback 内で `current + 1` として捕捉した局所値との等値比較にしか使われず
（`:104-106`, `:116-118`）、render 中で読まれず戻り値にも含まれない。mount 時点で focus 予約は
存在し得ないため差は観測されない。

実測: finding 消滅、error 2 のまま、新規 finding 0（warnings 51 → 50）。既存テスト 14 件 pass。

**この変更には振る舞い上の署名が無いため、revert を検出する guard test は作れない。**
形のみの変更であり、テストが緑であることは正しさの証拠ではない。

#### `subscriptions-index-page.tsx:81`

```ts
const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight());
// … 別の effect で addEventListener("resize", …)
```

初稿はこれを accepted-risk とした。2026-09-08 の pass の判断
（`quality-policy.md`「Behavioural Single Findings」の "Migrating is not mandatory absent an
observed defect"）を引き継ぎ、「読み手が `:111` の 1 箇所だけなので rule の言う tearing は
起こり得ない」という事実を足して裏づけた形にしていた。

**独立レビューがこの根拠を棄却した。** rule のメッセージは "stale **or** torn values" で、
読み手の数は tearing 側にしか効かない。stale 側は残る: 初回 render 中に
`window.innerHeight` を読む一方、resize の購読が始まるのは passive effect なので、
**その間に起きた resize は取り逃がす**。これは読み手が 1 つでも成立する。

`useSyncExternalStore` へ移行した。`subscribe` は `window.addEventListener("resize", …)` を
そのまま渡せる形で module scope に切り出した（`getSnapshot` は既に module scope にあった
`getViewportHeight` をそのまま使える）。共有 store への昇格は不要で、2026-09-08 の pass が
移行を見送った理由（「shared store への昇格は別の設計タスク」）は前提が違っていた。

実測: audit mode の warning が 74 → **73**。inline disable で黙らせたのではなく finding が
消えている。

テストは 2 件追加した。

- 「drops the restored list scroll when the window is resized after mount」— 購読が働くことを固定。
  `subscribe` を no-op へ差し替える故障注入で落ちる（1 failed / 30 passed）。
  ただしこれは旧実装でも通るので、移行の guard にはならない
- 「adopts a viewport change that lands while the resize listener is being attached」—
  **移行が直した競合そのものを固定する。** `window.addEventListener` を spy して
  `type === "resize"` の呼び出し中に `innerHeight` を変える。つまり購読の設置中に起きた
  resize を再現する。`useSyncExternalStore` は購読後に `getSnapshot` を読み直すので採用され、
  旧実装（`useState` + passive effect）では取り逃がす。旧実装へ戻すと落ちる
  （1 failed / 31 passed）、現実装で 32 passed

**初稿はこの競合を「テストから到達できない」と書いていた。独立レビューが到達方法を示して
棄却した。** 到達不能だと書くこと自体が主張であり、証明が要る。

### false-positive（3 件）

#### `no-pass-live-state-to-parent` `use-sidebar-feed-drag-state.ts:120`

書き換え対象の `setActiveDropTarget` は `:15` のローカル `useState` setter であり、
`SidebarFeedDragStateParams`（`sidebar-feed-section.types.ts:17-24`）に該当 prop は無い
（定義されている callback は `moveFeedToFolder` と `moveFeedToUnfoldered` の 2 つだけ）。
親へ何も渡していないので、rule は対象を取り違えている。

**同じ 2 ルールが出た他 11 件とは根拠の形が違うのはこの 1 件だけである。** 他は実体が
store action で「親が居ない」ことを理由にするが、これは「そもそも prop でない」。

既存テスト: `use-sidebar-feed-drag-state.node.test.tsx`
「clears an active folder hover target when folder data changes during drag」がこの分岐を固定。

#### `no-derived-state` `use-screen-snapshot.ts:30`

`snapshot` は「一度採用した candidate を、その後 candidate が `null` に戻っても保持し続ける」
ラッチであり、現在の入力（`candidate` / `canAdopt`）からは導出できない。rule の主張する
導出可能性が成立しない。`useMemo` は破棄されうる契約なので代替にならない。

`use-screen-snapshot.node.test.tsx` の 11 件がラッチ契約を固定している
（"keeps the previous snapshot while the next fetch is pending" 他）。

なお `hasResolvedSnapshot` / `hasAdoptedSnapshot` は production では読まれておらず
（読み手はテストのみ）、これは本 finding とは別の観察として記録する。

#### `no-secrets-in-client-code` `use-account-detail-credentials-editor.ts:37`

```ts
const MISSING_PASSWORD_ERROR_MARKER = "Password is not configured";
```

読み手は 1 箇所だけで、`:73` の `accountHasMissingSavedPassword` が
`account.connection_verification_error` に対する `.includes()` の照合語として使う。

値の出自は backend のユーザー可視エラー文である。
`src-tauri/src/infra/keyring_store/mod.rs:24` が
`"Password is not configured. Re-enter your password in account settings, save it, and try again."`
を生成し、Rust 側も同じ語を marker として持つ
（`src-tauri/src/commands/account_commands/credentials.rs:13`、使用は `:74`）。

秘密値は関与しない。rule の主張「the secret ships to the browser where anyone can read it」は
この値については逆で、ブラウザで読まれることが仕様であり、知られても権限は得られない。
同ファイル `:36` の `MASKED_PASSWORD_VALUE` は報告されていないので、rule は PASSWORD を含む
識別子を機械的に挙げているわけではない。

別件として記録（本 pass の scope 外）: この marker は英語エラー文の部分一致で、IPC 境界の
両側に文字列が二重に置かれている。Rust と TS の 2 定数を突き合わせる contract test は無く、
backend 側で文言を書き換えるか localize すると `accountHasMissingSavedPassword` が黙って
false を返す。

### accepted-risk: 外部 store への収束型補正 effect（8 件）

`no-pass-data-to-parent` / `no-pass-live-state-to-parent` の 8 件。
**共通する理由は 1 つだが、下流は 8 件それぞれ辿った結果として異なる。**
理由が同じであることを、下流が同じであることと読み替えないために、まず 8 本の trace を置く。

| finding | rule | prop の実体 | 書き込む slice |
| --- | --- | --- | --- |
| `use-sidebar-visibility-fallback.ts:115` | data | `selectFeedFromCurrentContext`（`ui-store-reader-actions.ts:255-260`） | `selection` 系 reset |
| `use-sidebar-visibility-fallback.ts:118` | data | `handleSelectSmartView`（`use-sidebar-controller-sections.ts:104-119`）→ `setExpandedFolders` **と** `selectSmartView`（`:278-279`） | `expandedFolderIds` + `selection` の 2 回書き |
| `use-sidebar-visibility-fallback.ts:121` | data | `setViewMode`（`:349-355`） | `viewMode` / `recentlyReadIds` / `retainedArticleIds` / `articleReaderScrollPositions`。`selection` は触らない |
| `use-sidebar-visibility-fallback.ts:121` | live-state | 同上 | 同上 |
| `use-sidebar-account-selection.ts:102` | data | `restoreAccountSelection`（`:235-242`） | `selectedAccountId` / `selection` / `focusedPane` |
| `use-sidebar-startup-folder-expansion.ts:347` | data | `setExpandedFolders`（`:365`） | `expandedFolderIds` |
| `use-sidebar-startup-folder-expansion.ts:347` | live-state | 同上 | 同上 |
| `use-sidebar-startup-folder-expansion.ts:380` | live-state | 同上（`:379` の件数比較ガードあり） | 同上 |

いずれも prop として渡ってくる callback の実体が **zustand store action** であり、
親コンポーネントの state ではない。rule のモデルにある「親」が存在しない。

**remedy は `react-doctor rules explain` で確認した**（scan の 1 行メッセージには書かれていない）。
2 つの rule は別々の React docs 節を根拠にし、remedy も別である。

| rule | remedy | 根拠 |
| --- | --- | --- |
| `no-pass-data-to-parent` | 親でデータを取得して prop で下ろす、**または hook から返す** | [Passing data to the parent](https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent) |
| `no-pass-live-state-to-parent` | state を親へ上げる、**または hook から返す** | [Notifying parent components about state changes](https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes) |

どちらの remedy も **state / データの所有者を上へ移すこと**を求めている。
この 8 件でそれが届かない理由は 2 つある。

- **所有者は既に上にある。** 書き込み先は zustand store で、子が持っている state を
  親へ知らせているのではない。子にあるのは store の state から store の state への
  **補正の導出**だけで、子が起点のデータは無い。「親で取得して下ろす」は、下ろす元が
  子にある場合の話である
- **`hook から返す` は effect を消さず 1 段上へ移すだけ。** これらは既に hook であり、
  `useSidebarVisibilityFallback` が decision を返す形にしても、受け取る
  `useSidebarFeedSectionController` も hook なので、store action を呼ぶ effect が
  そちらへ移る。effect を消せるのは適用点がイベントハンドラになるときだけで、
  ここでは条件が複数の非同期ソース（preferences load、React Query の feeds / folders / tags、
  dev intent）にまたがる resolver（`:115` `:118` `:121` は 7 入力、`:102` は 6 入力）であり、
  単一のイベントに対応しない。イベント発生地点（preference トグル、フィード木計算、タグ削除）は
  それぞれ他方の入力を持たないため、resolver を N 箇所へ複製することになる

初稿はここに `no-adjust-state-on-prop-change` の remedy 3 つ
（render 中に導出 / `key` で reset / prop を変えるイベント側で更新）を当てていた。
**別ルールの remedy であり、`no-pass-*` 12 件のうち remedy を論じた 11 件
（本節の 8 件、preference 修復 persist の 2 件、tag picker の 1 件）すべてで反論の相手を
間違えていた。** 残る 1 件（`use-sidebar-feed-drag-state.ts:120`）は rule が対象を
取り違えているので remedy の検討が要らない。結論はどれも変わらないが、根拠は
正しい remedy に対するものへ置き換えた。`rules explain` を先に引いていれば避けられた誤りである。

第 1 波の `use-sidebar-feed-section-controller.ts:62`（毎 render の localStorage write）型の
must-fix が混ざっていないことを 1 件ずつ確認した。

- `:115` `:118` `:121` `:102`: 書き込み後は resolver が `none` / `noop` を返す
- `:347`: `startupExpansionTokenRef`（`:331`）により 1 token につき 1 回
- `:380`: `:379` の `prunedExpandedFolderIds.length !== expandedFolderIds.size` により
  実際に除去がある時だけ書く

いずれも収束し、無条件の副作用には到達しない。

### accepted-risk: preference 修復 persist（2 件）

`use-sidebar-account-selection.ts:107`（`no-pass-data-to-parent` と
`no-pass-live-state-to-parent` の 2 件）。

上の 8 件と下流が違う。`setSelectedAccountPreference` → `setPref("selected_account_id", …)`
（`use-sidebar-controller-actions.ts:29-34`）→ `preferences-store.ts:464` で optimistic な
`set({ prefs })` と fire-and-forget な Tauri IPC `setPreference`。

`setPref` 自体は値比較をせず無条件に書くが、呼び出しが
`action.persistPreference = savedAccountId !== nextAccountId`（resolver `:60`）で
ガードされているため no-op write は起きない。

**「remedy が効く」側ではなく「壊れる方向」を確認した**: 永続化失敗時に再試行ループにならないか。
`setPref` は失敗しても optimistic 値を source of truth として残す設計
（`preferences-store.ts` の "the optimistic UI value remains the source of truth until a
later load or edit"）なので、`savedAccountId` は新しい値のままになり `persistPreference` は
false になる。ループしない。

remedy は 8 件と同じ形で届かない。所有者を上へ移す remedy については、
`selected_account_id` は既に preferences store が持っており子の state ではない。
hook から返す remedy については、`useSidebarAccountSelection` が
「この id を persist せよ」を返す形にしても、受け取る `useSidebarFeedSectionController` も
hook なので `setPref` を呼ぶ effect がそちらへ移るだけである。適用点をイベントハンドラに
できないのは、条件が accounts 一覧の到着と preferences load 完了という別々の非同期境界に
またがるためで、どちらの地点も resolver の他方の入力を持たない。

既存テスト: **この hook（`useSidebarAccountSelection`）の effect を通すテストは無い。**
`sidebar-account-selection.node.test.ts` は純関数 resolver だけを検証しており、
`restoreAccountSelection` / `setSelectedAccountPreference` が実際に呼ばれることを
固定しているテストは存在しない。

### accepted-risk: 親 state への本物の書き込み（1 件）

`no-pass-data-to-parent` `use-article-tag-picker-popover.ts:162`。

上の 10 件と違い、これは rule のモデルがそのまま当たる。`closePicker(true)` →
`onExpandedChange(false)` → `article-tag-chips.tsx:129` の
`dispatch({ type: "set-show-picker", value: false })` で親の `useReducer` state を書く。

`no-pass-data-to-parent` の remedy は「親でデータを取得して下ろす、または hook から返す」である。
所有者を上へ移す側は既に満たされている: `showPicker` は owner の `useReducer` state であり、
子は持っていない。hook から返す側は effect を 1 段上へ移すだけになる。前 render の件数との
比較を `previousAvailableTagCountRef` で保持する必要があるため、比較は hook が持たざるを得ず、
返された信号に owner が反応するには owner 側の effect が要る。

そしてこの finding については、**タグ割り当て経路に限れば owner が既に別経路で閉じている**。
`assignExistingTag` の `onSuccess` が `finish-create-tag` を dispatch し、reducer
（`article-tag-chips.tsx:36-38`）が `{ showPicker: false, newTagName: "" }` を返す。さらに
`useTagArticle` は `createMutation(fn, invalidateArticleTagQueries)`（`src/hooks/use-tags.ts:184-187`）で
optimistic update を持たない invalidation のみなので、`availableTags` が縮むのは refetch 解決後で、
`finish-create-tag` の commit より後になる。したがってこの経路では effect は `:158` の
`!isExpanded` で早期 return する（コード読解からの推論であり、実測ではない）。

残る生きた trigger は「ピッカーを開いている間に外部要因で available タグが減る」場合の
防御的クローズとトリガーへの focus 復帰である。前 render の件数との比較を ref
（`previousAvailableTagCountRef`）で保持する必要があるため、render 中の導出では表現できない。

**この effect にはテストが無かったので、本 pass で追加した。** 到達可能性を推論で済ませず
固定するため。`use-article-tag-picker-popover.test.tsx` に 2 件:

- 「closes the popover and asks for focus restore when the available tags shrink while open」
- 「keeps the popover open when the available tags grow」

検出力: `closePicker(true)` を落とす故障注入で前者が落ちる（1 failed / 6 passed）。

### accepted-risk: 前 render の prop を保持する tracker（1 件）

`no-derived-state` `use-subscriptions-index-state.ts:97`。

`activeAccountId` は `options?.accountId` の写しではなく、**前 render の値を保持して遷移を
検出する** tracker である。読み手は `:93` の等値比較と `:113` の依存配列だけで、hook の
戻り値には含まれない（render される出力に一切現れない）。現在の入力から導出することはできない。

**ただし「導出できないから rule が誤り」とは言えない。** 同 family の
`no-adjust-state-on-prop-change` の `rules explain` は
"Avoid tracking the previous prop in more state, which preserves the duplication" と述べており、
**前 render の prop を state で追跡すること自体を避けるべきものとして名指ししている。**
つまり rule 側の立場は「その tracker は存在するべきでない」であり、
「導出できない」は反論になっていない。

それでも accepted-risk とする理由は、rule が誤っているからではなく**変更が設計変更になる**ためである。
tracker を無くすには、8 個の setter と `resetListScrollState` を含むアカウント reset ブロック全体を
作り替える必要がある。同ブロックの effect 形は第 1 波で既に accepted-risk として決まっている
（`:98` / `:100` の inline 記録）。`quality-policy.md`「React Doctor Warning Categories」の基準では
バグ・回帰・当該変更が持ち込んだもののみが must-fix であり、これはどれにも当たらない。
tracker を消す restructure は別タスクとして扱う。

### accepted-risk: 派生データの整合修復（1 件）

`no-adjust-state-on-prop-change` `use-subscriptions-index-state.ts:169`。

issue が「他 15 件と根拠の形が違う」と書いたとおりで、これは prop 変化への追従ではない。
依存は `[selectedFeedId, selectedRow, visibleRows]` で、`visibleRows` は同 hook 内で
search / sort / filter / kept / deferred から算出される派生値である（prop ではない）。

`selectedRow`（`:164`）は既に render 中で導出済み。effect が維持しているのは**永続する
`selectedFeedId`** で、これは後続の操作（`markSelectedFeedKept` 等）が参照するため、描画時の
一時値では代替できない。`key` reset は hook の全 state（`keptFeedIds` / `deferredFeedIds` /
`searchQuery` 等）を失う。`visibleRows` は多数の経路から変わるので単一イベントに割り当てられない。
effect を落とすと `selectedFeedId` が存在しない行を指し続ける回帰になる。

既存テスト 4 件が固定している: `:49-71`（第一行へ移す）/ `:73-95`（可視行 0 で解除）/
`:97-114`（可視なら保持）/ `:179-200`（return-state との相互作用）。

`:97` との関係: 因果は繋がっているが別 effect である。`:97` の effect はアカウント遷移を
起点に 8 つの state を reset し、`:169` の effect は可視集合の membership を起点に
`selectedFeedId` だけを直す。`:97` が `selectedFeedId` を `null` にした後、`:169` が
`visibleRows[0]` を選び直す。**同じ hook にあることを、同じ finding であることと読み替えない。**

### accepted-risk: `key` remedy が禁止されている reset（1 件）

`no-reset-all-state-on-prop-change` `destructive-confirm-dialog-view.tsx:50`。

clear している React state は `confirmInFlight`（`:38`）1 つだけである（`confirmInFlightRef` は
ref なので rule の対象外）。rule 名の「all state」には当たらない。

`key` remedy が採れない根拠を、結論の再掲ではなくコードの事実として確認した。
`restoreFocusElementRef`（`:40`）は `:52`（closed → open の遷移時のみ）で
`getRestorableActiveElement()` を記録し、`:61`（open → closed の遷移時のみ）で
`restoreFocusOnMicrotask(...)` に渡す。**open 遷移をまたいだ生存が必須**で、remount すると
`null` に戻り focus 復帰が機能しない。`wasOpenRef`（`:41`）も前回状態を保持する。

owner は条件付き render ではなく `open` boolean でマウントし続ける:
`tag-context-menu.tsx:175` / `tags-settings.tsx:288` / `unsubscribe-feed-dialog.tsx:29`。
prop の owner はコンポーネントの外にあるので第 3 の remedy も届かない。

第 1 波は同じ effect の `:57` / `:58` について `no-adjust-state-on-prop-change` で
同じ結論を出している。

### accepted-risk: 実在する構造債（1 件）

`no-giant-component` `subscriptions-index-page.tsx:60`（370 行）。

rule の指摘は妥当で、false-positive ではない。`rules explain` の remedy は
「各セクションを別コンポーネントへ切り出す」である。

本 PR で viewport 追従 effect を `useSyncExternalStore` へ移したため、
コンポーネントは `:68` から EOF（`:426`）までの **359 行**、effect は
`:254` / `:273`（`useEffect`）と `:279`（`useLayoutEffect`）の **3 本**になった。
JSX は `SubscriptionsIndexPageView` 1 要素に約 50 prop を渡す形なので、
**JSX ツリーの分割ではなく effect と prop 構築を hook へ切り出すのが実際の分割線になる**。

分類 pass の中で 370 行の再構成は行わない。分割は独立したタスクとして追跡する。

### suppress したら別ルールが現れる（`no-derived-state` / `no-derived-state-effect`）

`no-derived-state` 2 件に inline 記録を置いたところ、**報告されていなかった
`no-derived-state-effect` が同数の 2 件現れた**。19 件抑制したのに総数が 17 しか減らないことで
気づいた。

同じ state を宣言・更新側と effect 側の 2 つの角度から見たペアのルールで、react-doctor は
片方だけを報告する。抑制すると他方が露出する。位置も別で、
`no-derived-state` は `setState` の呼び出し行、`no-derived-state-effect` は `useEffect(` の行を指す。

| state | `no-derived-state` | `no-derived-state-effect` |
| --- | --- | --- |
| `use-subscriptions-index-state.ts` の `activeAccountId` | `setActiveAccountId` 呼び出し行 | 同 effect の `useEffect(` 行 |
| `use-screen-snapshot.ts` の `snapshot` | `setSnapshot` 呼び出し行 | 同 effect の `useEffect(` 行 |

`--no-respect-inline-disables` を付けた走査では `no-derived-state` だけが出て
`no-derived-state-effect` は出ない。つまり shadowing は disable の処理ではなく rule engine 側にある。

`no-derived-state-effect` の remedy は `rules explain` によると
「render 中に導出する」に加えて **`key` prop による reset** である。これも 2 件とも届かない。
`use-subscriptions-index-state` は hook なので `key` を持てず、呼び出し元の
`SubscriptionsIndexPage` を remount すると `keptFeedIds` / `deferredFeedIds` / `searchQuery` /
スクロール位置まで失う。`useScreenSnapshot` も hook で、remount はラッチの目的
（フェッチ中に直前スナップショットを見せ続ける）を真正面から壊す。

判定は state について下したものなので、両方の rule view に同じ記録を付けた。
**この形は「ルールを 1 つ黙らせたら別のルールと交換になる」典型で、件数の差分を取らないと見えない。**
`quality-policy.md`「Lazy Ref Init Findings」が記録している warning 2 件 → error 2 件の交換と
同じ種類の事故である。

## 判定の集計

| disposition | 件数 |
| --- | --- |
| 修正して finding を消した | 3 |
| false-positive | 3 |
| accepted-risk | 15 |
| 合計 | 21 |

inline 記録は 18 件の finding に対して **20 個**置いてある。差の 2 個は上記の
`no-derived-state-effect` ぶんで、同じ判定を 2 つ目の rule view にも付けたものである。

`must-fix` は 0 件。判定基準は `quality-policy.md`「React Doctor Warning Categories」に従い、
バグ・回帰・当該変更が持ち込んだもののみを must-fix とする。render 頻度や形だけでは昇格させない。

## 第 1 波の手順のうち、本 pass で効いたもの

issue が引き継ぎとして残した 5 項目のうち、実際に判定を変えたもの。

1. **証拠収集と判定を分けた。** 証拠は 4 並列で委譲し、判定は下流を辿ってから出した
2. **family の代表 1 件で一般化しなかった。** これで 2 箇所が分かれた。
   `no-pass-*` 12 件のうち `use-sidebar-feed-drag-state.ts:120` だけは「prop でない」という
   別の根拠になり、`rerender-lazy-ref-init` 2 件は ref が render 中に読まれるかどうかで
   remedy が変わった
3. **「remedy が効く」も検証した。** `useState(() => new Set(...))` は
   `no-derived-state` と交換になると推定していたが、実測では新規 finding 0 だった。
   推定のままなら accepted-risk と誤判定していた
4. **推論で止まっていた 1 件をテストで決めた。** `use-article-tag-picker-popover.ts:162` は
   「到達しない」推論と「テストが無い」事実が同時に立っていたので、テストを書いて到達性を固定した
5. **テストの緑を根拠にしなかった。** 3 件の fix はいずれも故障注入で検出力を確認し、
   `use-article-list-navigation.ts:27` については guard が作れないことを明記した

## 本 pass で追加すべきだった手順

独立レビューで棄却された 1 件と、その後の見直しで見つかった 11 件の根拠誤りは、
同じ原因から出ている。**scan が印字する 1 行メッセージを rule の主張と remedy の全体だと
扱った。**

`react-doctor rules explain <rule id>` は、rule の category、根拠にしている React docs の節、
remedy を印字する。これを引いていれば避けられた誤りが 3 種類あった。

- `prefer-use-sync-external-store`: メッセージは "stale **or** torn values" と 2 つの症状を
  並べており、片方（tearing）への反論では答えになっていなかった（棄却された 1 件）
- `no-pass-data-to-parent` / `no-pass-live-state-to-parent`: remedy は「所有者を上へ移す /
  hook から返す」で、初稿が当てていた 3 つ（render 中に導出 / `key` / イベント側で更新）は
  **別ルールの remedy** だった。remedy を論じた 11 件すべてで反論の相手を間違えていた
  （12 件目の `use-sidebar-feed-drag-state.ts:120` は rule が対象を取り違えている
  false-positive なので remedy の検討自体が無い）
- `no-adjust-state-on-prop-change`: remedy の記述が
  "Avoid tracking the previous prop in more state" と、`no-derived-state` の
  `use-subscriptions-index-state.ts:97` に使っていた「前 prop の tracker だから導出できない」
  という弁護をそのまま否定していた

**分類の前に、対象の rule id ごとに `rules explain` を引くこと。** メッセージだけで
remedy を推測しない。

## 独立レビューで棄却された判定

第 1 波にならい、棄却された内容も残す。本 pass は 21 判定のうち **1 件が棄却**され、
`.claude/rules/quality-policy.md` への追記 1 箇所が一般化しすぎと指摘された。
残り 20 判定は棄却なし。レビューは作成者と別 identity・別セッション（Codex `gpt-5.6-sol`,
effort high）で、SHA `473c3820254426710bf0f9c45bc50ed612fc2d36` を固定して実施した。

### 棄却 1: `prefer-use-sync-external-store` を accepted-risk とした判定

誤りは「読み手が 1 箇所なので tearing は起こり得ない」で止めたことだった。rule の主張は
"stale **or** torn values" の 2 つで、読み手の数は前者に効かない。初回 render 中の
`window.innerHeight` 読み取りと passive effect での購読開始の間に起きた resize を取り逃がす
問題は、読み手が 1 つでも残る。詳細と対応は「修正して finding を消した」の
`subscriptions-index-page.tsx:81` の項。

この誤りの形は第 1 波で 4 回踏んだものとは違う。family の代表で一般化したのではなく、
**rule のメッセージが並べている 2 つの主張のうち片方だけに反論して、全体を否定したものとして
扱った。** rule が複数の症状を挙げているときは、症状ごとに成否を分けて書く必要がある。

### 指摘 2: 件数差分の読み方を一般化しすぎていた

`quality-policy.md` に「disable を足した数だけ総数が減らなければ、別 rule が置き換わったものと
して扱う」と書いていた。短縮幅の不足は rule id の綴り違い、対象行の取り違え、コメント位置の
誤りなど **disable が不発だった場合にも起きる**ので、この書き方では設定ミスを shadowing と
誤診する。該当箇所は原因を 2 通り併記する形へ直した。

## 着地後の実測値（Phase B の再 pin 用）

worktree `quality/react-doctor-wave2-300` の本 pass 完了時点。plugin 0.9.14。

| 走査 | error | warning | files |
| --- | --- | --- | --- |
| 既定（inline disable を尊重） | 2 | 31 | 31 |
| `--no-respect-inline-disables`（audit） | 2 | 73 | 46 |

照合: 52（作業前）− 3（修正した finding）− 18（inline 記録を置いた finding）= **31**。
audit 側は 76（作業前の 52 + 第 1 波の disable 24）− 3（修正）= **73**。

残る warning 31 件の rule は `no-high-complexity-react-function` 25 /
`no-loading-flag-reset-outside-finally` 3 / `js-set-map-lookups` 1 /
`no-self-updating-effect` 1 / `prefer-html-dialog` 1 の 5 つだけで、**いずれも既に
disposition が記録されている family である**。したがって
`untriagedWarningCountAtScan` は 31 − 25 − 6 = **0** になる。

error 2 件は 2026-09-10 の pass で分類済み（false-positive 1 / test-only accepted-risk 1）。

audit との差 43 件が inline disable による抑制量である。`warningCount` 単独では
「直った」と「黙らせた」を区別できないので、再 pin では audit 側の数も併記する必要がある。

### Phase B（merge 後に main から実施）で必要な編集

1. `pluginVersion` を `0.9.14` へ
2. `scanSha` を merge 後の main の SHA へ（feature branch から取らない）
3. `classifiedWarningFamilies` の各 count を、その走査が実際に報告する件数へ揃える。
   `untriagedWarningCountAtScan` はこの合計から導出されるため、0 になった family の count を
   放置すると untriaged が実際より少なく出る（今回 `require-pnpm-hardening` で起きていた）。
   **entry 自体は消さない。** 消すと過去の決定が復元できなくなる
4. 第 2 波で判定した family を `classifiedWarningFamilies` へ追加する（count は 0）。
   対象: `no-pass-data-to-parent` / `no-pass-live-state-to-parent` / `no-derived-state` /
   `no-derived-state-effect` / `no-adjust-state-on-prop-change` / `no-giant-component` /
   `no-reset-all-state-on-prop-change` / `no-secrets-in-client-code`。
   `prefer-use-sync-external-store` と `rerender-lazy-ref-init` は移行・修正で消えたので
   family 追加は不要（`quality-policy.md` 側の記述を更新済み）
5. `pendingJudgmentWarningFamilies` の `rerender-lazy-ref-init` を外す（2 件とも修正済み）
6. audit mode の warning 数を pin する定数を足す（`warningCount` だけでは
   suppress 後の数しか残らないため）

## 関連

- Issue #300、親は Issue #249
- [react-doctor-warning-classification-249.md](./react-doctor-warning-classification-249.md)
- [../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md)
