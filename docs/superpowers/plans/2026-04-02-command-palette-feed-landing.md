# Command Palette Feed Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Make `@` feed selection in the command palette land on the first visible article for that feed and open browser view automatically when the feed resolves to widescreen mode.

Architecture: Keep the UI change limited to `CommandPalette`, but move the landing behavior into a reusable frontend intent. Use a pure helper to mirror article-list visibility/sort rules, then a hook that combines React Query cache access for both feeds and articles, feed display-mode resolution, and existing Zustand store actions.

Tech Stack: React 19, TypeScript, TanStack React Query, Zustand, Vitest, Testing Library, react-i18next

Spec: `docs/superpowers/specs/2026-04-02-command-palette-feed-landing-design.md`

---

## File Map

### New Files

| File | Responsibility |
| --- | --- |
| `src/lib/feed-landing.ts` | Pure feed-landing helpers: resolve the first visible article and decide reader vs browser landing |
| `src/hooks/use-feed-landing.ts` | Reusable landing intent that fetches feed articles through React Query and drives `useUiStore` actions |
| `src/__tests__/lib/feed-landing.test.ts` | Unit tests for landing helper behavior |
| `src/__tests__/hooks/use-feed-landing.test.tsx` | Integration tests for landing intent with React Query + Zustand |

### Modified Files

| File | Change |
| --- | --- |
| `src/components/reader/command-palette.tsx` | Replace direct `selectFeed()` with landing intent |
| `src/__tests__/components/command-palette.test.tsx` | Assert latest-visible-article landing instead of feed-only selection |
| `README.md` | Add short usage documentation for the new command palette behavior |

## Implementation Notes

- `selectFeed()` currently resets `viewMode` to `"unread"`, so the landing helper must select the first article that would actually remain visible after that reset.
- Reuse `resolveEffectiveDisplayMode()` from `src/lib/article-view.ts`.
- Reuse article-list visibility and sort rules via `selectVisibleArticles()` from `src/lib/article-list.ts` instead of inventing a separate “latest” definition.
- Let the hook reuse React Query cache when available, but fall back to `fetchQuery()` for feeds/articles so tests and future automation callers are not coupled to prior component renders.
- When the landing result is reader mode, call `closeBrowser()` after `selectArticle()` so stale `browserUrl` state is cleared.
- When there are no visible articles after the feed switch, stop at feed selection without forcing an article open.

## Task 1: Add Pure Feed-Landing Helpers

## Task 1 Files

- Create: `src/lib/feed-landing.ts`
- Test: `src/__tests__/lib/feed-landing.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { resolveFeedLandingArticle, resolveFeedLandingMode } from "@/lib/feed-landing";

const baseArticles: ArticleDto[] = [
  {
    id: "art-new",
    feed_id: "feed-1",
    title: "Newest unread",
    content_sanitized: "<p>new</p>",
    summary: null,
    url: "https://example.com/new",
    author: null,
    published_at: "2026-04-02T09:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-old",
    feed_id: "feed-1",
    title: "Older unread",
    content_sanitized: "<p>old</p>",
    summary: null,
    url: "https://example.com/old",
    author: null,
    published_at: "2026-04-01T09:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
];

describe("resolveFeedLandingArticle", () => {
  it("returns the first visible unread article using newest-first ordering", () => {
    expect(resolveFeedLandingArticle({ articles: baseArticles, sortUnread: "newest_first" })?.id).toBe("art-new");
  });

  it("returns null when the unread landing list would be empty", () => {
    const allRead = baseArticles.map((article) => ({ ...article, is_read: true }));
    expect(resolveFeedLandingArticle({ articles: allRead, sortUnread: "newest_first" })).toBeNull();
  });
});

describe("resolveFeedLandingMode", () => {
  it("uses browser mode for widescreen feeds with a URL", () => {
    expect(
      resolveFeedLandingMode({
        feedDisplayMode: "widescreen",
        defaultDisplayMode: "normal",
        articleUrl: "https://example.com/new",
      }),
    ).toBe("browser");
  });

  it("falls back to reader mode when the landing article has no URL", () => {
    expect(
      resolveFeedLandingMode({
        feedDisplayMode: "widescreen",
        defaultDisplayMode: "normal",
        articleUrl: null,
      }),
    ).toBe("reader");
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `pnpm vitest run src/__tests__/lib/feed-landing.test.ts`

Expected: FAIL because `@/lib/feed-landing` does not exist yet.

- [ ] **Step 3: Write the minimal helper implementation**

```ts
import type { ArticleDto } from "@/api/tauri-commands";
import { selectVisibleArticles } from "@/lib/article-list";
import { resolveEffectiveDisplayMode } from "@/lib/article-view";

export function resolveFeedLandingArticle(params: {
  articles: ArticleDto[];
  sortUnread: string;
}): ArticleDto | null {
  const visible = selectVisibleArticles({
    articles: params.articles,
    accountArticles: undefined,
    tagArticles: undefined,
    searchResults: undefined,
    feedId: "__feed_landing__",
    tagId: null,
    viewMode: "unread",
    showSearch: false,
    searchQuery: "",
    sortUnread: params.sortUnread,
    retainedArticleIds: new Set(),
  });

  return visible[0] ?? null;
}

export function resolveFeedLandingMode(params: {
  feedDisplayMode: string | null | undefined;
  defaultDisplayMode: string;
  articleUrl: string | null | undefined;
}): "reader" | "browser" {
  if (!params.articleUrl) {
    return "reader";
  }

  return resolveEffectiveDisplayMode(params.feedDisplayMode, params.defaultDisplayMode) === "widescreen"
    ? "browser"
    : "reader";
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `pnpm vitest run src/__tests__/lib/feed-landing.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the helper slice**

```bash
git add src/lib/feed-landing.ts src/__tests__/lib/feed-landing.test.ts
git commit -m "feat: add feed landing helpers"
```

## Task 2: Implement the Reusable Feed-Landing Intent

## Task 2 Files

- Create: `src/hooks/use-feed-landing.ts`
- Test: `src/__tests__/hooks/use-feed-landing.test.tsx`

- [ ] **Step 1: Write the failing hook tests**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("useFeedLanding", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({
      prefs: { reader_view: "normal", reading_sort: "newest_first" },
      loaded: true,
    });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        default:
          return undefined;
      }
    });
  });

  it("lands on the first visible article in reader mode for normal feeds", async () => {
    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("opens browser mode for widescreen feeds with a landing URL", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "widescreen" } : feed));
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("stops at feed selection when the landing list is empty", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles
            .filter((article) => article.feed_id === args.feedId)
            .map((article) => ({ ...article, is_read: true }));
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });
});
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run: `pnpm vitest run src/__tests__/hooks/use-feed-landing.test.tsx`

Expected: FAIL because `@/hooks/use-feed-landing` does not exist yet.

- [ ] **Step 3: Write the minimal hook implementation**

```ts
import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { listArticles, listFeeds } from "@/api/tauri-commands";
import { useFeeds } from "@/hooks/use-feeds";
import { resolveFeedLandingArticle, resolveFeedLandingMode } from "@/lib/feed-landing";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useFeedLanding() {
  const queryClient = useQueryClient();
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const readerView = usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "reader_view"));
  const sortUnread = usePreferencesStore((state) => state.prefs.reading_sort ?? state.prefs.sort_unread ?? "newest_first");

  return useCallback(
    async (feedId: string) => {
      if (!selectedAccountId) {
        return;
      }

      const feedList =
        feeds.length > 0
          ? feeds
          : await queryClient.fetchQuery({
              queryKey: ["feeds", selectedAccountId],
              queryFn: () => listFeeds(selectedAccountId).then(Result.unwrap),
            });

      const feed = feedList.find((candidate) => candidate.id === feedId);
      if (!feed) {
        return;
      }

      const store = useUiStore.getState();
      store.selectFeed(feedId);

      try {
        const articles = await queryClient.fetchQuery({
          queryKey: ["articles", feedId],
          queryFn: () => listArticles(feedId).then(Result.unwrap),
        });

        const landingArticle = resolveFeedLandingArticle({ articles, sortUnread });
        if (!landingArticle) {
          store.closeBrowser();
          return;
        }

        store.selectArticle(landingArticle.id);

        if (
          resolveFeedLandingMode({
            feedDisplayMode: feed.display_mode,
            defaultDisplayMode: readerView,
            articleUrl: landingArticle.url,
          }) === "browser"
        ) {
          store.openBrowser(landingArticle.url as string);
        } else {
          store.closeBrowser();
        }
      } catch (error) {
        console.error("Failed to land on feed article:", error);
      }
    },
    [feeds, queryClient, readerView, selectedAccountId, sortUnread],
  );
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run: `pnpm vitest run src/__tests__/hooks/use-feed-landing.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the hook slice**

```bash
git add src/hooks/use-feed-landing.ts src/__tests__/hooks/use-feed-landing.test.tsx
git commit -m "feat: add reusable feed landing intent"
```

## Task 3: Wire Command Palette Into the Landing Intent

## Task 3 Files

- Modify: `src/components/reader/command-palette.tsx`
- Modify: `src/__tests__/components/command-palette.test.tsx`

- [ ] **Step 1: Update the command-palette test to expect landing behavior**

```tsx
it("selecting a feed lands on the first visible article and closes the palette", async () => {
  const user = userEvent.setup();
  render(<CommandPalette />, { wrapper: createWrapper() });

  const input = await screen.findByPlaceholderText("Search commands…");
  await user.type(input, "@Tech");
  await user.click(await screen.findByRole("option", { name: /Tech Blog/ }));

  await waitFor(() => {
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    expect(useUiStore.getState().selectedArticleId).toBe("art-1");
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run the command-palette test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/command-palette.test.tsx`

Expected: FAIL because the palette still performs a feed-only selection.

- [ ] **Step 3: Replace direct feed selection with the landing intent**

```tsx
import { useFeedLanding } from "@/hooks/use-feed-landing";

export function CommandPalette() {
  const openFeedLanding = useFeedLanding();
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);

  function handleFeedSelect(feedId: string) {
    addToHistory(`${HISTORY_PREFIX.feed}${feedId}`);
    void openFeedLanding(feedId);
    closeCommandPalette();
  }
}
```

Keep action, tag, and article behavior unchanged.

- [ ] **Step 4: Run the command-palette test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/command-palette.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the palette integration**

```bash
git add src/components/reader/command-palette.tsx src/__tests__/components/command-palette.test.tsx
git commit -m "feat: land command palette feed picks on latest article"
```

## Task 4: Document the New Usage and Run Verification

## Task 4 Files

- Modify: `README.md`

- [ ] **Step 1: Add a short usage section to the README**

Add a small subsection near the feature/usage documentation:

```md
## Command Palette Feed Landing

- Press `Cmd+K` / `Ctrl+K` to open the command palette
- Type `@` to search subscriptions
- Press `Enter` on a feed to jump to its first visible article
- Feeds in `3-Pane` mode land in the reader
- Feeds in `Widescreen` mode land in browser view
- If a feed has no visible unread articles, the app stops at the feed list instead of forcing an article open
```

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run src/__tests__/lib/feed-landing.test.ts src/__tests__/hooks/use-feed-landing.test.tsx src/__tests__/components/command-palette.test.tsx`

Expected: PASS

- [ ] **Step 3: Run the project check gate**

Run: `mise run check`

Expected: format, lint, and tests all pass.

- [ ] **Step 4: Commit the docs + verification-ready state**

```bash
git add README.md
git commit -m "docs: describe command palette feed landing"
```
