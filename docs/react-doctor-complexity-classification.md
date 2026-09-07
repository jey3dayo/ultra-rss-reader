---
type: record
title: React Doctor Complexity Classification
description: Dated triage record classifying the 25 in-scope no-high-complexity-react-function findings from Issue #249, with the structural family and rationale for each.
resource: urn:ultra-rss-reader:docs:react-doctor-complexity-classification
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-08
audience: agent, developer
owner: project-maintainers
---

# React Doctor Complexity Classification

Triage record for the `no-high-complexity-react-function` findings reported by
`pnpm exec react-doctor . --verbose --scope full --json --json-compact --blocking none --no-score --no-dead-code`
(`oxlint-plugin-react-doctor@0.9.13`) on `f9df8be7c`, covering the remainder of Issue #249. The durable
half of this record — the structural families and the method for triaging a new hit — lives in
[../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md). Everything below is a
historical snapshot; do not treat the table as a list of code that still has these shapes.

The scan reported 26 findings. `useAccountDetailViewProps`
(`src/components/settings/hooks/account-detail/use-account-detail-view-props.tsx`, cyclomatic 85,
cognitive 106) is excluded from this record and tracked separately as Issue #256: it is an order of
magnitude above every other finding and needs its own extraction design rather than a classification
row. The 25 rows below are the rest.

## Result

| Classification | Count | Action taken |
| --- | --- | --- |
| must-fix | 0 | — |
| accepted-risk | 25 | Left as-is; each is an intentional single-owner surface whose split is recorded as a net loss below |
| false-positive | 0 | — |
| suppress | 0 | — |

No finding is a bug, a regression, or a warning introduced by a current change. The one finding that
lives on a render hot path (`ArticleListItem`) inverts the rule's own remedy, so it is accepted risk
rather than must-fix; see the hot-path row and the observation at the end of this record.

## How The Rule Fires

`oxlint-plugin-react-doctor@0.9.13` reports when `cyclomatic <= 15 && cognitive <= 15` is false —
both thresholds are 15 and the condition is a disjunction, so a function is reported when *either*
metric exceeds 15. `SidebarNavButton` (cyclomatic 15, cognitive 16) is reported on the cognitive side
alone. The rule is `severity: warn`, tagged `test-noise` and `react-jsx-only`, and its recommendation
is to extract independent render branches and state logic into focused components or hooks.

Which metric dominates, read together with nesting depth, is what separates the families below:

- **Cyclomatic-dominant at nesting 1–2** is a flat fan of independent guards in one return or one
  props object. The branches are siblings, not layers.
- **Cognitive-dominant at nesting 3–4** is nested or sequentially dependent conditionals inside
  derivations, effects, or an empty-state block. The number describes real reading cost.

## Method

Every function was read in full. Each row records the responsibility, which metric fired, where the
complexity comes from, whether the code sits on a render hot path, and whether it has side effects.
A row is `accepted-risk` only when splitting it along the rule's recommendation was checked and found
to make something concretely worse — duplicated accessibility wiring, a visibility contract scattered
across files, a hook that cannot be called conditionally, or more component instances on a hot path.

Rows are grouped into seven families. Membership is by shared *structure and constraint*, never by
shared rule name, shared age, or "not an outlier".

### A. Conditional-surface fan

One return whose complexity is N sibling optional slots and visibility guards describing a single
screen, panel, or card. Extracting each branch yields single-call-site components and moves "what is
visible when" out of the one place a reader looks for it; the guards share the props they read, so
each extracted piece re-receives most of the parent's props.

### B. Shared primitive variant matrix

A shared `src/components/shared` or design-system component whose public API is a matrix of optional
props and placement/tone variants. Splitting by variant duplicates the id derivation, ARIA wiring,
and event plumbing that make the variants behave identically — a correctness risk larger than the
complexity it removes.

### C. Optional-prop capability gate

A settings view where a whole optional feature is enabled by a long conjunction asserting that its
props were all supplied together. The conjunction is one predicate and must be read as a unit; moving
it into a child only relocates the same terms. The real improvement here is a props-shape change
(one optional object instead of N optional props), which is a separate design decision.

### D. Reader selection-union dispatch

Hooks that map the reader selection union (feed / folder / tag / recent / account / smart) onto
queries and view state. The arms are mutually exclusive members of one exhaustive contract, and the
Rules of Hooks require every query to be called unconditionally before one is selected — so the fan
cannot be collapsed, only moved to another hook that still calls all of them. See
[reader-article-scope-matrix.md](./reader-article-scope-matrix.md) for the contract these encode.

### E. Container state-resolution chain

A container whose derivations are sequentially dependent: each step consumes the previous one. These
are not independent branches, so the rule's phrasing does not apply directly; the whole chain is
extractable as one hook, which is the same shape as Issue #256.

### F. Platform window-chrome matrix

Branching on macOS overlay titlebar vs compact desktop vs browser preview, governed by
[../.claude/rules/tauri-window-chrome.md](../.claude/rules/tauri-window-chrome.md). Splitting per
platform triplicates the header content or scatters drag-region placement.

### G. Opt-in diagnostic surface

A dev diagnostic panel that is lazily imported and rendered only when a preference is on. Its
complexity is the diagnostic payload it exists to display.

## Findings

Metrics are cyclomatic / cognitive as reported. `F` is the family above.

| Location | Function | cy | co | F | Classification | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| `src/components/app-layout.tsx:297` | `WideLayout` | 18 | 16 | A | accepted-risk | Resolves which of account/sidebar/list/content panes are mounted and how each animates. The pane-visibility booleans (`sidebarPaneAvailable`, `shouldShowSidebar`, `shouldShowAccountPane`) are derived once and reused across sibling shells; extracting a shell recomputes or re-receives all of them, and the layout invariant stops being readable in one place. |
| `src/components/debug/focus-debug-hud-view.tsx:60` | `FocusDebugHudView` | 24 | 28 | G | accepted-risk | Debug HUD body. Reached only through `lazy()` in `app-shell.tsx` behind `debug_browser_hud === "true"`, so it is out of the default render path entirely. The branches are the diagnostic states it exists to render (expanded, geometry shown, position cycling, trace present); splitting them scatters the HUD's own contract without shrinking shipped work. |
| `src/components/reader/article-list-item.tsx:25` | `ArticleListItem` | 30 | 28 | A | accepted-risk | One article row. All data derivation is already extracted to `resolveArticleListItemPresentation`; the remaining count is `cn()` conditional classes for selection style, active pane, read/starred, and preview size. This is the app's highest-frequency render and the list is not virtualized, so following the recommendation would add component instances per row — the remedy makes the hot path worse. See the observation below for the separate, real hot-path finding here. |
| `src/components/reader/article-list-screen-view.tsx:59` | `ArticleListScreenView` | 18 | 41 | A | accepted-risk | Loading / empty / list screen states as three early returns. Cognitive-dominant at nesting 4 because the empty branch nests `isHiddenEmptyState` / `isSetupEmptyState` / default ternaries inside a passive-card layout ternary. The three empty variants share the same message, description, and action props and must stay visually consistent, so the branch is the empty-state contract itself. This is the strongest extraction candidate in family A if a future change touches it. |
| `src/components/reader/article-toolbar-view.tsx:165` | `ArticleToolbarActionStrip` | 29 | 36 | A | accepted-risk | Toolbar actions under a mobile/wide duality, where each action is gated by a `show*` × `can*` pair and some actions relocate into an overflow menu. The mobile and desktop arms must expose the same action set with the same enablement, which is exactly what reading them side by side checks. |
| `src/components/reader/command-palette-resource-groups.tsx:44` | `CommandPaletteResourceGroups` | 16 | 14 | A | accepted-risk | Cyclomatic-only. Five sibling result groups, each `visible && length > 0`, over a recent/search display-state switch. The groups share `getCommandItemValue` and the recent/filtered selection; splitting each into a component repeats that plumbing five times for one call site each. |
| `src/components/reader/feed-tree-folder-section.tsx:38` | `FeedTreeFolderSection` | 17 | 15 | A | accepted-risk | Cyclomatic-only. A folder row whose optional surfaces are drag-drop overlay, selection indicator, context menu, and trailing unread count, each guarded independently. The drop-target data attributes are spread conditionally onto three different elements from the same `canDragFeeds` flag; splitting risks the three drifting apart. |
| `src/components/reader/folder-select-view.tsx:58` | `FolderSelectView` | 17 | 19 | B | accepted-risk | Same folder field in inline and stacked layouts, with five parallel `compact ? A : B` class picks in the inline arm. Both arms must offer the same select options and the same "new folder" input; the shared option encoding/decoding above the branch is what keeps that true. |
| `src/components/reader/hooks/article-list/use-article-list-sources.ts:89` | `useArticleListSources` | 26 | 29 | D | accepted-risk | Calls eight article queries unconditionally and then selects the primary one from `sourcePlan.sourceKind`, plus eight `useMemo` normalizations keyed on the same union. The Rules of Hooks forbid making the calls conditional, so the arity of the selection union is a floor on the count; an extracted hook would still call all eight. |
| `src/components/reader/hooks/article-list/use-article-list-view-state.ts:5` | `useArticleListViewState` | 17 | 22 | D | accepted-risk | Pure derivation of footer modes, primary-source loading, search loading/empty, and setup empty state. Cognitive-dominant at nesting 4 from two ternary ladders that both walk the same selection union in the same order. Splitting them separates two views of one decision that must stay aligned. |
| `src/components/reader/hooks/article/use-article-view-selection.ts:61` | `useArticleViewSelection` | 24 | 31 | D | accepted-risk | Resolves the article pane into one discriminated state (subscriptions-index / browser-only / empty / loading / not-found / article). The guards are ordered precedence rules — the comment on the by-id fetch documents why list membership must not gate opening — so the sequence is the contract. Nine store selectors and six queries must also be called unconditionally before any of it. |
| `src/components/reader/sidebar-nav-button.tsx:39` | `SidebarNavButton` | 15 | 16 | B | accepted-risk | Cognitive-only, and the clearest example of the disjunctive threshold. Shared sidebar row primitive: nested `selected` × `activePane` × `selectedIndicatorMode` class selection plus a string/node trailing slot. Every sidebar row depends on these states matching, which is why they live in one primitive. |
| `src/components/settings/account-detail/danger-zone-view.tsx:46` | `AccountDangerZoneView` | 28 | 17 | C | accepted-risk | Cyclomatic-dominant with cognitive barely over: `hasLocalSyncControls` is a nine-term conjunction asserting the local-sync props were supplied as a set, on top of import/export busy gating. The conjunction is one capability predicate; extracting the local-sync block moves all nine terms with it. |
| `src/components/settings/account-detail/sync-section-view.tsx:62` | `AccountSyncSectionView` | 18 | 19 | C | accepted-risk | Sync settings section with optional progress, status rows, and three optional action buttons that share one `isSyncing \|\| isDevCredentialsRecoveryInFlight` disabled rule. That shared rule is why the buttons are rendered together. |
| `src/components/settings/add-account/account-config-form.tsx:136` | `AccountConfigForm` | 17 | 17 | E | accepted-risk | The only finding whose complexity is async side-effect control rather than rendering. `isCurrentSubmitSnapshot` is a six-term latest-only guard and the failure path classifies retryable / auth / generic errors. Both are required by [../.claude/rules/async-side-effect-policy.md](../.claude/rules/async-side-effect-policy.md); splitting the guard away from the submit lifecycle weakens the stale-completion contract it exists to enforce. |
| `src/components/settings/data-settings-view.tsx:52` | `DataSettingsView` | 20 | 11 | C | accepted-risk | The most cyclomatic-dominant row (cognitive 11, well under the threshold), which is the signature of a flat guard fan. Four `*ActionUnavailable` booleans are each a four- or five-term disjunction over the same busy flags, deliberately differing in which flags they include. Reading them adjacently is how the differences stay intentional. |
| `src/components/settings/settings-modal.tsx:192` | `SettingsModalContent` | 34 | 38 | E | accepted-risk | Sequential resolution of which account the settings modal shows and whether it is locked: `activeSetupAccountId` → `setupVisibleAccount` → `hasSelectedVisibleAccount` → `resolvedSettingsAccountId` → `selectedVisibleAccount` → `isSetupLocked`, each consuming the previous. Not independent branches. The whole chain is extractable as one hook, which is the same work as Issue #256; doing it here without that design would just move the number. |
| `src/components/shared/app-toast-view.tsx:29` | `AppToastView` | 19 | 16 | A | accepted-risk | Toast surface across fixed/static positioning, three placements, and an update variant, plus optional progress and action rows. Cyclomatic-dominant at nesting 1: the placement and variant class picks are siblings in one `cn()` call, and their mutual exclusivity is only checkable while they are adjacent. |
| `src/components/shared/confirm-dialog-view.tsx:172` | `ConfirmDialogView` | 16 | 16 | B | accepted-risk | Variant tone table plus hold-to-confirm, which is enabled only for the destructive variant and threads `holdEnabled` through five pointer handlers, a data attribute, and two class decisions. Those must all agree; a split that lets them disagree turns a 2s destructive confirmation into a single click. |
| `src/components/shared/feed-detail-panel.tsx:131` | `FeedDetailPanel` | 34 | 35 | A | accepted-risk | Shared feed panel with ten optional slots crossed with a `card` / `low-wire` surface, so most slots contribute two branches — one for presence, one for surface. Extracting slots scatters the low-wire pairing, and a surface change would then have to be applied in every extracted file to stay coherent. |
| `src/components/shared/labeled-input-row.tsx:43` | `LabeledInputRow` | 35 | 36 | B | accepted-risk | Highest non-excluded finding, and entirely an optional-prop matrix: 25 optional props, inline vs inside action placement, icon vs text action, and error text. The `??` defaulting chains and the `aria-errormessage` / `aria-invalid` / `aria-describedby` / generated-id wiring are what make every consumer's row behave the same. Splitting by variant duplicates that accessibility wiring across files. |
| `src/components/shared/tag-color-picker.tsx:19` | `TagColorPicker` | 20 | 20 | B | accepted-risk | WAI-ARIA radiogroup with roving tabindex: Home/End/Arrow traversal, wrap-around, index normalization when the current color is not in the option list, and disabled gating. These are one keyboard contract over one ref array, not independent branches; a `useRovingRadioGroup` extraction is possible but would separate the traversal state from the inputs that own it. |
| `src/components/shared/workspace-header.tsx:93` | `WorkspaceHeader` | 33 | 33 | F | accepted-risk | Three window-chrome modes (macOS overlay, compact desktop, browser preview) decide drag-region placement, eyebrow position, back-button visibility, and vertical rhythm, alongside a content-change motion effect. The two comments in the body record why the drag surfaces are layered the way they are; per-platform splitting triplicates the header content. |
| `src/components/subscriptions-index/subscription-detail-pane.tsx:90` | `SubscriptionDetailPane` | 16 | 20 | A | accepted-risk | Assembles `FeedDetailPanel` props from a nullable row, nullable metrics, and a nullable detail candidate. Nesting 3 is optional chaining inside one props object literal — there is no independent branch to extract, only a shorter way to write the same nullability. |
| `src/components/subscriptions-index/subscriptions-overview-summary.tsx:216` | `SummaryFilterCardButton` | 16 | 15 | A | accepted-risk | Cyclomatic-only, nesting 1. One `summaryCard.isActive` flag threaded through nine sibling nodes (accent bar, badge, motion key, value tone, caption tone, screen-reader hint) plus a review-only tooltip wrapper. Any split still needs the same flag in each piece. |

## Observation Outside This Rule

`ArticleListItem` is not memoized, subscribes to `useUiStore` per row for `focusedPane` even though
the parent can pass `isActivePane`, and renders inside an unvirtualized list. That is a real render
cost on the app's hottest path, but it is not what `no-high-complexity-react-function` reports, and
none of it is fixed by the extraction this rule recommends. It is recorded here so the finding is not
lost, and belongs in its own issue rather than in this classification.
