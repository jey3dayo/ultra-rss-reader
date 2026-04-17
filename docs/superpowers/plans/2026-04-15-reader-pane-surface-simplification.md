# Reader Pane Surface Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Make the article reader pane feel flatter and quieter by removing the top card treatment, reordering the header to `date → title → source/author → image → body`, and preserving existing reader interactions.

Architecture: Keep the change entirely inside the existing reader presentation components. First lock the new hierarchy in Vitest, then flatten `ArticleReaderBody`, simplify `ArticleMetaView`, and lightly retune `ArticleContentView` so the new header and body read as one column.

Tech Stack: React 19, TypeScript, Tailwind utility classes, Vitest, Testing Library, Biome

---

## File Structure

- Modify: `src/components/reader/article-reader-body.tsx:69-111`
- Modify: `src/components/reader/article-meta-view.tsx:12-49`
- Modify: `src/components/reader/article-content-view.tsx:8-19`
- Modify: `src/__tests__/components/article-meta-view.test.tsx:7-52`
- Modify: `src/__tests__/components/article-content-view.test.tsx:7-53`
- Verify: `src/__tests__/components/article-view.test.tsx:130-220`

### Responsibility Split

- `article-reader-body.tsx`
  Own the one-column article layout, spacing rhythm, and where tags sit relative to header/content.
- `article-meta-view.tsx`
  Own the visual hierarchy for date, title, feed name, and author, plus the clickable affordances for title/feed.
- `article-content-view.tsx`
  Own the image wrapper and prose tone so the body matches the quieter header.
- `article-meta-view.test.tsx` / `article-content-view.test.tsx`
  Lock the intended hierarchy and surface treatment at the component level.
- `article-view.test.tsx`
  Re-run as the integration guard to confirm title clicks and sanitized content links still work after the layout refactor.

### Task 1: Lock the new header and content surface in tests

### Files

- Modify: `src/__tests__/components/article-meta-view.test.tsx:7-52`
- Modify: `src/__tests__/components/article-content-view.test.tsx:7-53`

- [ ] **Step 1: Rewrite the meta-view assertions to match the new hierarchy**

```tsx
it("renders a quieter header hierarchy with plain feed metadata", async () => {
  const user = userEvent.setup();
  const onTitleClick = vi.fn();
  const onTitleAuxClick = vi.fn();
  const onFeedClick = vi.fn();

  render(
    <ArticleMetaView
      title="First Article"
      author="Alice"
      feedName="Tech Blog"
      publishedLabel="Mar 25, 2026"
      onTitleClick={onTitleClick}
      onTitleAuxClick={onTitleAuxClick}
      onFeedClick={onFeedClick}
    />,
  );

  const heading = screen.getByRole("heading", { level: 1, name: "First Article" });
  const titleButton = screen.getByRole("button", { name: "First Article" });
  const feedButton = screen.getByRole("button", { name: "Tech Blog" });

  expect(screen.getByText("Mar 25, 2026")).toHaveClass("text-[0.72rem]");
  expect(heading).toHaveClass("text-[2rem]");
  expect(heading).toHaveClass("sm:text-[2.6rem]");
  expect(heading).toHaveClass("leading-[1.06]");
  expect(feedButton).not.toHaveClass("rounded-full");
  expect(feedButton).not.toHaveClass("border");
  expect(screen.getByText("Alice").parentElement).toHaveClass("text-sm");

  await user.click(titleButton);
  fireEvent(titleButton, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
  await user.click(feedButton);

  expect(onTitleClick).toHaveBeenCalledTimes(1);
  expect(onTitleAuxClick).toHaveBeenCalledTimes(1);
  expect(onFeedClick).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Rewrite the content-view assertions to lock the quieter image/body treatment**

```tsx
it("renders the thumbnail as article content instead of a card surface", () => {
  const { container } = render(
    <ArticleContentView
      thumbnailUrl="https://example.com/thumbnail.png"
      contentHtml="<p>Hello <strong>world</strong> <a href='https://example.com'>link</a></p>"
    />,
  );

  const image = screen.getByAltText("");
  const prose = container.querySelector(".prose");

  expect(image).toHaveAttribute("src", "https://example.com/thumbnail.png");
  expect(image.parentElement).toHaveClass("mb-10");
  expect(image.parentElement).toHaveClass("rounded-xl");
  expect(prose).toHaveClass("text-[1.02rem]");
  expect(prose).toHaveClass("leading-8");
});
```

- [ ] **Step 3: Run the focused Vitest files and confirm they fail on the old classes**

Run:

```bash
pnpm vitest run src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx
```

Expected:

```text
FAIL  src/__tests__/components/article-meta-view.test.tsx
FAIL  src/__tests__/components/article-content-view.test.tsx
AssertionError: expected element to have class "text-[0.72rem]"
AssertionError: expected element to have class "rounded-xl"
```

- [ ] **Step 4: Commit the test-only intent lock**

```bash
git add src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx
git commit -m "test: lock simplified reader pane hierarchy"
```

### Task 2: Flatten `ArticleReaderBody` into a single reading column

### Files

- Modify: `src/components/reader/article-reader-body.tsx:69-111`

- [ ] **Step 1: Replace the card wrapper with a plain one-column article shell**

```tsx
return (
  <ScrollArea data-testid="article-reader-scroll-area" className="h-full">
    <article className="mx-auto max-w-[44rem] px-7 pb-20 pt-14 md:px-11 md:pt-20">
      <div className="space-y-8">
        <ArticleMetaView
          title={article.title}
          author={article.author}
          feedName={feedName}
          publishedLabel={formatArticleDate(article.published_at, resolveArticleDateLocale(i18n.language))}
          onTitleClick={articleUrl ? (e) => openArticleUrl(articleUrl, e.metaKey, e.ctrlKey) : undefined}
          onTitleAuxClick={
            articleUrl
              ? (e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    void openArticleInExternalBrowser(articleUrl);
                  }
                }
              : undefined
          }
          onFeedClick={feedName ? () => selectFeed(article.feed_id) : undefined}
        />

        <div className="border-t border-border/35 pt-5">
          <ArticleTagChips articleId={article.id} />
        </div>

        <div ref={setContentContainerElement}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </div>
    </article>
  </ScrollArea>
);
```

- [ ] **Step 2: Keep the anchor interception logic untouched**

```tsx
useEffect(() => {
  const contentContainer = contentContainerElement;
  if (!contentContainer || !articleContentHtml) {
    return;
  }

  const anchors = Array.from(contentContainer.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  // keep the existing click interception exactly as-is
}, [articleContentHtml, contentContainerElement, openArticleUrl]);
```

- [ ] **Step 3: Run the article-view integration test to confirm title/content links still open externally**

Run:

```bash
pnpm vitest run src/__tests__/components/article-view.test.tsx
```

Expected:

```text
PASS  src/__tests__/components/article-view.test.tsx
```

- [ ] **Step 4: Commit the flattened reader-body shell**

```bash
git add src/components/reader/article-reader-body.tsx
git commit -m "refactor: flatten article reader body surface"
```

### Task 3: Simplify `ArticleMetaView` and retune `ArticleContentView`

### Files

- Modify: `src/components/reader/article-meta-view.tsx:12-49`
- Modify: `src/components/reader/article-content-view.tsx:8-19`
- Re-run: `src/__tests__/components/article-meta-view.test.tsx`
- Re-run: `src/__tests__/components/article-content-view.test.tsx`

- [ ] **Step 1: Rebuild the meta component around date, title, then plain feed/author text**

```tsx
return (
  <div className="space-y-5">
    <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
      {publishedLabel}
    </p>

    <h1 className="text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground sm:text-[2.6rem]">
      {onTitleClick ? (
        <button
          type="button"
          className="-mx-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-1 text-left transition-colors hover:bg-foreground/5"
          onClick={onTitleClick}
          onAuxClick={onTitleAuxClick}
        >
          {title}
        </button>
      ) : (
        title
      )}
    </h1>

    {(feedName || author) && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground/88">
        {feedName &&
          (onFeedClick ? (
            <button
              type="button"
              className="text-sm text-muted-foreground/88 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              onClick={onFeedClick}
            >
              {feedName}
            </button>
          ) : (
            <span>{feedName}</span>
          ))}
        {feedName && author ? <span aria-hidden="true" className="text-muted-foreground/45">/</span> : null}
        {author ? <p>{author}</p> : null}
      </div>
    )}
  </div>
);
```

- [ ] **Step 2: Retune the image wrapper and prose classes without changing HTML sanitization**

```tsx
return (
  <>
    {thumbnailUrl && (
      <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted/20">
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </div>
    )}
    <div
      className="prose prose-invert max-w-none text-[1.02rem] leading-8 text-foreground/88 prose-headings:text-foreground prose-strong:text-foreground"
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  </>
);
```

- [ ] **Step 3: Re-run the focused component tests and confirm they pass**

Run:

```bash
pnpm vitest run src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx
```

Expected:

```text
PASS  src/__tests__/components/article-meta-view.test.tsx
PASS  src/__tests__/components/article-content-view.test.tsx
```

- [ ] **Step 4: Commit the header/body presentation changes**

```bash
git add src/components/reader/article-meta-view.tsx src/components/reader/article-content-view.tsx
git commit -m "feat: simplify reader pane presentation"
```

### Task 4: Run integration and repo quality gates

### Files

- Verify: `src/__tests__/components/article-view.test.tsx:130-220`
- Modify only if failures point back to:
  - `src/components/reader/article-reader-body.tsx`
  - `src/components/reader/article-meta-view.tsx`
  - `src/components/reader/article-content-view.tsx`
  - `src/__tests__/components/article-meta-view.test.tsx`
  - `src/__tests__/components/article-content-view.test.tsx`

- [ ] **Step 1: Run the reader-focused Vitest batch**

```bash
pnpm vitest run \
  src/__tests__/components/article-meta-view.test.tsx \
  src/__tests__/components/article-content-view.test.tsx \
  src/__tests__/components/article-view.test.tsx
```

Expected:

```text
PASS  src/__tests__/components/article-meta-view.test.tsx
PASS  src/__tests__/components/article-content-view.test.tsx
PASS  src/__tests__/components/article-view.test.tsx
```

- [ ] **Step 2: If any assertion breaks, fix only the reader-pane files above and rerun the same command**

```bash
pnpm vitest run \
  src/__tests__/components/article-meta-view.test.tsx \
  src/__tests__/components/article-content-view.test.tsx \
  src/__tests__/components/article-view.test.tsx
```

Expected:

```text
All three files pass with no snapshot churn and no browser/open-link regression.
```

- [ ] **Step 3: Run the full project quality gate**

```bash
mise run check
```

Expected:

```text
format + lint + test complete with exit code 0
```

- [ ] **Step 4: Commit the verification pass if any follow-up fix was needed**

```bash
git add src/components/reader/article-reader-body.tsx src/components/reader/article-meta-view.tsx src/components/reader/article-content-view.tsx src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx
git commit -m "test: verify simplified reader pane"
```

## Self-Review

- Spec coverage:
  - Card removal, title-first ordering, thinner boundary treatment, plainer feed metadata, preserved interactions, quieter image/body styling, and edge-case-oriented verification are all covered.
- Placeholder scan:
  - No `TODO`, `TBD`, or deferred implementation markers remain.
- Type consistency:
  - The plan only touches existing prop names (`title`, `author`, `feedName`, `publishedLabel`, `thumbnailUrl`, `contentHtml`) and keeps the current click handlers unchanged.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-reader-pane-surface-simplification.md`.

Two execution options:

1. Subagent-Driven (recommended) - 実装時にタスクごとに分けて進める
2. Inline Execution - このセッションでそのまま順番に実装する

補足:

- 現在のワークツリーには unrelated な未コミット変更があるため、実装に入るなら dedicated worktree を使うか、ステージ対象を厳密に絞る前提で進める。
