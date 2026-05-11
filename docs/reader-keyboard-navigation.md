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

## Long Article Selection And Search Highlight Contract

Before article-content virtualization is introduced, article content remains a single rendered reading surface. Any future virtualization work must preserve the current reader contracts instead of treating offscreen content as disposable DOM.

Virtualization preconditions:

- Text selection owned by the browser must not be cleared by scroll restoration, article-local re-rendering, image load completion, or background preference updates while the selected article stays the same.
- Find-in-article and search highlights must be anchored to normalized text ranges or stable content nodes, not viewport row indexes. A highlight outside the viewport must be recoverable when the user scrolls to it.
- Reader scroll restoration must use a stable article/content anchor and offset. Restoring by virtual row index is not enough because sanitizer output, image loading, and future content blocks can change layout height.
- Lazy image loading may defer network and layout work, but it must not reorder text, steal focus from article content, or move a restored text/search highlight without a follow-up correction.
- Print, share, and copy-full-article behavior remain future scope. Do not infer that virtualized offscreen DOM is the complete article body for those actions without a separate contract.

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

Dense control keyboard contract:

- Toolbar buttons, feed tree rows, article rows, settings form controls, command palette items, and browser overlay controls must expose a visible `:focus-visible` state without requiring prior hover.
- Keyboard-only operation must reach the same primary actions as pointer operation: pane movement, row selection, article read/star actions, feed/tag selection, settings save/cancel actions, and command palette execution.
- Selected and focused states must remain visually distinct. Selection may show current app context; focus must show the current keyboard operation target.
- Disabled dense controls must remain focus-skipped unless they need to expose a reason. If a disabled control is reachable for explanation, its label or description must include why the action is unavailable.
- Focus styles must not depend on color alone. Pair tone changes with an outline, inset indicator, underline, icon change, or text label when the control carries state.

Pointer target inventory:

| Surface | Minimum target contract | Notes |
| --- | --- | --- |
| Compact toolbar icon buttons | At least 32px square on desktop and 44px square on touch-oriented/mobile layouts. | The visual glyph may be smaller, but the interactive hit area must meet the target. |
| Feed tree and sidebar rows | Full row height is the pointer target; row actions must keep at least a 32px hit area. | Disclosure toggles and inline actions must not require pixel-precise clicks. |
| Tag chips and chip remove actions | The chip body must be at least 32px high; remove affordances must keep at least a 32px target or use the whole chip as the action. | Do not rely on a tiny icon-only remove target inside dense chips. |
| Settings action buttons | At least 32px high in desktop settings rows, with 44px reserved for mobile or touch layouts. | Adjacent buttons need enough gap that the target areas do not overlap. |

Pointer target verification should inventory compact toolbar buttons, feed tree rows, tag chips, settings action buttons, and browser overlay controls together. A smaller visual treatment is acceptable only when padding or row geometry preserves the interactive target.

Dense display width and tooltip policy:

- Feed, folder, account, and tag names created by the user must truncate inside the row content lane. They must not push trailing counts, inline actions, or context controls outside the row.
- Visible name fragments should use bidi-safe display with `dir="auto"` where the value is rendered directly.
- Pointer tooltips or native `title` values may expose the full user-created display name for feed, folder, account, and tag rows. This exception does not apply to URLs, server paths, credentials, debug paths, or other privacy-sensitive values.
- At 200% zoom or text scaling, dense rows may grow vertically when needed, but toolbar buttons, tree rows, tag chips, and settings action buttons must keep distinct hit areas and avoid text overlapping adjacent controls.

## Landmark And Heading Contract

Reader, settings, and subscriptions surfaces need a stable screen reader outline even when the visual layout is pane-based.

| Surface | Required structure |
| --- | --- |
| Reader app shell | One primary `main` landmark owns the active reader workspace. Sidebar navigation uses `nav`; secondary article metadata or feed detail panels use `complementary` only when they are not the primary reading target. |
| Reader panes | Account, sidebar, article list, and article content panes each need a programmatic label. The article content pane must expose the article heading when an article is selected; empty and loading states need labeled status text. |
| Settings | Settings modal/dialog content must have a modal heading. Each settings section needs a heading or an equivalent accessible label tied to its controls. Hidden settings panels must not remain in the screen reader traversal order. |
| Subscriptions index | The subscriptions workspace uses a single page heading, labeled review/list regions, and row/group labels that identify account, feed, folder, or tag context. |

Hidden panes and collapsed sections must not expose duplicate headings or stale row actions to assistive technology. When a pane is visually present but inactive, keep its landmark or region label stable and let focus/selection state explain whether it is the active keyboard target.

## Color And Status Contract

Sync, account, feed, and tag status must never be communicated by color alone.

| State class | Required non-color signal |
| --- | --- |
| Syncing or updating | Text such as "Syncing" / "Updating", a progress label, or an accessible live-region announcement. |
| Sync failure, auth failure, or stale content | Error/warning text or icon with an accessible label. Feed/account names must be included when safe. |
| Selected account, feed, article, or tag | `aria-current`, `aria-selected`, checked/pressed state, or equivalent text/icon treatment in addition to color. |
| Muted, filtered, starred, unread, or tagged state | Icon, text, count, or accessible label that names the state. |
| High contrast or forced-colors mode | State must remain detectable through text, icon shape, border, underline, or system color mapping. |

Color may reinforce severity or selection, but it is secondary evidence. Review dense controls by turning off color-dependent assumptions: if the state cannot be named from text, icon, accessible label, or structural state, the contract is not met.

## Sync And Update Announcement Contract

Sync and update progress announcements must be useful without creating a noisy screen reader queue.

- Announce operation start once per user-visible sync/update operation.
- Do not announce every progress tick. Progress announcements should be throttled to meaningful milestones, phase changes, or a minimum interval.
- Completion and failure must be announced once with the operation class and outcome.
- Cancellation must be announced once when the user cancels or the app suppresses background sync/update work.
- Background sync suppressed by offline, disabled, locked, or already-running state should use one concise announcement or status update, not repeated queue entries.
- Visual progress bars need an accessible name and bounded value when progress is determinate. Indeterminate progress needs a status label instead of fake percentages.
- Toasts and live regions must not duplicate the same message at the same time. Prefer one live-region owner for sync/update progress.

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

## Command And Shortcut Persistence Contract

Action identifiers are public only at the boundary where another surface stores or emits them. Internal helper names, locale keys, and UI component names may change without migration only when they are not persisted or emitted across a runtime boundary.

Public persistence boundary:

| Boundary class | Persistent or external surface | Stable identifier contract |
| --- | --- | --- |
| Preference | Shortcut overrides are stored as `shortcut_${ShortcutActionId}`. The allowed action id suffixes are the `ShortcutActionId` values in `src/lib/keyboard/keyboard-shortcuts.ts`, and Rust preferences accept the same suffix list. | Rename only by keeping the old key readable until a migration copies it to the new key. Unknown `shortcut_*` keys are invalid and must not silently become defaults. |
| History | Command palette recent action history stores values created from `{ kind: "action", id }`. The action id is either an `AppAction` or the palette-only `open-shortcuts-help`. | Rename only by migrating or ignoring old history entries explicitly. Do not persist labels, translated text, or menu ids as history ids. |
| Debug | Debug input trace records resolved action strings such as `window-key / -> emit`, `menu-action open-settings`, and `queue next-article`. | Debug trace strings are diagnostic evidence, not preferences. They may change for clarity, but incident notes must record the exact string observed for that build. |

Keyboard shortcut migration path:

- A renamed customizable shortcut action must keep the old `shortcut_<old_id>` accepted long enough to read existing user preferences.
- Migration must copy the old value to `shortcut_<new_id>` only when the new key is absent, then stop writing the old key.
- The TypeScript `ShortcutActionId` union, `shortcutDefinitions`, frontend schemas, Rust `ALLOWED_SHORTCUT_IDS`, and preference command tests must move together.
- Browser preview shortcut bridge coverage must be updated when the renamed action is one of the bridge-owned keys: `shortcut_close_or_clear`, `shortcut_toggle_read`, `shortcut_toggle_star`, `shortcut_open_external_browser`, `shortcut_next_article`, `shortcut_prev_article`, `shortcut_next_feed`, `shortcut_prev_feed`, or `shortcut_reload_webview`.
- A pure label rename does not require preference migration when the `ShortcutActionId` suffix stays unchanged.

Shortcut help content contract:

- The shortcut help modal is generated from `shortcutDefinitions`, current preference values, platform display formatting, and locale labels.
- Settings shortcut rows are generated from the same `shortcutDefinitions` source.
- A change to shortcut ids, default keys, category order, or displayed labels must update focused snapshots or equivalent contract assertions for:
  - the help modal generated content,
  - the settings shortcut rows,
  - `buildKeyToActionMap` / `resolveKeyboardAction`,
  - locale coverage for every shortcut label and category key.
- Actual bindings are the resolved preference value for each `shortcut_${id}` when present, otherwise the `defaultKey`. Duplicate bindings and native-menu-owned bindings are omitted from the active key map.

Command availability matrix:

| Surface | Source of available ids | Availability gate | Persistence behavior |
| --- | --- | --- | --- |
| Global keyboard | `shortcutDefinitions` plus `resolveKeyboardAction` | Blocks in text editing targets, IME composition, unsupported keys, top-layer UI, missing selected article, non-browser `reload_webview`, and `close_or_clear` with no current close/clear target. | Stores only shortcut override preferences. It does not write command history. |
| Shortcut help | `shortcutDefinitions` | Shows configured/default bindings even when the current runtime state would skip an action. | Reads preferences only. |
| Shortcut settings | `shortcutDefinitions` | Rejects duplicate active bindings and native-menu-owned shortcuts such as `⌘+r`. | Writes `shortcut_${id}` preference keys. |
| Command palette | `useCommandPaletteActions` | Hides or no-ops unavailable account-scoped actions when no account is selected; no-ops `sync-all` while sync is already running; `open-shortcuts-help` is palette-only and bypasses `executeAction`. | Writes command history for executed actions and selected resources. |
| Native menu | Rust `resolve_menu_action` emits `AppAction` strings through `menu-action`. | Native menu availability lives in Rust menu construction. `accounts-sync` owns `CmdOrCtrl+R`; item menu shortcut hints are fixed display labels and do not read user shortcut preferences. | Does not write shortcut preferences or command history. |
| Browser preview shortcut bridge | Rust browser shortcut specs keyed by selected `shortcut_*` preferences. | Only bridge-owned browser preview actions are available inside the native browser overlay. | Reads preferences to build the bridge script; write ownership remains shortcut settings. |

## A11y Baseline Checklist

Use this baseline before changing dialog, popover, keyboard shortcut, focus, or landmark behavior. It intentionally describes outcomes instead of component internals so implementation work can choose the smallest fitting surface.

Top-layer and focus containment:

- Modal dialogs, command surfaces, destructive confirmations, popovers, and embedded browser overlays define which surface is currently topmost.
- `Tab` and `Shift+Tab` stay within the topmost modal surface when focus trapping is expected, and they return to the invoking or stable pane context when it closes.
- `Escape` closes only the current transient surface before falling back to pane navigation or global shortcut behavior.
- Background panes do not expose actionable controls to keyboard or assistive technology while a modal surface owns interaction.

Keyboard and IME handling:

- Global shortcuts are skipped while text input, editable content, composition, or IME candidate selection is active.
- Shortcut handling distinguishes app commands from text editing keys, native menu shortcuts, and browser overlay shortcuts.
- Keyboard-only users can reach the same primary reader, settings, command palette, and overlay actions that pointer users can reach.
- A focused test or manual pass records the event path when behavior depends on composition, platform shortcut ownership, or native WebView behavior.

Landmark, heading, and status structure:

- Reader, settings, subscriptions, and overlay surfaces expose one clear primary landmark or dialog context for the active task.
- Pane, section, empty, loading, and error states have stable programmatic labels without duplicate hidden headings.
- Sync, update, save, delete, and failure states provide non-color status text, structural state, or accessible announcements.
- Live-region or toast announcements avoid duplicate messages for the same operation.

Focus visible and recovery:

- The current keyboard operation target is visible without hover and remains distinct from selected or checked state.
- Focus recovery after close, cancel, save, route change, account switch, or refetch returns to a stable pane target rather than `body`.
- Disabled actions are skipped unless they intentionally expose an unavailable reason.
- Manual verification notes may record surface names and user-visible flows, but should not lock future helper names, file names, or component structure.

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
- Landmark and heading structure is stable for reader, settings, and subscriptions surfaces.
- Keyboard-only operation reaches dense toolbar, tree, list, settings, command palette, and browser overlay actions with visible focus.
- Compact toolbar, tree row, tag chip, and settings action targets meet the pointer target inventory.
- Sync/account/feed/tag states are not color-only and have text, icon, accessible state, or structural state.
- Sync/update progress announcements are throttled and announce start, meaningful progress, completion, failure, cancellation, and suppression without duplicate live-region noise.
- Destructive dialog labels include target name and undo-unavailable meaning for screen readers.
- Dense row action labels identify the full safe target even when visible text is truncated.
- Public shortcut/action ids are classified as preference, history, or debug before renaming.
- Renamed shortcut ids include a read-and-copy migration path for existing `shortcut_<old_id>` preferences.
- Shortcut help generated content and actual bindings stay covered by focused snapshots or equivalent contract assertions.
- Command palette, native menu, global keyboard, shortcut help, shortcut settings, and browser preview availability are checked against the command availability matrix.
- Tests cover changed key paths at the component or hook level.

## Current Review

The current implementation matches this contract with one caveat: global shortcut handling still lives in `src/hooks/use-keyboard.ts` and can grow broad over time. When adding another pane-specific key, prefer adding a small pane helper next to the owning pane first, then use the global hook only for recovery cases where focus is on `body` or on a stale transient surface.
