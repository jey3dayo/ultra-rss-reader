---
type: record
title: Similarity Pair Classification
description: Dated triage record for similarity-ts function and type pairs at threshold 0.9; durable heuristics live in similarity-false-positives.md.
resource: urn:ultra-rss-reader:docs:similarity-pair-classification
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-22
audience: agent, developer
owner: project-maintainers
---

# Similarity Pair Classification

Triage record for `similarity-ts --threshold 0.9 src/` at commit `5a645904fbb896b111a3b1f84f261435cbdad7f0` (includes #327). The durable scan rules live in [../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md); hub-noise heuristics and allowlist limits live in [../.claude/rules/similarity-false-positives.md](../.claude/rules/similarity-false-positives.md). This file is the pair-level inventory those counts must explain.

Each row records **both paths and symbols** so later scans can diff pair sets without relying on symbol names alone.

## Scan contract

| Metric | Count at scanSha | Display baseline in scripts/similarity-report.ts |
| --- | ---: | ---: |
| Function pairs | 38 | 38 |
| Named type pairs | 17 | 17 |
| Type literal pairs | 0 | 0 |
| CSS rules / exact / similar / BEM | 98 / 0 / 8 / 10 | 98 / 0 / 8 / 10 |

Re-pin rule: compare **pair sets** (path + symbol on each side), not totals alone. Rows are not deleted when a pair disappears; mark the row `removed-at-<sha>` in a follow-up edit instead.

### Allowlist entries absent from this scan

Three function allowlist ids did not match any pair at scanSha (scan still lists them as `absent` in the report summary): `article-auto-mark-vs-browser-webview-sync`, `article-auto-mark-vs-browser-overlay-focus-return`, `article-auto-mark-vs-browser-overlay-close`. Keep the ids until a scan omits them long enough to justify removal.

## Function pairs (38)

| Similarity % | Path A | Symbol A | Path B | Symbol B | Classification | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 91.37 | `src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts` | `useFeedTreePointerDragEvents` | `src/components/reader/hooks/sidebar/feed-tree-presence-output.ts` | `buildOutput` | pending | No extraction decision at scanSha |
| 92.70 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/hooks/use-updater.ts` | `useUpdater` | false-positive | allowlist browser-bounds-lifecycle-vs-updater-lifecycle |
| 90.16 | `src/components/reader/hooks/article-list/use-article-list-effects.ts` | `useArticleListEffects` | `src/components/reader/hooks/sidebar/use-sidebar-nav-button-trailing.ts` | `useSidebarNavButtonTrailing` | pending | No extraction decision at scanSha |
| 94.29 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` | `useSidebarAccountSelection` | false-positive | allowlist browser-bounds-lifecycle-vs-sidebar-account-selection |
| 90.00 | `src/components/reader/hooks/article-list/use-article-list-effects.ts` | `useArticleListEffects` | `src/lib/account/add-account-form.ts` | `buildAddAccountPayload` | pending | No extraction decision at scanSha |
| 90.58 | `src/components/settings/hooks/use-scroll-overflow-state.ts` | `useScrollOverflowState` | `src/lib/subscriptions/subscription-review-candidates.ts` | `buildSubscriptionReviewCandidates` | false-positive | allowlist scroll-overflow-state-vs-subscription-review-candidates |
| 91.57 | `src/hooks/use-mouse-navigation.ts` | `useMouseNavigation` | `src/hooks/use-updater.ts` | `useUpdater` | pending | No extraction decision at scanSha |
| 90.75 | `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` | `handleDelete` | `src/hooks/use-updater.ts` | `useUpdater` | pending | No extraction decision at scanSha |
| 94.29 | `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts` | `useBrowserDebugGeometryEvents` | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/hooks/use-mouse-navigation.ts` | `useMouseNavigation` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` | `useBrowserWebviewLoadTimeout` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 90.19 | `src/components/reader/hooks/sidebar/use-sidebar-account-switcher.ts` | `useAccountSwitcherViewModel` | `src/components/settings/hooks/use-scroll-overflow-state.ts` | `useScrollOverflowState` | pending | No extraction decision at scanSha |
| 92.22 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/components/subscriptions-index/hooks/use-subscriptions-index-escape.ts` | `useSubscriptionsIndexEscape` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.86 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` | `handleDelete` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` | `useBrowserOverlayShortcuts` | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 91.22 | `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts` | `useBrowserDebugGeometryEvents` | `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` | `useSidebarAccountSelection` | pending | No extraction decision at scanSha |
| 92.65 | `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` | `useBrowserWebviewLoadTimeout` | `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` | `useSidebarAccountSelection` | pending | No extraction decision at scanSha |
| 90.63 | `src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts` | `useBrowserWebviewBoundsSync` | `src/components/settings/account-detail/query-cache.ts` | `patchCachedAccount` | false-positive | allowlist account-cache-patcher-vs-browser-bounds-lifecycle |
| 92.65 | `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` | `useBrowserOverlayShortcuts` | `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` | `useSidebarAccountSelection` | pending | No extraction decision at scanSha |
| 90.00 | `src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts` | `useSidebarAccountSelection` | `src/components/settings/account-detail/query-cache.ts` | `patchCachedAccount` | pending | No extraction decision at scanSha |
| 93.53 | `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` | `useAccountDetailSyncStatusRows` | `src/lib/subscriptions/subscriptions-index.ts` | `buildSubscriptionListRows` | pending | No extraction decision at scanSha |
| 91.00 | `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts` | `useBrowserDebugGeometryEvents` | `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` | `useBrowserWebviewLoadTimeout` | pending | No extraction decision at scanSha |
| 90.98 | `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` | `useBrowserWebviewLoadTimeout` | `src/hooks/use-mouse-navigation.ts` | `useMouseNavigation` | pending | No extraction decision at scanSha |
| 91.57 | `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts` | `useBrowserWebviewStateChanged` | `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` | `useAccountDetailSyncStatusRows` | pending | No extraction decision at scanSha |
| 91.32 | `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts` | `useBrowserWebviewStateChanged` | `src/lib/subscriptions/subscriptions-index.ts` | `buildSubscriptionListRows` | pending | No extraction decision at scanSha |
| 90.98 | `src/__tests__/hooks/use-browser-webview-sync.node.test.tsx` | `renderBrowserWebviewSync` | `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` | `useAccountDetailSyncStatusRows` | pending | No extraction decision at scanSha |
| 90.75 | `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` | `handleDelete` | `src/hooks/use-mouse-navigation.ts` | `useMouseNavigation` | pending | No extraction decision at scanSha |
| 91.51 | `src/components/reader/hooks/browser/use-browser-webview-load-timeout.ts` | `useBrowserWebviewLoadTimeout` | `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` | `handleDelete` | pending | No extraction decision at scanSha |
| 91.25 | `src/components/subscriptions-index/hooks/use-subscriptions-review-clock.ts` | `useSubscriptionsReviewClock` | `src/dev/use-resolved-dev-intent.ts` | `useResolvedDevIntent` | pending | No extraction decision at scanSha |
| 91.00 | `src/components/reader/hooks/browser/use-browser-debug-geometry-events.ts` | `useBrowserDebugGeometryEvents` | `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` | `useBrowserOverlayShortcuts` | pending | No extraction decision at scanSha |
| 90.98 | `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` | `useBrowserOverlayShortcuts` | `src/hooks/use-mouse-navigation.ts` | `useMouseNavigation` | pending | No extraction decision at scanSha |
| 92.94 | `src/__tests__/config/repo-contracts.node.test.ts` | `typescriptFilesUnder` | `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` | `useAccountDetailSyncStatusRows` | pending | No extraction decision at scanSha |
| 92.15 | `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts` | `resolveAccountDetailSyncWarningDetailLine` | `src/components/settings/hooks/account-detail/use-account-detail-sync-status-rows.ts` | `useAccountDetailSyncStatusRows` | pending | No extraction decision at scanSha |
| 90.45 | `src/components/settings/account-detail/query-cache.ts` | `patchCachedAccount` | `src/components/subscriptions-index/hooks/use-subscriptions-index-escape.ts` | `useSubscriptionsIndexEscape` | pending | No extraction decision at scanSha |
| 90.19 | `src/components/reader/hooks/browser/use-browser-overlay-shortcuts.ts` | `useBrowserOverlayShortcuts` | `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` | `handleDelete` | pending | No extraction decision at scanSha |
| 93.68 | `src/hooks/use-articles.ts` | `useArticles` | `src/hooks/use-articles.ts` | `useAccountArticles` | pending | Track A-4 factory; separate task |
| 90.53 | `src/__tests__/config/repo-contracts.node.test.ts` | `typescriptFilesUnder` | `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts` | `useBrowserWebviewStateChanged` | pending | No extraction decision at scanSha |
| 90.04 | `src/components/reader/hooks/browser/use-browser-webview-state-changed.ts` | `useBrowserWebviewStateChanged` | `src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts` | `resolveAccountDetailSyncWarningDetailLine` | pending | No extraction decision at scanSha |

## Type pairs (17)

Type pairs are recorded here because `similarityFalsePositiveBaseline` cannot match them (parser returns only the function half). See similarity-false-positives.md.

| Similarity % | Path A | Symbol A | Path B | Symbol B | Classification | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 100.00 | `src/dev/prod-stubs/use-resolved-dev-intent.ts` | `ResolvedDevIntentState` | `src/dev/use-resolved-dev-intent.ts` | `ResolvedDevIntentState` | false-positive | vite production alias mirror |
| 96.63 | `src/lib/account/add-account-form.ts` | `AddAccountPayload` | `src/lib/account/add-account-form.ts` | `AddAccountFormState` | false-positive | optional vs required serverUrl contract |
| 95.38 | `src/components/reader/sidebar-sources.types.ts` | `SidebarSourcesParams` | `src/components/reader/hooks/article-list/article-list-controller.types.ts` | `UseArticleListSearchParams` | false-positive | one-consumer hook param types |
| 95.00 | `src/components/reader/hooks/sidebar/feed-tree-presence-state.ts` | `LeavingFeedEntry` | `src/components/reader/hooks/sidebar/feed-tree-presence-state.ts` | `LogicalFeedInfo` | false-positive | intentional frozen vs live view models |
| 94.16 | `src/hooks/create-mutation.ts` | `CreateMutationInvalidationDiagnostics` | `src/lib/query/query-invalidation.ts` | `QueryInvalidationIntentMatrixEntry` | pending | No type-pair allowlist entry; record here |
| 93.82 | `src/components/settings/hooks/restore-reconciliation.ts` | `DatabaseRestoreAccount` | `src/__tests__/hooks/create-mutation.node.test.tsx` | `TestArgs` | pending | No type-pair allowlist entry; record here |
| 93.60 | `src/components/settings/account-detail/sync-section-view.tsx` | `AccountSyncStatusRow` | `src/lib/ui/options.ts` | `OptionWithLabel` | pending | No type-pair allowlist entry; record here |
| 93.48 | `src/components/settings/settings-page.types.ts` | `SettingsPageControlIdentity` | `src/components/settings/hooks/restore-reconciliation.ts` | `DatabaseRestoreAccount` | pending | No type-pair allowlist entry; record here |
| 93.48 | `src/components/settings/settings-page.types.ts` | `SettingsPageControlIdentity` | `src/__tests__/lib/reader-source-articles.node.test.ts` | `Article` | pending | No type-pair allowlist entry; record here |
| 93.45 | `src/components/settings/hooks/restore-reconciliation.ts` | `DatabaseRestoreAccount` | `src/__tests__/lib/reader-source-articles.node.test.ts` | `Article` | pending | No type-pair allowlist entry; record here |
| 93.39 | `src/components/settings/account-detail/sync-section-view.tsx` | `AccountSyncStatusRow` | `src/lib/browser/browser-debug-geometry.ts` | `BrowserDebugGeometryRow` | pending | No type-pair allowlist entry; record here |
| 93.19 | `src/components/settings/settings-page.types.ts` | `SettingsPageControlIdentity` | `src/__tests__/hooks/create-mutation.node.test.tsx` | `TestArgs` | pending | No type-pair allowlist entry; record here |
| 93.11 | `src/__tests__/components/use-feed-article-summaries.node.test.tsx` | `HookProps` | `src/lib/query/query-invalidation.ts` | `InvalidateFeedMutationQueriesOptions` | pending | No type-pair allowlist entry; record here |
| 93.00 | `src/__tests__/hooks/create-mutation.node.test.tsx` | `TestArgs` | `src/__tests__/lib/reader-source-articles.node.test.ts` | `Article` | pending | No type-pair allowlist entry; record here |
| 92.80 | `src/__tests__/hooks/use-sidebar-sync.node.test.ts` | `QueryInvalidationSpy` | `src/__tests__/dev/scenarios/runner.node.test.ts` | `InvocationOrderMock` | pending | No type-pair allowlist entry; record here |
| 92.70 | `src/lib/ui/options.ts` | `OptionWithLabel` | `src/lib/browser/browser-debug-geometry.ts` | `BrowserDebugGeometryRow` | pending | No type-pair allowlist entry; record here |
| 90.88 | `src/components/reader/hooks/article-list/article-list-controller.types.ts` | `ArticleListPresentationSearch` | `src/components/reader/hooks/article-list/article-list-controller.types.ts` | `UseArticleListSearchResult` | pending | No type-pair allowlist entry; record here |

## Measurement Notes

Measured 2026-09-19 at `6e967f4b1`; these are the numbers behind the rules in `similarity-false-positives.md`.

- Hub noise: `similarity-ts --threshold 0.9 src/` reported 40 function pairs. `useBrowserWebviewBoundsSync` appeared in 9 of them, paired with unrelated targets including `patchCachedAccount`, `useSubscriptionsIndexEscape`, and `useAccountDetailSyncStatusRows`; the eight most frequent symbols filled 44 of the 80 pair slots. The no-suppression decision was taken on the same date.
- `createDeferred`: 22 files under `src/__tests__` defined their own copy while 4 imported `tests/helpers/deferred.ts`. `--filter-function createDeferred --threshold 0.9` returned 0 pairs; with `--no-size-penalty` it returned 1478. The 22 copies were removed in commit `1b9bf2bb3`. The first inventory counted 23 files and 26 definitions and both were wrong: the looser pattern `^[[:space:]]*(const|function) createDeferred` also matched `createDeferredCleanup()` in `tauri-event-listeners.node.test.ts` and call sites of the form `const createDeferredResult = createDeferred<...>()`.
