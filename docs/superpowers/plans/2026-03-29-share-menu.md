# Share Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 記事詳細ペインのツールバーに Base UI Menu による共有ポップオーバーメニューを追加する

Architecture: 既存の `ArticleToolbar` に Base UI `Menu` コンポーネントを追加。メニュー項目は既存の Tauri コマンド（`copyToClipboard`, `addToReadingList`, `openInBrowser`）を呼び出す。メール共有は `mailto:` URL を組み立てて `openInBrowser` で開く。表示/非表示は preferences の `action_share_menu` フラグで制御。

Tech Stack: Base UI React (`@base-ui/react/menu`), lucide-react, i18next, Zustand (preferences)

Spec: `docs/superpowers/specs/2026-03-29-share-menu-design.md`

---

## Task 1: i18n キーの追加

### Files:

- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] **Step 1: reader.json (en) にキーを追加**

`"open_in_external_browser"` の後に以下を追加:

```json
"share": "Share",
"share_via_email": "Share via Email",
"added_to_reading_list": "Added to Reading List",
"add_to_reading_list": "Add to Reading List",
```

- [ ] **Step 2: reader.json (ja) にキーを追加**

同じ位置に以下を追加:

```json
"share": "共有",
"share_via_email": "メールで共有",
"added_to_reading_list": "リーディングリストに追加しました",
"add_to_reading_list": "リーディングリストに追加",
```

- [ ] **Step 3: settings.json (en) にキーを追加**

`actions` セクション内の `"open_in_external_browser"` の後に追加:

```json
"share_menu": "Share Menu"
```

- [ ] **Step 4: settings.json (ja) にキーを追加**

同じ位置に追加:

```json
"share_menu": "共有メニュー"
```

- [ ] **Step 5: コミット**

```bash
git add src/locales/en/reader.json src/locales/ja/reader.json src/locales/en/settings.json src/locales/ja/settings.json
git commit -m "feat: add i18n keys for share menu"
```

---

## Task 2: preferences に `action_share_menu` を追加

### Files:

- Modify: `src/stores/preferences-store.ts`

- [ ] **Step 1: `preferenceSchemas` に `action_share_menu` を追加**

`src/stores/preferences-store.ts` の `preferenceSchemas` オブジェクト内、`action_share: booleanStringSchema,` の直後に追加:

```typescript
action_share_menu: booleanStringSchema,
```

- [ ] **Step 2: `corePreferenceDefaults` にデフォルト値を追加**

`action_share: "true",` の直後に追加:

```typescript
action_share_menu: "true",
```

- [ ] **Step 3: 型チェック実行**

Run: `rtk tsc`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/stores/preferences-store.ts
git commit -m "feat: add action_share_menu preference"
```

---

## Task 3: 共有メニューコンポーネントの実装

### Files:

- Modify: `src/components/reader/article-view.tsx`

- [ ] **Step 1: import を追加**

`article-view.tsx` の先頭に以下の import を追加:

```typescript
import { Menu } from "@base-ui/react/menu";
```

lucide-react の import に `BookmarkPlus`, `Mail`, `Share` を追加:

```typescript
import {
  ArrowLeft,
  BookmarkPlus,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  Plus,
  Share,
  X,
} from "lucide-react";
```

既存 import に `contextMenuStyles` を追加:

```typescript
import { contextMenuStyles } from "./context-menu-styles";
```

- [ ] **Step 2: `ArticleToolbar` 内に共有メニューを追加**

`actionShare === "true"` ブロック（`</AppTooltip>` 閉じタグ）の直後、`</TooltipProvider>` の直前に以下を追加:

```tsx
{
  resolvePreferenceValue(
    usePreferencesStore.getState().prefs,
    "action_share_menu",
  ) === "true" && (
    <Menu.Root>
      <AppTooltip
        label={t("share")}
        children={
          <Menu.Trigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                disabled={!article?.url}
                aria-label={t("share")}
              />
            }
          >
            <Share className="h-4 w-4" />
          </Menu.Trigger>
        }
      />
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className={contextMenuStyles.popup}>
            <Menu.Item
              className={contextMenuStyles.item}
              onClick={() => {
                if (!article?.url) return;
                void copyToClipboard(article.url).then((result) =>
                  Result.pipe(
                    result,
                    Result.inspect(() => showToast(t("link_copied"))),
                    Result.inspectError((e) => {
                      console.error("Copy failed:", e);
                      showToast(e.message);
                    }),
                  ),
                );
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t("copy_link")}
            </Menu.Item>
            <Menu.Item
              className={contextMenuStyles.item}
              onClick={() => {
                if (!article?.url) return;
                void addToReadingList(article.url).then((result) =>
                  Result.pipe(
                    result,
                    Result.inspect(() => showToast(t("added_to_reading_list"))),
                    Result.inspectError((e) => {
                      console.error("Add to reading list failed:", e);
                      showToast(e.message);
                    }),
                  ),
                );
              }}
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              {t("add_to_reading_list")}
            </Menu.Item>
            <Menu.Separator className={contextMenuStyles.separator} />
            <Menu.Item
              className={contextMenuStyles.item}
              onClick={() => {
                if (!article?.url) return;
                const subject = encodeURIComponent(article.title);
                const body = encodeURIComponent(article.url);
                void openInBrowser(`mailto:?subject=${subject}&body=${body}`);
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              {t("share_via_email")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

### 注意点:

- `resolvePreferenceValue` は既に import 済み
- `copyToClipboard`, `addToReadingList`, `openInBrowser` は既に import 済み
- `contextMenuStyles` は `article-context-menu.tsx` と同じパスからの import
- `article.title` は `ArticleDto` の必須フィールド

- [ ] **Step 3: preference を Zustand セレクタに変更**

Step 2 で `usePreferencesStore.getState()` を直接呼んでいる部分を、既存パターンに合わせてコンポーネント上部のセレクタに変更:

`actionShare` の定義の直後に追加:

```typescript
const actionShareMenu = usePreferencesStore((s) =>
  resolvePreferenceValue(s.prefs, "action_share_menu"),
);
```

Step 2 の条件を `actionShareMenu === "true"` に変更。

- [ ] **Step 4: 型チェック + lint 実行**

Run: `rtk tsc && rtk lint`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/reader/article-view.tsx
git commit -m "feat: add share menu to article toolbar"
```

---

## Task 4: Settings に共有メニュートグルを追加

### Files:

- Modify: `src/components/settings/actions-settings.tsx`

- [ ] **Step 1: import に `Share` アイコンを追加**

```typescript
import { Copy, ExternalLink, Globe, Share } from "lucide-react";
```

- [ ] **Step 2: `serviceEntries` 配列に共有メニューの項目を追加**

`action_share` エントリの後に追加:

```typescript
{
  label: t("actions.share_menu"),
  prefKey: "action_share_menu",
  icon: <Share className="h-5 w-5" />,
},
```

- [ ] **Step 3: 型チェック + lint 実行**

Run: `rtk tsc && rtk lint`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/settings/actions-settings.tsx
git commit -m "feat: add share menu toggle to actions settings"
```

---

## Task 5: テストの追加

### Files:

- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: 共有メニューボタンの表示テストを追加**

既存テストファイルの末尾（最後の `});` の前）に追加:

```typescript
it("renders the share menu button when an article is selected", async () => {
  useUiStore.getState().selectAccount("acc-1");
  useUiStore.getState().selectFeed("feed-1");
  useUiStore.getState().selectArticle("art-1");

  render(<ArticleView />, { wrapper: createWrapper() });

  const shareButton = await screen.findByRole("button", { name: "Share" });
  expect(shareButton).toBeInTheDocument();
  expect(shareButton).toBeEnabled();
});

it("disables the share menu button when no article is selected", async () => {
  useUiStore.getState().selectAccount("acc-1");
  useUiStore.getState().selectFeed("feed-1");

  render(<ArticleView />, { wrapper: createWrapper() });

  await waitFor(() => {
    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(shareButton).toBeDisabled();
  });
});

it("hides the share menu button when action_share_menu preference is false", async () => {
  usePreferencesStore.setState({ prefs: { action_share_menu: "false" }, loaded: true });
  useUiStore.getState().selectAccount("acc-1");
  useUiStore.getState().selectFeed("feed-1");
  useUiStore.getState().selectArticle("art-1");

  render(<ArticleView />, { wrapper: createWrapper() });

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト実行**

Run: `rtk vitest run src/__tests__/components/article-view.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/__tests__/components/article-view.test.tsx
git commit -m "test: add share menu button tests"
```

---

## Task 6: 全体品質チェック

- [ ] **Step 1: フォーマッター実行**

Run: `rtk mise run format`

- [ ] **Step 2: lint + 型チェック + テスト**

Run: `rtk mise run check`
Expected: 全 PASS

- [ ] **Step 3: 必要なら修正してコミット**

修正があれば:

```bash
git add -u
git commit -m "fix: address lint/format issues in share menu"
```
