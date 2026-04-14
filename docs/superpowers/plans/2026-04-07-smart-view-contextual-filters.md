# Smart View Contextual Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: スマートビュー `未読` / `スター` の役割を整理し、`未読` では余計なフィルタを消し、`スター` では `未読 / すべて` だけを補助条件として扱えるようにする

Architecture: sidebar の smart view は「起点ビュー」、article list footer は「起点に応じて変化する補助条件」として再定義する。`selection.type === "smart"` を起点判定に使い、一覧のデータ選択は `selection.kind` と `viewMode` の組み合わせから導出し、記事一覧ヘッダー直下に非インタラクティブな context strip を追加して現在地を一箇所に集約する。

Tech Stack: React 19, TypeScript, Zustand, TanStack Query, Vitest, Testing Library, Tauri command mocks

Spec: `docs/superpowers/specs/2026-04-07-smart-view-contextual-filters-design.md`

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `src/stores/ui-store.ts` | smart view 選択時の初期 `viewMode` を新ルールに合わせて調整する |
| Modify | `src/lib/article-list.ts` | smart view 起点と footer 条件を反映した article filtering へ拡張する |
| Modify | `src/components/reader/article-list.tsx` | smart view 状態の導出、footer option set 切り替え、context strip 配置を行う |
| Modify | `src/components/reader/article-list-footer.tsx` | 固定 3 択をやめ、動的 option set を描画できるようにする |
| Create | `src/components/reader/article-list-context-strip.tsx` | 現在地を `主ピル + 副ピル` で表示する非インタラクティブな帯 |
| Modify | `src/__tests__/stores/ui-store.test.ts` | smart view 選択時の `viewMode` 初期値を固定する |
| Modify | `src/__tests__/lib/article-list.test.ts` | starred smart view + `unread/all` の filtering ルールを固定する |
| Modify | `src/__tests__/components/article-list.test.tsx` | footer option set と context strip 表示を検証する |
| Modify | `src/__tests__/components/sidebar.test.tsx` | sidebar smart view selection と downstream 表示の整合を確認する |
| Create | `src/__tests__/components/article-list-context-strip.test.tsx` | context strip の表示組み合わせを確認する |

## Notes Before Editing

- 既存の未コミット変更 (`src/__tests__/components/sidebar.test.tsx` ほか) を巻き戻さないこと。差分をよく読んで、この feature の追加分だけを重ねること。
- `selectSmartView("starred")` は現状 `viewMode = "starred"` をセットしているが、今回の方針では `スター` は起点であり、footer 条件の初期値は `all` にする。
- `viewMode = "starred"` を他の feed / folder / all 画面で使っている可能性があるため、「smart view のときだけ意味が変わる」ではなく、一覧データの選び方を `selection.kind` 側に寄せること。
- `reader.json` にはすでに `filter_unread` / `filter_all` / `filter_starred` がある。まずは既存ラベルを再利用し、新しい i18n key は必要最小限にする。

---

## Task 1: Smart view の state semantics を先に固定する

## Task 1 Files

- Modify: `src/stores/ui-store.ts`
- Test: `src/__tests__/stores/ui-store.test.ts`

- [ ] **Step 1: `starred` smart view の初期状態を表す失敗テストを書く**

`src/__tests__/stores/ui-store.test.ts` に追加:

```ts
it("selectSmartView('starred') keeps starred as the selection source and defaults the footer mode to all", () => {
  useUiStore.getState().selectSmartView("starred");

  expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
  expect(useUiStore.getState().viewMode).toBe("all");
});

it("selectSmartView('unread') keeps unread as a complete smart view without footer filtering", () => {
  useUiStore.getState().selectSmartView("unread");

  expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
  expect(useUiStore.getState().viewMode).toBe("unread");
});
```

- [ ] **Step 2: store テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/stores/ui-store.test.ts`

Expected: FAIL because `selectSmartView("starred")` currently sets `viewMode` to `"starred"`.

- [ ] **Step 3: `selectSmartView` の最小実装を更新する**

`src/stores/ui-store.ts` を更新:

```ts
selectSmartView: (kind) =>
  set({
    selection: { type: "smart", kind },
    viewMode: kind === "starred" ? "all" : "unread",
    selectedArticleId: null,
    contentMode: "empty",
    focusedPane: "list",
    recentlyReadIds: new Set(),
    retainedArticleIds: new Set(),
  }),
```

ポイント:

- `unread` smart view は従来どおり `viewMode = "unread"`
- `starred` smart view は「起点 = starred」「footer 初期条件 = all」という意味に切り替える
- 既存の `setViewMode("starred")` はまだ残してよいが、smart view 選択の初期値では使わない

- [ ] **Step 4: store テストを再実行して通す**

Run: `pnpm vitest run src/__tests__/stores/ui-store.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/stores/ui-store.ts src/__tests__/stores/ui-store.test.ts
git commit -m "feat: redefine smart view default modes"
```

---

## Task 2: article filtering を smart view 起点で表現できるようにする

## Task 2 Files

- Modify: `src/lib/article-list.ts`
- Test: `src/__tests__/lib/article-list.test.ts`

- [ ] **Step 1: starred smart view の filtering 失敗テストを書く**

`src/__tests__/lib/article-list.test.ts` に追加:

```ts
it("shows all starred articles when starred smart view uses all footer mode", () => {
  const result = selectVisibleArticles({
    articles: undefined,
    accountArticles: [
      { ...sampleArticles[0], id: "starred-read", is_starred: true, is_read: true },
      { ...sampleArticles[1], id: "starred-unread", is_starred: true, is_read: false },
      { ...sampleArticles[2], id: "plain-unread", is_starred: false, is_read: false },
    ],
    tagArticles: undefined,
    searchResults: undefined,
    feedId: null,
    tagId: null,
    folderFeedIds: null,
    smartViewKind: "starred",
    viewMode: "all",
    showSearch: false,
    searchQuery: "",
    sortUnread: "newest_first",
    retainedArticleIds: new Set(),
  });

  expect(result.map((article) => article.id)).toEqual(["starred-unread", "starred-read"]);
});

it("shows only unread starred articles when starred smart view uses unread footer mode", () => {
  const result = selectVisibleArticles({
    articles: undefined,
    accountArticles: [
      { ...sampleArticles[0], id: "starred-read", is_starred: true, is_read: true },
      { ...sampleArticles[1], id: "starred-unread", is_starred: true, is_read: false },
      { ...sampleArticles[2], id: "plain-unread", is_starred: false, is_read: false },
    ],
    tagArticles: undefined,
    searchResults: undefined,
    feedId: null,
    tagId: null,
    folderFeedIds: null,
    smartViewKind: "starred",
    viewMode: "unread",
    showSearch: false,
    searchQuery: "",
    sortUnread: "newest_first",
    retainedArticleIds: new Set(),
  });

  expect(result.map((article) => article.id)).toEqual(["starred-unread"]);
});
```

- [ ] **Step 2: helper テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/lib/article-list.test.ts`

Expected: FAIL because `selectVisibleArticles(...)` cannot distinguish smart view `starred` from normal `viewMode = "all"`.

- [ ] **Step 3: `selectVisibleArticles(...)` に smart view 起点を追加する**

`src/lib/article-list.ts` を更新:

```ts
type SelectVisibleArticlesParams = {
  // existing fields...
  smartViewKind?: "unread" | "starred" | null;
};
```

filtering ルールを更新:

```ts
const all = filterByFolderFeedIds(feedId ? (articles ?? []) : (accountArticles ?? []), folderFeedIds);

if (smartViewKind === "starred") {
  const starred = all.filter((article) => article.is_starred || retainedArticleIds?.has(article.id));
  list = viewMode === "unread" ? starred.filter((article) => !article.is_read || retainedArticleIds?.has(article.id)) : starred;
} else if (viewMode === "unread") {
  list = all.filter((article) => !article.is_read || retainedArticleIds?.has(article.id));
} else if (viewMode === "starred") {
  list = all.filter((article) => article.is_starred || retainedArticleIds?.has(article.id));
} else {
  list = [...all];
}
```

ポイント:

- `smartViewKind === "starred"` を最優先する
- feed / folder / all 画面の既存 `viewMode === "starred"` は壊さない
- `retainedArticleIds` の扱いは現状の read/star toggle UX を維持する

- [ ] **Step 4: helper テストを再実行して通す**

Run: `pnpm vitest run src/__tests__/lib/article-list.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/article-list.ts src/__tests__/lib/article-list.test.ts
git commit -m "feat: support contextual smart view filtering"
```

---

## Task 3: Footer を動的 option set にし、context strip を追加する

## Task 3 Files

- Create: `src/components/reader/article-list-context-strip.tsx`
- Modify: `src/components/reader/article-list-footer.tsx`
- Modify: `src/components/reader/article-list.tsx`
- Test: `src/__tests__/components/article-list-context-strip.test.tsx`
- Test: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: context strip の見た目テストを書く**

`src/__tests__/components/article-list-context-strip.test.tsx` を新規作成:

```tsx
it("renders a single primary pill for unread smart view", () => {
  render(<ArticleListContextStrip primaryLabel="未読" secondaryLabel={null} />);

  expect(screen.getByText("未読")).toBeInTheDocument();
  expect(screen.queryByText("すべて")).not.toBeInTheDocument();
});

it("renders primary and secondary pills for starred smart view", () => {
  render(<ArticleListContextStrip primaryLabel="スター" secondaryLabel="未読" />);

  expect(screen.getByText("スター")).toBeInTheDocument();
  expect(screen.getByText("未読")).toBeInTheDocument();
});
```

- [ ] **Step 2: article list の失敗テストを書く**

`src/__tests__/components/article-list.test.tsx` に追加:

```tsx
it("hides the footer filter in unread smart view and shows an unread context strip", async () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "smart", kind: "unread" },
    viewMode: "unread",
  });

  render(<ArticleList />, { wrapper: createWrapper() });

  expect(await screen.findByText("未読")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "すべて" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "スター" })).not.toBeInTheDocument();
});

it("shows only unread and all footer options in starred smart view", async () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "smart", kind: "starred" },
    viewMode: "all",
  });

  render(<ArticleList />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: "未読" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "すべて" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "スター" })).not.toBeInTheDocument();
  expect(screen.getByText("スター")).toBeInTheDocument();
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/article-list-context-strip.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: FAIL because the component does not exist and the footer is still fixed 3 択.

- [ ] **Step 4: `ArticleListContextStrip` を最小実装する**

`src/components/reader/article-list-context-strip.tsx` を作成:

```tsx
type ArticleListContextStripProps = {
  primaryLabel: string;
  secondaryLabel: string | null;
};

export function ArticleListContextStrip({ primaryLabel, secondaryLabel }: ArticleListContextStripProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2">
      <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-foreground">
        {primaryLabel}
      </span>
      {secondaryLabel ? (
        <span className="rounded-full border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {secondaryLabel}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: footer component を動的 option set へ変える**

`src/components/reader/article-list-footer.tsx` を更新:

```tsx
type FooterOption = { value: "all" | "unread" | "starred"; labelKey: "filter_all" | "filter_unread" | "filter_starred"; icon: "list" | "star" | "unread" };

type ArticleListFooterProps = {
  viewMode: ViewMode;
  options: FooterOption[];
  onSetViewMode: (mode: ViewMode) => void;
};
```

描画は `options.map(...)` に差し替える。

- [ ] **Step 6: article list 側で smart view に応じた option set と context labels を導出する**

`src/components/reader/article-list.tsx` を更新:

```tsx
const smartViewKind = selection.type === "smart" ? selection.kind : null;

const footerOptions = useMemo(() => {
  if (smartViewKind === "unread") return [];
  if (smartViewKind === "starred") {
    return [
      { value: "unread", icon: "unread", labelKey: "filter_unread" },
      { value: "all", icon: "list", labelKey: "filter_all" },
    ] as const;
  }

  return [
    { value: "unread", icon: "unread", labelKey: "filter_unread" },
    { value: "all", icon: "list", labelKey: "filter_all" },
    { value: "starred", icon: "star", labelKey: "filter_starred" },
  ] as const;
}, [smartViewKind]);

const contextStrip = useMemo(() => {
  if (smartViewKind === "unread") return { primary: t("filter_unread"), secondary: null };
  if (smartViewKind === "starred") {
    return { primary: t("filter_starred"), secondary: viewMode === "unread" ? t("filter_unread") : t("filter_all") };
  }
  return null;
}, [smartViewKind, t, viewMode]);
```

JSX に追加:

```tsx
{contextStrip ? (
  <ArticleListContextStrip primaryLabel={contextStrip.primary} secondaryLabel={contextStrip.secondary} />
) : null}
```

footer は options があるときだけ表示:

```tsx
{footerOptions.length > 0 ? <ArticleListFooter viewMode={viewMode} options={footerOptions} onSetViewMode={setViewMode} /> : null}
```

- [ ] **Step 7: focused component tests を再実行して通す**

Run: `pnpm vitest run src/__tests__/components/article-list-context-strip.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: PASS

- [ ] **Step 8: コミットする**

```bash
git add src/components/reader/article-list-context-strip.tsx src/components/reader/article-list-footer.tsx src/components/reader/article-list.tsx src/__tests__/components/article-list-context-strip.test.tsx src/__tests__/components/article-list.test.tsx
git commit -m "feat: add contextual smart view chrome"
```

---

## Task 4: Sidebar と一覧の組み合わせを回帰テストで固定する

## Task 4 Files

- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: sidebar 起点と一覧の組み合わせテストを書く**

`src/__tests__/components/sidebar.test.tsx` に追加:

```tsx
it("selects starred smart view with all-mode semantics so the article list can show all starred items", async () => {
  render(<Sidebar />, { wrapper: createWrapper() });

  const starredButton = await screen.findByRole("button", { name: /Starred|スター/ });
  await userEvent.setup().click(starredButton);

  expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
  expect(useUiStore.getState().viewMode).toBe("all");
});
```

- [ ] **Step 2: 関連コンポーネントテストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: FAIL if the old smart-view semantics are still leaking into tests or UI.

- [ ] **Step 3: 必要なテスト期待値を最小修正する**

確認ポイント:

- `selection.kind === "starred"` のときだけ footer 2 択になる
- `selection.kind === "unread"` のとき footer が消える
- sidebar 自体の選択見た目は従来どおり

- [ ] **Step 4: 関連コンポーネントテストを再実行して通す**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/components/article-list.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/__tests__/components/sidebar.test.tsx src/__tests__/components/article-list.test.tsx
git commit -m "test: cover smart view contextual filter behavior"
```

---

## Task 5: Feature 全体を検証する

## Task 5 Files

- Modify: なし

- [ ] **Step 1: この feature の focused test suite をまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/stores/ui-store.test.ts src/__tests__/lib/article-list.test.ts src/__tests__/components/article-list-context-strip.test.tsx src/__tests__/components/article-list.test.tsx src/__tests__/components/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 3: リポジトリ標準チェックを実行する**

Run: `mise run check`

Expected: PASS

- [ ] **Step 4: ブラウザ開発モードで手動確認する**

Run: `mise run app:dev:browser`

確認項目:

- sidebar `未読` 選択時、footer は出ず context strip だけが見える
- sidebar `スター` 選択時、footer は `未読 / すべて` の 2 択だけになる
- `スター + 未読` で starred unread のみが表示される
- `スター + すべて` に戻すと既読スターも見える
- feed / folder / all 画面の既存 `未読 / すべて / スター` 切替が壊れていない
- 記事からスターを外したとき、既存 retain UX が破綻していない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- smart view ごとの新しい振る舞い
- 実行したテスト/検証コマンド
- 手動確認結果
- 既存 `viewMode = "starred"` を今後整理する余地があれば、その旨
