# Reader Keyboard Navigation

This document is the source of truth for reader pane keyboard navigation. Keep it aligned with the implementation when changing pane focus, row selection, or keyboard shortcuts.

## Scope

The reader has four navigation surfaces:

- Account pane
- Sidebar pane
- Article list pane
- Article content pane

The general rule is:

- `ArrowLeft` and `ArrowRight` move between panes or commit a focused pane item.
- `ArrowUp` and `ArrowDown` move within the currently focused pane.
- `Enter` commits the currently focused row when that pane has row-style choices.
- `Escape` closes transient UI and returns to the stable pane context.

## Ownership

Keep pane-local behavior close to the pane component. Use the global keyboard hook only for cross-pane fallback and browser-level focus recovery.

- Account pane local handler: `src/components/reader/account-pane.tsx`
- Account pane shared helpers: `src/lib/account/account-pane-navigation.ts`
- Sidebar pane local handler: `src/components/reader/sidebar.tsx`
- Article list local handler: `src/components/reader/hooks/article-list/use-article-list-keydown-handler.ts`
- Article content fallback handling: `src/hooks/use-keyboard.ts`
- Focus target helpers: `src/lib/reader-focus.ts`

## Account Pane

The account pane is transient. It appears to the left of the sidebar in non-mobile layouts.

| Key | Behavior |
| --- | --- |
| `ArrowUp` | Move focus to the previous account row. Wrap at the top. |
| `ArrowDown` | Move focus to the next account row. Wrap at the bottom. |
| `Enter` | Select the focused account, close the account pane, and focus the sidebar unread smart view. |
| `ArrowRight` | Same as `Enter`. Treat it as commit, not merely close. |
| `Escape` | Close the account pane without changing account selection, then focus the current sidebar selection. |

The account pane must not open the account switcher popover in non-mobile layouts. The popover remains a mobile behavior.

## Sidebar Pane

The sidebar contains smart views, subscription folders/feeds, and tags. It owns row selection for these items.

| Key | Behavior |
| --- | --- |
| `ArrowUp` | Move to the previous visible sidebar navigation target and activate it. |
| `ArrowDown` | Move to the next visible sidebar navigation target and activate it. |
| `ArrowLeft` | Open the account pane and focus the selected account row. |
| `ArrowRight` | Move focus to the article list. Focus the selected article row when present; otherwise focus the first readable row/list target. |

Section disclosure headers such as Subscriptions and Tags may receive focus, but they should use tonal background focus. They must not show the orange ring style used by general form controls.

## Article List Pane

The article list owns article-row navigation and article selection.

| Key | Behavior |
| --- | --- |
| `ArrowUp` | Move to the previous article row. |
| `ArrowDown` | Move to the next article row. |
| `ArrowLeft` | Open/focus the sidebar and focus the current sidebar selection. |
| `ArrowRight` | Select the focused article row when needed, then focus article content. |

Global shortcuts can still apply when the event is not one of the pane-owned arrow keys.

When the selected smart view is `recent`, article selection must not record the selected article back into recently viewed history. The list order should stay stable while the user moves with `ArrowUp` and `ArrowDown`.

## Article Content Pane

Article content is not a row list. It should prioritize content reading, scrolling, and article-local controls.

| Key | Behavior |
| --- | --- |
| `ArrowLeft` | Return to the article list when the article content pane is focused. |
| `ArrowUp` | Reserved for content scroll or focused article-local controls. Do not move the article list selection. |
| `ArrowDown` | Reserved for content scroll or focused article-local controls. Do not move the article list selection. |

When `ArrowLeft` originates from an article-list row while the app state still says content is focused, route back to the sidebar. This preserves the leftward chain from article content to article list to sidebar.

## Visual Focus Contract

Pane rows use two separate concepts:

- Selected item: the app state context.
- Active pane focus: the current keyboard operation target.

Selected rows should remain visible when focus moves away from their pane. Active rows should be stronger than inactive selected rows, but focus should be expressed with tonal background changes instead of orange outline rings.

Rules:

- Account rows, sidebar rows, and article rows may use a thin contextual indicator line.
- Focus-only states use subtle gray or tonal backgrounds.
- Section headers and footer tabs use gray/tonal backgrounds for keyboard focus.
- Avoid `focus-visible:ring-ring/*` for reader navigation rows, section headers, and footer tabs.
- Keep orange or primary rings for form controls and dialog controls where a conventional focus ring is still appropriate.

## Screen Reader Action Labels

Dialog and row action labels must carry the same target and recovery meaning that sighted users get from nearby text.

Destructive dialog contract:

- Delete account, delete feed, delete tag, and clear history dialogs must include the target name in the accessible name for the primary destructive action when a target is known.
- The destructive action's accessible name or description must include that the operation cannot be undone.
- Loading labels must preserve the target and destructive meaning. Do not collapse to a generic "Deleting" label.
- Failure retry labels must preserve the target name and must not imply undo or recovery unless the app can actually roll back the operation.
- If the target name is unavailable, the destructive action should be disabled with a reason instead of using an ambiguous screen reader label.

Dense row action contract:

- Icon-only actions in account, sidebar, tag, and article rows need accessible labels that include the row target when the visible control does not.
- Truncated row text must not be the only source of the action target. The full safe display name should be available to assistive technology.
- Tooltip copy can supplement pointer users, but the accessible label or description is the required contract for keyboard and screen reader users.

## Review Checklist

Use this checklist when changing reader keyboard behavior:

- Every arrow-key behavior is owned by exactly one pane-local handler or one documented global fallback.
- `ArrowRight` in the account pane commits the focused account, just like `Enter`.
- Account selection returns focus to the unread smart view, not an incidental previous sidebar row.
- Mobile account switching still uses the popover behavior.
- Sidebar `ArrowLeft` opens the account pane in non-mobile layouts.
- Article list `ArrowLeft` returns to the sidebar.
- Article content `ArrowLeft` returns to the article list.
- Recent smart view navigation keeps history order stable and does not re-record articles while moving through the list.
- Focus styling uses tonal backgrounds for reader navigation controls and does not reintroduce orange rings.
- Destructive dialog labels include target name and undo-unavailable meaning for screen readers.
- Dense row action labels identify the full safe target even when visible text is truncated.
- Tests cover changed key paths at the component or hook level.

## Current Review

The current implementation matches this contract with one caveat: global shortcut handling still lives in `src/hooks/use-keyboard.ts` and can grow broad over time. When adding another pane-specific key, prefer adding a small pane helper next to the owning pane first, then use the global hook only for recovery cases where focus is on `body` or on a stale transient surface.
