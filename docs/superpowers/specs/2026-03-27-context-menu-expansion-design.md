# Context Menu Expansion Design

## Summary

Right-click context menus to add "Mark All as Read" functionality at feed, folder, and article list levels, plus per-article actions (Read/Unread, Star, Open in Browser).

## Background

Currently only feed items have a context menu (Open site, Unsubscribe, Edit). No context menus exist for folders, article list areas, or individual article items. The existing "Mark All as Read" is available via a header button and keyboard shortcut (`a`), but not via right-click.

## Design

### Two Categories of Context Menus

#### Category A: Per-Article Actions (Frontend-Only)

These operate on data already loaded in the UI. No backend changes needed.

#### 1. Article Item Context Menu (`article-context-menu.tsx` - new)

- Toggle Read / Unread — `markArticleRead(id, !read)`
- Toggle Star / Unstar — `toggleArticleStar(id, !starred)`
- Open in Browser — `openInBrowser(url)`
- Right-click does NOT change article selection state
- Wrap each article row with `ContextMenu.Root` / `ContextMenu.Trigger`

#### 2. Article List Context Menu (`article-list-context-menu.tsx` - new)

- Mark All as Read — reuse existing `handleMarkAllRead` logic from article-list
- Targets currently displayed/filtered articles (same as existing header button)
- Respects `ask_before_mark_all` preference
- Attach to article list background/empty area (not individual items)

#### Category B: Bulk Mark Read (Backend API Required)

The backend `list_articles` has a default `limit=50`. Frontend cache may not contain all unread articles for a feed/folder. Dedicated backend commands are needed for correctness.

#### 3. Feed Context Menu (modify existing `feed-context-menu.tsx`)

- Add "Mark All as Read" item before the separator
- Calls new backend command `mark_feed_read(feed_id)`
- Respects `ask_before_mark_all` preference
- New TypeScript wrapper: `markFeedRead(feedId)` in `tauri-commands.ts`

#### 4. Folder Context Menu (`folder-context-menu.tsx` - new)

- Mark All as Read — calls new backend command `mark_folder_read(folder_id)`
- Respects `ask_before_mark_all` preference
- New TypeScript wrapper: `markFolderRead(folderId)` in `tauri-commands.ts`

### Backend Changes

New Rust commands in `article_commands.rs`:

- `mark_feed_read(feed_id: String)` — SQL: `UPDATE articles SET read = 1 WHERE feed_id = ? AND read = 0`
- `mark_folder_read(folder_id: String)` — SQL: `UPDATE articles SET read = 1 WHERE feed_id IN (SELECT id FROM feeds WHERE folder_id = ?) AND read = 0`

New repository methods in `article.rs` trait + `sqlite_article.rs` implementation.

### Shared Styles

Extract common context menu class names as constants to avoid duplication across 4 menu components:

```typescript
// e.g., in a shared constants file or inline
export const contextMenuStyles = {
  popup:
    "min-w-[200px] rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none",
  item: "flex w-full cursor-default items-center rounded-md px-3 py-1.5 outline-none data-highlighted:bg-accent/20",
  separator: "my-1 h-px bg-border",
};
```

### DOM Composition

- Avoid nesting `<button>` inside `<button>`. Use `ContextMenu.Trigger` with `render` prop to compose with existing interactive elements (following feed-item.tsx pattern).
- Article list menu attaches to the scroll area background, not individual items.
- Article item menu and article list menu coexist: item menu on each row, list menu on empty/background area.

### Query Invalidation

After mark-read mutations, invalidate all relevant query keys:

- `["articles"]`, `["accountArticles"]`, `["feeds"]` (existing)
- `["articlesByTag"]`, `["search"]` (currently missing — fix as part of this work)

## Implementation Order

1. Article item context menu (frontend-only, lowest risk)
2. Article list context menu (frontend-only, reuses existing logic)
3. Backend API: `mark_feed_read` + `mark_folder_read`
4. Feed context menu: add "Mark All as Read"
5. Folder context menu: new component

## Accessibility

- No nested `<button>` elements
- Preserve article item `role` and focusability
- Maintain existing keyboard shortcut paths (no regression)
- Context menu is an additional access method, not a replacement

## Testing

- Right-click does not change article selection state
- Tag/search views reflect read/star updates after mutation
- `ask_before_mark_all` setting is respected in all mark-all-read paths
- Backend commands correctly mark all articles for feed/folder
- Query invalidation covers all view types

## Out of Scope

- Folder selection feature (exists in ui-store but unused in sidebar)
- Replacing `window.confirm` with app-internal dialog (defer unless UX issues arise)
- Additional menu items beyond the ones specified (Copy Link, etc.)
